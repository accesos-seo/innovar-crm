-- Migración 026 — WhatsApp al admin + recordatorios 24h interno + 2h cliente/admin
-- (Fase 3 · Slice 3)
--
-- Fundamento:
--   D3 — Admin recibe WhatsApp al agendarse una visita.
--   D4 — Recordatorio 24h al cliente Y al admin. El cron existente
--        `wa-recordatorio-24h-daily` YA cubre el lado cliente (template
--        `recordatorio24hantes`, genérico para todas las citas). Aquí
--        solo agregamos el lado interno.
--   D5 — Recordatorio 2h al cliente Y al admin (dual, ambos lados nuevos).
--
-- Reutilizamos:
--   - `enqueue_notification(...)` — helper genérico con dedup_key automático.
--   - `fn_wa_enqueue_for_profile(...)` — wrapper para staff (verifica is_active +
--     whatsapp_phone + preferencia notification_preferences->whatsapp->event).
--
-- Templates Meta requeridos (a aprobar por el usuario en Meta Business Manager):
--   - visit_assigned_admin_v1            (UTILITY · ES)
--   - visit_reminder_24h_internal_v1     (UTILITY · ES)
--   - visit_reminder_2h_client_v1        (UTILITY · ES)
--   - visit_reminder_2h_internal_v1      (UTILITY · ES)
--
-- Mientras los templates NO estén aprobados, el worker
-- `process-whatsapp-notifications` marcará las filas como `failed`. Cero daño.

BEGIN;

-- =============================================================================
-- 1) Trigger AFTER INSERT ON visits → notifica al visitante (admin) por WhatsApp
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_visit_assigned_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client      RECORD;
  v_first_name  text;
