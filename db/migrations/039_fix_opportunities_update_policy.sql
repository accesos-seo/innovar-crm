-- =====================================================
-- 039 — Fix RLS: opportunities UPDATE permite created_by
-- =====================================================
-- Bug: la policy opportunities_update_assigned_or_admin solo incluía
-- assigned_to = auth.uid(), omitiendo created_by. Esto bloqueaba (403)
-- el archivo de leads propios que habían sido reasignados vía round-robin.
-- La policy SELECT ya incluía created_by; ahora la UPDATE queda simétrica.
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS opportunities_update_assigned_or_admin ON public.opportunities;

CREATE POLICY opportunities_update_assigned_or_admin
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.get_my_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.get_my_role() IN ('admin', 'super_admin')
  );

COMMIT;

-- =====================================================
-- FIN 039 · opportunities UPDATE policy corregida
-- =====================================================
