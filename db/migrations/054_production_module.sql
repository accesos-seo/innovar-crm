-- =====================================================
-- 054 — Módulo de Producción / Taller (PRD-produccion-taller.md)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-10
--
-- Piezas:
--   1) Tabla project_status_history + índice + RLS (solo SELECT staff;
--      INSERT únicamente vía trigger SECURITY DEFINER).
--   2) Trigger trg_log_project_status: AFTER UPDATE OF status registra
--      from/to/changed_by (NULL si lo cambió un proceso de sistema).
--   3) RPC move_project_status: camino canónico del Kanban de planta.
--      Centraliza las reglas de transición por rol (el Zod del repo lista
--      un enum project_status viejo, así que el frontend NO usa
--      useUpdateProject para mover fases) y guarda la nota del diálogo
--      de confirmación en el historial.
--   4) Bucket privado project-files (3D + despieces, 50 MB).
--   5) Seeds system_settings: production_capacity_max, production_stale_days.
--   6) Backfill best-effort: una fila sintética por proyecto vivo para que
--      "días en fase" tenga base desde el día 1.
--   7) Policy de tasks para que el rol produccion vea/gestione las tareas
--      de categoría 'produccion' (hoy solo ve las asignadas a sí mismo,
--      lo que dejaría el checklist de la ficha de taller incompleto).
--
-- ⚠️ Riesgo conocido: projects.status tiene 5+ triggers de WhatsApp en prod
--    (fn_wa_project_status_change, notify_fabrication_started, etc.).
--    Mover una tarjeta en el Kanban dispara mensajes al cliente → la UI
--    SIEMPRE confirma antes de llamar move_project_status.
-- =====================================================

BEGIN;

-- =============================================================================
-- 1) Tabla project_status_history
--    (project_phase_log existente es un log de notificaciones; NO sirve.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_status project_status,
  to_status project_status NOT NULL,
  changed_by uuid REFERENCES public.profiles(id),
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psh_project
  ON public.project_status_history (project_id, changed_at DESC);

ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;

-- Solo lectura para staff; sin policy de INSERT/UPDATE/DELETE: las filas
-- entran únicamente por el trigger (SECURITY DEFINER) y la nota por la RPC.
DROP POLICY IF EXISTS "staff_read_project_status_history" ON public.project_status_history;
CREATE POLICY "staff_read_project_status_history"
  ON public.project_status_history FOR SELECT
  USING (public.get_my_role() IN ('admin','super_admin','diseno','produccion','comercial'));

-- =============================================================================
-- 2) Trigger de registro de cambios de fase
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_project_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.project_status_history (project_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_project_status ON public.projects;
CREATE TRIGGER trg_log_project_status
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_project_status();

-- =============================================================================
-- 3) RPC move_project_status — camino canónico del Kanban
--    Reglas: admin/super_admin mueven a cualquier fase; diseno solo
--    en_diseno→aprobacion_final; produccion solo en_produccion→listo_instalacion.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.move_project_status(
  p_project_id uuid,
  p_to_status project_status,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role := public.get_my_role();
  v_from project_status;
BEGIN
  SELECT status INTO v_from
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL AND is_archived = false;

  IF v_from IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  IF v_from = p_to_status THEN
    RETURN jsonb_build_object('ok', false, 'error', 'same_status');
  END IF;

  IF v_role IN ('admin','super_admin') THEN
    NULL; -- cualquier movimiento, adelante o atrás
  ELSIF v_role = 'diseno' AND v_from = 'en_diseno' AND p_to_status = 'aprobacion_final' THEN
    NULL;
  ELSIF v_role = 'produccion' AND v_from = 'en_produccion' AND p_to_status = 'listo_instalacion' THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden_transition');
  END IF;

  -- Dispara los triggers de prod (historial + notificaciones WhatsApp)
  UPDATE public.projects SET status = p_to_status WHERE id = p_project_id;

  -- La nota del diálogo de confirmación va sobre la fila que acaba de
  -- insertar trg_log_project_status (misma transacción).
  IF p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN
    UPDATE public.project_status_history
       SET note = trim(p_note)
     WHERE id = (
       SELECT id FROM public.project_status_history
        WHERE project_id = p_project_id
        ORDER BY changed_at DESC, id DESC
        LIMIT 1
     );
  END IF;

  RETURN jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
END;
$$;

REVOKE ALL ON FUNCTION public.move_project_status(uuid, project_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_project_status(uuid, project_status, text) TO authenticated;

-- =============================================================================
-- 4) Bucket privado project-files (diseño 3D + despieces)
--    Los CAD (.skp/.dwg/.dxf) llegan como octet-stream; la extensión se
--    valida en el frontend (pdf,skp,dwg,dxf,png,jpg,jpeg,webp).
--    Path: <project_id>/design3d/<uuid>-<filename> | <project_id>/despiece/...
-- =============================================================================

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
) VALUES (
  'project-files',
  'project-files',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf','application/octet-stream','image/jpeg','image/jpg','image/png','image/webp'],
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_files_bucket_insert" ON storage.objects;
CREATE POLICY "project_files_bucket_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND public.get_my_role() IN ('admin','super_admin','diseno','produccion')
  );

