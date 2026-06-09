-- ============================================================
-- Migration: 20260609000009_analista_conversion.sql
-- Agente: analista-conversion (Capa 05 — Análisis)
-- Descripción: Vistas de métricas semanales de conversión y embudos.
--   NOTA: La tabla leads NO existe en este proyecto.
--   Se usa clients/opportunities como base del pipeline.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Índices de soporte para queries de conversión
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at
  ON public.opportunities (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_status_created
  ON public.opportunities (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_status_created
  ON public.quotations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_status_updated
  ON public.quotations (status, updated_at DESC);

-- ─────────────────────────────────────────────────────────────
-- system_settings: configuración del analista
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('analista_dry_run',     '"false"'::jsonb),
  ('analista_admin_phone', '""'::jsonb),
  ('analista_admin_name',  '"Admin"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Vista: vw_pipeline_weekly_metrics
-- Métricas de la semana anterior (lun-dom)
-- Usa clients como proxy de "nuevos contactos" (no hay tabla leads)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_pipeline_weekly_metrics AS
WITH semana AS (
  SELECT
    date_trunc('week', current_date - INTERVAL '7 days')                                  AS inicio,
    date_trunc('week', current_date - INTERVAL '7 days') + INTERVAL '6 days 23:59:59'     AS fin
)
SELECT
  s.inicio   AS semana_inicio,
  s.fin      AS semana_fin,
  -- Clientes nuevos de la semana (proxy de "leads nuevos")
  COUNT(DISTINCT c.id)  FILTER (WHERE c.created_at BETWEEN s.inicio AND s.fin)                AS leads_nuevos,
  -- Oportunidades abiertas
  COUNT(DISTINCT o.id)  FILTER (WHERE o.created_at BETWEEN s.inicio AND s.fin)                AS oportunidades_creadas,
  -- Cotizaciones enviadas
  COUNT(DISTINCT q.id)  FILTER (
    WHERE q.created_at BETWEEN s.inicio AND s.fin
      AND q.status IN ('sent', 'approved', 'rejected', 'expired')
  )                                                                                            AS cotizaciones_enviadas,
  -- Cotizaciones aprobadas
  COUNT(DISTINCT q.id)  FILTER (
    WHERE q.updated_at BETWEEN s.inicio AND s.fin
      AND q.status = 'approved'
  )                                                                                            AS cotizaciones_aprobadas,
  -- Oportunidades que avanzaron de 'new'
  COUNT(DISTINCT o.id)  FILTER (
    WHERE o.updated_at BETWEEN s.inicio AND s.fin
      AND o.status NOT IN ('new', 'lost')
  )                                                                                            AS leads_avanzaron
FROM semana s
CROSS JOIN public.clients c
LEFT  JOIN public.opportunities o  ON o.client_id = c.id
LEFT  JOIN public.quotations    q  ON q.opportunity_id = o.id
GROUP BY s.inicio, s.fin;

-- ─────────────────────────────────────────────────────────────
-- Vista: vw_conversion_times
-- Tiempos promedio por etapa (últimos 30 días)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_conversion_times AS
SELECT
  'opportunity_to_quotation'                            AS etapa,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (q.created_at - o.created_at)) / 86400.0
  )::NUMERIC, 1)                                        AS dias_promedio,
  COUNT(DISTINCT o.id)                                  AS muestra
FROM public.opportunities o
JOIN public.quotations q ON q.opportunity_id = o.id
  AND q.status IN ('sent', 'approved', 'rejected', 'expired')
WHERE o.created_at >= current_date - INTERVAL '30 days'

UNION ALL

SELECT
  'quotation_to_approval'                               AS etapa,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (q.updated_at - q.created_at)) / 86400.0
  )::NUMERIC, 1)                                        AS dias_promedio,
  COUNT(DISTINCT q.id)                                  AS muestra
FROM public.quotations q
WHERE q.status = 'approved'
  AND q.updated_at >= current_date - INTERVAL '30 days';

-- ─────────────────────────────────────────────────────────────
-- Vista: vw_bottleneck_detection
-- Detecta cuellos de botella en el embudo comercial
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_bottleneck_detection AS
WITH
opp_sin_cotizacion AS (
  SELECT COUNT(*) AS cnt
  FROM public.opportunities o
  WHERE o.status IN ('new', 'scheduled', 'visited')
    AND NOT EXISTS (SELECT 1 FROM public.quotations q WHERE q.opportunity_id = o.id)
    AND o.created_at < current_date - INTERVAL '5 days'
    AND o.deleted_at IS NULL
),
cotizaciones_sin_pago AS (
  SELECT COUNT(*) AS cnt
  FROM public.quotations q
  WHERE q.status = 'approved'
    AND q.updated_at < current_date - INTERVAL '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.payments pm ON pm.project_id = p.id AND pm.verification_status = 'verified'
      WHERE p.opportunity_id = q.opportunity_id
    )
),
proyectos_parados AS (
  SELECT COUNT(*) AS cnt
  FROM public.projects p
  WHERE p.status = 'en_produccion'
    AND p.fabrication_started_at < NOW() - INTERVAL '30 days'
    AND p.delivery_date < CURRENT_DATE
)
SELECT
  'opp_sin_cotizacion'   AS cuello,
  opp_sin_cotizacion.cnt AS cantidad
FROM opp_sin_cotizacion

UNION ALL

SELECT
  'cotizaciones_sin_pago'   AS cuello,
  cotizaciones_sin_pago.cnt AS cantidad
FROM cotizaciones_sin_pago

UNION ALL

SELECT
  'proyectos_parados'   AS cuello,
  proyectos_parados.cnt AS cantidad
FROM proyectos_parados;
