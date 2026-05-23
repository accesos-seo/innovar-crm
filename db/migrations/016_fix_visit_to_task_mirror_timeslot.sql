-- Migración 016 — Fix #2 de visit_to_task_mirror: cast del time_slot
--
-- Bug detectado tras aplicar 015: `tasks.time_slot` es de tipo `time without time zone`,
-- pero `to_char(NEW.scheduled_at, 'HH24:MI')` devuelve TEXT. PG no castea implícito
-- entre text y time. Agregamos `::time` al final.

BEGIN;

CREATE OR REPLACE FUNCTION public.visit_to_task_mirror()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_client_id  UUID;
BEGIN
  SELECT o.client_id INTO v_client_id
    FROM public.opportunities o
   WHERE o.id = NEW.opportunity_id;

  IF TG_OP = 'INSERT' THEN
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
      NEW.scheduled_at::DATE,
      NEW.scheduled_at::time,
      'visita',
      'cita'::task_category
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.tasks
       SET assigned_to  = NEW.visited_by,
           due_date     = NEW.scheduled_at::DATE,
           time_slot    = NEW.scheduled_at::time,
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
