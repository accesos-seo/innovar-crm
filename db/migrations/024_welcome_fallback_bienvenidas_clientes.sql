-- =====================================================
-- 024 — Fallback welcome: bienvenidas_clientes mientras Meta aprueba welcome_lead_v1
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
-- Contexto:
--   welcome_lead_v1 y booking_link_v1 aún no existen en el Business Manager
--   de Innovar en Meta → error 132001 al intentar enviarlas.
--   Heduin (encargado Meta) creará y someterá los templates a aprobación.
--
-- Fix temporal:
--   lead_welcome  → usa bienvenidas_clientes (1 var: nombre, aprobada, 14 envíos OK)
--   lead_booking_link → sigue con booking_link_v1 en status pending para que el
--                       worker lo reintente cuando el template sea aprobado.
--
-- Rollback:
--   Aplicar migración 025_restore_welcome_lead_v1.sql cuando ambos templates
--   estén aprobados en Meta. Cambiar template_name a 'welcome_lead_v1' y
--   ajustar template_parameters al formato {1: nombre}.
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_lead_followup_flow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_client          RECORD;
  v_assigned_name   TEXT;
  v_base_url        TEXT;
  v_public_url      TEXT;
BEGIN
  SELECT id, name, whatsapp_phone
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

  -- WELCOME: bienvenidas_clientes como fallback (aprobada) hasta que
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
  -- El worker lo reintentara cuando el template exista en Meta.
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

  RETURN NEW;
END;
$$;
