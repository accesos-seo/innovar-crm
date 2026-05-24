-- =====================================================
-- 040 — Fix RLS: opportunities UPDATE permite rol comercial
-- =====================================================
-- Bug: la policy opportunities_update_assigned_or_admin no incluía
-- el rol 'comercial', bloqueando con 403 el intento de archivar
-- oportunidades asignadas a otros usuarios. En 'clients' el rol
-- comercial tiene ALL sin restricción de ownership; esta migración
-- hace lo mismo para opportunities.
-- Aplicada en prod 2026-05-24 via Management API.
-- =====================================================

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

-- =====================================================
-- FIN 040 · opportunities UPDATE policy + comercial
-- =====================================================
