-- ============================================================================
-- 030_phase4_quotations_new_columns.sql
-- Fase 4 · Slice 1 — Columnas nuevas en quotations + clients
-- Idempotente. Aplicar vía Management API.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. quotations: campos para feedback del cliente (D5) y tracking (D7)
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS client_acceptance_note    TEXT,
  ADD COLUMN IF NOT EXISTS client_rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS client_rejection_subtype  TEXT,
  ADD COLUMN IF NOT EXISTS client_approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_rejected_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count                INT NOT NULL DEFAULT 0;

-- CHECK del subtype (drop+create por si ya existía con valores distintos)
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_client_rejection_subtype_check;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_client_rejection_subtype_check
  CHECK (client_rejection_subtype IS NULL OR client_rejection_subtype IN ('adjustments_requested','declined'));

COMMENT ON COLUMN public.quotations.client_acceptance_note   IS 'Comentario opcional del cliente al apretar Aceptar (Fase 4 D5)';
COMMENT ON COLUMN public.quotations.client_rejection_reason  IS 'Razón al apretar Rechazar o Solicitar ajustes (Fase 4 D5)';
COMMENT ON COLUMN public.quotations.client_rejection_subtype IS 'adjustments_requested = pidió cambios; declined = rechazó sin más (Fase 4 D5)';
COMMENT ON COLUMN public.quotations.client_approved_at       IS 'Timestamp cuando cliente apretó Aceptar (Fase 4 D2)';
COMMENT ON COLUMN public.quotations.client_rejected_at       IS 'Timestamp cuando cliente apretó Rechazar/Ajustes (Fase 4 D5)';
COMMENT ON COLUMN public.quotations.viewed_at                IS 'Primera vez que el cliente abrió el link público (Fase 4 D7.3)';
COMMENT ON COLUMN public.quotations.view_count               IS 'Total de aperturas del link público (Fase 4 D7.3)';

-- Índice para acelerar la cola "cotizaciones que el cliente vio pero no decidió"
CREATE INDEX IF NOT EXISTS idx_quotations_viewed_pending
  ON public.quotations (viewed_at)
  WHERE viewed_at IS NOT NULL AND status = 'sent';

-- ---------------------------------------------------------------------------
-- 2. clients: timestamp del primer proyecto (D3.3) para reporting
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS first_project_at TIMESTAMPTZ;

COMMENT ON COLUMN public.clients.first_project_at IS 'Timestamp del primer proyecto creado (Fase 4 D3.3) — útil para reporte de clientes nuevos del mes';

-- ---------------------------------------------------------------------------
-- Smoke tests (no fallan si todo OK)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='quotations' AND column_name='viewed_at';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quotations.viewed_at no se creó';
  END IF;

  PERFORM 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients' AND column_name='first_project_at';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'clients.first_project_at no se creó';
  END IF;

  RAISE NOTICE 'Migración 030 OK';
END $$;
