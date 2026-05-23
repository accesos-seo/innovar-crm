-- Migración 018 — Fix #3 de visit_to_task_mirror: pre-crear availability_slot
--
-- Bug detectado en QA del 2026-05-23 al ejecutar book_public_visit:
--   El trigger sync_task_availability_booking (en tasks, AFTER INSERT)
--   exige que exista un row en availability_slots con (staff_id, date, start_time)
--   exactos antes de permitir insertar la task. El flujo nuevo no precarga
--   esos slots, así que el INSERT desde visit_to_task_mirror aborta.
--
-- Fix: extendemos visit_to_task_mirror para que ANTES del INSERT en tasks,
-- asegure (UPSERT) el row de availability_slots con is_booked=false. El
-- trigger sync_task_availability_booking se encarga después de marcarlo
-- como reservado y de ligarlo al task.id.
--
-- end_time se calcula como start_time + duration_minutes.

BEGIN;

CREATE OR REPLACE FUNCTION public.visit_to_task_mirror()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_client_id  UUID;
  v_start_time TIME;
  v_end_time   TIME;
  v_date       DATE;
BEGIN
  SELECT o.client_id INTO v_client_id
    FROM public.opportunities o
   WHERE o.id = NEW.opportunity_id;

  v_date       := NEW.scheduled_at::DATE;
  v_start_time := NEW.scheduled_at::TIME;
  v_end_time   := (NEW.scheduled_at + (COALESCE(NEW.duration_minutes, 90) || ' minutes')::interval)::TIME;

  IF TG_OP = 'INSERT' THEN
    -- 0. Asegurar availability_slot (idempotente).
    --    sync_task_availability_booking (en tasks) lo busca para validar
    --    y luego lo marca is_booked=true vinculándolo al task.id.
    IF NEW.visited_by IS NOT NULL THEN
      INSERT INTO public.availability_slots (staff_id, date, start_time, end_time, is_booked)
      VALUES (NEW.visited_by, v_date, v_start_time, v_end_time, false)
      ON CONFLICT (staff_id, date, start_time) DO NOTHING;
    END IF;

    INSERT INTO public.tasks (
      id, client_id, assigned_to, created_by,
      title, status, due_date, time_slot, appointment_type, task_category
    )
    VALUES (
      NEW.id,
      v_client_id,
      NEW.visited_by,
      NEW.created_by,
      'Visita ' || NEW.modality,
      (CASE NEW.status
        WHEN 'agendada'   THEN 'pendiente'
        WHEN 'confirmada' THEN 'pendiente'
        WHEN 'realizada'  THEN 'completado'
        WHEN 'cancelada'  THEN 'cancelado'
        WHEN 'no_show'    THEN 'cancelado'
        ELSE 'pendiente'
      END)::task_status,
      v_date,
      v_start_time,
      'visita',
      'cita'::task_category
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió la fecha/hora/comercial asignado, asegurar nuevo slot también.
    IF NEW.visited_by IS NOT NULL
       AND (
         OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at
         OR OLD.visited_by IS DISTINCT FROM NEW.visited_by
       )
    THEN
      INSERT INTO public.availability_slots (staff_id, date, start_time, end_time, is_booked)
      VALUES (NEW.visited_by, v_date, v_start_time, v_end_time, false)
      ON CONFLICT (staff_id, date, start_time) DO NOTHING;
    END IF;

    UPDATE public.tasks
       SET assigned_to  = NEW.visited_by,
           due_date     = v_date,
           time_slot    = v_start_time,
           status       = (CASE NEW.status
                            WHEN 'agendada'   THEN 'pendiente'
                            WHEN 'confirmada' THEN 'pendiente'
                            WHEN 'realizada'  THEN 'completado'
                            WHEN 'cancelada'  THEN 'cancelado'
                            WHEN 'no_show'    THEN 'cancelado'
                            ELSE 'pendiente'
                          END)::task_status,
           completed_at = CASE WHEN NEW.status = 'realizada'
                                THEN COALESCE(NEW.realized_at, NOW())
                                ELSE NULL
                          END,
           updated_at   = NOW()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
