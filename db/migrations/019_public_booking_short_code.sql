-- =====================================================
-- 019 — Short URL codes para el flujo público de booking
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Requiere: 014 aplicada (opportunities.public_token vigente).
-- Aplicar: vía Management API.
-- Rollback: ver bloque al pie.
--
-- Qué hace:
--   1. Agrega `opportunities.short_code` (6 chars base62, UNIQUE).
--   2. Función `generate_unique_short_code()` que genera el código y
--      reintenta hasta encontrar uno libre (probabilidad de colisión a
--      62^6 ≈ 56.8 mil millones de combinaciones).
--   3. Trigger BEFORE INSERT que pobla NEW.short_code si vino NULL.
--   4. Backfill de opps existentes.
--   5. RPC pública `resolve_short_code(p_code)` que devuelve el
--      `public_token` si el código existe y la opp aún está agendable.
--   6. Actualiza el trigger `notify_lead_followup_flow` (creado en 014)
--      para que el WhatsApp envíe `/v/<short_code>` en lugar del token.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ALTER opportunities · short_code
-- =====================================================
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

-- Index ya implícito por UNIQUE — agregamos uno explícito para lookups rápidos
CREATE INDEX IF NOT EXISTS idx_opportunities_short_code
  ON public.opportunities(short_code)
  WHERE short_code IS NOT NULL AND deleted_at IS NULL;

-- =====================================================
-- 2. Generador de códigos base62 de 6 chars con uniqueness
-- =====================================================
-- Caracteres seguros: alfanumérico sin chars ambiguos (0/O, 1/l/I) para
-- copiar/pegar en WhatsApp sin errores.

CREATE OR REPLACE FUNCTION public.generate_unique_short_code()
RETURNS TEXT AS $$
DECLARE
  -- 56 chars: omitimos 0, O, o, 1, l, I, i — confusos en texto.
  v_alphabet   TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  v_code       TEXT;
  v_attempts   INT  := 0;
  v_exists     BOOLEAN;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substring(v_alphabet, 1 + floor(random() * length(v_alphabet))::INT, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.opportunities WHERE short_code = v_code) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      -- Defensa: si tras 50 intentos seguimos chocando, algo está muy mal.
      RAISE EXCEPTION 'No se pudo generar un short_code único tras 50 intentos';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- =====================================================
-- 3. Trigger BEFORE INSERT que pobla short_code
-- =====================================================

CREATE OR REPLACE FUNCTION public.assign_short_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_unique_short_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_short_code ON public.opportunities;
CREATE TRIGGER trg_assign_short_code
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_short_code();

-- =====================================================
-- 4. Backfill · opps existentes sin short_code
-- =====================================================
-- Loop manual: SET en batch puede chocar con el UNIQUE si dos rows
-- reciben el mismo código en el mismo UPDATE.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.opportunities
     WHERE short_code IS NULL
       AND deleted_at IS NULL
  LOOP
    UPDATE public.opportunities
       SET short_code = public.generate_unique_short_code()
     WHERE id = r.id;
  END LOOP;
END $$;

-- =====================================================
-- 5. RPC pública: resolve_short_code
-- =====================================================
-- Devuelve el public_token si el código existe y la opp está agendable.
-- El frontend usa esto para mapear /v/<code> → token, luego llama a las
-- RPCs existentes con ese token.

CREATE OR REPLACE FUNCTION public.resolve_short_code(p_code TEXT)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT public_token INTO v_token
    FROM public.opportunities
   WHERE short_code = p_code
     AND deleted_at IS NULL
     AND status IN ('new','contacted')
     AND (public_token_expires_at IS NULL OR public_token_expires_at > NOW())
   LIMIT 1;

  RETURN v_token;  -- NULL si no existe / vencido / ya agendado
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.resolve_short_code(TEXT) TO anon, authenticated;

-- =====================================================
-- 6. Actualizar trigger 014 para usar short_code en el link
-- =====================================================
-- Reescribimos `notify_lead_followup_flow` (definido en 014) para que el
-- segundo mensaje (booking_link_v1) contenga `/v/<short_code>` en lugar
-- de `/agendar/<public_token>`. El público_token sigue siendo válido en
-- la URL larga (compatibilidad hacia atrás).

CREATE OR REPLACE FUNCTION public.notify_lead_followup_flow()
RETURNS TRIGGER AS $$
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
  -- ⬇️ usa /v/<short_code> en lugar de /agendar/<public_token>
  v_public_url := v_base_url || '/v/' || NEW.short_code;

  SELECT full_name INTO v_assigned_name
    FROM public.profiles
   WHERE id = NEW.assigned_to;

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
-- (trigger trg_notify_lead_followup_flow ya existe, solo cambia el body)

COMMIT;

-- =====================================================
-- FIN 019 · Short URL flow listo
-- =====================================================
-- Test rápido:
--   SELECT short_code FROM opportunities WHERE deleted_at IS NULL AND status='new' LIMIT 5;
--   SELECT public.resolve_short_code('<algún_short_code>');
--
-- Rollback:
--   -- Revertir trigger 014 al SQL original (re-aplicar 014 después de quitar 019):
--   -- DROP la nueva versión de notify_lead_followup_flow, luego re-CREATE con la versión 014.
--   DROP FUNCTION IF EXISTS public.resolve_short_code(TEXT);
--   DROP TRIGGER IF EXISTS trg_assign_short_code ON public.opportunities;
--   DROP FUNCTION IF EXISTS public.assign_short_code();
--   DROP FUNCTION IF EXISTS public.generate_unique_short_code();
--   DROP INDEX IF EXISTS idx_opportunities_short_code;
--   ALTER TABLE public.opportunities DROP COLUMN IF EXISTS short_code;
-- =====================================================
