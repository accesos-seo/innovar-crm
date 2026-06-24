-- 068_whatsapp_routing_assistant.sql
--
-- Asistente de WhatsApp para INNOVAR — máquina de estados de ENRUTAMIENTO (sin IA).
--
-- Crea la capa de datos del chatbot determinista que responde a mensajes entrantes
-- (guardados por `meta-whatsapp-webhook` en `whatsapp_incoming_messages`) y enruta
-- al cliente según palabras clave / botones: cotización, agendamiento o asesor humano.
--
-- El cerebro vive en la Edge Function `whatsapp-router`. Esta migración solo crea:
--   1. whatsapp_conversations        — estado de cada conversación (1 fila por teléfono)
--   2. whatsapp_router_outbound_log  — bitácora de cada respuesta enviada (auditoría)
--   3. system_settings.whatsapp_router_config — configuración + COMPUERTA DE SEGURIDAD
--
-- Seguridad: el router arranca en modo "allowlist" → SOLO responde a los números de
-- prueba (Robert/Heduin). Ningún cliente real recibe respuesta automática hasta que un
-- humano cambie `mode` a "live". Esto es el equivalente DRY_RUN para un bot de entrada.
--
-- Idempotente. ROLLBACK al final (comentado).

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. whatsapp_conversations — estado del enrutamiento por teléfono
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text        NOT NULL,                       -- E.164 sin '+', ej. 573001234567
  contact_name     text,                                       -- nombre de perfil de WhatsApp
  step             text        NOT NULL DEFAULT 'new',         -- estado actual de la máquina
  data             jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- {name, city, work_type, address, intent, ...}
  intent           text,                                       -- 'quote' | 'schedule' | 'advisor'
  opportunity_id   uuid        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  client_id        uuid        REFERENCES public.clients(id)      ON DELETE SET NULL,
  human_handoff    boolean     NOT NULL DEFAULT false,         -- true → el bot deja de responder, toma Martha
  handoff_at       timestamptz,
  last_inbound_at  timestamptz,
  last_outbound_at timestamptz,
  message_count    integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_conversations_phone
  ON public.whatsapp_conversations (phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_step
  ON public.whatsapp_conversations (step);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_handoff
  ON public.whatsapp_conversations (human_handoff) WHERE human_handoff = true;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_whatsapp_conversations_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_whatsapp_conversations_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 2. whatsapp_router_outbound_log — bitácora de respuestas del bot
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_router_outbound_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               text        NOT NULL,
  conversation_id     uuid        REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  in_reply_to_wamid   text,                       -- wamid del mensaje entrante que disparó esta respuesta
  step_from           text,
  step_to             text,
  message_kind        text,                       -- 'text' | 'interactive'
  payload             jsonb,                      -- cuerpo enviado a Meta (o que se habría enviado)
  provider_message_id text,                       -- wamid devuelto por Meta
  status              text        NOT NULL,        -- 'sent' | 'failed' | 'dry_run' | 'skipped'
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_router_log_phone      ON public.whatsapp_router_outbound_log (phone);
CREATE INDEX IF NOT EXISTS idx_wa_router_log_created_at ON public.whatsapp_router_outbound_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_router_log_conv       ON public.whatsapp_router_outbound_log (conversation_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS — solo lectura para autenticados; service_role (el router) la salta
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_router_outbound_log ENABLE ROW LEVEL SECURITY;

-- anon NO debe leer ni escribir (ver project_orbit_rls_exposure): sin policy = denegado.
DROP POLICY IF EXISTS wa_conversations_select_auth ON public.whatsapp_conversations;
CREATE POLICY wa_conversations_select_auth ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS wa_router_log_select_auth ON public.whatsapp_router_outbound_log;
CREATE POLICY wa_router_log_select_auth ON public.whatsapp_router_outbound_log
  FOR SELECT TO authenticated USING (true);

-- Endurecimiento explícito contra anon (TRUNCATE/insert directos):
REVOKE ALL ON public.whatsapp_conversations       FROM anon;
REVOKE ALL ON public.whatsapp_router_outbound_log FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Configuración + COMPUERTA DE SEGURIDAD en system_settings
-- ───────────────────────────────────────────────────────────────────────────
-- mode = 'allowlist' → SOLO responde a teléfonos en allowlist (números de prueba).
-- mode = 'live'      → responde a cualquier cliente. Cambiar SOLO con aprobación humana.
--
-- NOTA: este INSERT siembra la ESTRUCTURA con valores no sensibles (gamas, ciudades,
-- textos de marca). Los datos personales (allowlist de números de prueba, teléfono y
-- nombre de la asesora) NO se versionan: se cargan en runtime vía Management API,
-- igual que `meeting_reminder_recipient_phone`. Quedan como '' / [] acá.
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'whatsapp_router_config',
  jsonb_build_object(
    'enabled', true,
    'mode', 'allowlist',
    'allowlist', jsonb_build_array(),          -- cargar números de prueba en runtime
    'assistant_name', 'Elena',
    'brand_greeting', 'Hola, somos INNOVAR cocinas de diseño. Cuéntenos, ¿cómo podemos ayudarle?',
    'advisor_name', '',                         -- cargar en runtime (PII fuera de git)
    'advisor_phone', '',                        -- cargar en runtime (PII fuera de git)
    'advisor_hours', '8:00 a.m. a 10:00 p.m.',
    'treat_as', 'usted',
    'emojis', 'moderado',
    'cities', jsonb_build_array(
      'Pereira', 'Dosquebradas', 'La Virginia', 'Cartago',
      'Santa Rosa de Cabal', 'Cuba', 'Viterbo'
    ),
    'prices_per_ml', jsonb_build_object(
      'basica', 850000,
      'intermedia', 950000,
      'alta', 1200000
    ),
    'booking_base_url', 'https://crm-innovar-app-2026.vercel.app',
    'session_idle_minutes', 360
  ),
  'Config del asistente de WhatsApp de enrutamiento (whatsapp-router). mode=allowlist es la compuerta de seguridad: solo responde a números de prueba hasta cambiar a live. allowlist/advisor_* se cargan en runtime (PII fuera de git).'
)
ON CONFLICT (key) DO NOTHING;  -- no pisar config ya ajustada por un humano

COMMIT;

-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK (ejecutar manualmente si hace falta revertir):
-- ───────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS public.whatsapp_router_outbound_log;
-- DROP TRIGGER IF EXISTS trg_whatsapp_conversations_updated_at ON public.whatsapp_conversations;
-- DROP FUNCTION IF EXISTS public.set_whatsapp_conversations_updated_at();
-- DROP TABLE IF EXISTS public.whatsapp_conversations;
-- DELETE FROM public.system_settings WHERE key = 'whatsapp_router_config';
-- COMMIT;
