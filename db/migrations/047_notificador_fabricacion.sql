-- =====================================================
-- 047 — Notificador de Inicio de Fabricación
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: cuando el equipo registra el inicio de
-- fabricación (fabrication_started_at pasa de NULL
-- a NOT NULL), enviar un WhatsApp automático al
-- cliente informándole que su cocina está siendo
-- fabricada.
--
-- Template Meta requerida: fabricacion_iniciada_v1
--   {{1}} = nombre del cliente
--   {{2}} = días estimados de fabricación
--
-- NOTA: activar este trigger solo cuando la template
-- Meta esté en estado APPROVED.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_notify_fabricacion_started()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id     UUID;
  v_client_name   TEXT;
  v_client_phone  TEXT;
  v_project_name  TEXT;
  v_notif_id      UUID;
BEGIN
  -- Solo cuando fabrication_started_at pasa de NULL a NOT NULL
  IF NEW.fabrication_started_at IS NULL OR OLD.fabrication_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener datos del cliente
  SELECT c.id, c.name, c.whatsapp_phone
    INTO v_client_id, v_client_name, v_client_phone
    FROM public.clients c
   WHERE c.id = NEW.client_id;

  IF NOT FOUND OR v_client_phone IS NULL THEN
    RETURN NEW;
  END IF;

  v_project_name := COALESCE(NEW.name, 'tu proyecto');

  -- Guard de idempotencia: una sola notificación por proyecto
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
     WHERE payload->>'project_id' = NEW.id::text
       AND event_type = 'project.fabricacion_started'
  ) THEN
    RETURN NEW;
  END IF;

  -- Encolar WhatsApp al cliente
  INSERT INTO public.notification_queue (
    recipient_phone,
    recipient_name,
    template_name,
    template_parameters,
    event_type,
    payload,
    status
  ) VALUES (
    v_client_phone,
    v_client_name,
    'fabricacion_iniciada_v1',
    jsonb_build_array(
      COALESCE(split_part(v_client_name, ' ', 1), v_client_name),
      '15 días hábiles'
    ),
    'project.fabricacion_started',
    jsonb_build_object(
      'project_id',   NEW.id,
      'client_id',    v_client_id,
      'project_name', v_project_name
    ),
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fabricacion_started ON public.projects;
CREATE TRIGGER trg_notify_fabricacion_started
  AFTER UPDATE OF fabrication_started_at ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_fabricacion_started();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- 1) Usar un proyecto real en estado activo:
--    UPDATE public.projects
--       SET fabrication_started_at = NOW()
--     WHERE id = '<project_uuid>'
--       AND fabrication_started_at IS NULL;
--
--    SELECT recipient_phone, template_name, template_params, status
--      FROM public.notification_queue
--     WHERE event_type = 'project.fabricacion_started'
--     ORDER BY created_at DESC LIMIT 1;
--    -- Debe mostrar una fila con template fabricacion_iniciada_v1
--
-- 2) Idempotencia:
--    Actualizar el mismo proyecto otra vez: el guard
--    evita duplicar la notificación.

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_notify_fabricacion_started ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_notify_fabricacion_started();
-- =====================================================
