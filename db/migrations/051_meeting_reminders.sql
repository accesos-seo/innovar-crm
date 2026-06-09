-- =====================================================
-- 051 — Recordatorios automáticos de reuniones
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: enviar WhatsApp al director de la empresa
-- un día antes y 2 horas antes de cada reunión quincenal
-- (jun–nov 2026).
--
-- Arquitectura:
--   1. Se agrega `scheduled_for` a notification_queue para
--      despacho diferido — la EF solo procesa filas cuyo
--      scheduled_for ya llegó (o es NULL).
--   2. Se registra la clave meeting_reminder_recipient_phone
--      en system_settings (fuente de verdad del teléfono).
--   3. fn_schedule_meeting_reminders() encola las 22 filas
--      (11 reuniones × 2 recordatorios), idempotente via dedup_key.
--   4. Un workflow n8n llama la función semanalmente.
--
-- Templates Meta requeridas (PENDING APPROVAL):
--   - reunion_recordatorio_24h_v1  — {{1}}=nombre
--   - reunion_recordatorio_2h_v1   — {{1}}=nombre, {{2}}=hora
--
-- Activación:
--   - wa_test_phone_override en system_settings redirige TODO
--     a Robert durante QA. El director NO recibirá mensajes
--     hasta que se elimine ese override.
-- =====================================================

-- ─────────────────────────────────────────────────────
-- PASO 1: agregar scheduled_for a notification_queue
-- ─────────────────────────────────────────────────────
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notification_queue_scheduled_idx
  ON public.notification_queue (scheduled_for, status)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────
