-- =============================================================================
-- 067_design_approval_spine.sql
-- Carta Magna · S4 — Spine de aprobación de diseño (backend)
-- =============================================================================
--
-- Origen: PRD-decisiones-comercial-aprobaciones.md + PRD-decisiones-diseno.md
-- + 2ª encuesta Q5 (tope de rondas) y Q7 (renders, no visor 3D).
--
-- Construye el ciclo de aprobación de diseño que HOY no existe (verificado prod
-- 2026-06-19): el diseñador envía la versión vigente al cliente; el cliente la ve
-- en un portal público por token, la aprueba o pide cambios; las solicitudes de
-- cambio respetan el tope de rondas (2 modelado + 1 render por etapa); pasada la
-- ronda incluida se genera cobro y se BLOQUEA hasta confirmación; solo super_admin
-- libera rondas sin cobro. Historial inmutable en design_approval_events.
--
-- NO toca la ruta del pago (flujo pago→diseño queda pendiente de decisión de Robert).
-- Es ADITIVO: nada se dispara hasta que el frontend llame estas RPC. La cadena de
-- avisos al aprobar el render (taller/comercial) y los recordatorios van en 068.
--
-- Convención: idempotente (CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS). Con ROLLBACK.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Columnas nuevas en projects
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS modelado_approved_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS renders_approved_by     uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS changes_requested_at    timestamptz,
  ADD COLUMN IF NOT EXISTS design_sent_at          timestamptz,
  ADD COLUMN IF NOT EXISTS design_stage            text,
  ADD COLUMN IF NOT EXISTS design_review_token     text,
  ADD COLUMN IF NOT EXISTS client_design_assets    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS design_extra_free_rounds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS design_charge_pending   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS design_charge_stage     text,
  -- Estas 3 ya existen en prod (verificado 2026-06-19); el IF NOT EXISTS las deja
  -- autocontenidas/idempotentes para que la migración no dependa de migraciones previas.
  ADD COLUMN IF NOT EXISTS modelado_approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS renders_approved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS client_approval_notes   text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_design_stage_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_design_stage_check
      CHECK (design_stage IS NULL OR design_stage IN ('modelado','render','aprobado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_design_review_token_key') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_design_review_token_key UNIQUE (design_review_token);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Tabla design_approval_events — historial inmutable rico (INSERT-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.design_approval_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage              text NOT NULL CHECK (stage IN ('modelado','render')),
  action             text NOT NULL CHECK (action IN ('approved','changes_requested','round_released','charge_confirmed')),
  source             text,   -- cliente_portal | comercial_presencial | comercial_whatsapp | comercial_telefono | cliente_whatsapp | super_admin
  is_delegated       boolean NOT NULL DEFAULT false,
  performed_by       uuid REFERENCES public.profiles(id),  -- interno que registró (NULL si fue el cliente por el portal)
  approver_name      text,   -- nombre que escribió el cliente / familiar
  motivo             text,
  nota               text,
  evidence_url       text,
  familiar_nombre    text,
  familiar_parentesco text,
  changes_description text,
  annotations        jsonb,  -- marcas del cliente sobre la imagen
  round_number       integer,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dae_project ON public.design_approval_events (project_id, created_at DESC);

ALTER TABLE public.design_approval_events ENABLE ROW LEVEL SECURITY;

-- Solo lectura para staff interno; sin policy de INSERT/UPDATE/DELETE: las filas
-- entran únicamente por las RPC SECURITY DEFINER de abajo. Inmutable por diseño.
DROP POLICY IF EXISTS "staff_read_design_approval_events" ON public.design_approval_events;
CREATE POLICY "staff_read_design_approval_events"
  ON public.design_approval_events FOR SELECT
  USING (public.get_my_role() IN ('admin','super_admin','diseno','comercial','gerente','administradora'));

-- -----------------------------------------------------------------------------
-- 3) RPC send_design_to_client — el diseñador publica la versión vigente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_design_to_client(
  p_project_id uuid,
  p_stage      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role   user_role := public.get_my_role();
  v_proj   RECORD;
  v_token  text;
  v_client RECORD;
  v_base   text;
  v_link   text;
BEGIN
  IF v_role IS NULL OR v_role <> ALL (ARRAY['diseno','admin','super_admin']::user_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_stage <> ALL (ARRAY['modelado','render']) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_stage');
  END IF;

  SELECT id, client_id, name, status, design_review_token
    INTO v_proj
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL AND is_archived = false;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;
  IF v_proj.status <> 'en_diseno'::project_status THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_in_design');
  END IF;

  v_token := COALESCE(v_proj.design_review_token, replace(gen_random_uuid()::text, '-', ''));

  UPDATE public.projects
     SET design_review_token = v_token,
         design_stage        = p_stage,
         design_sent_at      = now(),
         design_charge_pending = false,
         design_charge_stage = NULL,
         updated_at          = now()
   WHERE id = p_project_id;

  -- Aviso WhatsApp al cliente (plantilla Meta a aprobar; best-effort, no rompe el flujo).
  BEGIN
    SELECT c.id, c.name, c.whatsapp_phone INTO v_client
      FROM public.clients c WHERE c.id = v_proj.client_id;
    SELECT COALESCE(value->>'url', value #>> '{}') INTO v_base FROM public.system_settings WHERE key = 'public_app_base_url';
    v_link := COALESCE(v_base, '') || '/diseno/' || v_token;
    IF v_client.whatsapp_phone IS NOT NULL THEN
      PERFORM public.enqueue_notification(
        'design_version_ready', p_project_id::text, 'project', p_project_id::text,
        'client', v_client.id::text, v_client.name, v_client.whatsapp_phone,
        'design_version_ready_client_v1', 'es',
        jsonb_build_array(COALESCE(v_client.name,'cliente'), v_link),
        jsonb_build_object('design_link', v_link, 'stage', p_stage)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- el enqueue es opcional; si falla, el envío igual queda registrado
  END;

  RETURN jsonb_build_object('ok', true, 'token', v_token, 'stage', p_stage);
END;
$$;

REVOKE ALL ON FUNCTION public.send_design_to_client(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_design_to_client(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) RPC get_public_design — lectura pública por token (solo la versión vigente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_design(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proj   RECORD;
  v_client RECORD;
  v_assets jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT id, client_id, name, work_type, design_stage, design_sent_at,
         client_design_assets, modelado_approved_at, renders_approved_at,
         design_charge_pending, design_charge_stage
    INTO v_proj
    FROM public.projects
   WHERE design_review_token = p_token AND deleted_at IS NULL;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT name INTO v_client FROM public.clients WHERE id = v_proj.client_id;

  -- Solo los assets de la etapa vigente (no el historial).
  SELECT COALESCE(jsonb_agg(a ORDER BY (a->>'version')::int DESC), '[]'::jsonb)
    INTO v_assets
    FROM jsonb_array_elements(v_proj.client_design_assets) a
   WHERE (a->>'tipo') = v_proj.design_stage;

  RETURN jsonb_build_object(
    'ok', true,
    'project_name', v_proj.name,
    'client_name', v_client.name,
    'work_type', v_proj.work_type,
    'stage', v_proj.design_stage,
    'sent_at', v_proj.design_sent_at,
    'assets', v_assets,
    'modelado_approved', v_proj.modelado_approved_at IS NOT NULL,
    'renders_approved', v_proj.renders_approved_at IS NOT NULL,
    'charge_pending', v_proj.design_charge_pending AND v_proj.design_charge_stage = v_proj.design_stage
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_design(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_design(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5) Helper interno: aplica una aprobación de etapa (compartido portal/delegada)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_apply_design_approval(
  p_project_id uuid,
  p_stage      text,
  p_by         uuid,        -- interno que aprobó (NULL si fue el cliente por el portal)
  p_source     text,
  p_delegated  boolean,
  p_approver_name text,
  p_nota       text,
  p_evidence_url text,
  p_familiar_nombre text,
  p_familiar_parentesco text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proj RECORD;
BEGIN
  SELECT id, status, design_stage INTO v_proj
    FROM public.projects WHERE id = p_project_id AND deleted_at IS NULL FOR UPDATE;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;
  IF v_proj.design_stage IS DISTINCT FROM p_stage THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stage_mismatch');
  END IF;

  IF p_stage = 'modelado' THEN
    UPDATE public.projects
       SET modelado_approved_at = now(),
           modelado_approved_by = p_by,
           design_stage = 'render',
           design_sent_at = NULL,        -- esperando que el diseñador envíe los renders
           changes_requested_at = NULL,
           updated_at = now()
     WHERE id = p_project_id;
  ELSE  -- render
    UPDATE public.projects
       SET renders_approved_at = now(),
           renders_approved_by = p_by,
           client_approved_at = now(),
           design_stage = 'aprobado',
           changes_requested_at = NULL,
           updated_at = now()
     WHERE id = p_project_id;
    -- Render aprobado → avanza a aprobacion_final (dispara los triggers de estado).
    UPDATE public.projects
       SET status = 'aprobacion_final'::project_status
     WHERE id = p_project_id AND status = 'en_diseno'::project_status;
  END IF;

  INSERT INTO public.design_approval_events
    (project_id, stage, action, source, is_delegated, performed_by, approver_name,
     nota, evidence_url, familiar_nombre, familiar_parentesco)
  VALUES
    (p_project_id, p_stage, 'approved', p_source, p_delegated, p_by, p_approver_name,
     p_nota, p_evidence_url, p_familiar_nombre, p_familiar_parentesco);

  RETURN jsonb_build_object('ok', true,
    'next', CASE WHEN p_stage='modelado' THEN 'render' ELSE 'aprobacion_final' END);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_apply_design_approval(uuid,text,uuid,text,boolean,text,text,text,text,text) FROM PUBLIC, anon;

-- 5a) Aprobación pública (cliente por el portal)
CREATE OR REPLACE FUNCTION public.approve_design_public(
  p_token text,
  p_approver_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proj RECORD;
BEGIN
  SELECT id, design_stage INTO v_proj
    FROM public.projects WHERE design_review_token = p_token AND deleted_at IS NULL;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_proj.design_stage IS NULL OR v_proj.design_stage NOT IN ('modelado','render') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nothing_to_approve');
  END IF;
  RETURN public.fn_apply_design_approval(
    v_proj.id, v_proj.design_stage, NULL, 'cliente_portal', false,
    NULLIF(btrim(COALESCE(p_approver_name,'')),''), NULL, NULL, NULL, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_design_public(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_design_public(text, text) TO anon, authenticated;

-- 5b) Aprobación delegada (comercial registra en nombre del cliente, con evidencia)
CREATE OR REPLACE FUNCTION public.approve_design_delegated(
  p_project_id uuid,
  p_stage text,
  p_source text,
  p_nota text DEFAULT NULL,
  p_evidence_path text DEFAULT NULL,
  p_familiar_nombre text DEFAULT NULL,
  p_familiar_parentesco text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role := public.get_my_role();
BEGIN
  IF v_role IS NULL OR v_role <> ALL (ARRAY['comercial','admin','super_admin']::user_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF p_source <> ALL (ARRAY['comercial_presencial','comercial_whatsapp','comercial_telefono','cliente_whatsapp']) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_source');
  END IF;
  IF p_stage <> ALL (ARRAY['modelado','render']) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_stage');
  END IF;
  RETURN public.fn_apply_design_approval(
    p_project_id, p_stage, auth.uid(), p_source, true,
    NULL, p_nota, p_evidence_path,
    NULLIF(btrim(COALESCE(p_familiar_nombre,'')),''),
    NULLIF(btrim(COALESCE(p_familiar_parentesco,'')),''));
END;
$$;
REVOKE ALL ON FUNCTION public.approve_design_delegated(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_design_delegated(uuid,text,text,text,text,text,text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) Solicitar cambios (Q5: tope de rondas + cobro + bloqueo)
--    Helper que centraliza la lógica; lo usan el portal y el panel.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_request_design_changes(
  p_project_id uuid,
  p_stage text,
  p_description text,
  p_annotations jsonb,
  p_by uuid,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proj RECORD;
  v_included int;
  v_used int;
  v_next int;
  v_charge_min numeric;
  v_charge_max numeric;
  v_designer uuid;
BEGIN
  SELECT id, client_id, name, status, design_stage, designer_id,
         modelado_revision_number, render_revision_number, design_extra_free_rounds,
         design_charge_pending, design_charge_stage
    INTO v_proj
    FROM public.projects WHERE id = p_project_id AND deleted_at IS NULL FOR UPDATE;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;
  IF v_proj.design_stage IS DISTINCT FROM p_stage THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stage_mismatch');
  END IF;
  -- Corte temprano: si ya hay un cobro pendiente para esta etapa, no re-registrar ni
  -- re-notificar (evita que llamadas anon repetidas inunden historial y notificaciones).
  IF v_proj.design_charge_pending AND v_proj.design_charge_stage = p_stage THEN
    RETURN jsonb_build_object('ok', false, 'error', 'charge_pending');
  END IF;

  SELECT (value #>> '{}')::int INTO v_included FROM public.system_settings
    WHERE key = CASE WHEN p_stage='modelado' THEN 'design_rounds_modelado_included'
                     ELSE 'design_rounds_render_included' END;
  v_included := COALESCE(v_included, CASE WHEN p_stage='modelado' THEN 2 ELSE 1 END)
                + COALESCE(v_proj.design_extra_free_rounds, 0);
  v_used := CASE WHEN p_stage='modelado' THEN COALESCE(v_proj.modelado_revision_number,0)
                 ELSE COALESCE(v_proj.render_revision_number,0) END;
  v_next := v_used + 1;

  -- Registrar siempre el pedido de cambios (historial inmutable).
  INSERT INTO public.design_approval_events
    (project_id, stage, action, source, is_delegated, performed_by,
     changes_description, annotations, round_number)
  VALUES
    (p_project_id, p_stage, 'changes_requested', p_source, (p_by IS NOT NULL), p_by,
     NULLIF(btrim(COALESCE(p_description,'')),''), p_annotations, v_next);

  UPDATE public.projects
     SET changes_requested_at = now(),
         client_approval_notes = NULLIF(btrim(COALESCE(p_description,'')),''),
         updated_at = now()
   WHERE id = p_project_id;

  IF v_next > v_included THEN
    -- Supera las rondas incluidas → cobro pactado + BLOQUEA hasta confirmación.
    SELECT (value #>> '{}')::numeric INTO v_charge_min FROM public.system_settings WHERE key='design_extra_round_charge_min';
    SELECT (value #>> '{}')::numeric INTO v_charge_max FROM public.system_settings WHERE key='design_extra_round_charge_max';
    UPDATE public.projects
       SET design_charge_pending = true, design_charge_stage = p_stage, updated_at = now()
     WHERE id = p_project_id;

    -- Avisar internamente a admin/super_admin (in-app).
    INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, priority, action_url)
    SELECT pr.id, 'Ronda extra de diseño por cobrar',
           'El cliente pidió la ronda ' || v_next || ' de ' || p_stage || ' en ' || COALESCE(v_proj.name,'un proyecto')
             || ' — supera las incluidas. Hay que pactar el cobro y confirmar para continuar.',
           'projects', p_project_id, 'design_extra_round_charge', 1, '/projects/' || p_project_id
      FROM public.profiles pr
     WHERE pr.is_active = true AND pr.role = ANY (ARRAY['admin','super_admin','comercial']::user_role[]);

    RETURN jsonb_build_object('ok', true, 'requires_charge', true, 'round', v_next,
      'charge_min', COALESCE(v_charge_min,80000), 'charge_max', COALESCE(v_charge_max,150000));
  END IF;

  -- Ronda incluida → cuenta, crea tarea al diseñador y notifica.
  IF p_stage='modelado' THEN
    UPDATE public.projects SET modelado_revision_number = v_next WHERE id = p_project_id;
  ELSE
    UPDATE public.projects SET render_revision_number = v_next WHERE id = p_project_id;
  END IF;

  v_designer := v_proj.designer_id;
  INSERT INTO public.tasks (project_id, client_id, title, description, status, priority, due_date,
                            assigned_to, task_category, tags)
  VALUES (p_project_id, v_proj.client_id,
          'Aplicar cambios de ' || p_stage || ' (ronda ' || v_next || ')',
          COALESCE(NULLIF(btrim(COALESCE(p_description,'')),''), 'El cliente solicitó ajustes.'),
          'pendiente', 0, (current_date + 2), v_designer, 'diseno',
          ARRAY['auto','solicitud_cambios']);

  -- Aviso interno a admin/super_admin (sin auto-notificar al ejecutor).
  INSERT INTO public.notifications (user_id, title, body, related_table, related_id, notification_type, priority, action_url)
  SELECT pr.id, 'Cambios de diseño solicitados',
         'El cliente pidió cambios (' || p_stage || ', ronda ' || v_next || ') en ' || COALESCE(v_proj.name,'un proyecto') || '.',
         'projects', p_project_id, 'design_changes_requested', 1, '/projects/' || p_project_id
    FROM public.profiles pr
   WHERE pr.is_active = true AND pr.role = ANY (ARRAY['admin','super_admin']::user_role[])
     AND pr.id <> COALESCE(p_by, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN jsonb_build_object('ok', true, 'requires_charge', false, 'round', v_next);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_request_design_changes(uuid,text,text,jsonb,uuid,text) FROM PUBLIC, anon;

-- 6a) Pedido de cambios público (cliente por el portal)
CREATE OR REPLACE FUNCTION public.request_design_changes_public(
  p_token text,
  p_description text,
  p_annotations jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proj RECORD;
BEGIN
  SELECT id, design_stage INTO v_proj
    FROM public.projects WHERE design_review_token = p_token AND deleted_at IS NULL;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_proj.design_stage IS NULL OR v_proj.design_stage NOT IN ('modelado','render') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nothing_to_change');
  END IF;
  RETURN public.fn_request_design_changes(
    v_proj.id, v_proj.design_stage, p_description, p_annotations, NULL, 'cliente_portal');
END;
$$;
REVOKE ALL ON FUNCTION public.request_design_changes_public(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_design_changes_public(text, text, jsonb) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7) Confirmar cobro de ronda extra (admin/comercial) y liberar ronda (super_admin)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_extra_round_charge(
  p_project_id uuid,
  p_stage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role := public.get_my_role();
  v_proj RECORD;
  v_next int;
BEGIN
  IF v_role IS NULL OR v_role <> ALL (ARRAY['admin','super_admin','comercial']::user_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  SELECT id, client_id, designer_id, design_charge_pending, design_charge_stage,
         modelado_revision_number, render_revision_number
    INTO v_proj FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF v_proj.id IS NULL OR v_proj.design_charge_pending IS NOT TRUE OR v_proj.design_charge_stage IS DISTINCT FROM p_stage THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_pending_charge');
  END IF;

  v_next := CASE WHEN p_stage='modelado' THEN COALESCE(v_proj.modelado_revision_number,0)+1
                 ELSE COALESCE(v_proj.render_revision_number,0)+1 END;
  IF p_stage='modelado' THEN
    UPDATE public.projects SET modelado_revision_number=v_next, design_charge_pending=false, design_charge_stage=NULL WHERE id=p_project_id;
  ELSE
    UPDATE public.projects SET render_revision_number=v_next, design_charge_pending=false, design_charge_stage=NULL WHERE id=p_project_id;
  END IF;

  -- Rastro en el historial inmutable de que el cobro de la ronda extra fue confirmado.
  INSERT INTO public.design_approval_events (project_id, stage, action, performed_by, round_number, nota)
  VALUES (p_project_id, p_stage, 'charge_confirmed', auth.uid(), v_next, 'Cobro de ronda extra confirmado.');

  INSERT INTO public.tasks (project_id, client_id, title, description, status, priority, due_date, assigned_to, task_category, tags)
  VALUES (p_project_id, v_proj.client_id, 'Aplicar cambios de ' || p_stage || ' (ronda ' || v_next || ' — cobrada)',
          'Cobro de ronda extra confirmado. Aplicar los ajustes solicitados.', 'pendiente', 0, (current_date+2),
          v_proj.designer_id, 'diseno', ARRAY['auto','solicitud_cambios','ronda_cobrada']);

  RETURN jsonb_build_object('ok', true, 'round', v_next);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_extra_round_charge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_extra_round_charge(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_design_round(
  p_project_id uuid,
  p_stage text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role := public.get_my_role();
  v_proj RECORD;
  v_next int;
BEGIN
  IF v_role IS DISTINCT FROM 'super_admin'::user_role THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');  -- solo super_admin libera sin cobro
  END IF;
  SELECT id, client_id, designer_id, design_charge_pending, design_charge_stage,
         modelado_revision_number, render_revision_number, design_extra_free_rounds
    INTO v_proj FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  v_next := CASE WHEN p_stage='modelado' THEN COALESCE(v_proj.modelado_revision_number,0)+1
                 ELSE COALESCE(v_proj.render_revision_number,0)+1 END;
  IF p_stage='modelado' THEN
    UPDATE public.projects SET modelado_revision_number=v_next,
        design_extra_free_rounds=COALESCE(design_extra_free_rounds,0)+1,
        design_charge_pending=false, design_charge_stage=NULL WHERE id=p_project_id;
  ELSE
    UPDATE public.projects SET render_revision_number=v_next,
        design_extra_free_rounds=COALESCE(design_extra_free_rounds,0)+1,
        design_charge_pending=false, design_charge_stage=NULL WHERE id=p_project_id;
  END IF;

  INSERT INTO public.design_approval_events (project_id, stage, action, source, performed_by, nota, round_number)
  VALUES (p_project_id, p_stage, 'round_released', 'super_admin', auth.uid(),
          NULLIF(btrim(COALESCE(p_reason,'')),''), v_next);

  INSERT INTO public.tasks (project_id, client_id, title, description, status, priority, due_date, assigned_to, task_category, tags)
  VALUES (p_project_id, v_proj.client_id, 'Aplicar cambios de ' || p_stage || ' (ronda ' || v_next || ' — liberada)',
          'Ronda extra liberada sin cobro. Aplicar los ajustes.', 'pendiente', 0, (current_date+2),
          v_proj.designer_id, 'diseno', ARRAY['auto','solicitud_cambios','ronda_liberada']);

  RETURN jsonb_build_object('ok', true, 'round', v_next);
END;
$$;
REVOKE ALL ON FUNCTION public.release_design_round(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_design_round(uuid, text, text) TO authenticated;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.release_design_round(uuid,text,text);
-- DROP FUNCTION IF EXISTS public.confirm_extra_round_charge(uuid,text);
-- DROP FUNCTION IF EXISTS public.request_design_changes_public(text,text,jsonb);
-- DROP FUNCTION IF EXISTS public.fn_request_design_changes(uuid,text,text,jsonb,uuid,text);
-- DROP FUNCTION IF EXISTS public.approve_design_delegated(uuid,text,text,text,text,text,text);
-- DROP FUNCTION IF EXISTS public.approve_design_public(text,text);
-- DROP FUNCTION IF EXISTS public.fn_apply_design_approval(uuid,text,uuid,text,boolean,text,text,text,text,text);
-- DROP FUNCTION IF EXISTS public.get_public_design(text);
-- DROP FUNCTION IF EXISTS public.send_design_to_client(uuid,text);
-- DROP POLICY IF EXISTS "staff_read_design_approval_events" ON public.design_approval_events;
-- DROP TABLE IF EXISTS public.design_approval_events;
-- ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_design_review_token_key;
-- ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_design_stage_check;
-- ALTER TABLE public.projects
--   DROP COLUMN IF EXISTS modelado_approved_by, DROP COLUMN IF EXISTS renders_approved_by,
--   DROP COLUMN IF EXISTS changes_requested_at, DROP COLUMN IF EXISTS design_sent_at,
--   DROP COLUMN IF EXISTS design_stage, DROP COLUMN IF EXISTS design_review_token,
--   DROP COLUMN IF EXISTS client_design_assets, DROP COLUMN IF EXISTS design_extra_free_rounds,
--   DROP COLUMN IF EXISTS design_charge_pending, DROP COLUMN IF EXISTS design_charge_stage;
-- COMMIT;
-- =============================================================================
