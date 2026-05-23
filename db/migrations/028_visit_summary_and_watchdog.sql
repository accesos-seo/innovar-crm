-- Migración 028 — Resumen al cliente + watchdog visitas vencidas (Fase 3 · Slice 5)
--
-- Fundamento:
--   D10 — Al marcar una visita como `realizada`, enviar resumen al cliente por
--         WhatsApp confirmando recepción y plazo de cotización (template nuevo
--         `visit_summary_client_v1`).
--   D14 — Si una visita pasó su hora y no fue marcada (`realizada`/`no_show`/
--         `cancelada`), notificar al visitante por la campana del CRM. No
--         auto-marcar nada (riesgo de falso positivo).

BEGIN;

-- =============================================================================
-- 1) Trigger AFTER UPDATE OF status → resumen al cliente
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_visit_summary_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client      RECORD;
  v_first_name  text;
BEGIN
  IF NEW.status <> 'realizada' OR OLD.status = 'realizada' THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.name, c.whatsapp_phone
    INTO v_client
    FROM public.opportunities o
    JOIN public.clients c ON c.id = o.client_id
   WHERE o.id = NEW.opportunity_id;

  IF NOT FOUND
     OR v_client.whatsapp_phone IS NULL
     OR trim(v_client.whatsapp_phone) = '' THEN
    RETURN NEW;
  END IF;

  v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);

  PERFORM public.enqueue_notification(
    'visit.summary_client',
    NEW.id::text,
    'visit',
    NEW.id::text,
    'client',
    v_client.id::text,
    v_first_name,
    v_client.whatsapp_phone,
    'visit_summary_client_v1',
    'es',
    jsonb_build_array(
      v_first_name,   -- {{1}} nombre
      '24-48'         -- {{2}} plazo en horas
    ),
    jsonb_build_object(
      'visit_id',       NEW.id,
      'opportunity_id', NEW.opportunity_id,
      'client_id',      v_client.id
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_visit_summary_client ON public.visits;
CREATE TRIGGER trg_notify_visit_summary_client
  AFTER UPDATE OF status ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_visit_summary_client();


-- =============================================================================
-- 2) Función watchdog — visitas vencidas sin status final
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_visit_overdue_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r       RECORD;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT
      v.id              AS visit_id,
      v.scheduled_at,
      v.visited_by,
      c.name            AS client_name
    FROM public.visits v
    JOIN public.opportunities o ON o.id = v.opportunity_id
    JOIN public.clients c       ON c.id = o.client_id
    WHERE v.visited_by IS NOT NULL
      AND v.status IN ('agendada','confirmada','reagendada')
      AND v.deleted_at IS NULL
      AND v.scheduled_at < (NOW() - INTERVAL '2 hours')
      -- Dedup: no insertar si ya existe una notif del mismo tipo para esta visita.
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
         WHERE n.related_id = v.id
           AND n.user_id = v.visited_by
           AND n.notification_type = 'visit_overdue'
      )
  LOOP
    INSERT INTO public.notifications (
      user_id, title, body, related_table, related_id,
      notification_type, priority, action_url
    ) VALUES (
      r.visited_by,
      '⏰ Visita pendiente de cierre',
      'La visita de ' || COALESCE(r.client_name, 'cliente')
        || ' (' || to_char(r.scheduled_at AT TIME ZONE 'America/Bogota', 'DD/MM HH12:MI AM')
        || ') ya pasó. Márcala como realizada, no_show o reagendar.',
      'visits',
      r.visit_id,
      'visit_overdue',
      1,
      '/agenda/hoy?visit_id=' || r.visit_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- =============================================================================
-- 3) Cron schedule
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='visit-overdue-alerts') THEN
    PERFORM cron.unschedule('visit-overdue-alerts');
  END IF;
  PERFORM cron.schedule(
    'visit-overdue-alerts',
    '15 * * * *',
    $cron$SELECT public.enqueue_visit_overdue_alerts();$cron$
  );
END$$;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
--
-- 1) Resumen al cliente (forzar):
--    UPDATE public.visits SET status='realizada' WHERE id = '<visit_id>';
--    -- Pre-condición: measurements no vacío y ≥3 fotos (lo enforce validate_visit_completion).
--    SELECT * FROM public.notification_queue
--     WHERE event_reference_id = '<visit_id>' AND template_name = 'visit_summary_client_v1';
--    -- Debe haber 1 fila.
--
-- 2) Watchdog (forzar):
--    UPDATE public.visits SET scheduled_at = NOW() - INTERVAL '3 hours', status='agendada'
--     WHERE id = '<visit_id>';
--    SELECT public.enqueue_visit_overdue_alerts();
--    -- Debe devolver entero >=1 y crear fila en notifications con notification_type='visit_overdue'.
--
-- 3) Idempotencia:
--    SELECT public.enqueue_visit_overdue_alerts();
--    -- Re-correr: count en notifications con notification_type='visit_overdue' permanece.
--
-- 4) Cron registrado:
--    SELECT jobname, schedule FROM cron.job WHERE jobname='visit-overdue-alerts';

-- =============================================================================
-- Rollback
-- =============================================================================
-- SELECT cron.unschedule('visit-overdue-alerts');
-- DROP TRIGGER IF EXISTS trg_notify_visit_summary_client ON public.visits;
-- DROP FUNCTION IF EXISTS public.notify_visit_summary_client();
-- DROP FUNCTION IF EXISTS public.enqueue_visit_overdue_alerts();
