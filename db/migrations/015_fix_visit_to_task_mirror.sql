-- Migración 015 — Fix de visit_to_task_mirror
--
-- Bugs detectados en QA del 2026-05-23 al intentar agendar la primera visita real:
--
--   1. La columna `tasks.status` es del enum `task_status`, pero el CASE devolvía TEXT
--      y faltaba el cast `::task_status` al final.
--
--   2. El CASE usaba valores `'completada'` y `'cancelada'` (femenino) que NO existen
--      en el enum `task_status`. Los valores reales son `'completado'` y `'cancelado'`
--      (masculino).
--
--   3. El INSERT pasaba `task_category = 'visit_mirror'`, pero el enum `task_category`
--      no incluye ese valor. Los válidos son: cita, operativa, diseno, produccion,
--      administrativa, seguimiento. Reemplazamos por `'cita'` (mantiene la semántica)
--      y dejamos `appointment_type = 'visita'` como discriminador fino.
--
-- Resultado: hasta este fix era imposible insertar una visita (cualquier INSERT en
-- public.visits abortaba dentro del trigger visit_to_task_mirror).

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
      to_char(NEW.scheduled_at, 'HH24:MI'),
      'visita',
      'cita'::task_category
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.tasks
       SET assigned_to  = NEW.visited_by,
           due_date     = NEW.scheduled_at::DATE,
           time_slot    = to_char(NEW.scheduled_at, 'HH24:MI'),
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