BEGIN
  IF NEW.visited_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.name, c.address
    INTO v_client
    FROM public.opportunities o
    JOIN public.clients c ON c.id = o.client_id
   WHERE o.id = NEW.opportunity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);

  PERFORM public.fn_wa_enqueue_for_profile(
    NEW.visited_by,
    'visit.assigned_to_visitor',
    'visita_asignada',
    'visit',
    NEW.id,
    'visit_assigned_admin_v1',
    jsonb_build_array(
      v_first_name,                                                              -- {{1}} cliente nombre
      to_char(NEW.scheduled_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY'),     -- {{2}} fecha
      to_char(NEW.scheduled_at AT TIME ZONE 'America/Bogota', 'HH12:MI AM'),     -- {{3}} hora
      COALESCE(v_client.address, 'dirección por confirmar')                     -- {{4}} dirección
    ),
    jsonb_build_object(
      'visit_id',       NEW.id,
      'opportunity_id', NEW.opportunity_id,
      'client_id',      v_client.id,
      'scheduled_at',   NEW.scheduled_at
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_visit_assigned_admin ON public.visits;
CREATE TRIGGER trg_notify_visit_assigned_admin
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_visit_assigned_admin();


-- =============================================================================
-- 2) Cron 24h-interno — recordatorio al visitante (admin) sobre visitas de mañana
--    Notar: el cron existente `wa-recordatorio-24h-daily` (función
--    fn_wa_recordatorio_24h_scan) ya cubre el cliente con template
--    `recordatorio24hantes`. Aquí solo agregamos el lado interno.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_visit_reminders_24h_internal()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r        RECORD;
  v_count  integer := 0;
BEGIN
  FOR r IN
    SELECT
      v.id              AS visit_id,
      v.opportunity_id,
      v.scheduled_at,
      v.visited_by,
      c.name            AS client_name,
      c.address         AS client_address,
      c.whatsapp_phone  AS client_phone,
      o.services        AS services
    FROM public.visits v
    JOIN public.opportunities o ON o.id = v.opportunity_id
    JOIN public.clients c       ON c.id = o.client_id
    WHERE v.visited_by IS NOT NULL
      AND v.status IN ('agendada','confirmada','reagendada')
      AND v.deleted_at IS NULL
      AND (v.scheduled_at AT TIME ZONE 'America/Bogota')::date = (CURRENT_DATE AT TIME ZONE 'America/Bogota' + INTERVAL '1 day')::date
  LOOP
    PERFORM public.fn_wa_enqueue_for_profile(
      r.visited_by,
      'visit.reminder_24h_internal',
      'visita_recordatorio_24h',
      'visit',
      r.visit_id,
      'visit_reminder_24h_internal_v1',
      jsonb_build_array(
        to_char(r.scheduled_at AT TIME ZONE 'America/Bogota', 'HH12:MI AM'),    -- {{1}} hora
        COALESCE(r.client_name, 'Cliente'),                                     -- {{2}} cliente
        COALESCE(r.client_address, 'dirección por confirmar'),                  -- {{3}} dirección
        COALESCE(r.client_phone, 'sin teléfono'),                               -- {{4}} tel
        COALESCE(array_to_string(r.services, ', '), 'servicios por confirmar')  -- {{5}} servicios
      ),
      jsonb_build_object(
        'visit_id',       r.visit_id,
        'opportunity_id', r.opportunity_id,
        'scheduled_at',   r.scheduled_at
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;


-- =============================================================================
-- 3) Cron 2h — recordatorio dual (cliente + admin) sobre visitas en próximas 2h
--    Ventana: scheduled_at entre NOW()+1h45m y NOW()+2h15m para hit-rate del cron
--    horario sin doble-encolar.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_visit_reminders_2h()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r            RECORD;
  v_count      integer := 0;
  v_first_name text;
BEGIN
  FOR r IN
    SELECT
      v.id              AS visit_id,
      v.opportunity_id,
      v.scheduled_at,
      v.visited_by,
      c.id              AS client_id,
      c.name            AS client_name,
      c.address         AS client_address,
      c.whatsapp_phone  AS client_phone
    FROM public.visits v
    JOIN public.opportunities o ON o.id = v.opportunity_id
    JOIN public.clients c       ON c.id = o.client_id
    WHERE v.status IN ('agendada','confirmada','reagendada')
      AND v.deleted_at IS NULL
      AND v.scheduled_at BETWEEN (NOW() + INTERVAL '1 hour 45 minutes')
                              AND (NOW() + INTERVAL '2 hours 15 minutes')
  LOOP
    v_first_name := split_part(COALESCE(r.client_name, 'Cliente'), ' ', 1);

    -- 3.1 Cliente
    IF r.client_phone IS NOT NULL AND trim(r.client_phone) <> '' THEN
      PERFORM public.enqueue_notification(
        'visit.reminder_2h_client',
        r.visit_id::text,
        'visit',
        r.visit_id::text,
        'client',
        r.client_id::text,
        v_first_name,
        r.client_phone,
        'visit_reminder_2h_client_v1',
        'es',
        jsonb_build_array(
          v_first_name,                                                          -- {{1}} nombre
          to_char(r.scheduled_at AT TIME ZONE 'America/Bogota', 'HH12:MI AM')   -- {{2}} hora
        ),
        jsonb_build_object(
          'visit_id',     r.visit_id,
          'client_id',    r.client_id,
          'scheduled_at', r.scheduled_at
        )
      );
      v_count := v_count + 1;
    END IF;

    -- 3.2 Visitante (admin / comercial delegado)
    IF r.visited_by IS NOT NULL THEN
      PERFORM public.fn_wa_enqueue_for_profile(
        r.visited_by,
        'visit.reminder_2h_internal',
        'visita_recordatorio_2h',
        'visit',
        r.visit_id,
        'visit_reminder_2h_internal_v1',
        jsonb_build_array(
          to_char(r.scheduled_at AT TIME ZONE 'America/Bogota', 'HH12:MI AM'),  -- {{1}} hora
          COALESCE(r.client_name, 'Cliente'),                                   -- {{2}} cliente
          COALESCE(r.client_address, 'dirección por confirmar'),                -- {{3}} dirección
          COALESCE(r.client_phone, 'sin teléfono')                              -- {{4}} tel
        ),
        jsonb_build_object(
          'visit_id',     r.visit_id,
          'client_id',    r.client_id,
          'scheduled_at', r.scheduled_at
        )
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;


-- =============================================================================
-- 4) Cron schedules
--    Idempotentes: borra el job si ya existe antes de re-crear.
-- =============================================================================

-- 24h interno: 14:00 UTC = 09:00 hora Colombia (consistente con cron existente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='visit-reminders-24h-internal') THEN
    PERFORM cron.unschedule('visit-reminders-24h-internal');
  END IF;
  PERFORM cron.schedule(
    'visit-reminders-24h-internal',
    '0 14 * * *',
    $cron$SELECT public.enqueue_visit_reminders_24h_internal();$cron$
  );
END$$;

-- 2h dual: cada 30 min. Ventana ±15 min absorbe drift sin doble-encolar
-- (dedup_key del helper garantiza idempotencia).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='visit-reminders-2h') THEN
    PERFORM cron.unschedule('visit-reminders-2h');
  END IF;
  PERFORM cron.schedule(
    'visit-reminders-2h',
    '*/30 * * * *',
    $cron$SELECT public.enqueue_visit_reminders_2h();$cron$
  );
END$$;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
--
-- 1) Trigger de asignación:
--    -- Crear visita QA → ver fila encolada
--    SELECT id, event_type, template_name, status FROM public.notification_queue
--     WHERE event_reference_id = '<visit_id>' AND template_name = 'visit_assigned_admin_v1';
--
-- 2) Recordatorio 24h interno (forzar):
--    UPDATE public.visits SET scheduled_at = (CURRENT_DATE + INTERVAL '1 day')::timestamptz + TIME '09:00'
--     WHERE id = '<visit_id>';
--    SELECT public.enqueue_visit_reminders_24h_internal();
--    -- Debe devolver entero >= 1 y crear fila con template_name='visit_reminder_24h_internal_v1'.
--
-- 3) Recordatorio 2h dual (forzar):
--    UPDATE public.visits SET scheduled_at = NOW() + INTERVAL '2 hours' WHERE id = '<visit_id>';
--    SELECT public.enqueue_visit_reminders_2h();
--    -- Debe crear 2 filas (cliente + admin) con templates *_v1.
--
-- 4) Idempotencia:
--    SELECT public.enqueue_visit_reminders_2h();
--    -- Re-correr: count en notification_queue por dedup_key permanece igual.
--
-- 5) Cron registrados:
--    SELECT jobname, schedule FROM cron.job
--     WHERE jobname IN ('visit-reminders-24h-internal','visit-reminders-2h');

-- =============================================================================
-- Rollback
-- =============================================================================
-- SELECT cron.unschedule('visit-reminders-2h');
-- SELECT cron.unschedule('visit-reminders-24h-internal');
-- DROP TRIGGER IF EXISTS trg_notify_visit_assigned_admin ON public.visits;
-- DROP FUNCTION IF EXISTS public.notify_visit_assigned_admin();
-- DROP FUNCTION IF EXISTS public.enqueue_visit_reminders_24h_internal();
-- DROP FUNCTION IF EXISTS public.enqueue_visit_reminders_2h();
