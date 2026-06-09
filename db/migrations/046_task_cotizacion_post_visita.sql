-- =====================================================
-- 046 — Tarea de cotización automática al completar visita
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: cuando Álvaro marca una visita como 'realizada',
-- crear automáticamente una tarea asignada a él para preparar
-- la cotización del cliente en las próximas 48 horas.
--
-- La migración 028 ya envía el WA al cliente ("estamos preparando tu
-- cotización"). Esta migración agrega el lado interno: la tarea en el CRM.
--
-- Tarea generada:
--   - Título: "Preparar cotización — [nombre cliente]"
--   - Categoría: seguimiento
--   - Prioridad: 1 (alta)
--   - Vence: 2 días calendario desde hoy (NOW()::DATE + INTERVAL '2 days')
--   - Asignada a: visited_by (o fallback a get_default_visitor())
--   - Tags: ['visit:{visit_uuid}'] — clave de dedup
--
-- NOTA: La migración 028 (trg_notify_visit_summary_client) corre en la
-- misma tabla/evento. Múltiples triggers en el mismo evento son seguros
-- en PostgreSQL — se ejecutan en orden de creación.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_create_quotation_task_after_visit()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id    UUID;
  v_client_name  TEXT;
  v_default_user UUID;
  v_tag          TEXT;
BEGIN
  -- Solo cuando la visita pasa a 'realizada' por primera vez
  IF NEW.status <> 'realizada' OR OLD.status = 'realizada' THEN
    RETURN NEW;
  END IF;

  -- Obtener cliente de la oportunidad vinculada
  SELECT c.id, c.name
    INTO v_client_id, v_client_name
    FROM public.opportunities o
    JOIN public.clients c ON c.id = o.client_id
   WHERE o.id = NEW.opportunity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Asignado = quien hizo la visita, o Álvaro por defecto
  v_default_user := COALESCE(NEW.visited_by, public.get_default_visitor());

  IF v_default_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guard de idempotencia: una sola tarea por visita
  v_tag := 'visit:' || NEW.id::text;
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE v_tag = ANY(tags)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tasks (
    client_id,
    assigned_to,
    created_by,
    title,
    description,
    status,
    priority,
    due_date,
    task_category,
    tags,
    kanban_order
  ) VALUES (
    v_client_id,
    v_default_user,
    v_default_user,
    'Preparar cotización — ' || COALESCE(v_client_name, 'Cliente'),
    'Visita técnica completada. Preparar cotización personalizada en las próximas 48 horas.',
    'pendiente'::task_status,
    1,                                           -- alta prioridad
    NOW()::DATE + INTERVAL '2 days',             -- 2 días calendario desde hoy
    'seguimiento'::task_category,
    ARRAY[v_tag],                                -- dedup clave
    0
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_quotation_task_after_visit ON public.visits;
CREATE TRIGGER trg_create_quotation_task_after_visit
  AFTER UPDATE OF status ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_quotation_task_after_visit();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- 1) Forzar (usar UUID real de una visita en 'agendada'):
--    UPDATE public.visits SET status='realizada' WHERE id = '<visit_uuid>';
--    SELECT id, title, status, assigned_to, due_date, tags
--      FROM public.tasks
--     WHERE 'visit:<visit_uuid>' = ANY(tags);
--    -- Debe devolver 1 fila con título "Preparar cotización — [cliente]"
--
-- 2) Idempotencia:
--    UPDATE public.visits SET status='agendada' WHERE id = '<visit_uuid>';
--    UPDATE public.visits SET status='realizada' WHERE id = '<visit_uuid>';
--    -- El guard de tags evita segunda tarea. COUNT debe seguir en 1.
--
-- 3) Co-existencia con migración 028:
--    Ambos triggers deben ejecutar: verificar también que
--    notification_queue tiene una fila con event_type='visit.summary_client'
--    para la misma visita.

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_create_quotation_task_after_visit ON public.visits;
-- DROP FUNCTION IF EXISTS public.fn_create_quotation_task_after_visit();
-- =====================================================
