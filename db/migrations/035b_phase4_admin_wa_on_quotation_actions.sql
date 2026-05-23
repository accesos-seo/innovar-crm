-- ============================================================================
-- 035b_phase4_admin_wa_on_quotation_actions.sql
-- Fase 4 · Slice 2.5 — Cierra gap: WhatsApp al admin cuando cliente
--   acepta / pide ajustes / rechaza la cotización pública.
--
-- Hoy (post 035) los triggers fn_notify_quotation_acceptance y
-- fn_notify_quotation_rejection solo encolan notif in-app al admin.
-- Esta migración agrega `PERFORM public.fn_wa_enqueue_for_profile(...)`
-- al final de cada función, replicando el patrón ya usado en
-- request_quotation_reactivation (migración 034).
--
-- Templates Meta requeridos (a aprobar por Felipe — mientras tanto los
-- rows en notification_queue quedan en status='failed', cuando aprueben
-- pueden re-encolarse a 'pending'):
--   - admin_quotation_accepted_v1     (vars: admin, cliente, cot_number)
--   - admin_quotation_adjustments_v1  (vars: admin, cliente, cot_number, reason)
--   - admin_quotation_rejected_v1     (vars: admin, cliente, cot_number, reason)
--
-- Idempotente (CREATE OR REPLACE). Aplicar vía Management API.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. fn_notify_quotation_acceptance — agrega WA al admin
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

    -- WhatsApp al admin (template a aprobar en Meta — mientras tanto queda failed)
    PERFORM public.fn_wa_enqueue_for_profile(
      v_admin.id,
      'quotation_accepted',
      'wa_quotation_accepted',
      'quotation',
      NEW.id,
      'admin_quotation_accepted_v1',
      jsonb_build_array(
        COALESCE(v_admin.full_name, 'Equipo'),
        COALESCE(v_client.name, 'Cliente'),
        COALESCE(NEW.quotation_number, '?')
      ),
      jsonb_build_object('quotation_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 2. fn_notify_quotation_rejection — agrega WA al admin (ajustes o rechazo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notify_quotation_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_admin  public.profiles%ROWTYPE;
  v_title  TEXT;
  v_wa_template TEXT;
  v_wa_event TEXT;
  v_wa_pref TEXT;
  v_reason_text TEXT;
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

    -- Determinar template / event_type / pref_key según subtipo
    IF NEW.client_rejection_subtype = 'adjustments_requested' THEN
      v_wa_template := 'admin_quotation_adjustments_v1';
      v_wa_event    := 'quotation_adjustments_requested';
      v_wa_pref     := 'wa_quotation_adjustments';
    ELSE
      v_wa_template := 'admin_quotation_rejected_v1';
      v_wa_event    := 'quotation_rejected';
      v_wa_pref     := 'wa_quotation_rejected';
    END IF;

    v_reason_text := COALESCE(NEW.client_rejection_reason, '(sin comentarios)');

    -- WhatsApp al admin (template a aprobar en Meta — mientras tanto queda failed)
    PERFORM public.fn_wa_enqueue_for_profile(
      v_admin.id,
      v_wa_event,
      v_wa_pref,
      'quotation',
      NEW.id,
      v_wa_template,
      jsonb_build_array(
        COALESCE(v_admin.full_name, 'Equipo'),
        COALESCE(v_client.name, 'Cliente'),
        COALESCE(NEW.quotation_number, '?'),
        v_reason_text
      ),
      jsonb_build_object(
        'quotation_id', NEW.id,
        'rejection_subtype', NEW.client_rejection_subtype
      )
    );
  END IF;

  RETURN NEW;
END $$;

DO $$ BEGIN RAISE NOTICE 'Migración 035b OK — WA al admin en accept/adjustments/rejected'; END $$;
