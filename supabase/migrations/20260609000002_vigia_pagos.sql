-- ============================================================
-- Migration: 20260609000002_vigia_pagos.sql
-- Agente: vigía-pagos (Capa 01 — Cierre)
-- Descripción: Seguimiento automático de cotizaciones aprobadas sin pago
--   - Columnas de tracking en quotations
--   - Vista v_quotations_pending_payment
--   - Cron L-V 9 AM Colombia (14:00 UTC)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Tracking columns en quotations
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS vigia_stage TEXT
    CHECK (vigia_stage IN ('d1_sent', 'd7_sent', 'd14_sent', 'expired'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vigia_last_action_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_vigia
  ON public.quotations (status, vigia_stage, updated_at)
  WHERE status = 'approved';

-- ─────────────────────────────────────────────────────────────
-- Vista: cotizaciones aprobadas sin pago verificado
-- Usa profiles en lugar de leads (tabla leads no existe)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_quotations_pending_payment AS
SELECT
  q.id                                                     AS quotation_id,
  q.opportunity_id,
  q.status                                                 AS quotation_status,
  q.valid_until,
  q.total_amount,
  q.vigia_stage,
  q.vigia_last_action_at,
  q.updated_at                                             AS approved_at,
  EXTRACT(DAY FROM now() - q.updated_at)::INT              AS days_since_approval,
  c.id                                                     AS client_id,
  c.name                                                   AS client_name,
  c.whatsapp_phone                                         AS client_phone,
  o.assigned_to                                            AS commercial_id,
  p2.whatsapp_phone                                        AS commercial_phone,
  p2.full_name                                             AS commercial_name,
  proj.id                                                  AS project_id,
  EXISTS (
    SELECT 1 FROM public.payments pm
    WHERE pm.project_id = proj.id
      AND pm.verification_status = 'verified'
  )                                                        AS has_verified_payment
FROM public.quotations q
JOIN  public.opportunities o   ON o.id = q.opportunity_id
JOIN  public.clients       c   ON c.id = q.client_id
LEFT JOIN public.profiles  p2  ON p2.id = o.assigned_to
LEFT JOIN public.projects  proj ON proj.opportunity_id = o.id
WHERE q.status = 'approved';

-- ─────────────────────────────────────────────────────────────
-- system_settings: URL base EFs + datos bancarios
-- supabase_functions_base_url evita hardcodear el project ID en código SQL
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('supabase_functions_base_url', '""'::jsonb),   -- valor inyectado post-migración vía script
  ('bank_name',           '"Bancolombia"'::jsonb),
  ('bank_account',        '"000-000000-00"'::jsonb),
  ('bank_account_holder', '"Innovar Cocinas Arte SAS"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Cron: vigía-pagos-check — L-V 9 AM Colombia (14:00 UTC)
-- URL se lee desde system_settings para no hardcodear el project ID
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('vigia-pagos-check'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'vigia-pagos-check',
  '0 14 * * 1-5',
  $$
  SELECT net.http_post(
    url     := (SELECT value FROM public.system_settings WHERE key = 'supabase_functions_base_url') || '/vigia-pagos',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  )
  $$
);
