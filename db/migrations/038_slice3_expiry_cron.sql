-- =============================================================================
-- 038_slice3_expiry_cron.sql
-- Fase 4 · Slice 3 — Cron diario de expiración de cotizaciones aceptadas sin pago
-- =============================================================================
--
-- Decisión D4: cron diario marca `expired` toda cotización en client_approved
-- o pending_payment_verification con client_approved_at < now() - payment_window_days.
-- Encola WA `admin_quotation_expired_v1` al admin (mínimo crítico, ver D12).
-- Respeta feature flag `slice_3_enabled` (sale temprano si OFF).
-- Dedup_key por (quotation_id, día YYYY-MM-DD) evita doble notif si cron corre 2x.
--
-- Cron horario: 14:30 UTC = 09:30 Colombia.
-- El cron existente `wa-quotation-expiry-3d-daily` corre a 14:00 UTC, así que
-- 14:30 evita colisión.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) FUNCTION — expire_accepted_quotations_scan()
-- =============================================================================

CREATE OR REPLACE FUNCTION public.expire_accepted_quotations_scan()
RETURNS TABLE (expired_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_days INT;
  v_quot        RECORD;
  v_admin       RECORD;
  v_count       INT := 0;
  v_dedup_key   TEXT;
  v_days_diff   INT;
BEGIN
  -- Respetar feature flag.
  IF NOT public.get_feature_flag('slice_3_enabled') THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  -- Leer ventana configurable (default 7).
  SELECT COALESCE((value::text)::int, 7) INTO v_window_days
  FROM public.system_settings WHERE key = 'payment_window_days';
  IF v_window_days IS NULL OR v_window_days < 1 THEN
    v_window_days := 7;
  END IF;

  -- Iterar cotizaciones expirables.
  FOR v_quot IN
    SELECT q.id, q.client_id, q.opportunity_id, q.quotation_number,
           q.client_approved_at,
           EXTRACT(DAY FROM (now() - q.client_approved_at))::int AS days_since
    FROM public.quotations q
    WHERE q.status IN ('client_approved'::quotation_status,
                       'pending_payment_verification'::quotation_status)
      AND q.client_approved_at IS NOT NULL
      AND q.client_approved_at < now() - make_interval(days => v_window_days)
      AND q.deleted_at IS NULL
  LOOP
    -- Mover a expired (trigger fn_quotation_invalidate_short_code limpiará short_code).
    UPDATE public.quotations
    SET status = 'expired'::quotation_status,
        updated_at = now()
    WHERE id = v_quot.id;

    v_count := v_count + 1;
    v_days_diff := v_quot.days_since;

    -- Notif in-app a admins.
    INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url, priority)
    SELECT p.id,
           'Cotización expiró sin pago',
           format('La cotización N° %s expiró tras %s días aceptada sin pago verificado.',
                  COALESCE(v_quot.quotation_number, '?'), v_days_diff),
           'quotation_expired_payment', 'quotations', v_quot.id,
           format('/pagos?action=reactivate&id=%s', v_quot.id), 1
    FROM public.profiles p
    WHERE p.role IN ('admin'::user_role, 'super_admin'::user_role) AND p.is_active = true;

    -- Encolar WA al primer admin activo (mínimo crítico D12).
    FOR v_admin IN
      SELECT id, full_name, whatsapp_phone
      FROM public.profiles
      WHERE role IN ('admin'::user_role, 'super_admin'::user_role)
        AND is_active = true
        AND whatsapp_phone IS NOT NULL AND trim(whatsapp_phone) <> ''
      ORDER BY created_at
      LIMIT 1
    LOOP
      v_dedup_key := format('quotation_expired:%s:%s', v_quot.id, to_char(now(), 'YYYY-MM-DD'));

      INSERT INTO public.notification_queue (
        event_type, event_reference_id, entity_type, entity_reference_id,
        recipient_type, recipient_reference_id, recipient_name, recipient_phone,
        channel, provider,
        template_name, template_language, template_parameters,
        payload, dedup_key
      )
      VALUES (
        'quotation.expired_payment', v_quot.id::text,
        'quotation',                  v_quot.id::text,
        'admin', v_admin.id::text, COALESCE(split_part(v_admin.full_name, ' ', 1), 'Equipo'), v_admin.whatsapp_phone,
        'whatsapp', 'meta_whatsapp',
        'admin_quotation_expired_v1', 'es',
        jsonb_build_array(
          COALESCE(split_part(v_admin.full_name, ' ', 1), 'Equipo'),
          (SELECT name FROM public.clients WHERE id = v_quot.client_id),
          COALESCE(v_quot.quotation_number, '?'),
          v_days_diff::text
        ),
        jsonb_build_object('quotation_id', v_quot.id, 'days_since', v_days_diff),
        v_dedup_key
      )
      ON CONFLICT (dedup_key) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_count;
END $$;

REVOKE ALL ON FUNCTION public.expire_accepted_quotations_scan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_accepted_quotations_scan() TO authenticated;

-- =============================================================================
-- 2) CRON JOB — slice3-expire-accepted-quotations-daily (14:30 UTC daily)
-- =============================================================================
-- Idempotente: unschedule por jobname antes de re-schedule.

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'slice3-expire-accepted-quotations-daily';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'slice3-expire-accepted-quotations-daily',
    '30 14 * * *',
    $cron$ SELECT public.expire_accepted_quotations_scan(); $cron$
  );
END $$;

COMMIT;

-- =============================================================================
-- END 038_slice3_expiry_cron.sql
-- =============================================================================
