-- =====================================================
-- 055 — Módulo Postventa y Garantías (PRD-postventa-garantias.md)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-10
--
-- Construye sobre tablas YA existentes en prod: warranties,
-- warranty_claims, satisfaction_surveys, project_postventa_log.
--
-- ⚠️ RECONCILIACIÓN CON TRIGGERS LEGACY (inventariados en prod 2026-06-10):
--   • trg_auto_post_delivery (fn_auto_post_delivery): creaba garantía+encuesta
--     al pasar a 'entregado' SIN guard de idempotencia y con 12 meses
--     hardcodeados. → SE REEMPLAZA por fn_create_warranty_on_delivery +
--     fn_create_survey_on_delivery (idempotentes, meses configurables,
--     cubren también delivered_at).
--   • trg_wa_satisfaction_survey (fn_wa_satisfaction_survey): creaba encuesta
--     'sent' y encolaba WA template 'satisfaction_survey' con dominio
--     hardcodeado equivocado (innovarcocinas.live) usando el id como token.
--     → SE ELIMINA. El envío pasa a la EF postventa-engine (template
--     encuesta_satisfaccion_v1, link real, espera 2 días, respeta DRY_RUN).
--   • trg_project_delivered (fn_trigger_postventa): mensajes NPS/garantía/
--     referidos con postventa_dry_run. → NO SE TOCA (flujo independiente).
--
-- Piezas:
--   1) Columnas nuevas: satisfaction_surveys.public_token/expires_at,
--      warranty_claims.photos/created_by/claim_number.
--   2) generate_next_claim_number() — GAR-{año}-{seq} con advisory lock
--      (patrón de generate_next_quotation_number) + trigger BEFORE INSERT.
--   3) Triggers de entrega idempotentes (garantía + encuesta).
--   4) RPCs públicas get_public_survey / submit_public_survey (anon).
--   5) Trigger trg_notify_claim_created (WA admin si severidad alta/crítica
--      + garantía → 'claimed').
--   6) Bucket privado claim-photos + policies.
--   7) Policies staff_all_* (agregan super_admin a las admin_all_* legacy).
--   8) Vista v_postventa_metrics (security_invoker).
--   9) Seeds system_settings.
--
-- Templates Meta nuevos (proceso externo, bloquean solo el envío WA):
--   encuesta_satisfaccion_v1 (UTILITY, es):
--     "Hola {{1}} 👋 ¡Gracias por confiar en Innovar! Nos encantaría saber
--      cómo fue tu experiencia. Respóndenos en 1 minuto: {{2}}"
--   garantia_reclamo_admin_v1 (UTILITY, es):
--     "⚠️ Nuevo reclamo de garantía {{1}} — Proyecto: {{2}}. Severidad: {{3}}.
--      Revisa el CRM para asignarlo."
-- =====================================================

BEGIN;

-- =============================================================================
-- 1) Columnas nuevas
-- =============================================================================

-- ADD COLUMN con default volátil rellena las filas existentes con valores
-- distintos por fila (PG ≥ 11 hace rewrite evaluando el default por fila).
ALTER TABLE public.satisfaction_surveys
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE
    DEFAULT encode(gen_random_bytes(16), 'hex');

ALTER TABLE public.satisfaction_surveys
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill de seguridad (no-op si el default ya rellenó)
UPDATE public.satisfaction_surveys
   SET public_token = encode(gen_random_bytes(16), 'hex')
 WHERE public_token IS NULL;

UPDATE public.satisfaction_surveys
   SET expires_at = now() + interval '30 days'
 WHERE expires_at IS NULL AND status IN ('pending', 'sent');

ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS claim_number text UNIQUE;

-- =============================================================================
-- 2) Número de reclamo atómico GAR-{año}-{0001}
--    Mismo patrón que generate_next_quotation_number (advisory xact lock).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_next_claim_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year     int  := EXTRACT(YEAR FROM NOW())::int;
  v_prefix   text := 'GAR-' || v_year || '-';
  v_last_num int;
