-- ============================================================
-- Migration: 20260609000004_orquestador_agenda.sql
-- Agente: orquestador-agenda (Capa 02 — Conversión)
-- Descripción: Schema para ciclo de agendamiento de visitas
--   - Columnas de tracking en visits y opportunities
--   - Tabla visit_confirmations para propuestas bidireccionales (Slice 3)
--   - Cron job: orquestador-agenda-daily (9 AM Colombia)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Slice 1 & 2: Tracking columns en visits
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at  TIMESTAMPTZ DEFAULT NULL;

-- Índice para el cron query de recordatorios 24h (evita full scan diario)
-- Nota: el cron ya existente usa enqueue_visit_reminders_24h_internal().
-- Este índice optimiza queries adicionales del orquestador-agenda EF.
CREATE INDEX IF NOT EXISTS idx_visits_agendada_reminder
  ON public.visits (scheduled_at, status, reminder_24h_sent_at)
  WHERE status IN ('agendada', 'confirmada', 'reagendada')
    AND reminder_24h_sent_at IS NULL
    AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- Slice 2: scheduling_status en opportunities
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT
    CHECK (scheduling_status IN ('pending_slot','slot_proposed','confirmed','rescheduled'))
    DEFAULT 'pending_slot';

-- Índice para listar opportunities pendientes de slot en el frontend
CREATE INDEX IF NOT EXISTS idx_opportunities_scheduling_status
  ON public.opportunities (scheduling_status)
  WHERE scheduling_status != 'confirmed'
    AND deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- Slice 3: Tabla visit_confirmations (propuestas bidireccionales WA)
-- Solo requerida cuando los templates visit_proposal_client_v1 estén aprobados en Meta.
-- Se crea ahora para no bloquear el schema.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visit_confirmations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  -- Los slots propuestos referencian availability_slots solo si el slot existe;
  -- se usan TEXT como fallback para almacenar fecha/hora si no hay slot estructurado.
  proposed_slot_1   UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  proposed_slot_2   UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  proposed_slot_1_at TIMESTAMPTZ,   -- fecha/hora del slot 1 (desnormalizado para consultas rápidas)
  proposed_slot_2_at TIMESTAMPTZ,   -- fecha/hora del slot 2
  chosen_slot       UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  chosen_slot_at    TIMESTAMPTZ,    -- fecha/hora del slot elegido
  status            TEXT NOT NULL
    CHECK (status IN ('proposed','confirmed','rejected','expired','rescheduled'))
    DEFAULT 'proposed',
  client_response   TEXT DEFAULT NULL,   -- texto crudo del mensaje WA recibido
  proposed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ DEFAULT NULL,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: solo service_role escribe; authenticated puede leer sus propias confirmaciones
ALTER TABLE public.visit_confirmations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'visit_confirmations'
      AND policyname = 'visit_confirmations_service_all'
  ) THEN
    CREATE POLICY "visit_confirmations_service_all"
      ON public.visit_confirmations
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'visit_confirmations'
      AND policyname = 'visit_confirmations_auth_read'
  ) THEN
    CREATE POLICY "visit_confirmations_auth_read"
      ON public.visit_confirmations
      FOR SELECT
      TO authenticated
      USING (
        opportunity_id IN (
          SELECT id FROM public.opportunities
          WHERE assigned_to = auth.uid()
            AND deleted_at IS NULL
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visit_confirmations_opportunity
  ON public.visit_confirmations (opportunity_id, status);

CREATE INDEX IF NOT EXISTS idx_visit_confirmations_expires
  ON public.visit_confirmations (expires_at)
  WHERE status = 'proposed';

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.set_visit_confirmations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visit_confirmations_updated_at ON public.visit_confirmations;
CREATE TRIGGER trg_visit_confirmations_updated_at
  BEFORE UPDATE ON public.visit_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_visit_confirmations_updated_at();

-- ────────────────────────────────────────────────────────────
-- Cron job: orquestador-agenda-daily
-- Se ejecuta todos los días a las 14:00 UTC (9:00 AM Colombia UTC-5)
-- Llama a la EF orquestador-agenda para revisar visitas próximas
-- y enriquecer el tracking de reminder_24h_sent_at.
-- ────────────────────────────────────────────────────────────
-- La EF usa verify_jwt=false → no requiere Authorization header.
-- El cron llama directamente sin token, igual que detector-abandono-diario.
SELECT cron.schedule(
  'orquestador-agenda-daily',
  '5 14 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/orquestador-agenda',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{"action": "sync_reminders"}'::jsonb
  )
  $$
);
