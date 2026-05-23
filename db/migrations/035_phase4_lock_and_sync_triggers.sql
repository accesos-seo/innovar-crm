-- ============================================================================
-- 035_phase4_lock_and_sync_triggers.sql
-- Fase 4 · Slice 2 — Lock al enviar + sync opp + notif acceptance/rejection
-- Idempotente (CREATE OR REPLACE). Aplicar vía Management API.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. send_quotation_to_client(p_quotation_id) RPC
--    Admin/comercial mueve la cotización de draft → sent.
--    Dispara el trigger de lock + el WhatsApp con el link al cliente.
-- ---------------------------------------------------------------------------
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

  -- Asegurar quotation_number
  IF v_quotation.quotation_number IS NULL THEN
    UPDATE public.quotations
      SET quotation_number = public.generate_next_quotation_number(),
          updated_at = now()
      WHERE id = p_quotation_id;
  END IF;

  -- Mover a sent (esto activa el trigger lock_quotation_on_sent)
  UPDATE public.quotations
    SET status = 'sent'::quotation_status, updated_at = now()
    WHERE id = p_quotation_id;

  -- Re-leer post-update para obtener quotation_number y valid_until
  SELECT * INTO v_quotation FROM public.quotations WHERE id = p_quotation_id;

  -- Cliente
  SELECT * INTO v_client FROM public.clients WHERE id = v_quotation.client_id;

  -- Template diferenciado: V2+ usa template "v2" (D6.4)
  v_template := CASE
    WHEN COALESCE(v_quotation.version_number, 1) > 1 THEN 'quotation_v2_sent_v1'
    ELSE 'quotation_sent_v1'
  END;

  -- Encolar WhatsApp al cliente
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
        format('https://innovar.app/cotizacion/%s', v_quotation.public_token)
      ),
      jsonb_build_object('quotation_id', v_quotation.id, 'public_token', v_quotation.public_token)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'quotation_id', v_quotation.id,
    'public_token', v_quotation.public_token,
    'valid_until', v_quotation.valid_until
  );
END $$;

GRANT EXECUTE ON FUNCTION public.send_quotation_to_client(UUID) TO authenticated;

COMMENT ON FUNCTION public.send_quotation_to_client(UUID) IS 'Mueve cotización de draft a sent + encola WhatsApp con el link al cliente (Fase 4 D6.4, D10).';

-- ---------------------------------------------------------------------------
-- 2. lock_quotation_on_sent TRIGGER (D10.1)
--    Al pasar a sent: setea is_locked=true y valid_until +30d si NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_lock_quotation_on_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'sent'::quotation_status
     AND (OLD.status IS NULL OR OLD.status <> 'sent'::quotation_status) THEN
    NEW.is_locked := true;
    IF NEW.valid_until IS NULL THEN
      NEW.valid_until := now() + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lock_quotation_on_sent ON public.quotations;
CREATE TRIGGER trg_lock_quotation_on_sent
  BEFORE UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_quotation_on_sent();

