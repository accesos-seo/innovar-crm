-- ============================================================================
-- 035a_phase4_quotation_short_code.sql
-- Fase 4 · Slice 2.5 — URL corta para cotizaciones
--
-- Replica el patrón de la 019 (opportunities.short_code) sobre `quotations`
-- para que el cliente pueda compartir URLs cortas tipo `/c/A3X9Q2` en vez
-- del token de 32 chars.
--
-- Idempotente. Aplicar vía Management API.
-- ============================================================================

-- 1. ALTER TABLE: agregar `short_code` UNIQUE
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_quotations_short_code
  ON public.quotations(short_code)
  WHERE short_code IS NOT NULL AND deleted_at IS NULL;

-- 2. Generador de códigos base62 únicos (independiente del de opportunities
--    para no acoplar las dos tablas — colisiones cross-tabla son OK)
CREATE OR REPLACE FUNCTION public.generate_unique_quotation_short_code()
RETURNS TEXT AS $$
DECLARE
  -- 56 chars: omitimos 0, O, o, 1, l, I, i — confusos en texto.
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_code     TEXT;
  v_attempts INT  := 0;
  v_exists   BOOLEAN;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substring(v_alphabet, 1 + floor(random() * length(v_alphabet))::INT, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.quotations WHERE short_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'No se pudo generar un quotation short_code único tras 50 intentos';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. Trigger BEFORE INSERT que pobla short_code
CREATE OR REPLACE FUNCTION public.assign_quotation_short_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_unique_quotation_short_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_quotation_short_code ON public.quotations;
CREATE TRIGGER trg_assign_quotation_short_code
  BEFORE INSERT ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_quotation_short_code();

-- 4. Backfill rows existentes (incluso soft-deleted: el código no estorba)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.quotations WHERE short_code IS NULL LOOP
    UPDATE public.quotations
       SET short_code = public.generate_unique_quotation_short_code()
     WHERE id = r.id;
  END LOOP;
END $$;

-- 5. RPC pública: resolve_quotation_short_code(code) → public_token
--    El frontend hace /c/:code → llama RPC → redirige a /cotizacion/<token>.
CREATE OR REPLACE FUNCTION public.resolve_quotation_short_code(p_code TEXT)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT public_token INTO v_token
    FROM public.quotations
   WHERE short_code = p_code
     AND deleted_at IS NULL
   LIMIT 1;
  RETURN v_token; -- NULL si no existe o está borrada
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.resolve_quotation_short_code(TEXT) TO anon, authenticated;

-- 6. Re-CREATE get_public_quotation para que devuelva `short_code` también
--    (idéntico a 034 + esta línea nueva)
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

  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE public_token = p_token AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

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

  UPDATE public.quotations
  SET view_count = view_count + 1,
      viewed_at = COALESCE(viewed_at, now()),
      updated_at = now()
  WHERE id = v_quotation.id;

  v_quotation.view_count := v_quotation.view_count + 1;
  v_quotation.viewed_at := COALESCE(v_quotation.viewed_at, now());

  v_is_expired := v_quotation.status = 'expired'::quotation_status
               OR (v_quotation.valid_until IS NOT NULL AND v_quotation.valid_until < now());

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

  SELECT jsonb_build_object('name', c.name)
  INTO v_client
  FROM public.clients c
  WHERE c.id = v_quotation.client_id;

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
    'short_code',             v_quotation.short_code,  -- ⬅ NUEVO en 035a
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

-- 7. Re-CREATE send_quotation_to_client para que el WA use /c/<short_code>
--    (idéntico a 035 + cambio de URL en el template)
CREATE OR REPLACE FUNCTION public.send_quotation_to_client(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation public.quotations%ROWTYPE;
  v_client    public.clients%ROWTYPE;
  v_role      user_role;
  v_template  TEXT;
  v_base_url  TEXT;
  v_link      TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin'::user_role, 'super_admin'::user_role, 'comercial'::user_role) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quotation FROM public.quotations
    WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.status <> 'draft'::quotation_status THEN
    RAISE EXCEPTION 'only_drafts_can_be_sent' USING DETAIL = format('status=%s', v_quotation.status), ERRCODE = '22023';
  END IF;

  IF v_quotation.quotation_number IS NULL THEN
    UPDATE public.quotations
      SET quotation_number = public.generate_next_quotation_number(),
          updated_at = now()
      WHERE id = p_quotation_id;
  END IF;

  UPDATE public.quotations
    SET status = 'sent'::quotation_status, updated_at = now()
    WHERE id = p_quotation_id;

  SELECT * INTO v_quotation FROM public.quotations WHERE id = p_quotation_id;
  SELECT * INTO v_client FROM public.clients WHERE id = v_quotation.client_id;

  v_template := CASE
    WHEN COALESCE(v_quotation.version_number, 1) > 1 THEN 'quotation_v2_sent_v1'
    ELSE 'quotation_sent_v1'
  END;

  -- Base URL configurable vía system_settings (default Vercel prod)
  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );
  -- ⬅ NUEVO en 035a: usa /c/<short_code> en vez de /cotizacion/<public_token>
  v_link := v_base_url || '/c/' || COALESCE(v_quotation.short_code, v_quotation.public_token);

  IF v_client.whatsapp_phone IS NOT NULL AND v_client.whatsapp_phone <> '' THEN
    PERFORM public.enqueue_notification(
      'quotation_sent',
      v_quotation.id::text,
      'quotation',
      v_quotation.id::text,
      'client',
      v_client.id::text,
      v_client.name,
      v_client.whatsapp_phone,
      v_template,
      'es',
      jsonb_build_array(
        v_client.name,
        COALESCE(v_quotation.quotation_number, '?'),
        v_link
      ),
      jsonb_build_object(
        'quotation_id', v_quotation.id,
        'public_token', v_quotation.public_token,
        'short_code',   v_quotation.short_code
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'quotation_id', v_quotation.id,
    'public_token', v_quotation.public_token,
    'short_code',   v_quotation.short_code,
    'valid_until',  v_quotation.valid_until,
    'link',         v_link
  );
END $$;

DO $$ BEGIN RAISE NOTICE 'Migración 035a OK — short_code para quotations + URL corta /c/:code'; END $$;
