-- ============================================================
-- Migration: 20260609000003_calificador_leads_ia.sql
-- Agente: calificador-leads-ia
-- Prioridad: ALTA
-- Fecha: 2026-06-09
-- NOTA: NO aplicar hasta que Meta apruebe el template
--       lead_qualification_start_v1
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Columnas nuevas en clients
--    (clients es la tabla real — no existe tabla "leads")
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_contacted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_attempts int NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- 2. Columnas nuevas en opportunities
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS product_type          text,         -- 'cocina_integral','closet','bano','mueble_tv','otro'
  ADD COLUMN IF NOT EXISTS budget_range          text,         -- '$5M-$10M','$10M-$20M','>$20M','sin_definir'
  ADD COLUMN IF NOT EXISTS urgency_level         text,         -- 'urgente_1mes','3meses','6meses','sin_fecha'
  ADD COLUMN IF NOT EXISTS dimensions_approx     text,         -- texto libre, ej. "3x4 metros aprox"
  ADD COLUMN IF NOT EXISTS qualification_source  text DEFAULT 'manual';  -- 'ia_whatsapp','manual'

-- ────────────────────────────────────────────────────────────
-- 3. Tabla nueva: lead_conversations
--    Máquina de estados conversacional por cliente
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_conversations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  opportunity_id      uuid        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  phone               text        NOT NULL,
  status              text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','abandoned','error')),
  phase               text        NOT NULL DEFAULT 'init'
                        CHECK (phase IN (
                          'init',
                          'asking_product',
                          'asking_dimensions',
                          'asking_budget',
                          'asking_urgency',
                          'confirming',
                          'completed',
                          'abandoned'
                        )),
  messages            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  data_extracted      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  started_at          timestamptz NOT NULL DEFAULT now(),
  last_message_at     timestamptz,
  completed_at        timestamptz,
  abandoned_at        timestamptz,
  abandonment_reason  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices críticos
CREATE INDEX IF NOT EXISTS idx_lead_conversations_client_id
  ON public.lead_conversations(client_id);

-- Partial index: solo conversaciones activas (las más consultadas por el webhook)
CREATE INDEX IF NOT EXISTS idx_lead_conversations_phone_status
  ON public.lead_conversations(phone, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_lead_conversations_status_phase
  ON public.lead_conversations(status, phase);

CREATE INDEX IF NOT EXISTS idx_lead_conversations_started_at
  ON public.lead_conversations(started_at DESC);

-- RLS
ALTER TABLE public.lead_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_conversations'
      AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY "service_role_full_access" ON public.lead_conversations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Función auxiliar: is_business_hours()
--    Retorna true si estamos en L-V 8am-6pm hora Bogotá
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT (
    EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/Bogota') BETWEEN 1 AND 5
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Bogota') BETWEEN 8 AND 17
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 5. Función auxiliar: business_hours_elapsed(from_ts)
--    Retorna horas transcurridas (reloj de pared, v1 simplificado)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.business_hours_elapsed(from_ts timestamptz)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT EXTRACT(EPOCH FROM (NOW() - from_ts)) / 3600.0;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. Trigger updated_at en lead_conversations
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_conversations_updated_at ON public.lead_conversations;
CREATE TRIGGER trg_lead_conversations_updated_at
  BEFORE UPDATE ON public.lead_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 7. Verificación (retorna resultados al ejecutar la migración)
-- ────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'clients'
     AND column_name IN ('last_contacted_at','qualification_attempts'))        AS clients_cols_added,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'opportunities'
     AND column_name IN ('product_type','budget_range','urgency_level',
                         'dimensions_approx','qualification_source'))          AS opp_cols_added,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'lead_conversations')                             AS table_lead_conversations_ok,
  public.is_business_hours()                                                   AS in_business_hours_now;
