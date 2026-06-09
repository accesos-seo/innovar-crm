-- ============================================================
-- Migration: 20260609000005_notificador_proyecto.sql
-- Agente: notificador-proyecto (Capa 03 — Producción)
-- Descripción: Notifica al cliente en cada cambio de fase del proyecto
--   - Columnas adicionales en projects
--   - Tabla project_phase_log
--   - Trigger en projects (status SPANISH: en_diseno, en_produccion, entregado, completado)
--   - DRY_RUN via system_settings.notificador_proyecto_dry_run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Columnas adicionales en projects (idempotentes)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS estimated_fabrication_days INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS installation_scheduled_at  TIMESTAMPTZ DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- Tabla: project_phase_log — historial de notificaciones por fase
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_phase_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase          TEXT NOT NULL,
  notified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queue_id       UUID REFERENCES public.notification_queue(id) ON DELETE SET NULL,
  dry_run        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_phase_log_project
  ON public.project_phase_log (project_id, phase);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_phase_log_project_phase
  ON public.project_phase_log (project_id, phase)
  WHERE NOT dry_run;

ALTER TABLE public.project_phase_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_phase_log'
      AND policyname = 'project_phase_log_service_all'
  ) THEN
    CREATE POLICY "project_phase_log_service_all"
      ON public.project_phase_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Índice dedup en notification_queue (si no existe ya)
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_dedup_key
  ON public.notification_queue (dedup_key)
  WHERE dedup_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- system_settings: dry_run flag y URL del CRM
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('notificador_proyecto_dry_run', '"true"'::jsonb),
  ('crm_base_url', '"https://innovar-crm.vercel.app"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Función trigger: fn_notify_project_phase_change
-- Dispara en: en_diseno, en_produccion, entregado, completado
-- Mapeo de templates (fase → template):
--   en_diseno    → proyecto_en_diseno_v1
--   en_produccion → fabricacion_iniciada_v1
--   entregado    → instalacion_programada_v1
--   completado   → proyecto_completado_v1
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_project_phase_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_dry_run    BOOLEAN;
  v_template   TEXT;
  v_client_id  UUID;
  v_client_phone TEXT;
  v_client_name  TEXT;
  v_proj_name    TEXT;
  v_queue_id     UUID;
  v_dedup_key    TEXT;
  v_params       JSONB;
  v_fab_days     INT;
  v_install_date TEXT;
BEGIN
  -- Ignorar si el estado no es uno de los 4 relevantes
  IF NEW.status NOT IN ('en_diseno', 'en_produccion', 'entregado', 'completado') THEN
    RETURN NEW;
  END IF;
  -- Ignorar si el estado no cambió
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Leer dry_run flag
  SELECT ((value #>> '{}') = 'true') INTO v_dry_run
  FROM public.system_settings WHERE key = 'notificador_proyecto_dry_run';
  v_dry_run := COALESCE(v_dry_run, TRUE);

  -- Mapear fase a template
  v_template := CASE NEW.status
    WHEN 'en_diseno'     THEN 'proyecto_en_diseno_v1'
    WHEN 'en_produccion' THEN 'fabricacion_iniciada_v1'
    WHEN 'entregado'     THEN 'instalacion_programada_v1'
    WHEN 'completado'    THEN 'proyecto_completado_v1'
  END;

  -- Datos del cliente desde opportunities → clients
  SELECT c.id, c.whatsapp_phone, c.name
  INTO v_client_id, v_client_phone, v_client_name
  FROM public.opportunities o
  JOIN public.clients c ON c.id = o.client_id
  WHERE o.id = NEW.opportunity_id
  LIMIT 1;

  IF v_client_phone IS NULL THEN
    RETURN NEW; -- sin teléfono, no podemos notificar
  END IF;

  -- Nombre del proyecto (usa nombre del cliente si no hay nombre propio)
  v_proj_name := COALESCE(NEW.name, v_client_name || ' — Proyecto');

  -- Parámetros según fase
  CASE NEW.status
    WHEN 'en_diseno' THEN
      v_params := jsonb_build_array(v_client_name, v_proj_name);

    WHEN 'en_produccion' THEN
      v_fab_days := COALESCE(NEW.estimated_fabrication_days, 30);
      v_params := jsonb_build_array(v_client_name, v_fab_days::TEXT || ' días hábiles');

    WHEN 'entregado' THEN
      v_install_date := COALESCE(
        to_char(NEW.installation_scheduled_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY'),
        'próximamente'
      );
      v_params := jsonb_build_array(v_client_name, v_install_date);

    WHEN 'completado' THEN
      v_params := jsonb_build_array(v_client_name, v_proj_name);
  END CASE;

  -- Dedup key para evitar doble envío
  v_dedup_key := 'notificador-proyecto:' || NEW.id || ':' || NEW.status;

  -- Insertar en notification_queue (ON CONFLICT DO NOTHING gracias al índice dedup)
  IF NOT v_dry_run THEN
    INSERT INTO public.notification_queue (
      event_type, entity_type, event_reference_id,
      recipient_phone, channel, provider,
      template_name, template_language, template_parameters,
      dedup_key, status
    )
    VALUES (
      'project.phase_changed', 'project', NEW.id,
      v_client_phone, 'whatsapp', 'meta_whatsapp',
      v_template, 'es', v_params,
      v_dedup_key, 'pending'
    )
    ON CONFLICT (dedup_key) DO NOTHING
    RETURNING id INTO v_queue_id;
  END IF;

  -- Registrar en log
  INSERT INTO public.project_phase_log (project_id, phase, queue_id, dry_run)
  VALUES (NEW.id, NEW.status, v_queue_id, v_dry_run)
  ON CONFLICT (project_id, phase) WHERE NOT dry_run DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_phase_change ON public.projects;
CREATE TRIGGER trg_project_phase_change
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_project_phase_change();
