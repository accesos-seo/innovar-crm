-- Migración 027 — Storage bucket `visit_photos` + RLS policies (Fase 3 · Slice 4)
--
-- Fundamento (D7/D8 del plan Fase 3):
--   El form de cierre de visita exige ≥ 3 fotos (regla del trigger
--   validate_visit_completion existente). Necesitamos un bucket dedicado donde
--   Alvaro sube las fotos desde `/agenda/hoy`.
--
-- Convención de path:  visit_photos/<visit_id>/<filename>
--   El primer folder = visit_id. Las policies leen `storage.foldername(name)[1]`
--   para validar pertenencia.
--
-- Permisos:
--   - INSERT (upload): admin/super_admin, o el `visited_by` del visit.
--   - SELECT (read):  admin/super_admin, o el `visited_by` del visit, o el comercial
--     dueño de la opportunity. (Cliente no — para él, en Fase 4 se generarán signed URLs.)
--   - UPDATE/DELETE: solo admin/super_admin (corrección de fotos accidentales).

BEGIN;

-- =============================================================================
-- 1) Bucket
-- =============================================================================

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
) VALUES (
  'visit_photos',
  'visit_photos',
  false,                                                              -- privado: acceso vía RLS / signed URL
  10485760,                                                           -- 10 MB por archivo
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif'],
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 2) Helper inline: ¿el usuario puede tocar esta foto?
--    Cruza el folder=visit_id con visits para validar pertenencia.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_can_access_visit_photo(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
  WITH parts AS (
    SELECT (storage.foldername(p_object_name))[1] AS visit_uuid
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.visits v
    JOIN public.opportunities o ON o.id = v.opportunity_id
    WHERE v.id = (SELECT visit_uuid FROM parts)::uuid
      AND v.deleted_at IS NULL
      AND (
        v.visited_by   = auth.uid()
        OR v.created_by = auth.uid()
        OR o.assigned_to = auth.uid()
        OR public.get_my_role() IN ('admin','super_admin')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_can_access_visit_photo(text) TO authenticated;


-- =============================================================================
-- 3) Policies sobre storage.objects (idempotentes — DROP IF EXISTS)
-- =============================================================================

DROP POLICY IF EXISTS "visit_photos_insert" ON storage.objects;
CREATE POLICY "visit_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'visit_photos'
    AND public.fn_can_access_visit_photo(name)
  );

DROP POLICY IF EXISTS "visit_photos_select" ON storage.objects;
CREATE POLICY "visit_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visit_photos'
    AND public.fn_can_access_visit_photo(name)
  );

DROP POLICY IF EXISTS "visit_photos_update_admin" ON storage.objects;
CREATE POLICY "visit_photos_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'visit_photos'
    AND public.get_my_role() IN ('admin','super_admin')
  )
  WITH CHECK (
    bucket_id = 'visit_photos'
    AND public.get_my_role() IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS "visit_photos_delete_admin" ON storage.objects;
CREATE POLICY "visit_photos_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'visit_photos'
    AND public.get_my_role() IN ('admin','super_admin')
  );

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
--
-- SELECT id, name, public FROM storage.buckets WHERE id = 'visit_photos';
-- -- Debe existir, public=false.
--
-- SELECT polname, polcmd FROM pg_policy
--  WHERE polrelid='storage.objects'::regclass AND polname LIKE 'visit_photos_%';
-- -- Debe haber 4 policies (insert, select, update_admin, delete_admin).
--
-- Test funcional desde frontend (logueado como Alvaro):
--   const path = `${visit.id}/foto1.jpg`;
--   await supabase.storage.from('visit_photos').upload(path, file);
--   -- Debe pasar.
--
-- Test denegación (logueado como comercial NO asignado):
--   -- Mismo upload debe fallar con 403 (RLS violation).

-- =============================================================================
-- Rollback
-- =============================================================================
-- DROP POLICY IF EXISTS "visit_photos_delete_admin" ON storage.objects;
-- DROP POLICY IF EXISTS "visit_photos_update_admin" ON storage.objects;
-- DROP POLICY IF EXISTS "visit_photos_select" ON storage.objects;
-- DROP POLICY IF EXISTS "visit_photos_insert" ON storage.objects;
-- DROP FUNCTION IF EXISTS public.fn_can_access_visit_photo(text);
-- DELETE FROM storage.buckets WHERE id = 'visit_photos';
-- -- ⚠️ Borrar el bucket también borra todos los objects dentro.