BEGIN
  -- Constante arbitraria distinta a la de cotizaciones (9482631)
  PERFORM pg_advisory_xact_lock(9482632);

  SELECT COALESCE(
    MAX(NULLIF(SPLIT_PART(claim_number, '-', 3), '')::int),
    0
  )
  INTO v_last_num
  FROM public.warranty_claims
  WHERE claim_number LIKE v_prefix || '%';

  RETURN v_prefix || LPAD((v_last_num + 1)::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_warranty_claims_defaults()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.claim_number IS NULL THEN
    NEW.claim_number := public.generate_next_claim_number();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warranty_claims_defaults ON public.warranty_claims;
CREATE TRIGGER trg_warranty_claims_defaults
  BEFORE INSERT ON public.warranty_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_warranty_claims_defaults();

-- Defaults de encuesta nueva: token (cubierto por DEFAULT) + expiración
CREATE OR REPLACE FUNCTION public.fn_satisfaction_surveys_defaults()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_satisfaction_surveys_defaults ON public.satisfaction_surveys;
CREATE TRIGGER trg_satisfaction_surveys_defaults
  BEFORE INSERT ON public.satisfaction_surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_satisfaction_surveys_defaults();

-- =============================================================================
-- 3) Triggers de entrega — idempotentes, cubren delivered_at Y status
--    Reemplazan a trg_auto_post_delivery (legacy, sin guards).
-- =============================================================================

DROP TRIGGER IF EXISTS trg_auto_post_delivery ON public.projects;
-- fn_auto_post_delivery queda huérfana; se elimina explícitamente.
DROP FUNCTION IF EXISTS public.fn_auto_post_delivery();

CREATE OR REPLACE FUNCTION public.fn_create_warranty_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_months   int;
  v_starts   timestamptz;
  v_delivered_now boolean;