-- PASO 2: registrar receptor en system_settings
-- El teléfono vive en la BD, no en el código.
-- ─────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
  VALUES (
    'meeting_reminder_recipient_name',
    to_jsonb('Álvaro Ríos'::text)
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;

INSERT INTO public.system_settings (key, value)
  VALUES (
    'meeting_reminder_recipient_phone',
    to_jsonb('3002826317'::text)   -- 10 dígitos Colombia; la EF agrega el prefijo 57
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;

-- ─────────────────────────────────────────────────────
-- PASO 3: función que encola recordatorios
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_schedule_meeting_reminders(
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- Calendario derivado de src/lib/reuniones.ts.
  -- 2026-06-09 (i=0) se omite — ya pasó.
  -- Todas las reuniones son a las 23:00 UTC (6:00 PM Colombia).
  v_meetings timestamptz[] := ARRAY[
    '2026-06-25T23:00:00Z'::timestamptz,
    '2026-07-09T23:00:00Z'::timestamptz,
    '2026-07-23T23:00:00Z'::timestamptz,
    '2026-08-06T23:00:00Z'::timestamptz,
    '2026-08-20T23:00:00Z'::timestamptz,
    '2026-09-03T23:00:00Z'::timestamptz,
    '2026-09-17T23:00:00Z'::timestamptz,
    '2026-10-01T23:00:00Z'::timestamptz,
    '2026-10-15T23:00:00Z'::timestamptz,
    '2026-10-29T23:00:00Z'::timestamptz,
    '2026-11-12T23:00:00Z'::timestamptz
  ];

  v_recipient_phone  text;
  v_recipient_name   text;
  v_meeting_date     text;
  v_meeting          timestamptz;
  v_queued_24h       integer := 0;
  v_queued_2h        integer := 0;
  v_skipped          integer := 0;
BEGIN
  -- Leer receptor desde system_settings (no hardcodeado)
  SELECT value::text INTO v_recipient_phone
    FROM public.system_settings
   WHERE key = 'meeting_reminder_recipient_phone';

  SELECT value::text INTO v_recipient_name
    FROM public.system_settings
   WHERE key = 'meeting_reminder_recipient_name';

  IF v_recipient_phone IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'meeting_reminder_recipient_phone no configurado en system_settings'
    );
  END IF;

  -- Quitar comillas que jsonb::text agrega a los strings
  v_recipient_phone := trim('"' FROM v_recipient_phone);
  v_recipient_name  := trim('"' FROM v_recipient_name);

  FOREACH v_meeting IN ARRAY v_meetings LOOP

    -- Solo reuniones futuras con al menos 3h de margen
    IF v_meeting <= now() + INTERVAL '3 hours' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_meeting_date := to_char(v_meeting AT TIME ZONE 'UTC', 'YYYY-MM-DD');

    -- ── Recordatorio 24h antes (6 PM del día anterior) ──
    IF NOT p_dry_run THEN
      INSERT INTO public.notification_queue (
        event_type,
        event_reference_id,
        recipient_name,
        recipient_phone,
        channel,
        provider,
        template_name,
        template_language,
        template_parameters,
        payload,
        scheduled_for,
        status,
        dedup_key
      ) VALUES (
        'meeting.reminder_24h',
        v_meeting_date,
        v_recipient_name,
        v_recipient_phone,
        'whatsapp',
        'meta',
        'reunion_recordatorio_24h_v1',
        'es',
        jsonb_build_array(split_part(v_recipient_name, ' ', 1)),
        jsonb_build_object(
          'meeting_utc',   to_char(v_meeting, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'meeting_date',  v_meeting_date,
          'reminder_type', '24h'
        ),
        v_meeting - INTERVAL '24 hours',
        'pending',
        'meeting_24h_' || v_meeting_date
      )
      ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    v_queued_24h := v_queued_24h + 1;

    -- ── Recordatorio 2h antes (4 PM del mismo día) ──────
    IF NOT p_dry_run THEN
      INSERT INTO public.notification_queue (
        event_type,
        event_reference_id,
        recipient_name,
        recipient_phone,
        channel,
        provider,
        template_name,
        template_language,
        template_parameters,
        payload,
        scheduled_for,
        status,
        dedup_key
      ) VALUES (
        'meeting.reminder_2h',
        v_meeting_date,
        v_recipient_name,
        v_recipient_phone,
        'whatsapp',
        'meta',
        'reunion_recordatorio_2h_v1',
        'es',
        jsonb_build_array(
          split_part(v_recipient_name, ' ', 1),
          '6:00 PM'
        ),
        jsonb_build_object(
          'meeting_utc',   to_char(v_meeting, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'meeting_date',  v_meeting_date,
          'reminder_type', '2h'
        ),
        v_meeting - INTERVAL '2 hours',
        'pending',
        'meeting_2h_' || v_meeting_date
      )
      ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    v_queued_2h := v_queued_2h + 1;

  END LOOP;

  RETURN jsonb_build_object(
    'dry_run',       p_dry_run,
    'queued_24h',    v_queued_24h,
    'queued_2h',     v_queued_2h,
    'skipped_past',  v_skipped,
    'total',         v_queued_24h + v_queued_2h
  );
END;
$$;

-- =====================================================
-- VERIFICACIÓN (dry_run)
-- =====================================================
-- SELECT public.fn_schedule_meeting_reminders(true);
-- → { dry_run: true, queued_24h: 11, queued_2h: 11, skipped_past: 0 }
--
-- ACTIVACIÓN:
-- SELECT public.fn_schedule_meeting_reminders(false);
-- SELECT event_type, dedup_key, scheduled_for, status
--   FROM public.notification_queue
--  WHERE event_type LIKE 'meeting.%'
--  ORDER BY scheduled_for;
-- → 22 filas, del 24-jun al 12-nov
--
-- =====================================================
-- ROLLBACK
-- =====================================================
-- DELETE FROM public.notification_queue WHERE event_type LIKE 'meeting.%';
-- DROP FUNCTION IF EXISTS public.fn_schedule_meeting_reminders(boolean);
-- ALTER TABLE public.notification_queue DROP COLUMN IF EXISTS scheduled_for;
-- DROP INDEX IF EXISTS notification_queue_scheduled_idx;
-- DELETE FROM public.system_settings
--   WHERE key IN ('meeting_reminder_recipient_phone','meeting_reminder_recipient_name');
-- =====================================================
