-- ============================================================
-- Migration: 20260609000006_coordinador_produccion.sql
-- Agente: coordinador-produccion (Capa 03 — Producción)
-- Descripción: Al cambiar proyecto a 'en_produccion', genera ficha técnica
--   y notifica al taller via WhatsApp. Llama a EF coordinador-produccion.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Columnas en projects
-- ─────────────────────────────────────────────────────────────
-- fabrication_started_at ya existe en projects — solo agregar delivery_date
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- Columnas en quotation_items (ficha técnica de materiales)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS material   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS finish     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS width_cm   NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height_cm  NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS depth_cm   NUMERIC(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_projects_status_updated
  ON public.projects (status, updated_at)
  WHERE status = 'en_produccion';

-- ─────────────────────────────────────────────────────────────
-- system_settings: configuración del taller
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('workshop_whatsapp',        '""'::jsonb),
  ('default_fabrication_days', '25'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- RPC: get_project_ficha_tecnica
-- Retorna datos completos del proyecto para armar la ficha del taller
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_project_ficha_tecnica(p_project_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'project_id',    p.id,
    'project_name',  COALESCE(p.name, c.name || ' — Proyecto'),
    'client_name',   c.name,
    'client_phone',  c.whatsapp_phone,
    'delivery_date', p.delivery_date,
    'fabrication_days', COALESCE(p.estimated_fabrication_days, 25),
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'quantity',    qi.quantity,
        'material',    qi.material,
        'finish',      qi.finish,
        'dimensions',  CASE
          WHEN qi.width_cm IS NOT NULL
          THEN qi.width_cm::TEXT || 'x' || COALESCE(qi.height_cm::TEXT,'?') || 'x' || COALESCE(qi.depth_cm::TEXT,'?') || ' cm'
          ELSE NULL
        END
      ) ORDER BY COALESCE(qi.sort_order, 0))
      FROM public.quotation_items qi
      JOIN public.quotations q ON q.id = qi.quotation_id
      WHERE q.opportunity_id = p.opportunity_id
        AND q.status = 'approved'
    )
  ) INTO v_result
  FROM public.projects   p
  JOIN public.opportunities o ON o.id = p.opportunity_id
  JOIN public.clients       c ON c.id = o.client_id
  WHERE p.id = p_project_id;

  RETURN v_result;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Función trigger: notify_fabrication_started
-- Llama a la EF coordinador-produccion cuando status → en_produccion
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_fabrication_started()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'en_produccion' AND (OLD.status IS DISTINCT FROM 'en_produccion') THEN
    -- Marcar fecha de inicio
    NEW.fabrication_started_at := NOW();

    -- Calcular fecha estimada de entrega si no está ya fijada
    IF NEW.delivery_date IS NULL THEN
      NEW.delivery_date := (CURRENT_DATE + COALESCE(NEW.estimated_fabrication_days, 25))::DATE;
    END IF;

    -- Llamar EF coordinador-produccion (verify_jwt=false, sin auth header)
    -- URL se lee desde system_settings para no hardcodear el project ID
    PERFORM net.http_post(
      url     := (SELECT value FROM public.system_settings WHERE key = 'supabase_functions_base_url') || '/coordinador-produccion',
      headers := '{"Content-Type": "application/json"}'::JSONB,
      body    := jsonb_build_object(
        'project_id',   NEW.id::TEXT,
        'triggered_at', NOW()::TEXT
      )::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fabrication_started ON public.projects;
CREATE TRIGGER trg_fabrication_started
  BEFORE UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_fabrication_started();