DROP POLICY IF EXISTS "project_files_bucket_select" ON storage.objects;
CREATE POLICY "project_files_bucket_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND public.get_my_role() IN ('admin','super_admin','diseno','produccion')
  );

DROP POLICY IF EXISTS "project_files_bucket_delete" ON storage.objects;
CREATE POLICY "project_files_bucket_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND public.get_my_role() IN ('admin','super_admin','diseno')
  );

-- =============================================================================
-- 5) Seeds en system_settings
-- =============================================================================

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('production_capacity_max', to_jsonb('5'::text),
   'Máximo de proyectos simultáneos en en_produccion antes de alerta de capacidad (mismo umbral que la EF monitor-capacidad)'),
  ('production_stale_days', to_jsonb('7'::text),
   'Días sin cambio de fase para marcar una tarjeta del Kanban de planta como estancada')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 6) Backfill best-effort del historial
--    updated_at como aproximación del último cambio (mejor que now()).
-- =============================================================================

INSERT INTO public.project_status_history (project_id, from_status, to_status, note, changed_at)
SELECT p.id, NULL, p.status, 'backfill 054', COALESCE(p.updated_at, p.created_at, now())
  FROM public.projects p
 WHERE p.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.project_status_history h WHERE h.project_id = p.id
   );

-- =============================================================================
-- 7) Tasks: el rol produccion necesita ver/gestionar el checklist de taller
--    completo (hoy su única policy es assigned_to = auth.uid()).
--    Patrón del repo: FOR ALL sin TO (= PUBLIC).
-- =============================================================================

DROP POLICY IF EXISTS "produccion: tareas de taller" ON public.tasks;
CREATE POLICY "produccion: tareas de taller"
  ON public.tasks FOR ALL
  USING (
    public.get_my_role() = 'produccion'
    AND task_category = 'produccion'
  )
  WITH CHECK (
    public.get_my_role() = 'produccion'
    AND task_category = 'produccion'
  );

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- SELECT count(*) FROM project_status_history;                          -- ≈ nº proyectos vivos (backfill)
-- SELECT tgname FROM pg_trigger WHERE tgrelid='public.projects'::regclass
--   AND tgname='trg_log_project_status';                                -- 1 fila
-- SELECT proname FROM pg_proc WHERE proname='move_project_status';      -- 1 fila
-- SELECT id, public, file_size_limit FROM storage.buckets
--   WHERE id='project-files';                                           -- existe, false, 52428800
-- SELECT key, value FROM system_settings
--   WHERE key IN ('production_capacity_max','production_stale_days');   -- 2 filas

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- DROP POLICY IF EXISTS "produccion: tareas de taller" ON public.tasks;
-- DELETE FROM public.system_settings WHERE key IN ('production_capacity_max','production_stale_days');
-- DROP POLICY IF EXISTS "project_files_bucket_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "project_files_bucket_select" ON storage.objects;
-- DROP POLICY IF EXISTS "project_files_bucket_insert" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'project-files';
--   -- ⚠️ Borrar el bucket borra los objetos dentro.
-- DROP FUNCTION IF EXISTS public.move_project_status(uuid, project_status, text);
-- DROP TRIGGER IF EXISTS trg_log_project_status ON public.projects;
-- DROP FUNCTION IF EXISTS public.fn_log_project_status();
-- DROP TABLE IF EXISTS public.project_status_history;
-- =============================================================================
