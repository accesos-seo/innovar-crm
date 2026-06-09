-- ============================================================
-- Migration: 20260609000010_monitor_capacidad.sql
-- Agente: monitor-capacidad (Capa 05 — Análisis)
-- Descripción: Cron diario que alerta cuando hay > N proyectos
--   simultáneos en taller. Statuses reales: 'en_produccion', 'entregado'
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- system_settings: umbrales de capacidad del taller
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('capacity_monitor_dry_run',     '"true"'::jsonb),
  ('capacity_yellow_threshold',    '4'::jsonb),
  ('capacity_red_threshold',       '7'::jsonb),
  ('capacity_monitor_admin_phone', '""'::jsonb),
  ('capacity_monitor_admin_name',  '"Admin"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Índice de soporte para query diario de capacidad
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_capacity_check
  ON public.projects (status, delivery_date)
  WHERE status IN ('en_produccion', 'entregado');

-- Índice en scheduled_job_log para queries de historial reciente
CREATE INDEX IF NOT EXISTS idx_scheduled_job_log_name_date
  ON public.scheduled_job_log (job_name, started_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Cron: monitor-capacidad-daily — cada día 8 AM Colombia (13:00 UTC)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('monitor-capacidad-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'monitor-capacidad-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url     := (SELECT value FROM public.system_settings WHERE key = 'supabase_functions_base_url') || '/monitor-capacidad',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  )
  $$
);
