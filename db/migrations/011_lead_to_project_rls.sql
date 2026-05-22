-- =====================================================
-- 011 — Lead → Project Flow · Row Level Security
-- =====================================================
-- Requiere: 008 + 009 + 010 aplicados
-- Siguiente: 012_lead_to_project_seed.sql
--
-- Política general:
--  · `admin` y `super_admin` ven y editan todo.
--  · `comercial` ve y edita solo sus oportunidades / visitas asignadas.
--  · Rutas públicas (tokens) usan funciones SECURITY DEFINER (no RLS bypass directo).
--  · `service_role` bypassa RLS (para Edge Functions / cron jobs).
-- =====================================================

BEGIN;

-- =====================================================
-- Helper: get_my_role() ya existe en supabase_schema.sql
-- =====================================================

-- =====================================================
-- opportunities
-- =====================================================
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunities_select_own_or_admin ON public.opportunities;
CREATE POLICY opportunities_select_own_or_admin
  ON public.opportunities
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
      OR public.get_my_role() IN ('admin','super_admin')
    )
  );

DROP POLICY IF EXISTS opportunities_insert_authenticated ON public.opportunities;
CREATE POLICY opportunities_insert_authenticated
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR public.get_my_role() IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS opportunities_update_assigned_or_admin ON public.opportunities;
CREATE POLICY opportunities_update_assigned_or_admin
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.get_my_role() IN ('admin','super_admin')
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR public.get_my_role() IN ('admin','super_admin')
  );

DROP POLICY IF EXISTS opportunities_delete_admin ON public.opportunities;
CREATE POLICY opportunities_delete_admin
  ON public.opportunities
  FOR DELETE
  TO authenticated
  USING (public.get_my_role() IN ('admin','super_admin'));

-- =====================================================
-- opportunity_assignment_history (solo lectura para comerciales propios)
-- =====================================================
ALTER TABLE public.opportunity_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opp_assign_history_select ON public.opportunity_assignment_history;
CREATE POLICY opp_assign_history_select
  ON public.opportunity_assignment_history
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('admin','super_admin')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
       WHERE o.id = opportunity_id
         AND (o.assigned_to = auth.uid() OR o.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS opp_assign_history_insert_admin ON public.opportunity_assignment_history;
CREATE POLICY opp_assign_history_insert_admin
  ON public.opportunity_assignment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('admin','super_admin'));

-- =====================================================
-- visits
-- =====================================================
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visits_select ON public.visits;
CREATE POLICY visits_select
  ON public.visits
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      visited_by = auth.uid()
      OR created_by = auth.uid()
      OR public.get_my_role() IN ('admin','super_admin')
      OR EXISTS (
        SELECT 1 FROM public.opportunities o
         WHERE o.id = opportunity_id
           AND o.assigned_to = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS visits_insert ON public.visits;
CREATE POLICY visits_insert
  ON public.visits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('admin','super_admin')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
       WHERE o.id = opportunity_id
         AND o.assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS visits_update ON public.visits;
CREATE POLICY visits_update
  ON public.visits
  FOR UPDATE
  TO authenticated
  USING (
    visited_by = auth.uid()
    OR public.get_my_role() IN ('admin','super_admin')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
       WHERE o.id = opportunity_id
         AND o.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    visited_by = auth.uid()
    OR public.get_my_role() IN ('admin','super_admin')
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
       WHERE o.id = opportunity_id
         AND o.assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS visits_delete_admin ON public.visits;
CREATE POLICY visits_delete_admin
  ON public.visits
  FOR DELETE
  TO authenticated
  USING (public.get_my_role() IN ('admin','super_admin'));

-- =====================================================
-- system_settings (lectura todos, edición solo admin)
-- =====================================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_settings_select ON public.system_settings;
CREATE POLICY system_settings_select
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS system_settings_modify_admin ON public.system_settings;
CREATE POLICY system_settings_modify_admin
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('admin','super_admin'))
  WITH CHECK (public.get_my_role() IN ('admin','super_admin'));

-- =====================================================
-- agent_actions_log (solo admin lee, agente con service_role inserta)
-- =====================================================
ALTER TABLE public.agent_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_actions_select_admin_or_own ON public.agent_actions_log;
CREATE POLICY agent_actions_select_admin_or_own
  ON public.agent_actions_log
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.get_my_role() IN ('admin','super_admin')
  );

-- Inserts vienen de service_role (edge function n8n callback) — no
-- requieren policy explícita porque service_role bypassa RLS.

-- =====================================================
-- payments — endurecer policy existente
-- =====================================================
-- Reemplaza la policy permisiva `payments_all`.
DROP POLICY IF EXISTS "payments_all" ON public.payments;

DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() IN ('admin','super_admin')
    OR registered_by = auth.uid()
    OR verified_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.opportunities o
       JOIN public.quotations q ON q.opportunity_id = o.id
       WHERE q.id = quotation_id
         AND o.assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('admin','super_admin','comercial')
  );

-- Update permitido a admin para verificar; comercial puede actualizar
-- solo si verification_status sigue siendo 'pending' (corrección de errores).
DROP POLICY IF EXISTS payments_update_admin ON public.payments;
CREATE POLICY payments_update_admin
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('admin','super_admin'))
  WITH CHECK (public.get_my_role() IN ('admin','super_admin'));

DROP POLICY IF EXISTS payments_update_pending_by_owner ON public.payments;
CREATE POLICY payments_update_pending_by_owner
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (
    verification_status = 'pending'
    AND registered_by = auth.uid()
  )
  WITH CHECK (
    verification_status = 'pending'
    AND registered_by = auth.uid()
  );

DROP POLICY IF EXISTS payments_delete_admin ON public.payments;
CREATE POLICY payments_delete_admin
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (public.get_my_role() IN ('admin','super_admin'));

-- =====================================================
-- Grants para validate_public_token (anon puede llamarla vía RPC)
-- =====================================================
GRANT EXECUTE ON FUNCTION public.validate_public_token(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_slots(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_refund_percentage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_suggested_advance_pct() TO authenticated, anon;

COMMIT;

-- =====================================================
-- FIN 011 · RLS aplicada
-- Siguiente: 012_lead_to_project_seed.sql
-- =====================================================
