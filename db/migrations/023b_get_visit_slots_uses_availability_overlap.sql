-- Migración 023b — `get_visit_slots` mira `availability_slots` con solapamiento real (Fase 3 · S1 · Post-smoke)
--
-- Hallazgo del smoke 2026-05-23 (post-023/023a):
--   `get_visit_slots` (a la que delega `get_public_visit_slots`) marcaba un
--   slot como "disponible" si NO existía una row en `public.visits` para ese
--   visitante en ese timestamp exacto. Pero el sistema de disponibilidad real
--   vive en `public.availability_slots` (que es lo que `sync_task_availability_booking`
--   consulta para reservar). Esa tabla recibe rows de TRES caminos distintos:
--     1. `visit_to_task_mirror` (nuevas visitas via book_public_visit / admin)
--     2. inserciones directas en `tasks` con `task_category='cita'` por flujos
--        admin/legacy (ej. visitas técnicas creadas manualmente sin pasar por
--        `visits` — quedan como tasks huérfanas para `get_visit_slots`)
--     3. citas de diseño (`appointment_type='cita_diseno'`) que también reservan slot
--
-- La función original solo veía (1). Por eso ofrecía al cliente slots que en
-- realidad estaban ocupados por (2) o (3), y el INSERT explotaba con P0001
-- "El bloque de disponibilidad ya esta reservado".
--
-- Fix: usar `availability_slots` como única fuente de verdad de "ocupación",
-- con detección de SOLAPAMIENTO via `tstzrange &&` (no solo igualdad exacta).
-- Esto cubre:
--   - tasks legacy con time_slot arbitrario
--   - citas de diseño que duran 90+ minutos y solapan con el slot virtual
--   - cualquier futuro tipo de bloqueo
--
-- Convención de almacenamiento (validada en smoke): `availability_slots.date`
-- + `start_time/end_time` están persistidos con valores extraídos via
-- `NEW.scheduled_at::date` y `::time` con DB session timezone = 'UTC'. Por eso
-- la conversión correcta a timestamptz es `AT TIME ZONE 'UTC'`. (Si la
-- convención cambiara a Bogotá local, este patrón se rompe — documentar en
-- la próxima refactorización del esquema de slots.)
--
-- Idempotente. No modifica datos, solo lógica de read.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_visit_slots(
  p_commercial_id uuid,
  p_from date,
  p_to date
)
RETURNS TABLE(slot_start timestamptz, is_available boolean)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_slot_times TIME[] := ARRAY['09:00','11:00','13:30','15:30']::TIME[];
  v_duration   INTERVAL := '90 minutes';
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
           SELECT 1
             FROM public.availability_slots s
            WHERE s.staff_id = p_commercial_id
              AND s.is_booked = true
              AND tstzrange(
                    ((s.date::timestamp + s.start_time) AT TIME ZONE 'UTC'),
                    ((s.date::timestamp + s.end_time)   AT TIME ZONE 'UTC'),
                    '[)'
                  )
                  && tstzrange(
                    e.slot_start,
                    e.slot_start + v_duration,
                    '[)'
                  )
         ) AS is_available
    FROM expanded e
   ORDER BY e.slot_start;
END;
$function$;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- 1. Tomar un visitante con cita confirmada (ej. Alvaro, slot booked 28/05 14:00 UTC).
-- 2. SELECT slot_start, is_available
--      FROM public.get_visit_slots('09ca8b37-95b8-43dc-9b01-1100519d5ec5'::uuid,
--                                  '2026-05-28'::date, '2026-05-28'::date);
--    El slot '2026-05-28 14:00+00' DEBE aparecer con is_available=false.
--    Los demás (16:00, 18:30, 20:30 UTC) según corresponda.
--
-- 3. Smoke E2E: pedir public.book_public_visit(token, slot_libre) y verificar
--    que ya no se rompe con P0001.
--
-- =============================================================================
-- Rollback (versión previa, basada solo en `visits`)
-- =============================================================================
-- Reemplazar el NOT EXISTS por:
--   NOT EXISTS (
--     SELECT 1 FROM public.visits v
--      WHERE v.visited_by = p_commercial_id
--        AND v.scheduled_at = e.slot_start
--        AND v.status NOT IN ('cancelada','no_show')
--        AND v.deleted_at IS NULL
--   )
-- y aplicar CREATE OR REPLACE.
