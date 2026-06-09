-- =====================================================
-- 023 — Fix 409 en segunda oportunidad del mismo cliente
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
-- Síntoma: al crear una segunda oportunidad para un cliente existente,
--          PostgREST devolvía 409 con "Ya existe un registro con esos datos".
--
-- Causa raíz:
--   El trigger notify_lead_followup_flow() hacía INSERT en notification_queue
--   SIN especificar event_reference_id. La tabla tiene un índice UNIQUE parcial:
--     notification_queue_dedupe_idx ON (event_type,
--       COALESCE(event_reference_id,''), COALESCE(recipient_reference_id,''),
--       recipient_phone, template_name)
--   La primera oportunidad insertaba ('lead_welcome','','',<phone>,'welcome_lead_v1').
--   La segunda oportunidad del mismo cliente generaba el mismo tuple → 23505 → 409.
--
-- Fix: pasar event_reference_id = NEW.id::text en ambos INSERTs.
--      Así el dedup es por oportunidad, no por cliente. Un cliente puede
--      tener múltiples oportunidades sin colisión.
--      Se agrega ON CONFLICT DO NOTHING como defensa extra.
--
-- Rollback: restaurar versión anterior de la función (ver git o migración 022).
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

  INSERT INTO public.notification_queue (
    event_type, event_reference_id, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead_welcome',
    NEW.id::text,
    v_client.name,
    v_client.whatsapp_phone,
    'welcome_lead_v1', 'es',
    jsonb_build_object('1', COALESCE(v_client.name, 'Hola')),
    'pending'
  ) ON CONFLICT DO NOTHING;

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
      '1', COALESCE(v_client.name, 'Hola'),
      '2', v_public_url,
      '3', COALESCE(v_assigned_name, 'tu asesor asignado')
    ),
    'pending'
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
