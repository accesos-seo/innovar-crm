-- =====================================================
-- 045 — WA reactivación de leads sin agenda (cron diario)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: si un lead lleva > 3 días en estado new/contacted sin
-- haber agendado visita, reenviarle el link de agendamiento por WA.
-- Solo se envía una vez por semana por lead (dedup por 7 días).
--
-- Template: booking_link_v1 (ya aprobado en Meta, 4 sent históricos)
--   {{1}} = primer nombre cliente
--   {{2}} = URL de agendamiento /v/{short_code}
--   {{3}} = nombre del comercial asignado
--
-- Cron: diario a las 9:00 AM COT (14:00 UTC) — mismo horario que otros crons
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_wa_lead_reactivation_scan()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  r           RECORD;
  v_count     INTEGER := 0;
  v_first_name TEXT;
  v_base_url   TEXT;
  v_public_url TEXT;
  v_staff_name TEXT;
BEGIN
  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );

  FOR r IN
    SELECT
      o.id,
      o.short_code,
      o.assigned_to,
      o.stage,
      c.id          AS client_id,
      c.name        AS client_name,
      c.whatsapp_phone
    FROM public.opportunities o
    JOIN public.clients c ON c.id = o.client_id
    WHERE
      -- Lead en etapa temprana sin visita aún
      o.stage IN ('new', 'contacted')
      -- Más de 3 días desde que entró
      AND o.created_at < NOW() - INTERVAL '3 days'
      -- Sin visita futura pendiente
      AND NOT EXISTS (
        SELECT 1 FROM public.visits v
        WHERE v.opportunity_id = o.id
          AND v.scheduled_at > NOW()
          AND v.deleted_at IS NULL
          AND v.status NOT IN ('cancelled')
      )
      -- Sin reactivación en los últimos 7 días (evita spam)
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_queue nq
        WHERE nq.event_type = 'lead.reactivation'
          AND nq.event_reference_id = o.id::text
          AND nq.created_at > NOW() - INTERVAL '7 days'
      )
      -- Solo leads con teléfono válido
      AND c.whatsapp_phone IS NOT NULL
      AND length(trim(c.whatsapp_phone)) >= 10
      -- Short code disponible para armar el link
      AND o.short_code IS NOT NULL
      -- No está perdido ni convertido
      AND o.deleted_at IS NULL
  LOOP
    v_first_name := split_part(COALESCE(r.client_name, 'Cliente'), ' ', 1);
    v_public_url := v_base_url || '/v/' || r.short_code;

    SELECT full_name INTO v_staff_name
      FROM public.profiles
     WHERE id = r.assigned_to;

    -- Guard redundante: re-verifica antes del INSERT para proteger contra
    -- doble ejecución del cron dentro del mismo minuto (race condition).
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notification_queue nq
      WHERE nq.event_type = 'lead.reactivation'
        AND nq.event_reference_id = r.id::text
        AND nq.created_at > NOW() - INTERVAL '7 days'
    );

    INSERT INTO public.notification_queue (
      event_type, event_reference_id,
      entity_type, entity_reference_id,
      recipient_type, recipient_reference_id,
      recipient_name, recipient_phone,
      template_name, template_language, template_parameters,
      status
    ) VALUES (
      'lead.reactivation',
      r.id::text,
      'opportunity',
      r.id::text,
      'client',
      r.client_id::text,
      v_first_name,
      r.whatsapp_phone,
      'booking_link_v1',
      'es',
      jsonb_build_object(
        '1', v_first_name,
        '2', v_public_url,
        '3', COALESCE(v_staff_name, 'nuestro equipo')
      ),
      'pending'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Registrar cron job: diario 9am COT (14:00 UTC)
SELECT cron.schedule(
  'wa-lead-reactivation-daily',
  '0 14 * * *',
  'SELECT public.fn_wa_lead_reactivation_scan();'
);

-- =====================================================
-- ROLLBACK
-- =====================================================
-- SELECT cron.unschedule('wa-lead-reactivation-daily');
-- DROP FUNCTION IF EXISTS public.fn_wa_lead_reactivation_scan();
-- =====================================================
