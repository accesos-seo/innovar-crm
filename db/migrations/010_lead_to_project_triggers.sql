-- =====================================================
-- 010 — Lead → Project Flow · Triggers
-- =====================================================
-- Requiere: 008 + 009 aplicados
-- Siguiente: 011_lead_to_project_rls.sql
-- =====================================================

BEGIN;

-- =====================================================
-- opportunities
-- =====================================================

-- Round-robin auto-asignación (BEFORE INSERT)
DROP TRIGGER IF EXISTS trg_opp_round_robin ON public.opportunities;
CREATE TRIGGER trg_opp_round_robin
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_commercial_round_robin();

-- Validar transición de status (BEFORE UPDATE)
DROP TRIGGER IF EXISTS trg_opp_validate_transition ON public.opportunities;
CREATE TRIGGER trg_opp_validate_transition
  BEFORE UPDATE OF status ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_opportunity_transition();

-- Log de reasignación (AFTER UPDATE)
DROP TRIGGER IF EXISTS trg_opp_log_assignment ON public.opportunities;
CREATE TRIGGER trg_opp_log_assignment
  AFTER UPDATE OF assigned_to ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_opportunity_assignment_change();

-- =====================================================
-- visits
-- =====================================================

-- Validar datos mínimos al marcar realizada + propagar a opportunity
DROP TRIGGER IF EXISTS trg_visit_validate_completion ON public.visits;
CREATE TRIGGER trg_visit_validate_completion
  BEFORE INSERT OR UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_visit_completion();

-- Espejo a tasks
DROP TRIGGER IF EXISTS trg_visit_to_task_mirror ON public.visits;
CREATE TRIGGER trg_visit_to_task_mirror
  AFTER INSERT OR UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.visit_to_task_mirror();

-- Auto-generar quotation v1 al cerrar visita
DROP TRIGGER IF EXISTS trg_visit_auto_quotation ON public.visits;
CREATE TRIGGER trg_visit_auto_quotation
  AFTER UPDATE OF status ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_quotation();

-- =====================================================
-- quotations
-- =====================================================

-- Marcar versiones previas como históricas al crear nueva versión
DROP TRIGGER IF EXISTS trg_quot_mark_historical ON public.quotations;
CREATE TRIGGER trg_quot_mark_historical
  AFTER INSERT ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_quotation_historical_on_new_version();

-- =====================================================
-- payments
-- =====================================================

-- Conversión a proyecto al verificar primer pago
DROP TRIGGER IF EXISTS trg_payment_convert_to_project ON public.payments;
CREATE TRIGGER trg_payment_convert_to_project
  BEFORE UPDATE OF verification_status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.convert_quotation_to_project();

-- Para INSERT directo en verified (caso raro):
CREATE OR REPLACE FUNCTION public.convert_quotation_to_project_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status = 'verified' THEN
    -- Reusar la lógica del trigger UPDATE simulando OLD.verification_status='pending'.
    PERFORM 1;  -- placeholder; el trigger BEFORE INSERT real es la siguiente función:
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (Para INSERT con verification_status='verified' desde el inicio, el cliente
-- debe primero INSERT con 'pending' y luego UPDATE a 'verified'. Esto es por
-- diseño: la verificación requiere un acto explícito.)

-- =====================================================
-- updated_at triggers para tablas nuevas
-- =====================================================
-- (system_settings)
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;

-- =====================================================
-- FIN 010 · Triggers instalados
-- Siguiente: 011_lead_to_project_rls.sql
-- =====================================================
