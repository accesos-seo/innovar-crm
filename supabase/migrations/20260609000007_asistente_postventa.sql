-- ============================================================
-- Migration: 20260609000007_asistente_postventa.sql
-- Agente: asistente-postventa (Capa 04 — Retención)
-- Descripción: Al marcar un proyecto como 'entregado', programa 3 mensajes
--   de seguimiento postventa (NOW, +24h, +48h) en notification_queue.
--   El EF process-whatsapp-notifications ya filtra por scheduled_for.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Agregar scheduled_for a notification_queue (idempotente)
-- El EF process-whatsapp-notifications ya tiene el filtro en línea 251
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled
  ON public.notification_queue (scheduled_for)
  WHERE scheduled_for IS NOT NULL AND status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- Tabla: project_postventa_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_postventa_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dry_run     BOOLEAN NOT NULL DEFAULT FALSE,
  queue_ids   UUID[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_postventa_log_project
  ON public.project_postventa_log (project_id)
  WHERE NOT dry_run;

ALTER TABLE public.project_postventa_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_postventa_log'
      AND policyname = 'project_postventa_log_service_all'
  ) THEN
    CREATE POLICY "project_postventa_log_service_all"
      ON public.project_postventa_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- system_settings: configuración de postventa
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.system_settings (key, value)
VALUES
  ('nps_form_url',          '"https://innovar-crm.vercel.app/nps"'::jsonb),
  ('warranty_terms_short',  '"12 meses en estructura y herrajes"'::jsonb),
  ('support_contact_phone', '""'::jsonb),
  ('postventa_dry_run',     '"true"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Función trigger: fn_trigger_postventa
-- Dispara cuando un proyecto pasa a status = 'entregado'
-- Encola 3 mensajes: inmediato + 24h + 48h
-- Templates (meta debe tener aprobados):
--   nps_solicitud_v1      · {{1}}=nombre
--   garantia_info_v1      · {{1}}=nombre {{2}}=warranty_terms
--   referido_solicitud_v1 · {{1}}=nombre
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_trigger_postventa()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_dry_run      BOOLEAN;
  v_client_phone TEXT;
  v_client_name  TEXT;
  v_warranty     TEXT;
  v_queue_ids    UUID[];
  v_qid          UUID;
  v_now          TIMESTAMPTZ := NOW();
BEGIN
  -- Solo disparar cuando status cambia A 'entregado'
  IF NEW.status <> 'entregado' OR OLD.status = 'entregado' THEN
    RETURN NEW;
  END IF;

  -- Leer configuración
  SELECT ((value #>> '{}') = 'true') INTO v_dry_run
  FROM public.system_settings WHERE key = 'postventa_dry_run';
  v_dry_run := COALESCE(v_dry_run, TRUE);

  SELECT value INTO v_warranty
  FROM public.system_settings WHERE key = 'warranty_terms_short';
  v_warranty := COALESCE(v_warranty, '12 meses');

  -- Datos del cliente
  SELECT c.whatsapp_phone, c.name
  INTO v_client_phone, v_client_name
  FROM public.opportunities o
  JOIN public.clients c ON c.id = o.client_id
  WHERE o.id = NEW.opportunity_id
  LIMIT 1;

  IF v_client_phone IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_dry_run THEN
    INSERT INTO public.project_postventa_log (project_id, dry_run, triggered_at)
    VALUES (NEW.id, TRUE, v_now)
    ON CONFLICT (project_id) WHERE NOT dry_run DO NOTHING;
    RETURN NEW;
  END IF;

  -- Mensaje 1: NPS — inmediato
  INSERT INTO public.notification_queue (
    event_type, entity_type, event_reference_id,
    recipient_phone, channel, provider,
    template_name, template_language, template_parameters,
    dedup_key, scheduled_for, status
  ) VALUES (
    'project.delivered', 'project', NEW.id,
    v_client_phone, 'whatsapp', 'meta_whatsapp',
    'nps_solicitud_v1', 'es', jsonb_build_array(v_client_name),
    'postventa:' || NEW.id || ':nps', NULL, 'pending'
  )
  ON CONFLICT (dedup_key) DO NOTHING
  RETURNING id INTO v_qid;
  v_queue_ids := array_append(v_queue_ids, v_qid);

  -- Mensaje 2: Garantía — 24 horas después
  INSERT INTO public.notification_queue (
    event_type, entity_type, event_reference_id,
    recipient_phone, channel, provider,
    template_name, template_language, template_parameters,
    dedup_key, scheduled_for, status
  ) VALUES (
    'project.delivered', 'project', NEW.id,
    v_client_phone, 'whatsapp', 'meta_whatsapp',
    'garantia_info_v1', 'es', jsonb_build_array(v_client_name, v_warranty),
    'postventa:' || NEW.id || ':garantia', v_now + INTERVAL '24 hours', 'pending'
  )
  ON CONFLICT (dedup_key) DO NOTHING
  RETURNING id INTO v_qid;
  v_queue_ids := array_append(v_queue_ids, v_qid);

  -- Mensaje 3: Referidos — 48 horas después
  INSERT INTO public.notification_queue (
    event_type, entity_type, event_reference_id,
    recipient_phone, channel, provider,
    template_name, template_language, template_parameters,
    dedup_key, scheduled_for, status
  ) VALUES (
    'project.delivered', 'project', NEW.id,
    v_client_phone, 'whatsapp', 'meta_whatsapp',
    'referido_solicitud_v1', 'es', jsonb_build_array(v_client_name),
    'postventa:' || NEW.id || ':referido', v_now + INTERVAL '48 hours', 'pending'
  )
  ON CONFLICT (dedup_key) DO NOTHING
  RETURNING id INTO v_qid;
  v_queue_ids := array_append(v_queue_ids, v_qid);

  -- Log
  INSERT INTO public.project_postventa_log (project_id, triggered_at, dry_run, queue_ids)
  VALUES (NEW.id, v_now, FALSE, v_queue_ids)
  ON CONFLICT (project_id) WHERE NOT dry_run DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_delivered ON public.projects;
CREATE TRIGGER trg_project_delivered
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_postventa();
