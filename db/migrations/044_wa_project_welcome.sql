-- =====================================================
-- 044 — WA bienvenida al proyecto (INSERT en projects)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: cuando se crea un proyecto (convert_quotation_to_project),
-- enviar WA de bienvenida al cliente con el nombre del proyecto y
-- del diseñador asignado.
--
-- Template Meta: proyecto_iniciado_v1
--   Parámetros:
--     {{1}} = primer nombre del cliente
--     {{2}} = nombre del proyecto
--     {{3}} = nombre del diseñador (o "nuestro equipo" si no hay)
--
--   Texto sugerido para crear en Meta BM:
--     "¡Hola {{1}}! 🎉 Tu proyecto *{{2}}* ya está en marcha.
--      El equipo de diseño a cargo es {{3}} y estarán en contacto
--      contigo muy pronto. ¡Gracias por confiar en Innovar Cocinas!"
--
-- ESTADO DEL TEMPLATE: pendiente de creación en Meta BM por Robert.
--   Mientras no esté aprobado, las notificaciones se encolarán como
--   'pending' y no se enviarán hasta que el worker las encuentre.
--   El worker las marcará como failed al intentar enviar → acción:
--   crear el template y el worker las reintentará automáticamente.
--   (Se recomienda resetear a 'pending' después de la aprobación.)
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_wa_project_welcome()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_client        RECORD;
  v_designer_name TEXT;
  v_first_name    TEXT;
BEGIN
  -- Buscar cliente
  SELECT id, name, whatsapp_phone
    INTO v_client
    FROM public.clients
   WHERE id = NEW.client_id;

  IF v_client.whatsapp_phone IS NULL OR length(trim(v_client.whatsapp_phone)) < 10 THEN
    RETURN NEW;
  END IF;

  -- Buscar diseñador asignado
  SELECT full_name INTO v_designer_name
    FROM public.profiles
   WHERE id = NEW.designer_id;

  v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);

  -- Guard: solo una bienvenida por proyecto
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE event_type = 'project.created'
      AND event_reference_id = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_queue (
    event_type, event_reference_id,
    entity_type, entity_reference_id,
    recipient_type, recipient_reference_id,
    recipient_name, recipient_phone,
    template_name, template_language, template_parameters,
    status
  ) VALUES (
    'project.created',
    NEW.id::text,
    'project',
    NEW.id::text,
    'client',
    v_client.id::text,
    v_first_name,
    v_client.whatsapp_phone,
    'proyecto_iniciado_v1',
    'es',
    jsonb_build_object(
      '1', v_first_name,
      '2', COALESCE(NEW.name, 'tu proyecto'),
      '3', COALESCE(v_designer_name, 'nuestro equipo de diseño')
    ),
    'pending'
  );

  RETURN NEW;
END;
$$;

-- Crear trigger AFTER INSERT en projects
DROP TRIGGER IF EXISTS trg_wa_project_welcome ON public.projects;
CREATE TRIGGER trg_wa_project_welcome
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_wa_project_welcome();

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_wa_project_welcome ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_wa_project_welcome();
-- =====================================================
