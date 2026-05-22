-- =====================================================
-- MIGRACIÓN 008: WhatsApp — usar solo el primer nombre en el saludo
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor en este orden de arriba a abajo.
--   Idempotente — se puede correr varias veces sin romper nada.
--
-- QUÉ HACE:
--   Cuando el sistema encola un WhatsApp para enviar al cliente
--   (tabla notification_queue), si el primer parámetro del template
--   es el nombre completo del destinatario, lo recorta para que solo
--   contenga el primer nombre.
--
--   Antes:   "Hola Robert Virona, gracias por contactar..."
--   Después: "Hola Robert, gracias por contactar..."
--
-- POR QUÉ ASÍ Y NO MODIFICANDO LA FUNCIÓN ORIGINAL:
--   La función que encola los mensajes (fn_enqueue_whatsapp_new_lead
--   y similares) vive en la base de datos pero no en el repo de código.
--   Esta migración no la toca. Instala una "capa de seguridad" que
--   actúa sobre cualquier mensaje que se inserte en la cola, sin
--   importar qué función lo haya creado. Esto es robusto, reversible
--   y no rompe lógica existente.
--
-- SEGURIDAD — cuándo SÍ se aplica el recorte:
--   1. El mensaje tiene template_parameters como array JSON
--   2. El primer elemento de ese array es un texto con más de una palabra
--   3. El nombre del destinatario (recipient_name) empieza con ese mismo
--      texto — es decir, el parámetro {{1}} ES el nombre del destinatario
--      y no otra cosa (como nombre de proyecto, número, etc.)
--
--   Si cualquiera de las 3 condiciones falla, el mensaje pasa sin cambios.
--   Esto protege otros templates donde {{1}} podría ser una cantidad,
--   un código de cotización, un nombre de producto, etc.
-- =====================================================

-- -------------------------------------------------------
-- 1) Helper: extrae el primer nombre de un texto
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_first_name(full_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN full_name IS NULL THEN NULL
    ELSE split_part(btrim(regexp_replace(full_name, '\s+', ' ', 'g')), ' ', 1)
  END;
$$;

COMMENT ON FUNCTION public.app_first_name(TEXT) IS
  'Devuelve el primer nombre (primera palabra) de un nombre completo. Normaliza espacios múltiples.';

-- -------------------------------------------------------
-- 2) Trigger function: normaliza el parámetro {{1}} si es el nombre del destinatario
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notification_queue_first_name_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  first_param  TEXT;
  shortened    TEXT;
BEGIN
  -- Sin parámetros o no es array → no hacer nada
  IF NEW.template_parameters IS NULL
     OR jsonb_typeof(NEW.template_parameters) <> 'array'
     OR jsonb_array_length(NEW.template_parameters) = 0
  THEN
    RETURN NEW;
  END IF;

  -- Extraer el primer parámetro como texto
  first_param := NEW.template_parameters->>0;

  -- Sin primer parámetro o de una sola palabra → no hacer nada
  IF first_param IS NULL OR position(' ' IN btrim(first_param)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Salvaguarda: solo recortar si el primer parámetro coincide con
  -- el nombre del destinatario (es decir, {{1}} ES el nombre de la persona,
  -- no algún otro dato como nombre de proyecto o producto).
  IF NEW.recipient_name IS NULL
     OR btrim(NEW.recipient_name) <> btrim(first_param)
  THEN
    RETURN NEW;
  END IF;

  -- Recortar al primer nombre
  shortened := public.app_first_name(first_param);

  -- Reemplazar el elemento 0 del array preservando los demás parámetros
  NEW.template_parameters := jsonb_set(
    NEW.template_parameters,
    '{0}',
    to_jsonb(shortened),
    false
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_notification_queue_first_name_only() IS
  'Antes de insertar en notification_queue, si el primer parámetro del template es el nombre completo del destinatario, lo recorta a solo el primer nombre. Para saludos más amistosos en WhatsApp.';

-- -------------------------------------------------------
-- 3) Instalar el trigger (BEFORE INSERT) — idempotente
-- -------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notification_queue_first_name_only
  ON public.notification_queue;

CREATE TRIGGER trg_notification_queue_first_name_only
  BEFORE INSERT ON public.notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notification_queue_first_name_only();

-- -------------------------------------------------------
-- 4) Limpieza de mensajes pendientes (opcional pero recomendado)
-- -------------------------------------------------------
-- Si hay mensajes ya encolados con status 'pending' donde el primer
-- parámetro es el nombre completo del destinatario, recortarlos ahora
-- para que cuando salgan en el próximo ciclo del cron también lleguen
-- con solo el primer nombre.
UPDATE public.notification_queue
SET template_parameters = jsonb_set(
      template_parameters,
      '{0}',
      to_jsonb(public.app_first_name(template_parameters->>0)),
      false
    )
WHERE status = 'pending'
  AND template_parameters IS NOT NULL
  AND jsonb_typeof(template_parameters) = 'array'
  AND jsonb_array_length(template_parameters) >= 1
  AND position(' ' IN btrim(template_parameters->>0)) > 0
  AND recipient_name IS NOT NULL
  AND btrim(recipient_name) = btrim(template_parameters->>0);

-- -------------------------------------------------------
-- 5) Verificación — debe devolver el nombre del trigger recién creado
-- -------------------------------------------------------
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'notification_queue'
  AND trigger_name        = 'trg_notification_queue_first_name_only';
