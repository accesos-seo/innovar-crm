-- Snapshot pre-055 (2026-06-10): funciones legacy eliminadas por 055_postventa_module.sql
-- Triggers originales:
--   CREATE TRIGGER trg_auto_post_delivery AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION fn_auto_post_delivery();
--   CREATE TRIGGER trg_wa_satisfaction_survey AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION fn_wa_satisfaction_survey();

CREATE OR REPLACE FUNCTION public.fn_auto_post_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.status = 'entregado' AND (OLD.status IS DISTINCT FROM 'entregado') THEN

    INSERT INTO satisfaction_surveys (project_id, client_id, status)
    VALUES (NEW.id, NEW.client_id, 'pending');

    INSERT INTO warranties (project_id, client_id, warranty_months, starts_at, expires_at, status)
    VALUES (NEW.id, NEW.client_id, 12, now(), now() + INTERVAL '12 months', 'active');

    INSERT INTO notifications (user_id, title, body, notification_type, related_table, related_id, priority)
    SELECT 
      p.id,
      '📦 Proyecto entregado — encuesta y garantía creadas',
      'El proyecto "' || NEW.name || '" fue marcado como entregado. Se creó encuesta de satisfacción y garantía de 12 meses automáticamente.',
      'post_delivery',
      'projects',
      NEW.id,
      2
    FROM profiles p WHERE p.role = 'admin' LIMIT 1;

  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.fn_wa_satisfaction_survey()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client      clients%ROWTYPE;
  v_survey_id   UUID;
  v_survey_link TEXT;
  -- ⚠️ Robert: actualiza esta URL con el dominio real de la encuesta
  v_base_url    TEXT := 'https://innovarcocinas.live/encuesta/';
BEGIN
  -- Solo cuando el status cambia A 'entregado'
  IF NEW.status::text != 'entregado' THEN RETURN NEW; END IF;
  IF OLD.status::text = 'entregado'  THEN RETURN NEW; END IF;

  -- Verificar que no se haya enviado encuesta ya para este proyecto
  IF EXISTS (
    SELECT 1 FROM public.satisfaction_surveys
    WHERE project_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Obtener cliente
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_client.whatsapp_phone IS NULL OR trim(v_client.whatsapp_phone) = '' THEN
    RETURN NEW;
  END IF;

  -- Crear registro de encuesta
  INSERT INTO public.satisfaction_surveys (project_id, client_id, sent_at, status)
  VALUES (NEW.id, NEW.client_id, NOW(), 'sent')
  RETURNING id INTO v_survey_id;

  -- Construir link
  v_survey_link := v_base_url || v_survey_id::text;

  -- Encolar WA al cliente (directo vía enqueue_notification, no por profile)
  PERFORM public.enqueue_notification(
    'satisfaction_survey',                  -- p_event_type
    v_survey_id::text,                      -- p_event_reference_id
    'project',                              -- p_entity_type
    NEW.id::text,                           -- p_entity_reference_id
    'client',                               -- p_recipient_type
    v_client.id::text,                      -- p_recipient_reference_id
    COALESCE(v_client.name, 'Cliente'),     -- p_recipient_name
    v_client.whatsapp_phone,               -- p_recipient_phone
    'satisfaction_survey',                  -- p_template_name
    'es',                                   -- p_template_language
    jsonb_build_array(
      COALESCE(v_client.name, 'Cliente'),   -- {{1}} nombre cliente
      NEW.name,                             -- {{2}} nombre proyecto
      v_survey_link                         -- {{3}} link encuesta
    ),
    jsonb_build_object(
      'project_id', NEW.id,
      'survey_id',  v_survey_id
    )
  );

  RETURN NEW;
END;
$function$
;