BEGIN
  v_delivered_now :=
       (NEW.delivered_at IS NOT NULL AND OLD.delivered_at IS NULL)
    OR (NEW.status = 'entregado'::project_status
        AND OLD.status IS DISTINCT FROM 'entregado'::project_status);

  IF NOT v_delivered_now THEN
    RETURN NEW;
  END IF;

  -- Idempotencia: una sola garantía por proyecto
  IF EXISTS (SELECT 1 FROM public.warranties WHERE project_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(value #>> '{}', '')::int, 12) INTO v_months
    FROM public.system_settings WHERE key = 'warranty_default_months';
  v_months := COALESCE(v_months, 12);

  v_starts := COALESCE(NEW.delivered_at, now());

  INSERT INTO public.warranties (
    project_id, client_id, warranty_months, starts_at, expires_at, status
  ) VALUES (
    NEW.id, NEW.client_id, v_months, v_starts,
    v_starts + (v_months || ' months')::interval, 'active'
  );

  -- Aviso in-app al admin (conserva el comportamiento del trigger legacy)
  INSERT INTO public.notifications (
    user_id, title, body, notification_type, related_table, related_id, priority
  )
  SELECT p.id,
         '📦 Proyecto entregado — garantía y encuesta creadas',
         'El proyecto "' || NEW.name || '" fue marcado como entregado. Se creó su garantía de '
           || v_months || ' meses y la encuesta de satisfacción quedó pendiente de envío.',
         'post_delivery', 'projects', NEW.id, 2
    FROM public.profiles p WHERE p.role = 'admin' LIMIT 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_warranty_on_delivery ON public.projects;
CREATE TRIGGER trg_create_warranty_on_delivery
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_warranty_on_delivery();

CREATE OR REPLACE FUNCTION public.fn_create_survey_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivered_now boolean;
BEGIN
  v_delivered_now :=
       (NEW.delivered_at IS NOT NULL AND OLD.delivered_at IS NULL)
    OR (NEW.status = 'entregado'::project_status
        AND OLD.status IS DISTINCT FROM 'entregado'::project_status);

  IF NOT v_delivered_now THEN
    RETURN NEW;
  END IF;

  -- Idempotencia: una sola encuesta por proyecto
  IF EXISTS (SELECT 1 FROM public.satisfaction_surveys WHERE project_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- El envío real lo hace la EF postventa-engine (separación captura/envío)
  INSERT INTO public.satisfaction_surveys (project_id, client_id, status)
  VALUES (NEW.id, NEW.client_id, 'pending');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_survey_on_delivery ON public.projects;
CREATE TRIGGER trg_create_survey_on_delivery
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_survey_on_delivery();

-- Legacy: encolaba WA con dominio equivocado y usaba el id como token.
DROP TRIGGER IF EXISTS trg_wa_satisfaction_survey ON public.projects;
DROP FUNCTION IF EXISTS public.fn_wa_satisfaction_survey();

-- =============================================================================
-- 4) RPCs públicas de la encuesta (anon, SECURITY DEFINER)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_survey(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_survey  RECORD;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT s.id, s.status, s.expires_at, s.responded_at,
         pr.name AS project_name, pr.work_type,
         split_part(COALESCE(c.name, 'Cliente'), ' ', 1) AS client_first_name
    INTO v_survey
    FROM public.satisfaction_surveys s
    JOIN public.projects pr ON pr.id = s.project_id
    LEFT JOIN public.clients c ON c.id = s.client_id
   WHERE s.public_token = p_token;

  IF v_survey.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_survey.status = 'responded' THEN
    RETURN jsonb_build_object('already_responded', true);
  END IF;

  IF v_survey.status = 'expired'
     OR (v_survey.expires_at IS NOT NULL AND v_survey.expires_at < now()) THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'project_name', v_survey.project_name,
    'client_first_name', v_survey.client_first_name,
    'work_type', v_survey.work_type,
    'already_responded', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_survey(
  p_token text,
  p_overall int,
  p_quality int,
  p_punctuality int,
  p_service int,
  p_would_recommend boolean,
  p_comments text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_survey RECORD;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF p_overall     NOT BETWEEN 1 AND 5
  OR p_quality     NOT BETWEEN 1 AND 5
  OR p_punctuality NOT BETWEEN 1 AND 5
  OR p_service     NOT BETWEEN 1 AND 5 THEN
    RETURN jsonb_build_object('error', 'invalid_rating');
  END IF;

  SELECT id, status, expires_at INTO v_survey
    FROM public.satisfaction_surveys
   WHERE public_token = p_token
   FOR UPDATE;

  IF v_survey.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_survey.status = 'responded' THEN
    RETURN jsonb_build_object('error', 'already_responded');
  END IF;

  IF v_survey.status = 'expired'
     OR (v_survey.expires_at IS NOT NULL AND v_survey.expires_at < now()) THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  UPDATE public.satisfaction_surveys
     SET rating_overall     = p_overall,
         rating_quality     = p_quality,
         rating_punctuality = p_punctuality,
         rating_service     = p_service,
         would_recommend    = p_would_recommend,
         comments           = NULLIF(trim(p_comments), ''),
         responded_at       = now(),
         status             = 'responded'
   WHERE id = v_survey.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_survey(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_survey(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_public_survey(text, int, int, int, int, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_survey(text, int, int, int, int, boolean, text) TO anon, authenticated;

-- =============================================================================
-- 4b) RPC para staff: enviar/reenviar la encuesta ahora (bypassa la espera
--     de survey_delay_days; respeta postventa_dry_run). Patrón de
--     send_tracking_link (053): enqueue_notification solo es ejecutable por
--     service_role; esta RPC estrecha expone únicamente este envío.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_survey_now(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_survey     RECORD;
  v_client     RECORD;
  v_base_url   TEXT;
  v_first_name TEXT;
  v_url        TEXT;
  v_event_ref  TEXT;
  v_dry_run    TEXT;
BEGIN
  IF public.get_my_role() NOT IN ('admin','super_admin','comercial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT value #>> '{}' INTO v_dry_run
    FROM public.system_settings WHERE key = 'postventa_dry_run';
  IF COALESCE(v_dry_run, 'true') = 'true' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dry_run');
  END IF;

  SELECT s.id, s.status, s.public_token, s.client_id, s.project_id
    INTO v_survey
    FROM public.satisfaction_surveys s
   WHERE s.id = p_survey_id
   FOR UPDATE;
  IF v_survey.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_survey.status NOT IN ('pending', 'sent') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_sendable');
  END IF;

  SELECT id, name, whatsapp_phone INTO v_client
    FROM public.clients WHERE id = v_survey.client_id;
  IF v_client.whatsapp_phone IS NULL OR length(trim(v_client.whatsapp_phone)) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_without_phone');
  END IF;

  SELECT COALESCE(value ->> 'url', value #>> '{}') INTO v_base_url
    FROM public.system_settings WHERE key = 'public_app_base_url';
  IF v_base_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_base_url');
  END IF;

  v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);
  v_url := rtrim(v_base_url, '/') || '/encuesta/' || v_survey.public_token;

  -- Dedup de enqueue_notification = template:event_ref:phone.
  -- Primer envío: event_ref = id (igual que el motor → no duplica).
  -- Reenvío: event_ref con fecha → máx. 1 reenvío por día.
  IF v_survey.status = 'pending' THEN
    v_event_ref := v_survey.id::text;
  ELSE
    v_event_ref := v_survey.id::text || ':resend:' || to_char(now(), 'YYYYMMDD');
  END IF;

  PERFORM public.enqueue_notification(
    'survey.request', v_event_ref,
    'satisfaction_survey', v_survey.id::text,
    'client', v_client.id::text,
    v_first_name, v_client.whatsapp_phone,
    'encuesta_satisfaccion_v1', 'es',
    jsonb_build_array(v_first_name, v_url),
    jsonb_build_object('survey_id', v_survey.id, 'project_id', v_survey.project_id)
  );

  UPDATE public.satisfaction_surveys
     SET status = 'sent',
         sent_at = COALESCE(sent_at, now()),
         expires_at = now() + interval '30 days'
   WHERE id = v_survey.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.send_survey_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_survey_now(uuid) TO authenticated;

-- =============================================================================
-- 5) Reclamo creado: garantía → 'claimed' + WA al admin si alta/crítica
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_claim_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alert_phone   text;
  v_project_name  text;
  v_admin_id      uuid;
  v_severity_label text;
BEGIN
  -- La garantía pasa a 'claimed' con el primer reclamo
  UPDATE public.warranties
     SET status = 'claimed'
   WHERE id = NEW.warranty_id AND status = 'active';

  IF NEW.severity NOT IN ('high', 'critical') THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(trim(value #>> '{}'), '') INTO v_alert_phone
    FROM public.system_settings WHERE key = 'postventa_alert_phone';
  IF v_alert_phone IS NULL THEN
    RETURN NEW; -- sin teléfono configurado = no enviar
  END IF;

  SELECT pr.name INTO v_project_name
    FROM public.warranties w
    JOIN public.projects pr ON pr.id = w.project_id
   WHERE w.id = NEW.warranty_id;

  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  v_severity_label := CASE NEW.severity
    WHEN 'critical' THEN 'Crítica'
    WHEN 'high'     THEN 'Alta'
    WHEN 'medium'   THEN 'Media'
    ELSE 'Baja'
  END;

  PERFORM public.enqueue_notification(
    'warranty.claim_created',                 -- p_event_type
    NEW.id::text,                             -- p_event_reference_id (dedup por reclamo)
    'warranty_claim',                         -- p_entity_type
    NEW.id::text,                             -- p_entity_reference_id
    'staff',                                  -- p_recipient_type
    COALESCE(v_admin_id::text, 'system'),     -- p_recipient_reference_id
    'Equipo Innovar',                         -- p_recipient_name
    v_alert_phone,                            -- p_recipient_phone
    'garantia_reclamo_admin_v1',              -- p_template_name
    'es',                                     -- p_template_language
    jsonb_build_array(
      COALESCE(NEW.claim_number, NEW.id::text),
      COALESCE(v_project_name, 'Proyecto'),
      v_severity_label
    ),
    '{}'::jsonb
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_claim_created ON public.warranty_claims;
CREATE TRIGGER trg_notify_claim_created
  AFTER INSERT ON public.warranty_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_claim_created();

-- =============================================================================
-- 6) Bucket privado claim-photos
--    Path convención: <claim_id>/<uuid>.<ext> — lectura vía signed URLs.
-- =============================================================================

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
) VALUES (
  'claim-photos',
  'claim-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp'],
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "claim_photos_bucket_insert" ON storage.objects;
CREATE POLICY "claim_photos_bucket_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'claim-photos'
    AND public.get_my_role() IN ('admin','super_admin','comercial','produccion')
  );

DROP POLICY IF EXISTS "claim_photos_bucket_select" ON storage.objects;
CREATE POLICY "claim_photos_bucket_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'claim-photos'
    AND public.get_my_role() IN ('admin','super_admin','comercial','produccion')
  );

DROP POLICY IF EXISTS "claim_photos_bucket_delete" ON storage.objects;
CREATE POLICY "claim_photos_bucket_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'claim-photos'
    AND public.get_my_role() IN ('admin','super_admin','comercial','produccion')
  );

-- =============================================================================
-- 7) Policies de tabla — agregan super_admin (las legacy no lo cubrían)
-- =============================================================================

DROP POLICY IF EXISTS "admin_all_warranties" ON public.warranties;
DROP POLICY IF EXISTS "staff_all_warranties" ON public.warranties;
CREATE POLICY "staff_all_warranties"
  ON public.warranties FOR ALL
  USING (public.get_my_role() IN ('admin','super_admin','comercial'))
  WITH CHECK (public.get_my_role() IN ('admin','super_admin','comercial'));

DROP POLICY IF EXISTS "admin_all_warranty_claims" ON public.warranty_claims;
DROP POLICY IF EXISTS "staff_all_warranty_claims" ON public.warranty_claims;
CREATE POLICY "staff_all_warranty_claims"
  ON public.warranty_claims FOR ALL
  USING (public.get_my_role() IN ('admin','super_admin','comercial','produccion'))
  WITH CHECK (public.get_my_role() IN ('admin','super_admin','comercial','produccion'));

DROP POLICY IF EXISTS "admin_all_satisfaction" ON public.satisfaction_surveys;
DROP POLICY IF EXISTS "staff_all_satisfaction" ON public.satisfaction_surveys;
CREATE POLICY "staff_all_satisfaction"
  ON public.satisfaction_surveys FOR ALL
  USING (public.get_my_role() IN ('admin','super_admin','comercial'))
  WITH CHECK (public.get_my_role() IN ('admin','super_admin','comercial'));

-- =============================================================================
-- 8) Vista de métricas del dashboard
-- =============================================================================

CREATE OR REPLACE VIEW public.v_postventa_metrics
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.warranties WHERE status = 'active')
    AS warranties_active,
  (SELECT count(*) FROM public.warranties
    WHERE status = 'active' AND expires_at < now() + interval '60 days')
    AS warranties_expiring_60d,
  (SELECT count(*) FROM public.warranty_claims WHERE status = 'open')
    AS claims_open,
  (SELECT count(*) FROM public.warranty_claims WHERE status = 'in_progress')
    AS claims_in_progress,
  (SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 86400)::numeric, 1)
     FROM public.warranty_claims
    WHERE status = 'resolved'
      AND resolved_at IS NOT NULL
      AND resolved_at > now() - interval '90 days')
    AS claims_avg_resolution_days,
  (SELECT round(avg(rating_overall)::numeric, 2)
     FROM public.satisfaction_surveys WHERE status = 'responded')
    AS rating_overall_avg,
  (SELECT round(avg(rating_quality)::numeric, 2)
     FROM public.satisfaction_surveys WHERE status = 'responded')
    AS rating_quality_avg,
  (SELECT round(avg(rating_punctuality)::numeric, 2)
     FROM public.satisfaction_surveys WHERE status = 'responded')
    AS rating_punctuality_avg,
  (SELECT round(avg(rating_service)::numeric, 2)
     FROM public.satisfaction_surveys WHERE status = 'responded')
    AS rating_service_avg,
  (SELECT count(*) FROM public.satisfaction_surveys WHERE status = 'responded')
    AS surveys_responded,
  (SELECT round(100.0 * count(*) FILTER (WHERE would_recommend) / NULLIF(count(*), 0), 0)
     FROM public.satisfaction_surveys
    WHERE status = 'responded' AND would_recommend IS NOT NULL)
    AS would_recommend_pct;

