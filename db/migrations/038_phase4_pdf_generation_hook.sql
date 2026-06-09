-- ============================================================================
-- 038_phase4_pdf_generation_hook.sql
-- Fase 4 · Slice 5 — Trigger que llama Edge Function generate-quotation-pdf
-- Idempotente. Aplicar vía Management API.
--
-- La Edge Function generate-quotation-pdf debe estar desplegada ANTES de aplicar
-- esta migración. La llamada usa pg_net (asíncrona, no bloquea el commit).
--
-- Si la llamada falla (Edge Function no desplegada, network down), el trigger
-- registra el fallo en pdf_generation_log pero NO revierte la transacción —
-- la cotización queda approved con quotation_pdf_url=NULL y el botón "Descargar
-- PDF" simplemente no aparece. Reintento manual posible vía la misma RPC.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla de log para retries y debugging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pdf_generation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quotation_id    UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','succeeded','failed')),
  http_request_id BIGINT,  -- id devuelto por net.http_post
  response_status INT,
  error_message   TEXT,
  pdf_url         TEXT,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdf_log_project_id ON public.pdf_generation_log(project_id);
CREATE INDEX IF NOT EXISTS idx_pdf_log_status ON public.pdf_generation_log(status) WHERE status IN ('pending','sent','failed');

ALTER TABLE public.pdf_generation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdf_log_admin_read" ON public.pdf_generation_log;
CREATE POLICY "pdf_log_admin_read"
  ON public.pdf_generation_log FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ---------------------------------------------------------------------------
-- 2. trigger_pdf_generation — RPC manual para invocar/reintentar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_pdf_generation(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project   public.projects%ROWTYPE;
  v_log_id    UUID;
  v_request_id BIGINT;
  v_url       TEXT := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/generate-quotation-pdf';
  v_anon_key  TEXT;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_project.approved_quotation_id IS NULL THEN
    RAISE EXCEPTION 'project_has_no_approved_quotation' USING ERRCODE = '22023';
  END IF;

  -- Leer el anon key desde system_settings (poner antes de aplicar)
  v_anon_key := public.get_bank_setting('anon_jwt_for_internal_calls');

  -- Insertar row de log
  INSERT INTO public.pdf_generation_log (project_id, quotation_id, status)
  VALUES (p_project_id, v_project.approved_quotation_id, 'pending')
  RETURNING id INTO v_log_id;

  -- Llamada async vía pg_net
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
    ),
    body := jsonb_build_object(
      'project_id', p_project_id,
      'quotation_id', v_project.approved_quotation_id,
      'log_id', v_log_id
    )
  ) INTO v_request_id;

  UPDATE public.pdf_generation_log
    SET status = 'sent', http_request_id = v_request_id
    WHERE id = v_log_id;

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id, 'request_id', v_request_id);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.pdf_generation_log
    SET status = 'failed', error_message = SQLERRM, completed_at = now()
    WHERE id = v_log_id;
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END $$;

GRANT EXECUTE ON FUNCTION public.trigger_pdf_generation(UUID) TO authenticated;

COMMENT ON FUNCTION public.trigger_pdf_generation(UUID) IS 'Dispara la Edge Function generate-quotation-pdf vía pg_net (Fase 4 D12).';

-- ---------------------------------------------------------------------------
-- 3. fn_trigger_pdf_on_project_creation — trigger AFTER INSERT
--    Solo dispara si el proyecto nace de una quotation aprobada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trigger_pdf_on_project_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved_quotation_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Llamada fire-and-forget; el error no rompe la transacción del project insert
  BEGIN
    PERFORM public.trigger_pdf_generation(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'PDF generation trigger failed for project %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_generate_pdf_on_project_creation ON public.projects;
CREATE TRIGGER trg_generate_pdf_on_project_creation
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_pdf_on_project_creation();

DO $$ BEGIN RAISE NOTICE 'Migración 038 OK — PDF generation hook + log table + manual retry RPC'; END $$;
