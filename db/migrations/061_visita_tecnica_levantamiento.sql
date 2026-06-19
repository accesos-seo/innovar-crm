-- Migración 061 — Visita Técnica: Levantamiento en la ficha del proyecto + aviso al equipo
--
-- Origen: PRD `docs/prd/PRD-decisiones-visita-tecnica.md` (Cuestionario 2, Pregunta 10).
-- Cierra las brechas Q10c (sección "Levantamiento técnico" en la ficha) y
-- Q10d (notificación "Enviar al equipo") de la matriz de brechas.
--
-- Verificado contra producción el 19/06/2026 (Supabase Innovar, Management API):
--   - La captura ya existe (medidas en `visits.measurements`, fotos en bucket
--     `visit_photos`, notas en `visits.notes`).
--   - Pero el resultado NO llega al diseñador: la policy `visits_select` NO cubre
--     el rol `diseno` (solo visited_by / created_by / comercial asignado / admin),
--     y `fn_can_access_visit_photo` tampoco. → El diseñador no puede leer la visita
--     ni firmar las fotos. Por eso el surfacing se hace vía RPC SECURITY DEFINER +
--     un broadening quirúrgico de SOLO la policy de lectura del bucket.
--   - Al finalizar la visita solo se notifica al CLIENTE
--     (`notify_visit_summary_client`); no hay aviso al equipo.
--
-- Sin decisiones del dueño pendientes (el plano PDF / Q10b queda fuera de alcance,
-- es additivo y depende de la respuesta del dueño).
--
-- Convención: CREATE OR REPLACE + snapshot versionado; idempotente; con ROLLBACK.

BEGIN;

-- =============================================================================
-- 1) RPC `get_project_levantamiento` — surface del levantamiento al equipo
--    SECURITY DEFINER: el diseñador (rol `diseno`) NO pasa `visits_select`, así
--    que la lectura de medidas/notas se hace acá saltando la RLS de `visits`.
--    Resuelve la visita `realizada` más reciente vía projects → opportunity_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_project_levantamiento(p_project_id uuid)
RETURNS TABLE (
  visit_id        uuid,
  measurements    jsonb,
  photos          jsonb,
  notes           text,
  address         text,
  realized_at     timestamptz,
  visited_by      uuid,
  visited_by_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    v.id,
    v.measurements,
    v.photos,
    v.notes,
    v.address,
    v.realized_at,
    v.visited_by,
    p.full_name
  FROM public.projects pr
  JOIN public.visits v        ON v.opportunity_id = pr.opportunity_id
  LEFT JOIN public.profiles p ON p.id = v.visited_by
  WHERE pr.id = p_project_id
    AND v.status = 'realizada'
    AND v.deleted_at IS NULL
    AND public.get_my_role() IS NOT NULL   -- solo equipo interno autenticado
  ORDER BY v.realized_at DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_levantamiento(uuid) TO authenticated;


-- =============================================================================
-- 2) Broadening de SOLO la policy de lectura del bucket `visit_photos`
--    Mantiene intacta la regla original (admin/super_admin/visited_by/created_by/
--    comercial asignado vía fn_can_access_visit_photo) y AGREGA los roles internos
--    que consultan el levantamiento (diseño, comercial, gerencia, producción) para
--    que puedan firmar las fotos. INSERT/UPDATE/DELETE quedan SIN cambios.
-- =============================================================================

DROP POLICY IF EXISTS "visit_photos_select" ON storage.objects;
CREATE POLICY "visit_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visit_photos'
    AND (
      public.fn_can_access_visit_photo(name)
      OR public.get_my_role() = ANY (
        ARRAY['diseno','comercial','gerente','administradora','produccion']::user_role[]
      )
    )
  );


