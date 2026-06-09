-- =====================================================
-- 014 — WhatsApp Lead Follow-up Flow + Public Booking Link
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Requiere: 008-013 aplicados (opportunities, visits, notification_queue
--           y validate_public_token ya existen).
-- Aplicar: Supabase Dashboard → SQL Editor o Management API.
-- Rollback: ver bloque al pie del archivo (comentado).
--
-- Qué hace:
--   1. Agrega `opportunities.public_token_expires_at` (7 días desde create).
--   2. Agrega registro en `system_settings` con la URL pública base del CRM.
--   3. Trigger AFTER INSERT en opportunities que encola 2 mensajes
--      en `notification_queue` (welcome_lead_v1 + booking_link_v1).
--   4. RPC `get_public_booking_context(p_token TEXT)` — devuelve datos
--      del lead + comercial asignado para la página pública.
--   5. RPC `get_public_visit_slots(p_token, p_from, p_to)` — wrapper
--      público sobre `get_visit_slots()` que valida el token primero.
--   6. RPC `book_public_visit(p_token, p_scheduled_at)` — inserta en
--      `visits` con scheduled_via='public_link'. El trigger existente
--      `visit_to_task_mirror` espeja a tasks automáticamente; el trigger
--      `validate_visit_completion` avanza opportunity a 'visit_scheduled'
--      lo cual invalida el token (validate_public_token exige
--      status IN ('new','contacted')).
--
-- Reusa todo lo que ya existe — no duplica lógica de slots ni de
-- validación de tokens.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ALTER opportunities · expiración del token
-- =====================================================
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;

-- Backfill: tokens existentes vigentes ganan 7 días desde NOW().
-- (Para opportunities ya creadas, asumimos que su token sigue activo.)
UPDATE public.opportunities
   SET public_token_expires_at = NOW() + INTERVAL '7 days'
 WHERE public_token_expires_at IS NULL
   AND deleted_at IS NULL
   AND status IN ('new','contacted');

-- Default forward-looking: cualquier nueva opportunity arranca con
-- expiración 7 días (la app no necesita setearla explícitamente).
ALTER TABLE public.opportunities
  ALTER COLUMN public_token_expires_at SET DEFAULT (NOW() + INTERVAL '7 days');

-- =====================================================
-- 2. system_settings · URL pública base
-- =====================================================
-- Configurable sin redeploy. La Edge Function la lee al construir el link.
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'public_app_base_url',
  jsonb_build_object('url', 'https://crm-innovar-app-2026.vercel.app'),
  'Base URL del CRM público (usada en links de WhatsApp para agendamiento).'
)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 3. Trigger: encolar mensajes de WhatsApp al crear opportunity
-- =====================================================
-- AFTER INSERT — corre DESPUÉS de:
--   · trg_opp_round_robin (BEFORE INSERT) → asigna NEW.assigned_to.
-- Por lo que aquí ya tenemos assigned_to + public_token + expires_at populados.
--
-- Skip silencioso si:
--   · cliente sin whatsapp_phone (<10 dígitos)
--   · opportunity creada con data_origin='manual' por staff sin lead real
--     (heurística: si no hay whatsapp, no hay a quién mandar).

CREATE OR REPLACE FUNCTION public.notify_lead_followup_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_client          RECORD;
  v_assigned_name   TEXT;
  v_base_url        TEXT;
  v_public_url      TEXT;
