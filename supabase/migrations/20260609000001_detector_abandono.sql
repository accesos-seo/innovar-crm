-- ============================================================
-- Migration: detector-abandono
-- Agente de detección de oportunidades sin actividad >= 5 días
-- ============================================================

-- 1. Tabla de registro de alertas (dedup + historial)
CREATE TABLE IF NOT EXISTS public.abandonment_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  etapa           text NOT NULL CHECK (etapa IN ('d5', 'd10')),
  fecha_alerta    date NOT NULL DEFAULT CURRENT_DATE,
  dias_inactivo   int  NOT NULL,
  task_id         uuid REFERENCES public.tasks(id),
  queue_id        uuid REFERENCES public.notification_queue(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (opportunity_id, etapa, fecha_alerta)
);

CREATE INDEX IF NOT EXISTS idx_abandonment_log_opp_etapa
  ON public.abandonment_log(opportunity_id, etapa);

COMMENT ON TABLE public.abandonment_log IS
  'Registro de alertas emitidas por el agente detector-abandono. '
  'UNIQUE (opportunity_id, etapa, fecha_alerta) garantiza dedup: máximo una alerta por etapa por día.';

-- 2. Índice de performance en opportunities para el escaneo diario
CREATE INDEX IF NOT EXISTS idx_opportunities_abandonment_scan
  ON public.opportunities(assigned_to, status, last_activity_at)
  WHERE deleted_at IS NULL;

-- 3. Cron job: L-V a las 9:00 AM Bogotá (UTC-5 → 14:00 UTC)
--    La EF usa verify_jwt=false → no requiere token de autorización.
SELECT cron.schedule(
  'detector-abandono-diario',
  '0 14 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/detector-abandono',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  )
  $$
);
