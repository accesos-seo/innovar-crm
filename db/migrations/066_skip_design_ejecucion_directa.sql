-- =============================================================================
-- 066_skip_design_ejecucion_directa.sql
-- Carta Magna · S1 — Q8: Ejecución directa / proyectos "sin diseño"
-- =============================================================================
--
-- Origen: 2ª encuesta del dueño (Q8) + PRD-decisiones-produccion.md.
-- Regla del dueño: la omisión de diseño es la EXCEPCIÓN y queda controlada.
--   · Pueden omitir diseño: reparaciones, reposiciones, acabados, puertas de
--     reposición, catálogo estándar (producto definido por medidas/materiales).
--   · Autoridad en 2 niveles:
--       - Comercial: marca "sin diseño" en BAJO VALOR y alcance claro, sin
--         aprobación adicional (queda registrado quién y cuándo).
--       - Admin: aprueba la omisión SOBRE el umbral (system_settings.
--         skip_design_admin_threshold, default $500.000). El comercial solicita,
--         el admin aprueba/rechaza desde su panel, queda el motivo.
--       - Producción NUNCA decide.
--   · "Ejecución directa" = categoría propia: no genera tarea de diseño ni pide
--     renders (la tarea de diseño ya la suprime create_project_starter_tasks
--     cuando skip_design_process=true; acá además se cancela si se marca DESPUÉS).
--
-- Verificado contra prod (2026-06-19): la columna projects.skip_design_process YA
-- existe (boolean) y create_project_starter_tasks YA respeta el flag en la creación.
-- Lo que falta —y agrega esta migración— es: clasificación por categoría, la traza
-- de quién/ cuándo/ por qué, y el flujo de aprobación por umbral.
--
-- Convención: idempotente (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE). Con ROLLBACK.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Columnas de clasificación + traza de aprobación
-- -----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS direct_execution_category text,
  ADD COLUMN IF NOT EXISTS skip_design_status        text,
  ADD COLUMN IF NOT EXISTS skip_design_requested_by  uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS skip_design_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS skip_design_approved_by   uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS skip_design_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS skip_design_justification text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_direct_execution_category_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_direct_execution_category_check
      CHECK (direct_execution_category IS NULL OR direct_execution_category IN
        ('reparaciones','reposiciones','acabados','puertas','catalogo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='projects_skip_design_status_check') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_skip_design_status_check
      CHECK (skip_design_status IS NULL OR skip_design_status IN ('pending','approved','rejected'));
  END IF;
END $$;

COMMENT ON COLUMN public.projects.direct_execution_category IS
  'Categoría de ejecución directa (sin diseño): reparaciones|reposiciones|acabados|puertas|catalogo.';
COMMENT ON COLUMN public.projects.skip_design_status IS
  'Estado de la solicitud de omisión de diseño: NULL=no aplica, pending=espera admin, approved, rejected.';

-- -----------------------------------------------------------------------------
-- 2) RPC request_skip_design — el comercial/admin marca un proyecto "sin diseño"
--    Bajo umbral o si lo pide admin/super_admin → se aplica de inmediato.
--    Sobre umbral y lo pide comercial → queda 'pending' + tarea y aviso a admin.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_skip_design(
  p_project_id   uuid,
  p_category     text,
  p_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role       user_role := public.get_my_role();
  v_proj       RECORD;
  v_threshold  numeric;
  v_auto       boolean;
BEGIN
  IF v_role IS NULL OR v_role <> ALL (ARRAY['comercial','admin','super_admin','gerente','administradora']::user_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_category IS NULL OR p_category <> ALL (ARRAY['reparaciones','reposiciones','acabados','puertas','catalogo']) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_category');
  END IF;

  SELECT id, client_id, name, status, total_amount, skip_design_process, skip_design_status
    INTO v_proj
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL AND is_archived = false;

  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  IF v_proj.skip_design_process = true THEN
    RETURN jsonb_build_object('ok', true, 'mode', 'already_skipped');
  END IF;

  -- Demasiado tarde: ya está en producción o más allá.
  IF v_proj.status = ANY (ARRAY['en_produccion','listo_instalacion','entregado','completado']::project_status[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_late');
  END IF;

  SELECT (value #>> '{}')::numeric INTO v_threshold
    FROM public.system_settings WHERE key = 'skip_design_admin_threshold';
  v_threshold := COALESCE(v_threshold, 500000);

  -- Auto-aplica si lo pide un admin, o si el valor está bajo el umbral.
  v_auto := (v_role IN ('admin','super_admin'))
            OR (COALESCE(v_proj.total_amount, 0) <= v_threshold);

  UPDATE public.projects
     SET direct_execution_category = p_category,
         skip_design_requested_by  = auth.uid(),
         skip_design_requested_at   = now(),
         skip_design_justification  = NULLIF(btrim(COALESCE(p_justification,'')),'')
   WHERE id = p_project_id;

  IF v_auto THEN
    UPDATE public.projects
       SET skip_design_process   = true,
           skip_design_status    = 'approved',
           skip_design_approved_by = auth.uid(),
           skip_design_approved_at = now()
     WHERE id = p_project_id;

    -- Cancela la tarea de diseño automática si ya existía (proyecto marcado tarde).
    UPDATE public.tasks
       SET status = 'cancelado', updated_at = now()
     WHERE project_id = p_project_id
       AND task_category = 'diseno'
       AND status = 'pendiente'
       AND 'auto' = ANY(tags);

    RETURN jsonb_build_object('ok', true, 'mode', 'approved', 'category', p_category);
  END IF;

  -- Sobre umbral pedido por comercial → requiere aprobación de admin.
  UPDATE public.projects SET skip_design_status = 'pending' WHERE id = p_project_id;

  INSERT INTO public.tasks (
    project_id, client_id, title, description, status, priority, due_date,
    created_by, task_category, tags
  ) VALUES (
    p_project_id, v_proj.client_id,
    'Aprobar omisión de diseño — ' || COALESCE(v_proj.name, 'proyecto'),
    'El comercial solicitó marcar este proyecto como "sin diseño" (categoría: ' || p_category
      || '). Valor sobre el umbral: requiere tu aprobación. Motivo: '
      || COALESCE(NULLIF(btrim(COALESCE(p_justification,'')),''), 'sin detalle') || '.',
    'pendiente', 1, (current_date + 1),
    auth.uid(), 'administrativa', ARRAY['auto','aprobacion_omision_diseno']
  );

  INSERT INTO public.notifications (
    user_id, title, body, related_table, related_id,
    notification_type, priority, action_url
  )
  SELECT pr.id,
         'Omisión de diseño por aprobar',
         'El comercial pidió omitir el diseño de ' || COALESCE(v_proj.name,'un proyecto')
           || ' (categoría ' || p_category || '). Revisá y aprobá o rechazá.',
         'projects', p_project_id,
         'skip_design_approval_requested', 1,
         '/projects/' || p_project_id
    FROM public.profiles pr
   WHERE pr.is_active = true
     AND pr.role = ANY (ARRAY['admin','super_admin']::user_role[]);

  RETURN jsonb_build_object('ok', true, 'mode', 'pending', 'category', p_category);
END;
$$;

REVOKE ALL ON FUNCTION public.request_skip_design(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_skip_design(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) RPC resolve_skip_design — el admin aprueba o rechaza la omisión pendiente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_skip_design(
  p_project_id uuid,
  p_approve    boolean,
  p_reason     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role user_role := public.get_my_role();
  v_proj RECORD;
BEGIN
  IF v_role IS NULL OR v_role <> ALL (ARRAY['admin','super_admin']::user_role[]) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT id, name, skip_design_status, skip_design_requested_by, skip_design_justification
    INTO v_proj
    FROM public.projects
   WHERE id = p_project_id AND deleted_at IS NULL;

  IF v_proj.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  IF v_proj.skip_design_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  IF p_approve THEN
    UPDATE public.projects
       SET skip_design_process    = true,
           skip_design_status     = 'approved',
           skip_design_approved_by = auth.uid(),
           skip_design_approved_at = now()
     WHERE id = p_project_id;

    UPDATE public.tasks
       SET status = 'cancelado', updated_at = now()
     WHERE project_id = p_project_id
       AND task_category = 'diseno'
       AND status = 'pendiente'
       AND 'auto' = ANY(tags);
  ELSE
    UPDATE public.projects
       SET skip_design_process     = false,
           skip_design_status      = 'rejected',
           skip_design_approved_by  = auth.uid(),
           skip_design_approved_at  = now(),
           skip_design_justification = COALESCE(v_proj.skip_design_justification,'')
             || CASE WHEN NULLIF(btrim(COALESCE(p_reason,'')),'') IS NOT NULL
                     THEN ' [Rechazado: ' || btrim(p_reason) || ']' ELSE ' [Rechazado]' END
     WHERE id = p_project_id;
  END IF;

  -- Cierra la tarea de aprobación.
  UPDATE public.tasks
     SET status = 'completado', completed_at = now(), updated_at = now()
   WHERE project_id = p_project_id
     AND task_category = 'administrativa'
     AND 'aprobacion_omision_diseno' = ANY(tags)
     AND status = 'pendiente';

  -- Avisa al comercial que solicitó.
  IF v_proj.skip_design_requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, title, body, related_table, related_id,
      notification_type, priority, action_url
    ) VALUES (
      v_proj.skip_design_requested_by,
      CASE WHEN p_approve THEN '✅ Omisión de diseño aprobada' ELSE '❌ Omisión de diseño rechazada' END,
      'Tu solicitud para ' || COALESCE(v_proj.name,'el proyecto')
        || CASE WHEN p_approve THEN ' fue aprobada: pasa a ejecución directa.'
                ELSE ' fue rechazada' || COALESCE(': ' || NULLIF(btrim(COALESCE(p_reason,'')),''), '') || '.' END,
      'projects', p_project_id,
      'skip_design_resolved', 1,
      '/projects/' || p_project_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'approved', p_approve);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_skip_design(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_skip_design(uuid, boolean, text) TO authenticated;

COMMIT;

-- =============================================================================
-- Verificación (impersonando rol vía request.jwt.claims en un DO block):
--   · comercial + total_amount <= umbral → skip_design_process=true, status=approved.
--   · comercial + total_amount  > umbral → status=pending + tarea administrativa + aviso admin.
--   · admin resolve_skip_design(true)    → approved + tarea diseño cancelada.
--   · admin resolve_skip_design(false)   → rejected + justificación anotada.
-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.resolve_skip_design(uuid, boolean, text);
-- DROP FUNCTION IF EXISTS public.request_skip_design(uuid, text, text);
-- ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_skip_design_status_check;
-- ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_direct_execution_category_check;
-- ALTER TABLE public.projects
--   DROP COLUMN IF EXISTS direct_execution_category,
--   DROP COLUMN IF EXISTS skip_design_status,
--   DROP COLUMN IF EXISTS skip_design_requested_by,
--   DROP COLUMN IF EXISTS skip_design_requested_at,
--   DROP COLUMN IF EXISTS skip_design_approved_by,
--   DROP COLUMN IF EXISTS skip_design_approved_at,
--   DROP COLUMN IF EXISTS skip_design_justification;
-- COMMIT;
-- =============================================================================