BEGIN
  -- 1. Datos del cliente
  SELECT id, name, whatsapp_phone
    INTO v_client
    FROM public.clients
   WHERE id = NEW.client_id;

  IF v_client.whatsapp_phone IS NULL OR length(v_client.whatsapp_phone) < 10 THEN
    RETURN NEW;  -- sin teléfono utilizable → no encolamos nada
  END IF;

  -- 2. Base URL del CRM público
  v_base_url := COALESCE(
    (SELECT value->>'url' FROM public.system_settings WHERE key = 'public_app_base_url'),
    'https://crm-innovar-app-2026.vercel.app'
  );
  v_public_url := v_base_url || '/agendar/' || NEW.public_token;

  -- 3. Nombre del comercial asignado (puede ser NULL si round-robin no encontró nadie)
  SELECT full_name INTO v_assigned_name
    FROM public.profiles
   WHERE id = NEW.assigned_to;

  -- 4. Mensaje 1 — bienvenida
  INSERT INTO public.notification_queue (
    event_type, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead_welcome',
    v_client.name,
    v_client.whatsapp_phone,
    'welcome_lead_v1', 'es',
    jsonb_build_object('1', COALESCE(v_client.name, 'Hola')),
    'pending'
  );

  -- 5. Mensaje 2 — link público de agendamiento
  -- El worker los procesa por created_at ASC → orden garantizado.
  INSERT INTO public.notification_queue (
    event_type, recipient_name, recipient_phone,
    template_name, template_language, template_parameters, status
  ) VALUES (
    'lead_booking_link',
    v_client.name,
    v_client.whatsapp_phone,
    'booking_link_v1', 'es',
    jsonb_build_object(
      '1', COALESCE(v_client.name, 'Hola'),
      '2', v_public_url,
      '3', COALESCE(v_assigned_name, 'tu asesor asignado')
    ),
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_lead_followup_flow ON public.opportunities;
CREATE TRIGGER trg_notify_lead_followup_flow
  AFTER INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lead_followup_flow();

-- =====================================================
-- 4. RPC pública: get_public_booking_context
-- =====================================================
-- Llamada SIN auth desde la página /agendar/:token.
-- Valida que el token esté vigente Y la opportunity esté en estado
-- agendable (new/contacted, status que `validate_public_token` exige).

CREATE OR REPLACE FUNCTION public.get_public_booking_context(p_token TEXT)
RETURNS TABLE (
  opportunity_id  UUID,
  client_name     TEXT,
  client_phone    TEXT,
  staff_id        UUID,
  staff_name      TEXT,
  expires_at      TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id,
         c.name,
         c.whatsapp_phone,
         o.assigned_to,
         p.full_name,
         o.public_token_expires_at
    FROM public.opportunities o
    JOIN public.clients c ON c.id = o.client_id AND c.deleted_at IS NULL
    LEFT JOIN public.profiles p ON p.id = o.assigned_to
   WHERE o.public_token = p_token
     AND o.deleted_at IS NULL
     AND o.status IN ('new','contacted')
     AND (o.public_token_expires_at IS NULL OR o.public_token_expires_at > NOW())
   LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 5. RPC pública: get_public_visit_slots
-- =====================================================
-- Wrapper sobre get_visit_slots() que valida el token primero y
-- resuelve el commercial_id automáticamente.

CREATE OR REPLACE FUNCTION public.get_public_visit_slots(
  p_token TEXT,
  p_from  DATE,
  p_to    DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, is_available BOOLEAN) AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  -- 1. Validar token + extraer comercial asignado
  SELECT staff_id INTO v_staff_id
    FROM public.get_public_booking_context(p_token);

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido, vencido o sin comercial asignado'
      USING ERRCODE = '22023';
  END IF;

  -- 2. Delegar al cálculo de slots existente (martes/jueves, sin holidays)
  RETURN QUERY
  SELECT g.slot_start, g.is_available
    FROM public.get_visit_slots(v_staff_id, p_from, p_to) g;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 6. RPC pública: book_public_visit
-- =====================================================
-- Inserta en visits con scheduled_via='public_link'.
-- Los triggers existentes hacen el resto:
--   · validate_visit_completion → propaga opportunity a 'visit_scheduled'
--   · visit_to_task_mirror → espeja a tasks (visible en /agenda)
-- Y al pasar la opp a 'visit_scheduled', validate_public_token deja de
-- aceptar el token (status ya no IN ('new','contacted')) — token invalidado.

CREATE OR REPLACE FUNCTION public.book_public_visit(
  p_token         TEXT,
  p_scheduled_at  TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_ctx        RECORD;
  v_existing   UUID;
  v_visit_id   UUID;
BEGIN
  -- 1. Validar contexto
  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token);
  IF v_ctx.opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Este link ya no es válido. Contacta a Innovar.'
      USING ERRCODE = '22023';
  END IF;

  IF v_ctx.staff_id IS NULL THEN
    RAISE EXCEPTION 'No hay comercial asignado a esta oportunidad.'
      USING ERRCODE = '22023';
  END IF;

  -- 2. Validar que el slot solicitado todavía esté disponible
  SELECT v.id INTO v_existing
    FROM public.visits v
   WHERE v.visited_by = v_ctx.staff_id
     AND v.scheduled_at = p_scheduled_at
     AND v.status NOT IN ('cancelada','no_show')
     AND v.deleted_at IS NULL
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Ese horario ya no está disponible. Por favor elige otro.'
      USING ERRCODE = '23505';
  END IF;

  -- 3. Crear visit. duration_minutes=90 es default del schema.
  INSERT INTO public.visits (
    opportunity_id, scheduled_at, visited_by, modality,
    status, scheduled_via, created_by, notes
  ) VALUES (
    v_ctx.opportunity_id,
    p_scheduled_at,
    v_ctx.staff_id,
    'presencial',
    'agendada',
    'public_link',
    v_ctx.staff_id,  -- attribución: el comercial asignado figura como creador
    'Agendada por el cliente desde link público (WhatsApp).'
  )
  RETURNING id INTO v_visit_id;

  -- 4. Devolver datos para la pantalla de confirmación
  RETURN jsonb_build_object(
    'visit_id',     v_visit_id,
    'scheduled_at', p_scheduled_at,
    'staff_name',   v_ctx.staff_name,
    'client_name',  v_ctx.client_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. GRANTS para acceso anónimo
-- =====================================================
-- Estas 3 RPCs son SECURITY DEFINER y validan token internamente,
-- así que es seguro exponerlas al rol anon.

GRANT EXECUTE ON FUNCTION public.get_public_booking_context(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_visit_slots(TEXT, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_public_visit(TEXT, TIMESTAMPTZ) TO anon, authenticated;

COMMIT;

-- =====================================================
-- FIN 014 · Flujo WhatsApp + booking público listo
-- =====================================================
-- Tests rápidos:
--   SELECT * FROM public.get_public_booking_context('<token_de_una_opportunity_new>');
--   SELECT * FROM public.get_public_visit_slots('<token>', CURRENT_DATE, CURRENT_DATE + 14);
--
-- Rollback (descomentar para deshacer):
--   DROP FUNCTION IF EXISTS public.book_public_visit(TEXT, TIMESTAMPTZ);
--   DROP FUNCTION IF EXISTS public.get_public_visit_slots(TEXT, DATE, DATE);
--   DROP FUNCTION IF EXISTS public.get_public_booking_context(TEXT);
--   DROP TRIGGER IF EXISTS trg_notify_lead_followup_flow ON public.opportunities;
--   DROP FUNCTION IF EXISTS public.notify_lead_followup_flow();
--   ALTER TABLE public.opportunities DROP COLUMN IF EXISTS public_token_expires_at;
--   DELETE FROM public.system_settings WHERE key = 'public_app_base_url';
-- =====================================================
