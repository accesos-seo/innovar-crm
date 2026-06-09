-- =====================================================
-- 048 — Notificador de Instalación Programada
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: cuando el equipo registra la fecha de
-- instalación (scheduled_install_date pasa de NULL
-- a NOT NULL), enviar un WhatsApp automático al
-- cliente confirmándole la fecha exacta.
--
-- Template Meta requerida: instalacion_programada_v1
--   {{1}} = nombre del cliente
--   {{2}} = fecha en español (ej: "lunes 15 de julio de 2026")
--
-- NOTA: activar este trigger solo cuando la template
-- Meta esté en estado APPROVED.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_notify_instalacion_programada()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id     UUID;
  v_client_name   TEXT;
  v_client_phone  TEXT;
  v_fecha_texto   TEXT;
  v_notif_id      UUID;

  -- Nombres de meses en español
  v_meses TEXT[] := ARRAY[
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];
  -- Nombres de días en español
  v_dias TEXT[] := ARRAY[
    'domingo','lunes','martes','miércoles','jueves','viernes','sábado'
  ];
BEGIN
  -- Solo cuando scheduled_install_date pasa de NULL a NOT NULL
  IF NEW.scheduled_install_date IS NULL OR OLD.scheduled_install_date IS NOT NULL THEN
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

  -- Guard de idempotencia: una sola notificación por proyecto
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
     WHERE payload->>'project_id' = NEW.id::text
       AND event_type = 'project.instalacion_programada'
  ) THEN
    RETURN NEW;
  END IF;

  -- Formatear fecha en español: "lunes 15 de julio de 2026"
  v_fecha_texto := v_dias[EXTRACT(DOW FROM NEW.scheduled_install_date)::int + 1]
    || ' ' || EXTRACT(DAY FROM NEW.scheduled_install_date)::int::text
    || ' de ' || v_meses[EXTRACT(MONTH FROM NEW.scheduled_install_date)::int]
    || ' de ' || EXTRACT(YEAR FROM NEW.scheduled_install_date)::int::text;

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
    'instalacion_programada_v1',
    jsonb_build_array(
      COALESCE(split_part(v_client_name, ' ', 1), v_client_name),
      v_fecha_texto
    ),
    'project.instalacion_programada',
    jsonb_build_object(
      'project_id',         NEW.id,
      'client_id',          v_client_id,
      'install_date',       NEW.scheduled_install_date::text,
      'install_date_texto', v_fecha_texto
    ),
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_instalacion_programada ON public.projects;
CREATE TRIGGER trg_notify_instalacion_programada
  AFTER UPDATE OF scheduled_install_date ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_instalacion_programada();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- 1) Usar un proyecto real sin fecha de instalación:
--    UPDATE public.projects
--       SET scheduled_install_date = CURRENT_DATE + INTERVAL '7 days'
--     WHERE id = '<project_uuid>'
--       AND scheduled_install_date IS NULL;
--
--    SELECT recipient_phone, template_name, template_params, status
--      FROM public.notification_queue
--     WHERE event_type = 'project.instalacion_programada'
--     ORDER BY created_at DESC LIMIT 1;
--    -- template_params[1] debe ser la fecha en español correcta
--
-- 2) Idempotencia:
--    Actualizar con la misma fecha: el guard bloquea duplicado.

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_notify_instalacion_programada ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_notify_instalacion_programada();
-- =====================================================
