-- =====================================================
-- ROLLBACK · Lead → Project Flow (008–012)
-- =====================================================
-- ⚠️ ATENCIÓN: este script revierte las migraciones 008–012.
-- ⚠️ NO restaura datos. Si hay opportunities/visits creadas,
-- ⚠️ se PIERDEN. Hacer dump antes de ejecutar:
--    pg_dump --table=public.opportunities ... > backup.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Quitar triggers
-- =====================================================
DROP TRIGGER IF EXISTS trg_opp_round_robin            ON public.opportunities;
DROP TRIGGER IF EXISTS trg_opp_validate_transition    ON public.opportunities;
DROP TRIGGER IF EXISTS trg_opp_log_assignment         ON public.opportunities;
DROP TRIGGER IF EXISTS update_opportunities_updated_at ON public.opportunities;

DROP TRIGGER IF EXISTS trg_visit_validate_completion  ON public.visits;
DROP TRIGGER IF EXISTS trg_visit_to_task_mirror       ON public.visits;
DROP TRIGGER IF EXISTS trg_visit_auto_quotation       ON public.visits;
DROP TRIGGER IF EXISTS update_visits_updated_at       ON public.visits;

DROP TRIGGER IF EXISTS trg_quot_mark_historical       ON public.quotations;

DROP TRIGGER IF EXISTS trg_payment_convert_to_project ON public.payments;

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;

-- =====================================================
-- 2. Quitar policies nuevas y restaurar policy permisiva en payments
-- =====================================================
DROP POLICY IF EXISTS opportunities_select_own_or_admin   ON public.opportunities;
DROP POLICY IF EXISTS opportunities_insert_authenticated  ON public.opportunities;
DROP POLICY IF EXISTS opportunities_update_assigned_or_admin ON public.opportunities;
DROP POLICY IF EXISTS opportunities_delete_admin          ON public.opportunities;

DROP POLICY IF EXISTS opp_assign_history_select           ON public.opportunity_assignment_history;
DROP POLICY IF EXISTS opp_assign_history_insert_admin     ON public.opportunity_assignment_history;

DROP POLICY IF EXISTS visits_select                       ON public.visits;
DROP POLICY IF EXISTS visits_insert                       ON public.visits;
DROP POLICY IF EXISTS visits_update                       ON public.visits;
DROP POLICY IF EXISTS visits_delete_admin                 ON public.visits;

DROP POLICY IF EXISTS system_settings_select              ON public.system_settings;
DROP POLICY IF EXISTS system_settings_modify_admin        ON public.system_settings;

DROP POLICY IF EXISTS agent_actions_select_admin_or_own   ON public.agent_actions_log;

DROP POLICY IF EXISTS payments_select                     ON public.payments;
DROP POLICY IF EXISTS payments_insert                     ON public.payments;
DROP POLICY IF EXISTS payments_update_admin               ON public.payments;
DROP POLICY IF EXISTS payments_update_pending_by_owner    ON public.payments;
DROP POLICY IF EXISTS payments_delete_admin               ON public.payments;

-- Restaurar la policy permisiva original.
CREATE POLICY "payments_all"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- =====================================================
-- 3. Quitar funciones nuevas
-- =====================================================
DROP FUNCTION IF EXISTS public.validate_public_token(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_suggested_advance_pct();
DROP FUNCTION IF EXISTS public.calculate_refund_percentage(UUID);
DROP FUNCTION IF EXISTS public.get_visit_slots(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.assign_commercial_round_robin();
DROP FUNCTION IF EXISTS public.validate_opportunity_transition();
DROP FUNCTION IF EXISTS public.visit_to_task_mirror();
DROP FUNCTION IF EXISTS public.auto_generate_quotation();
DROP FUNCTION IF EXISTS public.validate_visit_completion();
DROP FUNCTION IF EXISTS public.convert_quotation_to_project();
DROP FUNCTION IF EXISTS public.convert_quotation_to_project_on_insert();
DROP FUNCTION IF EXISTS public.mark_quotation_historical_on_new_version();
DROP FUNCTION IF EXISTS public.log_opportunity_assignment_change();
DROP FUNCTION IF EXISTS public.normalize_phone(TEXT);

-- =====================================================
-- 4. Quitar columnas agregadas a tablas existentes
-- =====================================================
ALTER TABLE public.projects
  DROP COLUMN IF EXISTS materials_purchased_at,
  DROP COLUMN IF EXISTS fabrication_started_at,
  DROP COLUMN IF EXISTS opportunity_id;
DROP INDEX IF EXISTS public.projects_opportunity_idx;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS quotation_id,
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS verified_by,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS proof_url,
  DROP COLUMN IF EXISTS below_suggested;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
DROP INDEX IF EXISTS public.payments_quotation_verif_idx;
DROP INDEX IF EXISTS public.payments_project_verif_idx;

ALTER TABLE public.quotations
  DROP COLUMN IF EXISTS change_reason,
  DROP COLUMN IF EXISTS bypassed_visit,
  DROP COLUMN IF EXISTS bypass_reason,
  DROP COLUMN IF EXISTS opportunity_id,
  DROP COLUMN IF EXISTS quotation_type,
  DROP COLUMN IF EXISTS public_token;
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
DROP INDEX IF EXISTS public.quotations_opportunity_idx;
DROP INDEX IF EXISTS public.quotations_public_token_idx;
DROP INDEX IF EXISTS public.quotations_parent_version_idx;

-- =====================================================
-- 5. Quitar UNIQUE constraint clients.whatsapp_phone
-- =====================================================
DROP INDEX IF EXISTS public.clients_whatsapp_phone_unique_idx;
-- NOTA: el backfill de normalización NO se revierte. Los teléfonos quedan normalizados.

-- =====================================================
-- 6. Drop tablas nuevas (orden inverso de dependencias)
-- =====================================================
DROP TABLE IF EXISTS public.agent_actions_log;
DROP TABLE IF EXISTS public.system_settings;
DROP TABLE IF EXISTS public.opportunity_assignment_history;
DROP TABLE IF EXISTS public.visits;
DROP TABLE IF EXISTS public.opportunities;

COMMIT;

-- =====================================================
-- FIN ROLLBACK
-- Schema restaurado al estado pre-008.
-- =====================================================
