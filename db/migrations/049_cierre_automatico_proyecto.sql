-- =====================================================
-- 049 — Cierre Automático de Proyecto
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09 (rev 2 — BEFORE trigger)
--
-- Objetivo: cuando el equipo registra la entrega final
-- (delivered_at pasa de NULL a NOT NULL) Y el proyecto
-- está completamente pagado (is_fully_paid = true),
-- el sistema:
--   1. Cambia projects.status → 'completado' (via NEW, sin UPDATE separado)
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
-- DISEÑO: BEFORE trigger (no AFTER) para que el cambio
-- de status sea atómico con el UPDATE original — evita
-- el anti-patrón de UPDATE-dentro-de-AFTER que puede
-- causar "tuple concurrently updated" bajo concurrencia.
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
  -- Condición 1: delivered_at pasa de NULL a NOT NULL en ESTE update
  IF NEW.delivered_at IS NULL OR OLD.delivered_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Condición 2: proyecto completamente pagado
  IF NEW.is_fully_paid IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Guard de idempotencia: no re-ejecutar si ya está completado
  IF OLD.status::text = 'completado' THEN
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

  IF v_responsable IS NULL THEN
    SELECT id INTO v_default_user
      FROM public.profiles
     WHERE role = 'admin'
     LIMIT 1;
    v_responsable := v_default_user;
  END IF;

  -- 1. Cambiar status modificando NEW directamente (BEFORE trigger — atómico con el UPDATE original)
  NEW.status := 'completado';

  -- 2. Encolar WhatsApp al cliente (solo si tiene teléfono y no hay notificación previa)
  IF v_client_phone IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.notification_queue
        WHERE payload->>'project_id' = NEW.id::text
          AND event_type = 'project.completed'
     )
  THEN
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

  -- 3. Crear tarea "Solicitar reseña" solo si no existe ya para este proyecto
  IF v_responsable IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.tasks
        WHERE 'project:' || NEW.id::text = ANY(tags)
          AND title LIKE 'Solicitar reseña%'
     )
  THEN
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
  BEFORE UPDATE OF delivered_at, is_fully_paid ON public.projects
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
--    -- Verificar cierre (sin SELECT extra — atómico):
--    SELECT status FROM public.projects WHERE id = '<project_uuid>';
--    -- Debe ser 'completado' en la misma transacción
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
--    OLD.status = 'completado' → el guard bloquea re-ejecución.

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_cierre_automatico_proyecto ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_cierre_automatico_proyecto();
-- =====================================================
