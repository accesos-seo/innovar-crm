-- =============================================================================
-- 037e_fix_slice3_register_manual.sql
-- Fase 4 · Slice 3 — Fix #6 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 6 — register_manual_payment (mig 037 línea ~980) inserta payment con
-- verification_status='verified' (el trigger convert_quotation_to_project se
-- dispara y crea project sin designer) y LUEGO llama a verify_payment() para
-- asignar designer + encolar WA. Pero verify_payment hace
-- `IF v_payment.verification_status='verified' THEN RAISE already_verified` y
-- explota porque el payment YA es verified.
--
-- Fix: en register_manual_payment, asignar designer + encolar WA + notif inline
-- (mismo código que verify_payment líneas 724-773), sin la indirección a
-- verify_payment.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.register_manual_payment(
  p_quotation_id  UUID,
  p_amount        NUMERIC,
  p_method        TEXT,
  p_payment_type  TEXT DEFAULT NULL,
  p_designer_id   UUID DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        public.user_role;
  v_quot        public.quotations%ROWTYPE;
  v_payment_id  UUID;
  v_project_id  UUID;
  v_below       BOOLEAN := false;
  v_designer    public.profiles%ROWTYPE;
  v_client      public.clients%ROWTYPE;
  v_project_name TEXT;
  v_final_type  TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT public.get_feature_flag('slice_3_enabled') THEN
    RAISE EXCEPTION 'slice_3_disabled' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF p_method IS NULL OR p_method NOT IN ('efectivo','cheque','transferencia','nequi','daviplata','pse','credito') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;
  IF v_quot.id IS NULL THEN
    RAISE EXCEPTION 'quotation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quot.status NOT IN ('client_approved'::quotation_status,
                           'pending_payment_verification'::quotation_status,
                           'approved'::quotation_status) THEN
    RAISE EXCEPTION 'invalid_state_for_manual_payment' USING ERRCODE = '22023',
      DETAIL = format('status=%s', v_quot.status);
  END IF;

  v_below := (p_amount < (v_quot.total_amount * public.get_suggested_advance_pct() / 100));
  v_final_type := COALESCE(p_payment_type,
    CASE WHEN v_quot.status = 'approved'::quotation_status THEN 'installment' ELSE 'advance' END);

  IF v_final_type NOT IN ('advance','installment','final','refund') THEN
    RAISE EXCEPTION 'invalid_payment_type' USING ERRCODE = '22023';
  END IF;

  -- Validate designer if passed.
  IF p_designer_id IS NOT NULL THEN
    SELECT * INTO v_designer FROM public.profiles
    WHERE id = p_designer_id AND is_active = true AND role = 'diseno'::user_role;
    IF v_designer.id IS NULL THEN
      RAISE EXCEPTION 'invalid_designer' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Insert payment directly as verified. Trigger convert_quotation_to_project
  -- creates project if first payment. The trigger sets NEW.project_id.
  INSERT INTO public.payments (
    quotation_id, client_id, project_id,
    amount, payment_method,
    payment_type,
    verification_status, payment_source,
    below_suggested,
    registered_by, verified_by, verified_at,
    notes, received_at
  )
  VALUES (
    v_quot.id, v_quot.client_id,
    (SELECT id FROM public.projects WHERE approved_quotation_id = v_quot.id AND deleted_at IS NULL LIMIT 1),
    p_amount,
    p_method::public.payment_method,
    v_final_type,
    'verified', 'admin_manual',
    v_below,
    auth.uid(), auth.uid(), now(),
    NULLIF(trim(p_notes), ''), now()
  )
  RETURNING id, project_id INTO v_payment_id, v_project_id;

  -- If designer + project exist: assign designer + notify (mismo flujo que verify_payment).
  IF p_designer_id IS NOT NULL AND v_project_id IS NOT NULL THEN
    UPDATE public.projects
    SET designer_id = p_designer_id,
        updated_at  = now()
    WHERE id = v_project_id
      AND (designer_id IS NULL OR designer_id <> p_designer_id);

    SELECT * INTO v_client FROM public.clients
    WHERE id = (SELECT client_id FROM public.projects WHERE id = v_project_id);

    SELECT name INTO v_project_name FROM public.projects WHERE id = v_project_id;

    IF v_designer.whatsapp_phone IS NOT NULL AND trim(v_designer.whatsapp_phone) <> '' THEN
      INSERT INTO public.notification_queue (
        event_type, event_reference_id,
        entity_type, entity_reference_id,
        recipient_type, recipient_reference_id, recipient_name, recipient_phone,
        channel, provider,
        template_name, template_language, template_parameters,
        payload, dedup_key
      )
      VALUES (
        'project.designer_assigned', v_project_id::text,
        'project',                    v_project_id::text,
        'designer', v_designer.id::text, split_part(v_designer.full_name, ' ', 1), v_designer.whatsapp_phone,
        'whatsapp', 'meta_whatsapp',
        'project_assigned_designer_v1', 'es',
        jsonb_build_array(
          COALESCE(split_part(v_designer.full_name, ' ', 1), 'Equipo'),
          COALESCE(v_client.name, 'Cliente'),
          format('/proyectos/%s', v_project_id)
        ),
        jsonb_build_object('project_id', v_project_id, 'designer_id', v_designer.id),
        'project_assigned:' || v_project_id::text || ':' || v_designer.id::text
      )
      ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url, priority)
    VALUES (
      v_designer.id,
      'Te asignaron un proyecto',
      format('Te asignaron el proyecto «%s».', COALESCE(v_project_name, 'sin nombre')),
      'project_assigned', 'projects', v_project_id,
      format('/proyectos/%s', v_project_id), 2
    );
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs ("userId","userName",action,"tableName","recordId","changesSummary","timestamp")
  SELECT auth.uid(),
         (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
         'payment_registered_manual', 'payments', v_payment_id::text,
         format('amount=%s method=%s type=%s designer=%s',
                p_amount, p_method, v_final_type,
                COALESCE(p_designer_id::text,'none')),
         now();

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'project_id', v_project_id,
    'designer_id', p_designer_id
  );
END $$;

REVOKE ALL ON FUNCTION public.register_manual_payment(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_manual_payment(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) TO authenticated;

COMMIT;

-- =============================================================================
-- END 037e_fix_slice3_register_manual.sql
-- =============================================================================
