-- =====================================================
-- 008 — Lead → Project Flow · Estructura
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- PRD: docs/prd/lead-to-project-flow.md
-- Aplicar en: Supabase Dashboard → SQL Editor
-- Orden: 008 → 009 → 010 → 011 → 012
-- Rollback: ROLLBACK_lead_to_project.sql
--
-- Cambios:
--  · Nueva tabla opportunities (funnel comercial: 1 cliente → N oportunidades)
--  · Nueva tabla opportunity_assignment_history (auditoría reasignaciones)
--  · Nueva tabla visits (visita como entidad de primera clase)
--  · Nueva tabla system_settings (config editable por admin)
--  · Nueva tabla agent_actions_log (auditoría agente A-05)
--  · ALTER clients (UNIQUE whatsapp_phone normalizado)
--  · ALTER quotations (versionado + bypass visit + addendum)
--  · ALTER payments (verificación + tipo)
--  · ALTER projects (hitos de cancelación)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. FUNCIÓN HELPER: normalize_phone
-- =====================================================
-- Strip de todo lo no-dígito; espera 10 dígitos finales (formato Colombia).
CREATE OR REPLACE FUNCTION public.normalize_phone(input TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(regexp_replace(COALESCE(input, ''), '[^0-9]', '', 'g'), '');
$$ LANGUAGE SQL IMMUTABLE;

-- =====================================================
-- 2. BACKFILL: normalizar clients.whatsapp_phone existentes
-- =====================================================
UPDATE public.clients
   SET whatsapp_phone = public.normalize_phone(whatsapp_phone)
 WHERE whatsapp_phone IS NOT NULL
   AND whatsapp_phone <> public.normalize_phone(whatsapp_phone);

-- =====================================================
-- 3. CONSTRAINT: clients.whatsapp_phone UNIQUE (parcial — permite NULL)
-- =====================================================
-- Si hay duplicados pre-existentes la migración fallará aquí; resolver
-- duplicados manualmente antes de re-correr. Query de diagnóstico:
--   SELECT whatsapp_phone, COUNT(*) FROM public.clients
--   WHERE whatsapp_phone IS NOT NULL AND deleted_at IS NULL
--   GROUP BY whatsapp_phone HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS clients_whatsapp_phone_unique_idx
  ON public.clients (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL AND deleted_at IS NULL;

-- =====================================================
-- 4. TABLA: opportunities
-- =====================================================
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN (
                        'new','contacted','visit_scheduled','visit_completed',
                        'quoted','sent_to_client','client_approved',
                        'pending_payment_verification','approved',
                        'converted_to_project','lost','cancelled_after_approval'
                      )),
  services          TEXT[] NOT NULL CHECK (array_length(services, 1) >= 1),
  priority          TEXT NOT NULL DEFAULT 'SHORT'
                      CHECK (priority IN ('ASAP','SHORT','LON')),
  data_origin       TEXT NOT NULL
                      CHECK (data_origin IN ('wordpress','referido','walk-in','whatsapp','manual')),
  assigned_to       UUID REFERENCES public.profiles(id),
  public_token      TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  notes             TEXT,
  is_dormant        BOOLEAN NOT NULL DEFAULT false,
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lost_reason       TEXT,
  lost_at           TIMESTAMPTZ,
  city              TEXT,
  address           TEXT,
  created_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS opportunities_client_id_idx       ON public.opportunities (client_id);
CREATE INDEX IF NOT EXISTS opportunities_assigned_status_idx ON public.opportunities (assigned_to, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS opportunities_status_dormant_idx  ON public.opportunities (status, is_dormant) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS opportunities_last_activity_idx   ON public.opportunities (last_activity_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS opportunities_public_token_idx    ON public.opportunities (public_token);

CREATE OR REPLACE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 5. TABLA: opportunity_assignment_history
-- =====================================================
CREATE TABLE IF NOT EXISTS public.opportunity_assignment_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id  UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_user       UUID REFERENCES public.profiles(id),
  to_user         UUID NOT NULL REFERENCES public.profiles(id),
  changed_by      UUID NOT NULL REFERENCES public.profiles(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason          TEXT
);

CREATE INDEX IF NOT EXISTS opp_assign_history_opp_idx ON public.opportunity_assignment_history (opportunity_id);

-- =====================================================
-- 6. TABLA: visits
-- =====================================================
CREATE TABLE IF NOT EXISTS public.visits (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id        UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  scheduled_at          TIMESTAMPTZ NOT NULL,
  duration_minutes      INTEGER NOT NULL DEFAULT 90,
  visited_by            UUID REFERENCES public.profiles(id),
  modality              TEXT NOT NULL DEFAULT 'presencial'
                          CHECK (modality IN ('presencial','foto_remota')),
  status                TEXT NOT NULL DEFAULT 'agendada'
                          CHECK (status IN ('agendada','confirmada','realizada','no_show','cancelada','reagendada')),
  scheduled_via         TEXT
                          CHECK (scheduled_via IN ('public_link','comercial','agent_a05')),
  measurements          JSONB,
  photos                JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_confirmed_at   TIMESTAMPTZ,
  realized_at           TIMESTAMPTZ,
  reschedule_count      INTEGER NOT NULL DEFAULT 0,
  is_exception          BOOLEAN NOT NULL DEFAULT false,
  exception_reason      TEXT,
  public_token          TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  notes                 TEXT,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  -- Solo martes (DOW=2) o jueves (DOW=4), salvo foto-remota o excepción admin.
  CONSTRAINT visits_dow_window
    CHECK (modality = 'foto_remota'
           OR EXTRACT(DOW FROM scheduled_at) IN (2, 4)
           OR is_exception = true)
);

CREATE INDEX IF NOT EXISTS visits_opportunity_idx        ON public.visits (opportunity_id);
CREATE INDEX IF NOT EXISTS visits_visited_by_sched_idx   ON public.visits (visited_by, scheduled_at);
CREATE INDEX IF NOT EXISTS visits_status_sched_idx       ON public.visits (status, scheduled_at);
CREATE INDEX IF NOT EXISTS visits_public_token_idx       ON public.visits (public_token);

CREATE OR REPLACE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 7. TABLA: system_settings (config editable)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  description  TEXT,
  updated_by   UUID REFERENCES public.profiles(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 8. TABLA: agent_actions_log (auditoría A-05)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_actions_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id     TEXT NOT NULL,          -- ej: 'A-05'
  user_id      UUID REFERENCES public.profiles(id),
  intent       TEXT NOT NULL,          -- 'schedule_visit','register_payment','mark_lost', etc.
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  result       JSONB,
  status       TEXT NOT NULL DEFAULT 'success'
                 CHECK (status IN ('success','failed','rejected')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_actions_log_user_idx    ON public.agent_actions_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_actions_log_agent_idx   ON public.agent_actions_log (agent_id, created_at DESC);

-- =====================================================
-- 9. ALTER quotations
-- =====================================================
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS change_reason     TEXT,
  ADD COLUMN IF NOT EXISTS bypassed_visit    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bypass_reason     TEXT,
  ADD COLUMN IF NOT EXISTS opportunity_id    UUID REFERENCES public.opportunities(id),
  ADD COLUMN IF NOT EXISTS quotation_type    TEXT NOT NULL DEFAULT 'initial'
                              CHECK (quotation_type IN ('initial','addendum')),
  ADD COLUMN IF NOT EXISTS public_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex');

-- NOTA: quotations.status es ENUM `quotation_status`. Los 7 valores
-- requeridos (draft, sent, client_approved, pending_payment_verification,
-- approved, expired, rejected) se agregan en `007a_quotation_status_enum.sql`,
-- que debe correr ANTES de esta migración. El ENUM mismo asegura la
-- restricción, así que no se necesita CHECK constraint adicional.

CREATE INDEX IF NOT EXISTS quotations_opportunity_idx    ON public.quotations (opportunity_id);
CREATE INDEX IF NOT EXISTS quotations_public_token_idx   ON public.quotations (public_token);
CREATE INDEX IF NOT EXISTS quotations_parent_version_idx ON public.quotations (parent_quotation_id, version_number);

-- =====================================================
-- 10. ALTER payments
-- =====================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS quotation_id          UUID REFERENCES public.quotations(id),
  ADD COLUMN IF NOT EXISTS verification_status   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (verification_status IN ('pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS verified_by           UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_url             TEXT,
  ADD COLUMN IF NOT EXISTS below_suggested       BOOLEAN;

-- Reforzar enum de payment_type (incluye 'refund' para devoluciones).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_payment_type_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payment_type_check
      CHECK (payment_type IN ('advance','installment','final','refund'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payments_quotation_verif_idx ON public.payments (quotation_id, verification_status);
CREATE INDEX IF NOT EXISTS payments_project_verif_idx   ON public.payments (project_id, verification_status);

-- =====================================================
-- 11. ALTER projects
-- =====================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS materials_purchased_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fabrication_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opportunity_id            UUID REFERENCES public.opportunities(id);

CREATE INDEX IF NOT EXISTS projects_opportunity_idx ON public.projects (opportunity_id);

COMMIT;

-- =====================================================
-- FIN 008 · Estructura aplicada
-- Siguiente: 009_lead_to_project_functions.sql
-- =====================================================
