-- ============================================================================
-- 036_phase4_payment_flow.sql
-- Fase 4 · Slice 3 — Subida de comprobante (pública) + verificación (admin)
-- Idempotente (CREATE OR REPLACE). Aplicar vía Management API.
--
-- REUSA el trigger existente convert_quotation_to_project (verificado 2026-05-23)
-- que ya crea project + bloquea quotation + mueve opp + liga payment al firmar
-- payments.verification_status='verified'. Esta migración solo agrega:
--   - RPC pública para que el cliente suba comprobante
--   - RPC admin para verificar
--   - Asignación de designer post-creación de project
--   - clients.first_project_at fill
--   - WA al cliente + al designer asignado
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. submit_quotation_payment_proof — RPC pública del cliente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_quotation_payment_proof(
  p_token        TEXT,
  p_amount       NUMERIC,
  p_method       TEXT,        -- mapea a payment_method enum
  p_proof_url    TEXT,
  p_notes        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation public.quotations%ROWTYPE;
  v_payment_id UUID;
  v_admin public.profiles%ROWTYPE;
  v_below BOOLEAN;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF p_method IS NULL OR p_method = '' THEN
    RAISE EXCEPTION 'method_required' USING ERRCODE = '22023';
  END IF;

  IF p_proof_url IS NULL OR p_proof_url = '' THEN
    RAISE EXCEPTION 'proof_url_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quotation
  FROM public.quotations
  WHERE public_token = p_token AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.status NOT IN ('client_approved'::quotation_status, 'pending_payment_verification'::quotation_status) THEN
    RAISE EXCEPTION 'invalid_state_for_payment' USING DETAIL = format('status=%s', v_quotation.status), ERRCODE = '22023';
  END IF;

  IF v_quotation.valid_until IS NOT NULL AND v_quotation.valid_until < now() THEN
    RAISE EXCEPTION 'quotation_expired' USING ERRCODE = '22023';
  END IF;

  -- below_suggested: marca interna si el cliente pagó menos del 30% sugerido (D8.3)
  v_below := (p_amount < COALESCE(v_quotation.total_amount, 0) * 0.30);

  -- Insertar el pago en estado pending
  INSERT INTO public.payments (
    quotation_id, client_id, amount, payment_method, payment_type,
    proof_url, verification_status, below_suggested, received_at, notes
  ) VALUES (
    v_quotation.id,
    v_quotation.client_id,
    p_amount,
    p_method::payment_method,
    'advance',
    p_proof_url,
    'pending',
    v_below,
    now(),
    p_notes
  )
  RETURNING id INTO v_payment_id;

  -- Mover cotización a pending_payment_verification (si aún no estaba)
  UPDATE public.quotations
    SET status = 'pending_payment_verification'::quotation_status, updated_at = now()
    WHERE id = v_quotation.id
      AND status = 'client_approved'::quotation_status;

  -- Notif in-app al admin (cola de pagos pendientes)
  SELECT * INTO v_admin FROM public.profiles
    WHERE role = 'admin'::user_role AND is_active = true
    ORDER BY created_at LIMIT 1;

  IF v_admin.id IS NOT NULL THEN
    PERFORM public.enqueue_notification(
      'payment_proof_uploaded',
      v_payment_id::text,
      'payment',
      v_payment_id::text,
      'profile',
      v_admin.id::text,
      v_admin.full_name,
      COALESCE(v_admin.whatsapp_phone, ''),
      NULL, 'es', '[]'::jsonb,
      jsonb_build_object(
        'title', CASE WHEN v_below THEN 'Comprobante (¡bajo el sugerido!)' ELSE 'Nuevo comprobante por verificar' END,
        'body', format('Cotización %s · $%s COP · %s',
                       COALESCE(v_quotation.quotation_number,'?'),
                       to_char(p_amount, 'FM999G999G999'),
                       p_method),
        'action_url', '/admin/pagos-pendientes'
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'below_suggested', v_below);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_quotation_payment_proof(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_quotation_payment_proof(TEXT, NUMERIC, TEXT, TEXT, TEXT) IS 'RPC pública: cliente sube comprobante (Fase 4 D8.2, D8.3).';

-- ---------------------------------------------------------------------------
-- 2. verify_payment — RPC admin que confirma el comprobante
--    Dispara el trigger existente convert_quotation_to_project, que crea
--    project + bloquea quotation + mueve opp + notifica admins.
--    Después: asigna designer + first_project_at + WA al cliente + WA al designer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_payment(
  p_payment_id  UUID,
  p_designer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     user_role;
  v_uid      UUID;
  v_payment  public.payments%ROWTYPE;
  v_quot     public.quotations%ROWTYPE;
  v_client   public.clients%ROWTYPE;
  v_project_id UUID;
  v_designer public.profiles%ROWTYPE;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  v_uid := auth.uid();

  -- Si pasaron designer_id, validar que sea un diseñador activo
  IF p_designer_id IS NOT NULL THEN
    SELECT * INTO v_designer FROM public.profiles
      WHERE id = p_designer_id AND role = 'diseno'::user_role AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_designer_id' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'payment_already_processed' USING DETAIL = format('status=%s', v_payment.verification_status), ERRCODE = '22023';
  END IF;

  IF v_payment.quotation_id IS NULL THEN
    RAISE EXCEPTION 'payment_not_linked_to_quotation' USING ERRCODE = '22023';
  END IF;

  -- UPDATE que dispara el trigger convert_quotation_to_project
  UPDATE public.payments
    SET verification_status = 'verified',
        verified_by = v_uid,
        verified_at = now()
    WHERE id = p_payment_id;

  -- Re-leer payment para obtener project_id (el trigger lo seteó)
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  v_project_id := v_payment.project_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_not_created_by_trigger' USING HINT = 'Revisar trigger convert_quotation_to_project', ERRCODE = 'P0002';
  END IF;

  -- Re-leer quotation y cliente
  SELECT * INTO v_quot FROM public.quotations WHERE id = v_payment.quotation_id;
  SELECT * INTO v_client FROM public.clients WHERE id = v_quot.client_id;

  -- Asignar designer al proyecto (si vino en el param)
  IF p_designer_id IS NOT NULL THEN
    UPDATE public.projects
      SET designer_id = p_designer_id, updated_at = now()
      WHERE id = v_project_id;
  END IF;

  -- Marcar first_project_at en clients si era NULL (D3.3)
  UPDATE public.clients
    SET first_project_at = COALESCE(first_project_at, now()), updated_at = now()
    WHERE id = v_quot.client_id;

  -- WhatsApp al cliente: pago confirmado
  IF v_client.whatsapp_phone IS NOT NULL AND v_client.whatsapp_phone <> '' THEN
    PERFORM public.enqueue_notification(
      'payment_verified',
      v_payment.id::text,
      'payment',
      v_payment.id::text,
      'client',
      v_client.id::text,
      v_client.name,
      v_client.whatsapp_phone,
      'payment_received_v1',
      'es',
      jsonb_build_array(v_client.name),
      jsonb_build_object('quotation_id', v_quot.id, 'project_id', v_project_id)
    );
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs ("userId", "userName", action, "tableName", "recordId", "changesSummary", "timestamp")
  SELECT v_uid,
         COALESCE((SELECT full_name FROM public.profiles WHERE id = v_uid), 'unknown'),
         'payment_verified',
         'payments',
         v_payment.id::text,
         format('verified amount=%s; project=%s; designer=%s', v_payment.amount, v_project_id, COALESCE(p_designer_id::text, 'NULL'))
       , now();

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment.id,
    'project_id', v_project_id,
    'designer_id', p_designer_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.verify_payment(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.verify_payment(UUID, UUID) IS 'Admin verifica comprobante + asigna designer + dispara cascada (Fase 4 D3.1, D8.4).';

-- ---------------------------------------------------------------------------
-- 3. fn_notify_designer_on_project_assignment TRIGGER (D3.4)
--    Cuando projects.designer_id se setea o cambia → notif in-app + WhatsApp.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_designer_on_project_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_designer public.profiles%ROWTYPE;
  v_client_name TEXT;
BEGIN
  IF NEW.designer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.designer_id IS NOT DISTINCT FROM NEW.designer_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_designer FROM public.profiles WHERE id = NEW.designer_id;
  IF NOT FOUND OR v_designer.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = NEW.client_id;

  -- In-app
  PERFORM public.enqueue_notification(
    'project_assigned',
    NEW.id::text,
    'project',
    NEW.id::text,
    'profile',
    v_designer.id::text,
    v_designer.full_name,
    COALESCE(v_designer.whatsapp_phone, ''),
    NULL, 'es', '[]'::jsonb,
    jsonb_build_object(
      'title', 'Nuevo proyecto asignado',
      'body', format('%s · Cliente: %s', NEW.name, COALESCE(v_client_name,'?')),
      'action_url', format('/projects/%s', NEW.id)
    )
  );

  -- WhatsApp al designer
  IF v_designer.whatsapp_phone IS NOT NULL AND v_designer.whatsapp_phone <> '' THEN
    PERFORM public.fn_wa_enqueue_for_profile(
      v_designer.id,
      'project_assigned_designer',
      'wa_project_assigned',
      'project',
      NEW.id,
      'project_assigned_designer_v1',
      jsonb_build_array(
        v_designer.full_name,
        COALESCE(v_client_name, 'Cliente'),
        format('https://innovar.app/projects/%s', NEW.id)
      ),
      jsonb_build_object('project_id', NEW.id, 'client_id', NEW.client_id)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_designer_on_project_assignment ON public.projects;
CREATE TRIGGER trg_notify_designer_on_project_assignment
  AFTER INSERT OR UPDATE OF designer_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_designer_on_project_assignment();

DO $$ BEGIN RAISE NOTICE 'Migración 036 OK — submit/verify payment RPCs + designer assignment trigger'; END $$;
