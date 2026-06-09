-- =====================================================
-- 042 — Fix: welcome_lead_v1 en notify_lead_followup_flow
--           + valid_until en send_quotation_to_client
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Problemas que corrige:
--
--  A) notify_lead_followup_flow usaba template 'bienvenidas_clientes'
--     (no registrado en el TEMPLATE_REGISTRY de la Edge Function).
--     Desde el smoke test 2026-06-09 se confirma que esas filas fallan
--     con "Template 'bienvenidas_clientes' no registrado en la Edge Function".
--     Fix: usar 'welcome_lead_v1' + parámetro como objeto {"1": "<nombre>"}.
--
--  B) send_quotation_to_client no asignaba valid_until al pasar a 'sent'.
--     La cotización quedaba sin fecha de expiración (NULL), lo que hace
--     que accept_public_quotation nunca expire y el sistema de cron de
--     expiración (slice3-expire-accepted-quotations-daily) no funcione.
--     Fix: SET valid_until = CURRENT_DATE + quotation_validity_days de
--     system_settings (default 30 días).
--
--  C) Seed de supabase_anon_key en system_settings (clave PÚBLICA, ya
--     expuesta en el bundle del frontend). Necesaria para que la versión
--     futura de notify_lead_followup_flow (migración 028 actualizada) pueda
--     leerla desde system_settings en lugar de hardcodearla.
--
-- Rollback:
--   Revertir los CREATE OR REPLACE con los cuerpos previos de las funciones.
-- =====================================================