GRANT SELECT ON public.v_postventa_metrics TO authenticated;

-- =============================================================================
-- 9) Seeds en system_settings
-- =============================================================================

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('warranty_default_months', to_jsonb('12'::text),
   'Meses de garantía creados automáticamente al entregar un proyecto'),
  ('survey_delay_days', to_jsonb('2'::text),
   'Días de espera tras la entrega antes de enviar la encuesta de satisfacción'),
  ('postventa_alert_phone', to_jsonb(''::text),
   'WhatsApp interno que recibe alertas de reclamos alta/crítica y reclamos estancados (vacío = no enviar)'),
  ('google_review_url', to_jsonb(''::text),
   'Link de reseña en Google mostrado al cliente tras una encuesta ≥ 4 estrellas (vacío = ocultar CTA)'),
  ('postventa_dry_run', to_jsonb('true'::text),
   'Si ''true'', postventa-engine loguea sin encolar mensajes WA (modo seguro)')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- SELECT count(*) FROM satisfaction_surveys WHERE public_token IS NULL;          -- 0
-- SELECT public.generate_next_claim_number();                                    -- GAR-2026-0001
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.projects'::regclass
--   AND tgname IN ('trg_create_warranty_on_delivery','trg_create_survey_on_delivery'); -- 2
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.projects'::regclass
--   AND tgname IN ('trg_auto_post_delivery','trg_wa_satisfaction_survey');       -- 0 (eliminados)
-- SELECT id, public FROM storage.buckets WHERE id='claim-photos';                -- existe, public=false
-- SELECT * FROM v_postventa_metrics;                                             -- 1 fila
-- SELECT key FROM system_settings WHERE key IN ('warranty_default_months',
--   'survey_delay_days','postventa_alert_phone','google_review_url');            -- 4 filas

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- DROP VIEW IF EXISTS public.v_postventa_metrics;
-- DROP TRIGGER IF EXISTS trg_notify_claim_created ON public.warranty_claims;
-- DROP FUNCTION IF EXISTS public.fn_notify_claim_created();
-- DROP TRIGGER IF EXISTS trg_create_survey_on_delivery ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_create_survey_on_delivery();
-- DROP TRIGGER IF EXISTS trg_create_warranty_on_delivery ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_create_warranty_on_delivery();
-- DROP TRIGGER IF EXISTS trg_satisfaction_surveys_defaults ON public.satisfaction_surveys;
-- DROP FUNCTION IF EXISTS public.fn_satisfaction_surveys_defaults();
-- DROP TRIGGER IF EXISTS trg_warranty_claims_defaults ON public.warranty_claims;
-- DROP FUNCTION IF EXISTS public.fn_warranty_claims_defaults();
-- DROP FUNCTION IF EXISTS public.generate_next_claim_number();
-- DROP FUNCTION IF EXISTS public.submit_public_survey(text,int,int,int,int,boolean,text);
-- DROP FUNCTION IF EXISTS public.get_public_survey(text);
-- DROP POLICY IF EXISTS "staff_all_satisfaction" ON public.satisfaction_surveys;
-- DROP POLICY IF EXISTS "staff_all_warranties" ON public.warranties;
-- DROP POLICY IF EXISTS "staff_all_warranty_claims" ON public.warranty_claims;
-- DROP POLICY IF EXISTS "claim_photos_bucket_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "claim_photos_bucket_select" ON storage.objects;
-- DROP POLICY IF EXISTS "claim_photos_bucket_insert" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'claim-photos';  -- ⚠️ borra los objetos
-- DELETE FROM public.system_settings WHERE key IN ('warranty_default_months',
--   'survey_delay_days','postventa_alert_phone','google_review_url');
--   -- (postventa_dry_run NO se borra: existía antes de 055)
-- ALTER TABLE public.warranty_claims DROP COLUMN IF EXISTS claim_number,
--   DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS photos;
-- ALTER TABLE public.satisfaction_surveys DROP COLUMN IF EXISTS expires_at,
--   DROP COLUMN IF EXISTS public_token;
-- -- Para restaurar las policies legacy admin_all_* y los triggers legacy
-- -- (fn_auto_post_delivery / fn_wa_satisfaction_survey) ver el snapshot
-- -- completo en docs/handover o el historial de pg en prod previo a 055.
-- =============================================================================