-- =============================================================================
-- 3) Trigger "Enviar al equipo" — aviso in-app al finalizar la visita
--    Espeja `notify_visit_summary_client` (mismo guard de transición a 'realizada'
--    y misma resolución de cliente vía opportunities→clients), pero en vez de
--    WhatsApp al cliente hace un fan-out IN-APP al equipo interno.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_notify_visit_team_on_realized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client    RECORD;
  v_services  text;
  v_addr      text;
  v_title     text;
  v_body      text;
BEGIN
  -- Solo al transicionar a 'realizada' (igual que el resumen al cliente).
  IF NEW.status <> 'realizada' OR OLD.status = 'realizada' THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.name, c.address,
         array_to_string(o.services, ', ') AS services
    INTO v_client
    FROM public.opportunities o
    JOIN public.clients c ON c.id = o.client_id
   WHERE o.id = NEW.opportunity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_services := NULLIF(btrim(COALESCE(v_client.services, '')), '');
  v_addr := COALESCE(
    NULLIF(btrim(COALESCE(NEW.address, '')), ''),
    NULLIF(btrim(COALESCE(v_client.address, '')), ''),
    'dirección por confirmar'
  );
  v_title := '📐 Nuevo levantamiento listo';
  v_body  := 'Levantamiento de ' || COALESCE(v_client.name, 'cliente')
             || COALESCE(' (' || v_services || ')', '')
             || ' — ' || v_addr
             || '. Medidas y fotos quedan en la ficha del proyecto.';

  -- Fan-out in-app a los roles internos que actúan sobre un nuevo levantamiento.
  -- No se auto-notifica al técnico que cerró la visita (NEW.visited_by).
  INSERT INTO public.notifications (
    user_id, title, body, related_table, related_id,
    notification_type, priority, action_url
  )
  SELECT
    pr.id,
    v_title,
    v_body,
    'visits',
    NEW.id,
    'visit_levantamiento_ready',
    1,
    '/agenda/hoy?visit_id=' || NEW.id
  FROM public.profiles pr
  WHERE pr.is_active = true
    AND pr.role = ANY (
      ARRAY['admin','super_admin','comercial','diseno','gerente','administradora']::user_role[]
    )
    AND pr.id <> COALESCE(NEW.visited_by, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_visit_team_on_realized ON public.visits;
CREATE TRIGGER trg_notify_visit_team_on_realized
  AFTER UPDATE OF status ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_visit_team_on_realized();

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
--
-- 1) RPC existe y es SECURITY DEFINER:
--    SELECT proname, prosecdef FROM pg_proc WHERE proname='get_project_levantamiento';
--    -- prosecdef = true.
--
-- 2) Surface (con un proyecto que venga de una visita realizada):
--    SELECT * FROM public.get_project_levantamiento('<project_id>');
--    -- Debe devolver 1 fila con measurements/photos/notes.
--
-- 3) Policy de lectura ampliada:
--    SELECT polname FROM pg_policy WHERE polname='visit_photos_select';
--    -- Debe existir; el USING ahora incluye los roles internos.
--
-- 4) Aviso al equipo (forzar):
--    UPDATE public.visits SET status='realizada' WHERE id='<visit_id>';
--    -- Pre-condición: measurements no vacío + >=3 fotos (validate_visit_completion).
--    SELECT count(*) FROM public.notifications
--     WHERE related_id='<visit_id>' AND notification_type='visit_levantamiento_ready';
--    -- Debe haber 1 fila por cada miembro activo de los roles internos (excepto el técnico).
--
-- =============================================================================
-- Rollback
-- =============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_notify_visit_team_on_realized ON public.visits;
-- DROP FUNCTION IF EXISTS public.fn_notify_visit_team_on_realized();
-- DROP FUNCTION IF EXISTS public.get_project_levantamiento(uuid);
-- -- Restaurar la policy original (solo fn_can_access_visit_photo):
-- DROP POLICY IF EXISTS "visit_photos_select" ON storage.objects;
-- CREATE POLICY "visit_photos_select" ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'visit_photos' AND public.fn_can_access_visit_photo(name));
-- COMMIT;
