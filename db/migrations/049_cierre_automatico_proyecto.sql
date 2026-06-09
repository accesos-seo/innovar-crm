-- =====================================================
-- 049 — Cierre Automático de Proyecto
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: cuando el equipo registra la entrega final
-- (delivered_at pasa de NULL a NOT NULL) Y el proyecto
-- está completamente pagado (is_fully_paid = true),
-- el sistema:
--   1. Actualiza projects.status → 'completado'
--   2. Envía WA de agradecimiento al cliente
--   3. Crea tarea Kanban "Solicitar reseña" con 7 días
--
-- Template Meta requerida: proyecto_completado_v1
--   {{1}} = nombre del cliente
--   {{2}} = nombre del proyecto
--
-- Condición doble: si falta alguna (no entregado O no
-- pagado), el trigger no actúa. Evita cerrar proyectos
-- con saldo pendiente.
--
-- NOTA: activar este trigger solo cuando la template
-- Meta esté en estado APPROVED.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_cierre_automatico_proyecto()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id     UUID;
  v_client_name   TEXT;
  v_client_phone  TEXT;
  v_project_name  TEXT;
  v_responsable   UUID;
  v_default_user  UUID;
BEGIN
  -- Condición 1: delivered_at pasa de NULL a NOT NULL
  IF NEW.delivered_at IS NULL OR OLD.delivered_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Condición 2: proyecto completamente pagado
  IF NEW.is_fully_paid IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Guard de idempotencia: no re-ejecutar si ya está completado
  IF NEW.status = 'completado' THEN
    RETURN NEW;
  END IF;

  -- Obtener datos del cliente
  SELECT c.id, c.name, c.whatsapp_phone
    INTO v_client_id, v_client_name, v_client_phone
    FROM public.clients c
   WHERE c.id = NEW.client_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_project_name := COALESCE(NEW.name, 'tu proyecto');
  v_responsable  := COALESCE(NEW.designer_id, NEW.created_by);

  -- Fallback: buscar cualquier admin si no hay responsable
  IF v_responsable IS NULL THEN
    SELECT id INTO v_default_user
      FROM public.profiles
     WHERE role = 'admin'
     LIMIT 1;
    v_responsable := v_default_user;
  END IF;

  -- 1. Cerrar el proyecto
  UPDATE public.projects
     SET status = 'completado'
   WHERE id = NEW.id;

  -- 2. Encolar WhatsApp al cliente (solo si tiene teléfono)
  IF v_client_phone IS NOT NULL THEN
    INSERT INTO public.notification_queue (
      recipient_phone,
      recipient_name,
      template_name,
      template_params,
      event_type,
      payload,
      status
    ) VALUES (
      v_client_phone,
      v_client_name,
      'proyecto_completado_v1',
      jsonb_build_array(
        COALESCE(split_part(v_client_name, ' ', 1), v_client_name),
        v_project_name
      ),
      'project.completed',
      jsonb_build_object(
        'project_id',   NEW.id,
        'client_id',    v_client_id,
        'project_name', v_project_name
      ),
      'pending'
    );
  END IF;

  -- 3. Crear tarea "Solicitar reseña" con 7 días de plazo
  IF v_responsable IS NOT NULL THEN
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
      v_responsable,
      v_responsable,
      'Solicitar reseña — ' || COALESCE(v_client_name, 'Cliente'),
      'El proyecto fue entregado y pagado. Contactar al cliente para solicitar reseña en Google o redes sociales.',
      'pendiente'::task_status,
      0,
      NOW()::DATE + INTERVAL '7 days',
      'seguimiento'::task_category,
      ARRAY['project:' || NEW.id::text],
      0
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cierre_automatico_proyecto ON public.projects;
CREATE TRIGGER trg_cierre_automatico_proyecto
  AFTER UPDATE OF delivered_at, is_fully_paid ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cierre_automatico_proyecto();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- 1) Proyecto completamente pagado, marcar entrega:
--    UPDATE public.projects
--       SET delivered_at = NOW()
--     WHERE id = '<project_uuid>'
--       AND is_fully_paid = true
--       AND delivered_at IS NULL;
--
--    -- Verificar cierre:
--    SELECT status FROM public.projects WHERE id = '<project_uuid>';
--    -- Debe ser 'completado'
--
--    -- Verificar WA:
--    SELECT template_name, template_params FROM public.notification_queue
--     WHERE event_type = 'project.completed' ORDER BY created_at DESC LIMIT 1;
--
--    -- Verificar tarea:
--    SELECT title, due_date, tags FROM public.tasks
--     WHERE 'project:<project_uuid>' = ANY(tags);
--
-- 2) Proyecto con saldo pendiente (is_fully_paid = false):
--    UPDATE public.projects SET delivered_at = NOW()
--     WHERE id = '<project_uuid>' AND is_fully_paid = false;
--    -- El cierre NO debe activarse.
--
-- 3) Idempotencia:
--    El guard evita re-ejecutar si status ya es 'completado'.

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_cierre_automatico_proyecto ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_cierre_automatico_proyecto();
-- =====================================================
