-- ============================================================================
-- 034_phase4_public_quotation_rpcs.sql
-- Fase 4 · Slice 2 — RPCs públicas: ver, aceptar, rechazar, reactivar
-- Idempotente (CREATE OR REPLACE). Aplicar vía Management API.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_public_quotation(p_token)
--    Devuelve cotización + items + flags útiles para la URL pública.
--    Si el token apunta a una versión histórica, devuelve redirect_to_token.
--    Incrementa view_count y setea viewed_at en la primera apertura.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_quotation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation        public.quotations%ROWTYPE;
  v_latest_token     TEXT;
  v_items            JSONB;
  v_client           JSONB;
  v_bank             JSONB;
  v_is_expired       BOOLEAN;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = '22023';
  END IF;

  -- Buscar la cotización por token
  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE public_token = p_token
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Si es una versión histórica, redirigir al token de la versión vigente
  IF v_quotation.is_historical_copy = true THEN
    SELECT public_token INTO v_latest_token
    FROM public.quotations
    WHERE (parent_quotation_id = v_quotation.parent_quotation_id
           OR id = v_quotation.parent_quotation_id
           OR parent_quotation_id = v_quotation.id)
      AND is_historical_copy = false
      AND deleted_at IS NULL
    ORDER BY version_number DESC NULLS LAST, created_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'redirect_to_token', v_latest_token,
      'reason', 'newer_version_available'
    );
  END IF;

  -- Incrementar view_count + setear viewed_at si es la primera vez
  UPDATE public.quotations
  SET view_count = view_count + 1,
      viewed_at = COALESCE(viewed_at, now()),
      updated_at = now()
  WHERE id = v_quotation.id;

  -- Refrescar el row con los valores actualizados
  v_quotation.view_count := v_quotation.view_count + 1;
  v_quotation.viewed_at := COALESCE(v_quotation.viewed_at, now());

  -- Calcular si está expirada
  v_is_expired := v_quotation.status = 'expired'::quotation_status
               OR (v_quotation.valid_until IS NOT NULL AND v_quotation.valid_until < now());

  -- Items (siempre incluidos)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'description', i.description,
      'quantity', i.quantity,
      'unit_price', i.unit_price,
      'product_category', i.product_category,
      'configuration', i.configuration
    ) ORDER BY i.created_at
  ), '[]'::jsonb)
  INTO v_items
  FROM public.quotation_items i
  WHERE i.quotation_id = v_quotation.id;

  -- Info del cliente (parcial — solo nombre)
  SELECT jsonb_build_object('name', c.name)
  INTO v_client
  FROM public.clients c
  WHERE c.id = v_quotation.client_id;

  -- Datos bancarios — solo si el cliente ya aceptó (es decir, los necesita para pagar)
  IF v_quotation.status IN ('client_approved'::quotation_status, 'pending_payment_verification'::quotation_status, 'approved'::quotation_status) THEN
    SELECT jsonb_build_object(
      'bank_name',           public.get_bank_setting('bank_name'),
      'bank_account_number', public.get_bank_setting('bank_account_number'),
      'bank_account_type',   public.get_bank_setting('bank_account_type'),
      'bank_holder_name',    public.get_bank_setting('bank_holder_name'),
      'bank_holder_id',      public.get_bank_setting('bank_holder_id'),
      'nequi_phone',         public.get_bank_setting('nequi_phone'),
      'daviplata_phone',     public.get_bank_setting('daviplata_phone')
    ) INTO v_bank;
  ELSE
    v_bank := NULL;
  END IF;

  RETURN jsonb_build_object(
    'id',                     v_quotation.id,
    'quotation_number',       v_quotation.quotation_number,
    'version_number',         v_quotation.version_number,
    'parent_quotation_id',    v_quotation.parent_quotation_id,
    'status',                 v_quotation.status,
    'subtotal',               v_quotation.subtotal,
    'discount_type',          v_quotation.discount_type,
    'discount_value',         v_quotation.discount_value,
    'transport_cost',         v_quotation.transport_cost,
    'total_amount',           v_quotation.total_amount,
    'valid_until',            v_quotation.valid_until,
    'notes',                  v_quotation.notes,
    'view_count',             v_quotation.view_count,
    'viewed_at',              v_quotation.viewed_at,
    'client_approved_at',     v_quotation.client_approved_at,
    'client_rejected_at',     v_quotation.client_rejected_at,
    'is_expired',             v_is_expired,
    'pdf_url_available',      v_quotation.status = 'approved'::quotation_status,
    'client',                 v_client,
    'items',                  v_items,
    'bank',                   v_bank
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_quotation(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_quotation(TEXT) IS 'RPC pública: lee cotización por token, incrementa view_count, redirige si es versión histórica (Fase 4 D7).';

-- ---------------------------------------------------------------------------
-- 2. accept_public_quotation(p_token, p_note)
--    Cliente acepta la cotización entera (D1 todo-o-nada).
--    Trigger en migración 035 dispara WhatsApp con bank info + notif al admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_public_quotation(p_token TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation public.quotations%ROWTYPE;
BEGIN
  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE public_token = p_token AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.is_historical_copy = true THEN
    RAISE EXCEPTION 'historical_version_cannot_be_accepted' USING ERRCODE = '22023';
  END IF;

  IF v_quotation.status <> 'sent'::quotation_status THEN
    RAISE EXCEPTION 'invalid_state_for_acceptance' USING DETAIL = format('status=%s', v_quotation.status), ERRCODE = '22023';
  END IF;

  IF v_quotation.valid_until IS NOT NULL AND v_quotation.valid_until < now() THEN
    RAISE EXCEPTION 'quotation_expired' USING ERRCODE = '22023';
  END IF;

  UPDATE public.quotations
  SET status = 'client_approved'::quotation_status,
      client_approved_at = now(),
      client_acceptance_note = NULLIF(trim(p_note), ''),
      updated_at = now()
  WHERE id = v_quotation.id;

  RETURN jsonb_build_object(
    'ok', true,
    'quotation_id', v_quotation.id,
    'next_step', 'upload_payment_proof'
  );
END $$;

GRANT EXECUTE ON FUNCTION public.accept_public_quotation(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.accept_public_quotation(TEXT, TEXT) IS 'RPC pública: cliente acepta cotización (Fase 4 D1, D2). Setea status=client_approved.';

-- ---------------------------------------------------------------------------
-- 3. reject_public_quotation(p_token, p_subtype, p_reason)
--    Cliente rechaza o pide ajustes (D5).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_public_quotation(
  p_token   TEXT,
  p_subtype TEXT,
  p_reason  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation public.quotations%ROWTYPE;
BEGIN
  IF p_subtype NOT IN ('adjustments_requested','declined') THEN
    RAISE EXCEPTION 'invalid_rejection_subtype' USING ERRCODE = '22023';
  END IF;

  -- adjustments_requested exige razón explicando qué ajustes
  IF p_subtype = 'adjustments_requested' AND COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason_required_for_adjustments' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE public_token = p_token AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.status <> 'sent'::quotation_status THEN
    RAISE EXCEPTION 'invalid_state_for_rejection' USING DETAIL = format('status=%s', v_quotation.status), ERRCODE = '22023';
  END IF;

  IF v_quotation.valid_until IS NOT NULL AND v_quotation.valid_until < now() THEN
    RAISE EXCEPTION 'quotation_expired' USING ERRCODE = '22023';
  END IF;

  UPDATE public.quotations
  SET status = 'rejected'::quotation_status,
      client_rejected_at = now(),
      client_rejection_subtype = p_subtype,
      client_rejection_reason = NULLIF(trim(p_reason), ''),
      updated_at = now()
  WHERE id = v_quotation.id;

  RETURN jsonb_build_object(
    'ok', true,
    'quotation_id', v_quotation.id,
    'subtype', p_subtype
  );
END $$;

GRANT EXECUTE ON FUNCTION public.reject_public_quotation(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.reject_public_quotation(TEXT, TEXT, TEXT) IS 'RPC pública: cliente rechaza (declined) o pide ajustes (adjustments_requested) (Fase 4 D5).';

-- ---------------------------------------------------------------------------
-- 4. request_quotation_reactivation(p_token)
--    Cliente con link expirado pide nueva cotización (D4).
--    No cambia el estado. Solo encola WhatsApp al admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_quotation_reactivation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation public.quotations%ROWTYPE;
  v_client    public.clients%ROWTYPE;
  v_admin     public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE public_token = p_token AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.status <> 'expired'::quotation_status
     AND (v_quotation.valid_until IS NULL OR v_quotation.valid_until > now()) THEN
    RAISE EXCEPTION 'quotation_not_expired_yet' USING ERRCODE = '22023';
  END IF;

  -- Buscar info del cliente
  SELECT * INTO v_client FROM public.clients WHERE id = v_quotation.client_id;

  -- Notificar al primer admin activo (idealmente Alvaro = default_visitor)
  SELECT * INTO v_admin
  FROM public.profiles
  WHERE role = 'admin'::user_role AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_admin.id IS NOT NULL THEN
    -- In-app notif (insert directo en public.notifications; enqueue_notification es solo WhatsApp)
    INSERT INTO public.notifications (
      user_id, title, body, notification_type, related_table, related_id, action_url
    ) VALUES (
      v_admin.id,
      'Cliente pidió reactivación',
      format('%s pidió reactivar su cotización N° %s', COALESCE(v_client.name,'Cliente'), COALESCE(v_quotation.quotation_number,'?')),
      'quotation_reactivation_requested',
      'quotations',
      v_quotation.id,
      format('/cotizaciones/%s', v_quotation.id)
    );

    -- WhatsApp al admin (template a aprobar en Meta — mientras tanto, queda failed)
    PERFORM public.fn_wa_enqueue_for_profile(
      v_admin.id,
      'quotation_reactivation_requested',
      'wa_quotation_reactivation',
      'quotation',
      v_quotation.id,
      'quotation_reactivation_admin_v1',
      jsonb_build_array(
        v_admin.full_name,
        COALESCE(v_client.name, 'Cliente'),
        COALESCE(v_quotation.quotation_number, '?')
      ),
      jsonb_build_object('quotation_id', v_quotation.id)
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.request_quotation_reactivation(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.request_quotation_reactivation(TEXT) IS 'RPC pública: cliente con cotización vencida pide reactivación (Fase 4 D4).';

DO $$ BEGIN RAISE NOTICE 'Migración 034 OK — 4 RPCs públicas creadas'; END $$;
