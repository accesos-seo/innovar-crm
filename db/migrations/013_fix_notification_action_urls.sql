-- =====================================================
-- 013 — Fix legacy action_url paths en triggers de notifications
-- =====================================================
--
-- Contexto: las funciones de notificaciones (notify_booking_created,
-- notify_booking_status_change, notify_task_assigned, notify_task_blocked,
-- notify_task_comment, notify_task_completed) generaban action_url con paths
-- que nunca existieron en el router del frontend:
--   `/agenda/citas?task_id=...`  → debe ser `/agenda?task_id=...`
--   `/agenda/tareas?task_id=...` → debe ser `/tasks?task_id=...`
--
-- El frontend tenía un normalizador en src/lib/notifications-url.ts como
-- band-aid. Esta migración arregla el origen para que ya no se necesite.
--
-- También actualiza las filas existentes de public.notifications para
-- reescribir los action_url legacy a los correctos.
--
-- Fecha: 2026-05-23
-- Descubrimiento: docs/handover/2026-05-23_NOTIFICATIONS-PAGE.md §3.5
-- =====================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- 1. notify_booking_created
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo para citas (appointment_type no null)
  IF NEW.appointment_type IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, priority, action_url)
    VALUES (
      NEW.assigned_to,
      CASE NEW.appointment_type
        WHEN 'visita_tecnica' THEN '📍 Nueva visita técnica agendada'
        WHEN 'cita_diseno'    THEN '🎨 Nueva cita de diseño agendada'
        ELSE                       '📅 Nueva cita agendada'
      END,
      'Para el ' || to_char(NEW.due_date, 'DD/MM/YYYY') || ' a las ' || to_char(NEW.time_slot, 'HH12:MI AM'),
      'tasks',
      NEW.id,
      'booking_new',
      CASE (SELECT urgency FROM public.clients WHERE id = NEW.client_id)
        WHEN 'ASAP'  THEN 2
        WHEN 'SHORT' THEN 1
        ELSE              0
      END::smallint,
      '/agenda?task_id=' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────
-- 2. notify_booking_status_change
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.appointment_type IS NOT NULL THEN
    IF NEW.status = 'completado' AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, action_url)
      VALUES (
        NEW.assigned_to,
        '✅ Cita completada',
        NEW.title || ' del ' || to_char(NEW.due_date, 'DD/MM/YYYY'),
        'tasks',
        NEW.id,
        'booking_completed',
        '/agenda?task_id=' || NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────
-- 3. notify_task_assigned
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND NEW.task_category != 'cita'
     AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, priority, action_url)
    VALUES (
      NEW.assigned_to,
      CASE NEW.priority WHEN 2 THEN '🔴 Tarea urgente asignada' WHEN 1 THEN '🟡 Nueva tarea asignada' ELSE '📋 Nueva tarea asignada' END,
      NEW.title || CASE WHEN NEW.due_date IS NOT NULL THEN ' — Fecha límite: ' || to_char(NEW.due_date, 'DD/MM/YYYY') ELSE '' END,
      'tasks', NEW.id, 'task_assigned', NEW.priority, '/tasks?task_id=' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────
-- 4. notify_task_blocked
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_task_blocked()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'bloqueado' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, priority, action_url)
    VALUES (NEW.created_by, '⛔ Tarea bloqueada',
      NEW.title || ' fue marcada como bloqueada',
      'tasks', NEW.id, 'task_blocked', 2, '/tasks?task_id=' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────
-- 5. notify_task_comment
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS TRIGGER AS $$
DECLARE v_task RECORD;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
  IF v_task.assigned_to IS NOT NULL AND v_task.assigned_to != NEW.author_id THEN
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, action_url)
    VALUES (v_task.assigned_to, '💬 Nuevo comentario en tu tarea',
      (SELECT full_name FROM public.profiles WHERE id = NEW.author_id) || ' comentó en: ' || v_task.title,
      'tasks', v_task.id, 'task_comment', '/tasks?task_id=' || v_task.id);
  END IF;
  IF v_task.created_by IS NOT NULL AND v_task.created_by != NEW.author_id AND v_task.created_by != v_task.assigned_to THEN
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, action_url)
    VALUES (v_task.created_by, '💬 Comentario en tarea que creaste',
      (SELECT full_name FROM public.profiles WHERE id = NEW.author_id) || ' comentó en: ' || v_task.title,
      'tasks', v_task.id, 'task_comment', '/tasks?task_id=' || v_task.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────
-- 6. notify_task_completed
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completado' AND NEW.task_category != 'cita'
     AND NEW.created_by IS NOT NULL AND NEW.created_by != NEW.assigned_to THEN
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, action_url)
    VALUES (
      NEW.created_by, '✅ Tarea completada',
      NEW.title || ' — Completada por ' || (SELECT full_name FROM public.profiles WHERE id = NEW.assigned_to),
      'tasks', NEW.id, 'task_completed', '/tasks?task_id=' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────
-- 7. Backfill — reescribir filas existentes
-- ─────────────────────────────────────────────────────────
UPDATE public.notifications
   SET action_url = '/tasks' || substring(action_url FROM length('/agenda/tareas') + 1)
 WHERE action_url LIKE '/agenda/tareas%';

UPDATE public.notifications
   SET action_url = '/agenda' || substring(action_url FROM length('/agenda/citas') + 1)
 WHERE action_url LIKE '/agenda/citas%';

COMMIT;
