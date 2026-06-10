-- =====================================================
-- 053 — Portal del Cliente "Mi Proyecto" (PRD-portal-cliente.md)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-10
--
-- Piezas:
--   1) tracking_token: backfill + default + NOT NULL + índice único
--      (validado en prod 2026-06-10: ya existe default gen_random_uuid(),
--       NOT NULL y los índices projects_tracking_token_key /
--       idx_projects_tracking_token — los pasos quedan por idempotencia).
--   2) Bucket privado `project-photos` + policies por rol.
--   3) Policy de tabla `project_photos` para admin/super_admin/diseno/produccion
--      (la policy previa admin_all_project_photos solo cubría 'admin').
--   4) Seeds en system_settings: portal_contact_phone, portal_link_autosend.
--   5) Trigger trg_send_tracking_link: al pasar a 'cotizacion_aprobada'
--      encola WA con template tracking_link_v1 (solo si autosend='true').
--
-- Template Meta: tracking_link_v1 (pendiente de aprobación)
--   {{1}} = primer nombre del cliente
--   {{2}} = link del portal
--   Body sugerido: "Hola {{1}} 👋 Tu proyecto con Innovar ya está en marcha.
--   Sigue su avance paso a paso aquí: {{2}}. Te avisaremos en cada etapa."
--   Mientras no esté aprobada → portal_link_autosend queda en 'false'.
-- =====================================================

BEGIN;

-- =============================================================================
-- 1) tracking_token — backfill + default + NOT NULL + índice único
-- =============================================================================

UPDATE public.projects
   SET tracking_token = gen_random_uuid()
 WHERE tracking_token IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN tracking_token SET DEFAULT gen_random_uuid();

ALTER TABLE public.projects
  ALTER COLUMN tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tracking_token
  ON public.projects (tracking_token);

-- =============================================================================
-- 2) Bucket privado `project-photos`
--    Path convención: <project_id>/<uuid>.<ext>
--    El cliente final NUNCA accede directo: la EF public-project-tracking
--    genera signed URLs con service_role.
-- =============================================================================

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
) VALUES (
  'project-photos',
  'project-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp'],
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_photos_bucket_insert" ON storage.objects;
CREATE POLICY "project_photos_bucket_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-photos'
    AND public.get_my_role() IN ('admin','super_admin','diseno','produccion')
  );

DROP POLICY IF EXISTS "project_photos_bucket_select" ON storage.objects;
CREATE POLICY "project_photos_bucket_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-photos'
    AND public.get_my_role() IN ('admin','super_admin','diseno','produccion')
  );

DROP POLICY IF EXISTS "project_photos_bucket_delete" ON storage.objects;
CREATE POLICY "project_photos_bucket_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-photos'
    AND public.get_my_role() IN ('admin','super_admin','diseno','produccion')
  );

-- =============================================================================
-- 3) Policy de tabla project_photos (RLS ya habilitado en prod)
--    Patrón del repo: FOR ALL sin TO (= PUBLIC); get_my_role() devuelve user_role.
-- =============================================================================

DROP POLICY IF EXISTS "staff_all_project_photos" ON public.project_photos;
CREATE POLICY "staff_all_project_photos"
  ON public.project_photos FOR ALL
  USING (public.get_my_role() IN ('admin','super_admin','diseno','produccion'))
  WITH CHECK (public.get_my_role() IN ('admin','super_admin','diseno','produccion'));

-- =============================================================================
-- 4) Seeds en system_settings
-- =============================================================================

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('portal_contact_phone', to_jsonb('3002826317'::text),
   'Número WhatsApp de contacto mostrado en el portal público del cliente'),
  ('portal_link_autosend', to_jsonb('false'::text),
   'Si ''true'', al pasar un proyecto a cotizacion_aprobada se encola el WA con el link del portal (requiere template Meta tracking_link_v1 aprobada)')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 5) Trigger de envío automático del link de seguimiento
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_send_tracking_link()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_autosend   TEXT;
  v_base_url   TEXT;
  v_client     RECORD;
  v_first_name TEXT;
  v_url        TEXT;
