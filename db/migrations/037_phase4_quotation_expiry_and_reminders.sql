-- ============================================================================
-- 037_phase4_quotation_expiry_and_reminders.sql
-- Fase 4 · Slice 4 — Expiración automática + recordatorio 3d antes de vencer
-- Idempotente. Aplicar vía Management API.
--
-- MVP (D9.1): UN solo recordatorio a 3 días de vencer + aviso al admin al expirar.
-- Estados activos donde aplica: 'sent', 'client_approved', 'pending_payment_verification'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. expire_quotations_scan — marca expiradas + notif al admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_quotations_scan()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quot RECORD;
  v_admin public.profiles%ROWTYPE;
  v_count INT := 0;
  v_client_name TEXT;
BEGIN
  SELECT * INTO v_admin FROM public.profiles
    WHERE role = 'admin'::user_role AND is_active = true
    ORDER BY created_at LIMIT 1;

  FOR v_quot IN
    SELECT q.id, q.quotation_number, q.client_id, q.opportunity_id, q.status, q.valid_until
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.valid_until IS NOT NULL
      AND q.valid_until < now()
      AND q.status IN ('sent'::quotation_status,
                       'client_approved'::quotation_status,
                       'pending_payment_verification'::quotation_status)
  LOOP
    UPDATE public.quotations
      SET status = 'expired'::quotation_status, updated_at = now()
      WHERE id = v_quot.id;

    v_count := v_count + 1;

    -- Notif in-app al admin
    IF v_admin.id IS NOT NULL THEN
      SELECT c.name INTO v_client_name FROM public.clients c WHERE c.id = v_quot.client_id;
      PERFORM public.enqueue_notification(
        'quotation_expired',
        v_quot.id::text,
        'quotation',
        v_quot.id::text,
        'profile',
        v_admin.id::text,
        v_admin.full_name,
        COALESCE(v_admin.whatsapp_phone, ''),
        NULL, 'es', '[]'::jsonb,
        jsonb_build_object(
          'title', 'Cotización expirada sin acción',
          'body', format('%s · %s', COALESCE(v_client_name,'?'), COALESCE(v_quot.quotation_number,'?')),
          'action_url', format('/cotizaciones/%s', v_quot.id)
        )
      );
    END IF;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.expire_quotations_scan() TO authenticated;

COMMENT ON FUNCTION public.expire_quotations_scan() IS 'Marca cotizaciones vencidas como expired + notifica al admin (Fase 4 D9, cron diario).';

-- ---------------------------------------------------------------------------
-- 2. enqueue_quotation_reminders_3d — WhatsApp 3d antes de vencer
--    Idempotente vía dedup_key.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_quotation_reminders_3d()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quot RECORD;
  v_client public.clients%ROWTYPE;
  v_count INT := 0;
  v_dedup TEXT;
  v_template TEXT;
BEGIN
  FOR v_quot IN
    SELECT q.id, q.quotation_number, q.client_id, q.status, q.valid_until, q.public_token
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.is_historical_copy = false
      AND q.valid_until IS NOT NULL
      AND q.valid_until BETWEEN now() + INTERVAL '2 days 12 hours' AND now() + INTERVAL '3 days 12 hours'
      AND q.status IN ('sent'::quotation_status, 'client_approved'::quotation_status)
  LOOP
    SELECT * INTO v_client FROM public.clients WHERE id = v_quot.client_id;
    CONTINUE WHEN v_client.whatsapp_phone IS NULL OR v_client.whatsapp_phone = '';

    -- Template diferenciado según el estado actual
    v_template := CASE v_quot.status
      WHEN 'sent'::quotation_status            THEN 'quotation_reminder_3d_client_v1'
      WHEN 'client_approved'::quotation_status THEN 'payment_reminder_3d_client_v1'
    END;

    -- dedup_key: una sola vez por cotización por día
    v_dedup := format('quot-reminder-%s-%s-%s', v_quot.id, v_template, to_char(now(), 'YYYY-MM-DD'));

    -- Solo encolar si no existe ya un row con este dedup_key en estado no-terminal
    IF NOT EXISTS (
      SELECT 1 FROM public.notification_queue
      WHERE dedup_key = v_dedup
        AND status IN ('pending','processing','sent','delivered','read')
    ) THEN
      INSERT INTO public.notification_queue (
        event_type, event_reference_id, entity_type, entity_reference_id,
        recipient_type, recipient_reference_id, recipient_name, recipient_phone,
        channel, provider, template_name, template_language, template_parameters,
        payload, status, dedup_key, created_at, updated_at
      ) VALUES (
        'quotation_reminder_3d',
        v_quot.id::text,
        'quotation',
        v_quot.id::text,
        'client',
        v_client.id::text,
        v_client.name,
        v_client.whatsapp_phone,
        'whatsapp',
        'meta_whatsapp',
        v_template,
        'es',
        jsonb_build_array(
          v_client.name,
          COALESCE(v_quot.quotation_number,'?'),
          to_char(v_quot.valid_until AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY'),
          format('https://innovar.app/cotizacion/%s', v_quot.public_token)
        ),
        jsonb_build_object('quotation_id', v_quot.id),
        'pending',
        v_dedup,
        now(),
        now()
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.enqueue_quotation_reminders_3d() TO authenticated;

COMMENT ON FUNCTION public.enqueue_quotation_reminders_3d() IS 'Encola WhatsApp recordatorio 3d antes de vencer (Fase 4 D9 MVP).';

-- ---------------------------------------------------------------------------
-- 3. Crons (pg_cron)
--    - 14:00 UTC = 09:00 Colombia (horario aceptable para WhatsApp comercial)
--    - 14:05 UTC = expiry scan separado para evitar long-running locks
-- ---------------------------------------------------------------------------

-- Eliminar versiones previas si existen
SELECT cron.unschedule('wa-quotation-reminders-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='wa-quotation-reminders-daily');
SELECT cron.unschedule('wa-quotation-expiry-scan-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='wa-quotation-expiry-scan-daily');

SELECT cron.schedule(
  'wa-quotation-reminders-daily',
  '0 14 * * *',
  $$ SELECT public.enqueue_quotation_reminders_3d(); $$
);

SELECT cron.schedule(
  'wa-quotation-expiry-scan-daily',
  '5 14 * * *',
  $$ SELECT public.expire_quotations_scan(); $$
);

DO $$ BEGIN RAISE NOTICE 'Migración 037 OK — expiry scan + reminders 3d + 2 crons'; END $$;
