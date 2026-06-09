-- =====================================================
-- 043 — Fix booking_link_v1: URL personalizada + parámetros en objeto
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
-- Causa: migración 042 sobrescribió notify_lead_followup_flow con:
--   - URL genérica '/agendar' en vez de '/v/' || NEW.short_code
--   - jsonb_build_array() en vez de jsonb_build_object('1',...,'2',...,'3',...)
-- Síntoma: clientes reciben link que muestra "Link no válido" al abrirlo.
-- Fix: restaurar URL personalizada y formato objeto de parámetros.
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_lead_followup_flow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_client          RECORD;
  v_assigned_name   TEXT;
  v_base_url        TEXT;
  v_public_url      TEXT;
  v_anon_token      TEXT;
  v_api_url         TEXT;
BEGIN
  SELECT *
    INTO v_client
    FROM public.clients
   WHERE id = NEW.client_id;

  IF v_client.whatsapp_phone IS NULL OR length(v_client.whatsapp_phone) < 10 THEN
    RETURN NEW;
  END IF;

  SELECT full_name
    INTO v_assigned_name
    FROM public.profiles
   WHERE id = NEW.assigned_to;

  -- WELCOME WA: welcome_lead_v1
  INSERT INTO public.notification_queue (
    event_type, event_reference_id, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead.welcome',
    NEW.id::text,
    v_client.name,
    v_client.whatsapp_phone,
    'welcome_lead_v1', 'es',
    jsonb_build_object('1', split_part(COALESCE(v_client.name, 'cliente'), ' ', 1)),
    'pending'
  ) ON CONFLICT DO NOTHING;

  -- BOOKING LINK WA: booking_link_v1 con URL personalizada /v/{short_code}
  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );
  v_public_url := v_base_url || '/v/' || NEW.short_code;

  INSERT INTO public.notification_queue (
    event_type, event_reference_id, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead.booking_link',
    NEW.id::text,
    v_client.name,
    v_client.whatsapp_phone,
    'booking_link_v1', 'es',
    jsonb_build_object(
      '1', split_part(COALESCE(v_client.name, 'cliente'), ' ', 1),
      '2', v_public_url,
      '3', COALESCE(v_assigned_name, 'nuestro equipo')
    ),
    'pending'
  ) ON CONFLICT DO NOTHING;

  -- EMAIL via smart-api solo para clientes existentes (> 30 seg antes)
  IF (NEW.created_at - v_client.created_at) > INTERVAL '30 seconds' THEN
    SELECT value->>'token' INTO v_anon_token
      FROM public.system_settings WHERE key = 'supabase_anon_key';

    IF v_anon_token IS NOT NULL AND length(v_anon_token) > 10 THEN
      v_api_url := COALESCE(
        (SELECT value->>'url' FROM public.system_settings WHERE key = 'smart_api_endpoint'),
        'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/smart-api'
      );
      PERFORM net.http_post(
        url     := v_api_url,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_anon_token
        ),
        body    := jsonb_build_object('record', row_to_json(v_client))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- ROLLBACK
-- =====================================================
-- No hay rollback funcional — el estado anterior (v_base_url || '/agendar')
-- era incorrecto. Para volver: restaurar desde git la función de 042.
-- =====================================================
