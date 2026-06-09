-- ============================================================
-- Migration: 20260609000008_reactivador_clientes.sql
-- Agente: reactivate-clients (Capa 04 — Retención)
-- Descripción: Mensualmente identifica clientes con proyectos completados
--   hace 3-12 meses y envía mensaje de reactivación.
--   Statuses reales: 'entregado', 'completado'
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Índice para el query mensual de clientes inactivos
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_delivery_date_status
  ON public.projects (delivery_date, status)
  WHERE status IN ('entregado', 'completado')
    AND delivery_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Tabla: client_reactivation_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_reactivation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queue_id    UUID REFERENCES public.notification_queue(id) ON DELETE SET NULL,
  dry_run     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_reactivation_client
  ON public.client_reactivation_log (client_id, notified_at DESC);

-- Dedup por mes se hace a nivel de aplicación (EF consulta el log del mes actual)
-- No se crea índice único con date_trunc porque no es IMMUTABLE en PostgreSQL

ALTER TABLE public.client_reactivation_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_reactivation_log'
      AND policyname = 'client_reactivation_service_all'
  ) THEN
    CREATE POLICY "client_reactivation_service_all"
      ON public.client_reactivation_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- system_settings: configuración del reactivador
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('reactivador_clientes_dry_run',        '"true"'::jsonb),
  ('reactivador_clientes_min_months_ago', '3'::jsonb),
  ('reactivador_clientes_max_months_ago', '12'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Cron: reactivar-clientes-mensual — día 1 de cada mes, 9 AM Colombia (14:00 UTC)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('reactivar-clientes-mensual'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'reactivar-clientes-mensual',
  '0 14 1 * *',
  $$
  SELECT net.http_post(
    url     := (SELECT value FROM public.system_settings WHERE key = 'supabase_functions_base_url') || '/reactivate-clients',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  )
  $$
);