-- ---------------------------------------------------------------------------
-- 3. unlock_quotation(p_quotation_id, p_change_reason) RPC (D10.2)
--    Solo admin/super_admin. Exige change_reason. Loggea a audit_logs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_quotation(p_quotation_id UUID, p_change_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_uid  UUID;
  v_uname TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(trim(p_change_reason), '') = '' THEN
    RAISE EXCEPTION 'change_reason_required' USING ERRCODE = '22023';
  END IF;

  v_uid := auth.uid();
  SELECT full_name INTO v_uname FROM public.profiles WHERE id = v_uid;

  UPDATE public.quotations
    SET is_locked = false,
        change_reason = p_change_reason,
        updated_at = now()
    WHERE id = p_quotation_id
      AND is_locked = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quotation_not_locked_or_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs ("userId", "userName", action, "tableName", "recordId", "changesSummary", "timestamp")
  VALUES (v_uid, COALESCE(v_uname, 'unknown'), 'quotation_unlocked', 'quotations', p_quotation_id::text, p_change_reason, now());

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.unlock_quotation(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.unlock_quotation(UUID, TEXT) IS 'Admin desbloquea cotización enviada con razón obligatoria + audit (Fase 4 D10.2).';

-- ---------------------------------------------------------------------------
-- 4. sync_opportunity_status_from_quotation TRIGGER
--    Mapea quotation.status → opportunity.status para mantener consistencia.
--    Solo sincroniza forward-progressing transitions; rejected/expired no
--    auto-marcan la opp como lost (decisión manual del admin).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_opportunity_from_quotation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_opp_status TEXT;
BEGIN
  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_new_opp_status := CASE NEW.status
    WHEN 'sent'::quotation_status                          THEN 'sent_to_client'
    WHEN 'client_approved'::quotation_status               THEN 'client_approved'
    WHEN 'pending_payment_verification'::quotation_status  THEN 'pending_payment_verification'
    WHEN 'approved'::quotation_status                      THEN 'approved'
    ELSE NULL  -- rejected, expired, draft: no sync automático
  END;

  IF v_new_opp_status IS NOT NULL THEN
    UPDATE public.opportunities
      SET status = v_new_opp_status, updated_at = now(), last_activity_at = now()
      WHERE id = NEW.opportunity_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_opportunity_from_quotation ON public.quotations;
CREATE TRIGGER trg_sync_opportunity_from_quotation
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_opportunity_from_quotation();

-- ---------------------------------------------------------------------------
-- 5. notify_quotation_acceptance TRIGGER (D2, D8)
--    Al pasar a client_approved: WA al cliente con bank info + notif al admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_admin  public.profiles%ROWTYPE;
  v_advance_suggested NUMERIC;
BEGIN
  IF NEW.status <> 'client_approved'::quotation_status
     OR OLD.status = 'client_approved'::quotation_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;
  SELECT * INTO v_admin FROM public.profiles
    WHERE role = 'admin'::user_role AND is_active = true
    ORDER BY created_at LIMIT 1;

  v_advance_suggested := round(COALESCE(NEW.total_amount, 0) * 0.30);

  -- WhatsApp al cliente con datos bancarios
  IF v_client.whatsapp_phone IS NOT NULL AND v_client.whatsapp_phone <> '' THEN
    PERFORM public.enqueue_notification(
      'quotation_payment_request',
      NEW.id::text,
      'quotation',
      NEW.id::text,
      'client',
      v_client.id::text,
      v_client.name,
      v_client.whatsapp_phone,
      'payment_request_v1',
      'es',
      jsonb_build_array(
        v_client.name,
        public.get_bank_setting('bank_name'),
        public.get_bank_setting('bank_account_number'),
        public.get_bank_setting('bank_holder_name'),
        format('$%s COP', to_char(v_advance_suggested, 'FM999G999G999'))
      ),
      jsonb_build_object('quotation_id', NEW.id, 'public_token', NEW.public_token, 'advance_suggested', v_advance_suggested)
    );
  END IF;

  -- Notif in-app al admin (insert directo en public.notifications; enqueue_notification es solo WhatsApp)
  IF v_admin.id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, title, body, notification_type, related_table, related_id, action_url
    ) VALUES (
      v_admin.id,
      'Cliente aceptó cotización',
      format('%s aceptó la cotización N° %s', COALESCE(v_client.name,'Cliente'), COALESCE(NEW.quotation_number,'?')),
      'quotation_accepted',
      'quotations',
      NEW.id,
      format('/cotizaciones/%s', NEW.id)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_quotation_acceptance ON public.quotations;
CREATE TRIGGER trg_notify_quotation_acceptance
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_quotation_acceptance();

-- ---------------------------------------------------------------------------
-- 6. notify_quotation_rejection TRIGGER (D5)
--    Notif al admin con el feedback del cliente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_admin  public.profiles%ROWTYPE;
  v_title  TEXT;
BEGIN
  IF NEW.status <> 'rejected'::quotation_status
     OR OLD.status = 'rejected'::quotation_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;
  SELECT * INTO v_admin FROM public.profiles
    WHERE role = 'admin'::user_role AND is_active = true
    ORDER BY created_at LIMIT 1;

  v_title := CASE NEW.client_rejection_subtype
    WHEN 'adjustments_requested' THEN 'Cliente pidió ajustes'
    WHEN 'declined' THEN 'Cliente rechazó cotización'
    ELSE 'Cotización rechazada'
  END;

  IF v_admin.id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, title, body, notification_type, related_table, related_id, action_url
    ) VALUES (
      v_admin.id,
      v_title,
      format('%s · %s · "%s"',
        COALESCE(v_client.name,'Cliente'),
        COALESCE(NEW.quotation_number,'?'),
        COALESCE(NEW.client_rejection_reason, '(sin comentarios)')),
      CASE NEW.client_rejection_subtype
        WHEN 'adjustments_requested' THEN 'quotation_adjustments_requested'
        ELSE 'quotation_rejected'
      END,
      'quotations',
      NEW.id,
      format('/cotizaciones/%s', NEW.id)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_quotation_rejection ON public.quotations;
CREATE TRIGGER trg_notify_quotation_rejection
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_quotation_rejection();

-- ---------------------------------------------------------------------------
-- 7. log_quotation_status_changes TRIGGER
--    Audit log de TODAS las transiciones de status.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_log_quotation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_uname TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_uname FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.audit_logs ("userId", "userName", action, "tableName", "recordId", "changesSummary", "timestamp")
  VALUES (
    v_uid,
    COALESCE(v_uname, CASE WHEN v_uid IS NULL THEN 'public_or_system' ELSE 'unknown' END),
    'quotation_status_changed',
    'quotations',
    NEW.id::text,
    format('%s → %s', OLD.status, NEW.status),
    now()
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_quotation_status_change ON public.quotations;
CREATE TRIGGER trg_log_quotation_status_change
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_quotation_status_change();

DO $$ BEGIN RAISE NOTICE 'Migración 035 OK — lock + sync + 4 triggers + unlock RPC + send RPC'; END $$;
