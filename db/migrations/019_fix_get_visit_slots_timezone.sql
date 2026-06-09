-- Migración 019 — Fix de get_visit_slots: zona horaria de Colombia
--
-- Bug detectado en QA UI del 2026-05-23:
--   `get_visit_slots` retornaba `(date + time)::TIMESTAMPTZ`, lo que en
--   PostgreSQL interpreta el timestamp naive como hora del servidor (UTC).
--   Resultado: el slot SQL "09:00 UTC" llegaba al browser como "04:00 hora
--   Colombia" (UTC-5). El cliente veía la página /agendar con horarios
--   04:00 / 06:00 / 08:30 / 10:30 en lugar de los esperados
--   09:00 / 11:00 / 13:30 / 15:30.
--
-- Fix: convertir explícitamente desde America/Bogota con `AT TIME ZONE`.
-- El timestamp interno sigue siendo UTC, pero ahora representa la hora local
-- correcta. El frontend mostrará 09:00 cuando el browser está en zona Colombia.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_visit_slots(
  p_commercial_id uuid,
  p_from          date,
  p_to            date
)
RETURNS TABLE(slot_start timestamp with time zone, is_available boolean)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE
  v_slot_times TIME[] := ARRAY['09:00','11:00','13:30','15:30']::TIME[];
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT d::DATE AS day
      FROM generate_series(p_from, p_to, '1 day'::INTERVAL) d
     WHERE EXTRACT(DOW FROM d) IN (2, 4)
       AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = d::DATE)
  ),
  expanded AS (
    SELECT ((d.day + t) AT TIME ZONE 'America/Bogota') AS slot_start
      FROM days d
     CROSS JOIN unnest(v_slot_times) t
  )
  SELECT e.slot_start,
         NOT EXISTS (
           SELECT 1 FROM public.visits v
            WHERE v.visited_by = p_commercial_id
              AND v.scheduled_at = e.slot_start
              AND v.status NOT IN ('cancelada','no_show')
              AND v.deleted_at IS NULL
         ) AS is_available
    FROM expanded e
   ORDER BY e.slot_start;
END;
$function$;

COMMIT;