-- ─── A) Fix notify_lead_followup_flow ────────────────────────────────────────
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

  -- WELCOME WA: welcome_lead_v1 (aprobada en Meta BM)
  -- Parámetro: {"1": "<primer_nombre>"} — formato objeto esperado por bodyBuilder
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

  -- Base URL para el link de agendamiento
  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );
  v_public_url := v_base_url || '/agendar';

  -- BOOKING LINK WA: booking_link_v1
  -- {{1}}=nombre cliente {{2}}=link {{3}}=nombre comercial
  IF v_client.whatsapp_phone IS NOT NULL THEN
    INSERT INTO public.notification_queue (
      event_type, event_reference_id, recipient_name, recipient_phone,
      template_name, template_language, template_parameters, status
    ) VALUES (
      'lead.booking_link',
      NEW.id::text,
      v_client.name,
      v_client.whatsapp_phone,
      'booking_link_v1', 'es',
      jsonb_build_array(
        split_part(COALESCE(v_client.name, 'cliente'), ' ', 1),
        v_public_url,
        COALESCE(v_assigned_name, 'nuestro equipo')
      ),
      'pending'
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- EMAIL via smart-api solo para clientes EXISTENTES (> 30 seg antes).
  -- PREREQUISITO: system_settings debe tener key='supabase_anon_key' con value={"token":"<anon>"}.
  -- Si la key no existe el bloque se omite — previene llamadas con 'Bearer NULL'.
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

-- ─── B) Fix send_quotation_to_client — asignar valid_until ────────────────────
CREATE OR REPLACE FUNCTION public.send_quotation_to_client(p_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quotation public.quotations%ROWTYPE;
  v_client    public.clients%ROWTYPE;
  v_role      user_role;
  v_template  TEXT;
  v_base_url  TEXT;
  v_link      TEXT;
  v_validity_days INT;
BEGIN
  v_role := public.get_my_role();
  IF v_role NOT IN ('admin'::user_role, 'super_admin'::user_role, 'comercial'::user_role) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quotation FROM public.quotations
    WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quotation.status <> 'draft'::quotation_status THEN
    RAISE EXCEPTION 'only_drafts_can_be_sent'
      USING DETAIL = format('status=%s', v_quotation.status), ERRCODE = '22023';
  END IF;

  -- Generar número de cotización si aún no tiene
  IF v_quotation.quotation_number IS NULL THEN
    UPDATE public.quotations
      SET quotation_number = public.generate_next_quotation_number(),
          updated_at = now()
      WHERE id = p_quotation_id;
  END IF;

  -- Días de validez configurables (default 30 si la key no existe en system_settings)
  SELECT (value)::int
    INTO v_validity_days
    FROM public.system_settings
   WHERE key = 'quotation_validity_days';

  v_validity_days := COALESCE(v_validity_days, 30);

  -- Marcar como enviada + asignar valid_until
  UPDATE public.quotations
    SET status      = 'sent'::quotation_status,
        valid_until = CURRENT_DATE + v_validity_days,
        updated_at  = now()
    WHERE id = p_quotation_id;

  SELECT * INTO v_quotation FROM public.quotations WHERE id = p_quotation_id;
  SELECT * INTO v_client FROM public.clients WHERE id = v_quotation.client_id;

  v_template := CASE
    WHEN COALESCE(v_quotation.version_number, 1) > 1 THEN 'quotation_v2_sent_v1'
    ELSE 'quotation_sent_v1'
  END;

  -- Base URL configurable vía system_settings (default Vercel prod)
  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );
  -- Usa /c/<short_code> para links cortos (prefer short_code sobre public_token)
  v_link := v_base_url || '/c/' || COALESCE(v_quotation.short_code, v_quotation.public_token);

  IF v_client.whatsapp_phone IS NOT NULL AND v_client.whatsapp_phone <> '' THEN
    PERFORM public.enqueue_notification(
      'quotation_sent',
      v_quotation.id::text,
      'quotation',
      v_quotation.id::text,
      'client',
      v_client.id::text,
      v_client.name,
      v_client.whatsapp_phone,
      v_template,
      'es',
      jsonb_build_array(
        v_client.name,
        COALESCE(v_quotation.quotation_number, '?'),
        v_link
      ),
      jsonb_build_object(
        'quotation_id', v_quotation.id,
        'public_token', v_quotation.public_token,
        'short_code',   v_quotation.short_code
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',          true,
    'quotation_id', v_quotation.id,
    'public_token', v_quotation.public_token,
    'short_code',   v_quotation.short_code,
    'valid_until',  v_quotation.valid_until,
    'link',         v_link
  );
END;
$function$;

-- ─── C) Seed supabase_anon_key en system_settings ────────────────────────────
-- NOTA: Este seed NO se aplica desde este archivo para evitar tokens en git.
-- Aplicar manualmente vía Management API o script de setup:
--
--   INSERT INTO system_settings (key, value, description)
--   VALUES ('supabase_anon_key',
--           jsonb_build_object('token', '<VITE_SUPABASE_ANON_KEY>'),
--           'Clave pública anon de Supabase. Usada por triggers PG para smart-api.')
--   ON CONFLICT (key) DO NOTHING;
--
-- El valor está en .env como VITE_SUPABASE_ANON_KEY (clave pública, no un secreto,
-- pero igualmente no debe hardcodearse en migraciones versionadas en git).

-- ─── Reset filas fallidas corregibles en notification_queue ──────────────────
-- Las filas con 'bienvenidas_clientes' que fallaron por template no registrado
-- ahora pueden reenviarse con el template correcto. Las actualizamos a pending
-- y corregimos el template_name para que el próximo cron las procese.
UPDATE public.notification_queue
SET
  template_name       = 'welcome_lead_v1',
  template_parameters = jsonb_build_object(
    '1',
    COALESCE(
      (SELECT split_part(c.name, ' ', 1)
         FROM public.clients c
         JOIN public.opportunities o ON o.client_id = c.id
        WHERE o.id::text = event_reference_id
        LIMIT 1),
      recipient_name
    )
  ),
  status              = 'pending',
  attempt_count       = 0,
  error_message       = NULL,
  failed_at           = NULL
WHERE template_name = 'bienvenidas_clientes'
  AND status        = 'failed';
