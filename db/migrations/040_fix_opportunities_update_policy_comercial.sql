-- =====================================================
-- 040 — Fix RLS: opportunities ALL policies para admin y comercial
-- =====================================================
-- Bug: archivar oportunidades fallaba con HTTP 403 para todos los
-- usuarios (admin, comercial), incluso con la policy UPDATE correcta.
-- Causa raíz: policies específicas por cmd (INSERT/SELECT/UPDATE/DELETE)
-- con TO authenticated producen comportamiento diferente al patrón ALL
-- de 'clients' que usa TO PUBLIC y un USING simple por rol.
-- Fix: agregar dos policies ALL (cmd=ALL, roles=public) que espejean
-- exactamente lo que tiene 'clients': admin_all y comercial_all.
-- Con policies PERMISSIVE, PG usa OR — si cualquiera pasa, se permite.
-- Aplicada en prod 2026-05-24 via Management API.
-- =====================================================

-- Step 1: Update the UPDATE policy to include comercial (belt + suspenders)
DROP POLICY IF EXISTS opportunities_update_assigned_or_admin ON public.opportunities;

CREATE POLICY opportunities_update_assigned_or_admin
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (
    (assigned_to = auth.uid())
    OR (created_by = auth.uid())
    OR (get_my_role() = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'comercial'::user_role]))
  )
  WITH CHECK (
    (assigned_to = auth.uid())
    OR (created_by = auth.uid())
    OR (get_my_role() = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'comercial'::user_role]))
  );

-- Step 2: Add ALL policies per role mirroring clients pattern
DROP POLICY IF EXISTS opportunities_admin_all ON public.opportunities;
DROP POLICY IF EXISTS opportunities_comercial_all ON public.opportunities;

CREATE POLICY opportunities_admin_all
  ON public.opportunities
  FOR ALL
  TO PUBLIC
  USING (get_my_role() = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role]))
  WITH CHECK (get_my_role() = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role]));

CREATE POLICY opportunities_comercial_all
  ON public.opportunities
  FOR ALL
  TO PUBLIC
  USING (get_my_role() = 'comercial'::user_role)
  WITH CHECK (get_my_role() = 'comercial'::user_role);

-- =====================================================
-- FIN 040 · opportunities: ALL policies admin + comercial
-- =====================================================
