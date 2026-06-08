-- =====================================================
-- 028 — Email para clientes existentes vía opportunity trigger
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
--
-- Problema:
--   El trigger tr_on_new_lead_email solo dispara en clients INSERT.
--   Cuando un cliente existente genera una nueva oportunidad, no hay
--   INSERT en clients → no se envía email al equipo interno.
--
-- Solución:
--   Actualizar notify_lead_followup_flow (trigger en opportunities INSERT)
--   para también llamar smart-api con el row del cliente cuando este ya
--   existía antes de la oportunidad (created_at diff > 30 seg).
--   Esto evita emails duplicados para clientes NUEVOS (que ya reciben
--   email de tr_on_new_lead_email en el mismo segundo).
--
--   Adicionalmente: SELECT * en lugar de SELECT id, name, whatsapp_phone
--   para que el smart-api reciba los mismos campos que en el INSERT nativo.
--
-- Rollback:
--   Ver migración 024 para la versión anterior de esta función.
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_lead_followup_flow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_client          RECORD;
  v_assigned_name   TEXT;
  v_base_url        TEXT;
  v_public_url      TEXT;
BEGIN
  SELECT *
    INTO v_client
    FROM public.clients
   WHERE id = NEW.client_id;

  IF v_client.whatsapp_phone IS NULL OR length(v_client.whatsapp_phone) < 10 THEN
    RETURN NEW;
  END IF;

  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );
  v_public_url := v_base_url || '/v/' || NEW.short_code;

  SELECT full_name INTO v_assigned_name
    FROM public.profiles
   WHERE id = NEW.assigned_to;

  -- WELCOME WA: bienvenidas_clientes como fallback (aprobada) hasta que
  -- Heduin cree y apruebe welcome_lead_v1 en Meta BM.
  INSERT INTO public.notification_queue (
    event_type, event_reference_id, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead_welcome',
    NEW.id::text,
    v_client.name,
    v_client.whatsapp_phone,
    'bienvenidas_clientes', 'es',
    jsonb_build_array(split_part(COALESCE(v_client.name, 'cliente'), ' ', 1) || '.'),
    'pending'
  ) ON CONFLICT DO NOTHING;

  -- BOOKING LINK: pendiente hasta que booking_link_v1 sea aprobada.
  INSERT INTO public.notification_queue (
    event_type, event_reference_id, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead_booking_link',
    NEW.id::text,
    v_client.name,
    v_client.whatsapp_phone,
    'booking_link_v1', 'es',
    jsonb_build_object(
      '1', split_part(COALESCE(v_client.name, 'cliente'), ' ', 1),
      '2', v_public_url,
      '3', COALESCE(v_assigned_name, 'tu asesor asignado')
    ),
    'pending'
  ) ON CONFLICT DO NOTHING;

  -- EMAIL vía smart-api solo para clientes EXISTENTES.
  -- Clientes nuevos ya reciben email por tr_on_new_lead_email (clients INSERT).
  -- Detectamos cliente existente si fue creado >30 seg antes que la oportunidad.
  -- NOTA: La anon key abajo es PÚBLICA por diseño de Supabase (ya está en el bundle
  -- del frontend). Los triggers PG no tienen acceso a variables de entorno, por lo
  -- que debe hardcodearse aquí. Patrón idéntico al de fn_trigger_welcome_email (migración 009).
  -- NO es una credencial secreta — es la clave pública de la API.
  IF (NEW.created_at - v_client.created_at) > INTERVAL '30 seconds' THEN
    PERFORM net.http_post(
      url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/smart-api',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkemJqcHRvemVxY2JuYXFodHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDU3MTQsImV4cCI6MjA5MTY4MTcxNH0.M4-nl-r-M3sMNGUoJoyRXar8dwdnUkAJGR9YGkV5bNk'
      ),
      body    := jsonb_build_object('record', row_to_json(v_client))
    );
  END IF;

  RETURN NEW;
END;
$$;