BEGIN
  -- Solo en la transición a cotizacion_aprobada
  IF NEW.status IS DISTINCT FROM 'cotizacion_aprobada'::project_status
     OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Kill switch: requiere template Meta aprobada
  SELECT value #>> '{}' INTO v_autosend
    FROM public.system_settings WHERE key = 'portal_link_autosend';
  IF COALESCE(v_autosend, 'false') <> 'true' THEN
    RETURN NEW;
  END IF;

  -- Dedup: un solo envío de link por proyecto
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE event_type = 'project.tracking_link'
      AND event_reference_id = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id, name, whatsapp_phone INTO v_client
    FROM public.clients WHERE id = NEW.client_id;

  IF v_client.whatsapp_phone IS NULL OR length(trim(v_client.whatsapp_phone)) < 10 THEN
    RETURN NEW;
  END IF;

  -- public_app_base_url se guarda como {"url": "..."} (validado en prod)
  SELECT COALESCE(value ->> 'url', value #>> '{}') INTO v_base_url
    FROM public.system_settings WHERE key = 'public_app_base_url';
  IF v_base_url IS NULL THEN
    RETURN NEW;
  END IF;

  v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);
  v_url := rtrim(v_base_url, '/') || '/proyecto/' || NEW.tracking_token::text;

  PERFORM public.enqueue_notification(
    'project.tracking_link',          -- p_event_type
    NEW.id::text,                     -- p_event_reference_id
    'project',                        -- p_entity_type
    NEW.id::text,                     -- p_entity_reference_id
    'client',                         -- p_recipient_type
    v_client.id::text,                -- p_recipient_reference_id
    v_first_name,                     -- p_recipient_name
    v_client.whatsapp_phone,          -- p_recipient_phone
    'tracking_link_v1',               -- p_template_name
    'es',                             -- p_template_language
    jsonb_build_array(v_first_name, v_url),  -- p_template_parameters
    '{}'::jsonb                       -- p_payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_tracking_link ON public.projects;
CREATE TRIGGER trg_send_tracking_link
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_send_tracking_link();

-- =============================================================================
-- 6) RPC para el botón "Enviar por WhatsApp" del CRM
--    enqueue_notification solo es ejecutable por service_role; esta RPC
--    estrecha expone únicamente el envío del link de seguimiento a staff.
--    Gate: portal_link_autosend = 'true' actúa como interruptor maestro
--    "template Meta tracking_link_v1 aprobada" (para trigger Y para manual).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_tracking_link(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project    RECORD;
  v_client     RECORD;
  v_base_url   TEXT;
  v_first_name TEXT;
  v_url        TEXT;
BEGIN
  IF public.get_my_role() NOT IN ('admin','super_admin','diseno','produccion','comercial') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF COALESCE((SELECT value #>> '{}' FROM public.system_settings
               WHERE key = 'portal_link_autosend'), 'false') <> 'true' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'template_not_approved');
  END IF;

  SELECT id, name, client_id, tracking_token INTO v_project
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL AND is_archived = false;
  IF v_project.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  SELECT id, name, whatsapp_phone INTO v_client
    FROM public.clients WHERE id = v_project.client_id;
  IF v_client.whatsapp_phone IS NULL OR length(trim(v_client.whatsapp_phone)) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_without_phone');
  END IF;

  -- Anti doble-click: no encolar si ya hay un envío pendiente para este proyecto
  IF EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE event_type = 'project.tracking_link'
      AND event_reference_id = v_project.id::text
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pending');
  END IF;

  SELECT COALESCE(value ->> 'url', value #>> '{}') INTO v_base_url
    FROM public.system_settings WHERE key = 'public_app_base_url';
  IF v_base_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_base_url');
  END IF;

  v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);
  v_url := rtrim(v_base_url, '/') || '/proyecto/' || v_project.tracking_token::text;

  PERFORM public.enqueue_notification(
    'project.tracking_link', v_project.id::text,
    'project', v_project.id::text,
    'client', v_client.id::text,
    v_first_name, v_client.whatsapp_phone,
    'tracking_link_v1', 'es',
    jsonb_build_array(v_first_name, v_url),
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.send_tracking_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tracking_link(uuid) TO authenticated;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- SELECT id, public FROM storage.buckets WHERE id = 'project-photos';            -- existe, public=false
-- SELECT polname FROM pg_policy WHERE polrelid='storage.objects'::regclass
--   AND polname LIKE 'project_photos_bucket_%';                                  -- 3 policies
-- SELECT key, value FROM system_settings
--   WHERE key IN ('portal_contact_phone','portal_link_autosend');                -- 2 filas
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.projects'::regclass
--   AND tgname='trg_send_tracking_link';                                         -- 1 fila

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.send_tracking_link(uuid);
-- DROP TRIGGER IF EXISTS trg_send_tracking_link ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_send_tracking_link();
-- DELETE FROM public.system_settings WHERE key IN ('portal_contact_phone','portal_link_autosend');
-- DROP POLICY IF EXISTS "staff_all_project_photos" ON public.project_photos;
-- DROP POLICY IF EXISTS "project_photos_bucket_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "project_photos_bucket_select" ON storage.objects;
-- DROP POLICY IF EXISTS "project_photos_bucket_insert" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'project-photos';
--   -- ⚠️ Borrar el bucket borra los objetos dentro.
-- -- (No revertir default/NOT NULL de tracking_token: ya existían antes de 053.)
-- =============================================================================
