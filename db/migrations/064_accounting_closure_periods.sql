-- Migración 064 — Capa de CIERRE DE PERÍODO (Finanzas) + reversión auditada
--
-- Decisión del dueño (2026-06-19, Cuestionario 1 · Q1): "Sí, se confirma el cierre de período."
--
-- Construye una capa de cierre de PERÍODO por encima del cierre por proyecto existente
-- (accounting_closures, intacto), tal como la describió el cliente:
--   - consolida varios proyectos terminados + 100% pagados, con su comparativo, y
--   - resta los gastos de BODEGA acumulados desde el último período confirmado (regla de
--     corte Q3), para ver la utilidad NETA del negocio.
-- Incluye reversión auditada restringida al CEO (super_admin) con motivo (Q4) y la tabla
-- closure_audit_log que el cliente nombró.
--
-- Esquema verificado en prod (Management API, 2026-06-19): projects.total_amount (cotizado),
-- projects.balance_due (mantenido por trg_payment_recalc_balance), is_fully_paid; income por
-- proyecto = SUM(payments.amount); gasto por proyecto = SUM(expenses aprobados); get_my_role()
-- devuelve user_role; auth.uid() disponible. Roles: super_admin = CEO (no existe rol "CEO").
--
-- Idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE) y transaccional.

BEGIN;

-- =============================================================================
-- 1. TABLAS
-- =============================================================================

-- El cierre del período
CREATE TABLE IF NOT EXISTS public.accounting_closure_periods (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start           date,                         -- límite inferior exclusivo (último cierre); NULL = primer cierre
  period_end             date NOT NULL,                -- fecha de corte del período
  status                 text NOT NULL DEFAULT 'borrador'
                           CHECK (status IN ('borrador','confirmado','revertido')),
  created_by             uuid,
  confirmed_at           timestamptz,
  total_projects_profit  numeric NOT NULL DEFAULT 0,
  total_bodega_expenses  numeric NOT NULL DEFAULT 0,
  net_profit             numeric NOT NULL DEFAULT 0,
  notes                  text,
  reverted_at            timestamptz,
  reverted_by            uuid,
  reverted_reason        text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Snapshot por proyecto incluido (foto inmutable del comparativo)
CREATE TABLE IF NOT EXISTS public.accounting_closure_period_projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id         uuid NOT NULL REFERENCES public.accounting_closure_periods(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL,
  project_name      text NOT NULL,
  quoted_value      numeric NOT NULL DEFAULT 0,
  total_paid        numeric NOT NULL DEFAULT 0,
  balance_due       numeric NOT NULL DEFAULT 0,
  project_expenses  numeric NOT NULL DEFAULT 0,
  profit            numeric NOT NULL DEFAULT 0,
  margin_pct        numeric NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Snapshot de gastos de bodega del período
CREATE TABLE IF NOT EXISTS public.accounting_closure_period_expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     uuid NOT NULL REFERENCES public.accounting_closure_periods(id) ON DELETE CASCADE,
  expense_id    uuid,
  category      text NOT NULL,
  description   text,
  amount        numeric NOT NULL DEFAULT 0,
  expense_date  date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Bitácora de auditoría de cierres (la tabla que nombró el cliente: closureAuditLog)
CREATE TABLE IF NOT EXISTS public.closure_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       uuid REFERENCES public.accounting_closure_periods(id) ON DELETE SET NULL,
  action          text NOT NULL,                       -- 'created' | 'confirmed' | 'reverted'
  performed_by    uuid,
  performed_at    timestamptz NOT NULL DEFAULT now(),
  previous_status text,
  projects_count  integer,
  reason          text
);

CREATE INDEX IF NOT EXISTS idx_acp_status        ON public.accounting_closure_periods(status);
CREATE INDEX IF NOT EXISTS idx_acp_period_end    ON public.accounting_closure_periods(period_end);
CREATE INDEX IF NOT EXISTS idx_acpp_period       ON public.accounting_closure_period_projects(period_id);
CREATE INDEX IF NOT EXISTS idx_acpp_project      ON public.accounting_closure_period_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_acpe_period       ON public.accounting_closure_period_expenses(period_id);
CREATE INDEX IF NOT EXISTS idx_cal_period        ON public.closure_audit_log(period_id);

-- =============================================================================
-- 2. RLS — lectura para admin/super_admin/gerente; escritura solo vía RPC (SECURITY DEFINER)
-- =============================================================================

ALTER TABLE public.accounting_closure_periods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_closure_period_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_closure_period_expenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closure_audit_log                   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acp_select  ON public.accounting_closure_periods;
DROP POLICY IF EXISTS acpp_select ON public.accounting_closure_period_projects;
DROP POLICY IF EXISTS acpe_select ON public.accounting_closure_period_expenses;
DROP POLICY IF EXISTS cal_select  ON public.closure_audit_log;

CREATE POLICY acp_select ON public.accounting_closure_periods
  FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin','super_admin','gerente']::user_role[]));

CREATE POLICY acpp_select ON public.accounting_closure_period_projects
  FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin','super_admin','gerente']::user_role[]));

CREATE POLICY acpe_select ON public.accounting_closure_period_expenses
  FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin','super_admin','gerente']::user_role[]));

CREATE POLICY cal_select ON public.closure_audit_log
  FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin','super_admin','gerente']::user_role[]));

-- =============================================================================
-- 3. RPC — crear cierre de período (borrador) con snapshots atómicos
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_closure_period(
  p_period_end date,
  p_project_ids uuid[],
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_my_role()::text;
  v_period_id uuid;
  v_last_end  date;
  v_projects_profit numeric := 0;
  v_bodega numeric := 0;
  v_count int := 0;
BEGIN
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden',
      'message', 'Solo el CEO (super_admin) puede crear cierres de período.');
  END IF;
  IF p_period_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input',
      'message', 'Falta la fecha de corte del período.');
  END IF;
  IF p_project_ids IS NULL OR array_length(p_project_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_projects',
      'message', 'Seleccioná al menos un proyecto para el cierre.');
  END IF;

  -- Límite inferior = fecha del último período confirmado (regla de corte de bodega, Q3)
  v_last_end := (SELECT max(period_end) FROM public.accounting_closure_periods WHERE status = 'confirmado');

  INSERT INTO public.accounting_closure_periods (period_start, period_end, status, created_by, notes)
  VALUES (v_last_end, p_period_end, 'borrador', v_actor, p_notes)
  RETURNING id INTO v_period_id;

  -- Snapshot de proyectos ELEGIBLES: entregado/completado + 100% pagado + no en un cierre confirmado previo
  INSERT INTO public.accounting_closure_period_projects
    (period_id, project_id, project_name, quoted_value, total_paid, balance_due, project_expenses, profit, margin_pct)
  SELECT
    v_period_id, pr.id, pr.name,
    COALESCE(pr.total_amount, 0),
    COALESCE(pay.paid, 0),
    COALESCE(pr.balance_due, 0),
    COALESCE(exp.spent, 0),
    COALESCE(pay.paid, 0) - COALESCE(exp.spent, 0),
    CASE WHEN COALESCE(pay.paid, 0) > 0
         THEN round((COALESCE(pay.paid, 0) - COALESCE(exp.spent, 0)) / pay.paid * 100, 1)
         ELSE 0 END
  FROM public.projects pr
  LEFT JOIN LATERAL (SELECT SUM(amount) AS paid FROM public.payments WHERE project_id = pr.id) pay ON true
  LEFT JOIN LATERAL (SELECT SUM(amount) AS spent FROM public.expenses
                     WHERE project_id = pr.id AND approval_status = 'aprobado') exp ON true
  WHERE pr.id = ANY(p_project_ids)
    AND pr.status IN ('entregado', 'completado')
    AND pr.is_fully_paid = true
    AND NOT EXISTS (
      SELECT 1 FROM public.accounting_closure_period_projects cpp
      JOIN public.accounting_closure_periods cp ON cp.id = cpp.period_id
      WHERE cpp.project_id = pr.id AND cp.status = 'confirmado'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    DELETE FROM public.accounting_closure_periods WHERE id = v_period_id;
    RETURN jsonb_build_object('success', false, 'error', 'no_eligible_projects',
      'message', 'Ninguno de los proyectos seleccionados es elegible (entregado/completado, 100% pagado y no incluido ya en un cierre confirmado).');
  END IF;

  -- Snapshot de gastos de BODEGA del período (corte: (último cierre, p_period_end], solo aprobados)
  INSERT INTO public.accounting_closure_period_expenses
    (period_id, expense_id, category, description, amount, expense_date)
  SELECT v_period_id, e.id, e.category::text, e.description, e.amount, e.expense_date
  FROM public.expenses e
  WHERE e.project_id IS NULL
    AND e.approval_status = 'aprobado'
    AND e.expense_date <= p_period_end
    AND (v_last_end IS NULL OR e.expense_date > v_last_end);

  SELECT COALESCE(SUM(profit), 0) INTO v_projects_profit
    FROM public.accounting_closure_period_projects WHERE period_id = v_period_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_bodega
    FROM public.accounting_closure_period_expenses WHERE period_id = v_period_id;

  UPDATE public.accounting_closure_periods
    SET total_projects_profit = v_projects_profit,
        total_bodega_expenses = v_bodega,
        net_profit = v_projects_profit - v_bodega,
        updated_at = now()
    WHERE id = v_period_id;

  INSERT INTO public.closure_audit_log (period_id, action, performed_by, previous_status, projects_count)
  VALUES (v_period_id, 'created', v_actor, NULL, v_count);

  RETURN jsonb_build_object(
    'success', true,
    'period_id', v_period_id,
    'projects_count', v_count,
    'total_projects_profit', v_projects_profit,
    'total_bodega_expenses', v_bodega,
    'net_profit', v_projects_profit - v_bodega,
    'period_start', v_last_end,
    'period_end', p_period_end
  );
END;
$function$;

-- =============================================================================
-- 4. RPC — confirmar (borrador → confirmado)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.confirm_closure_period(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_my_role()::text;
  v_status text;
  v_count int;
BEGIN
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden',
      'message', 'Solo el CEO (super_admin) puede confirmar cierres.');
  END IF;
  SELECT status INTO v_status FROM public.accounting_closure_periods WHERE id = p_period_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found', 'message', 'Cierre no encontrado.');
  END IF;
  IF v_status <> 'borrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state',
      'message', 'Solo un borrador puede confirmarse.');
  END IF;

  SELECT count(*) INTO v_count FROM public.accounting_closure_period_projects WHERE period_id = p_period_id;

  UPDATE public.accounting_closure_periods
    SET status = 'confirmado', confirmed_at = now(), updated_at = now()
    WHERE id = p_period_id;

  INSERT INTO public.closure_audit_log (period_id, action, performed_by, previous_status, projects_count)
  VALUES (p_period_id, 'confirmed', v_actor, 'borrador', v_count);

  RETURN jsonb_build_object('success', true, 'period_id', p_period_id, 'status', 'confirmado');
END;
$function$;

-- =============================================================================
-- 5. RPC — revertir cierre confirmado (solo CEO, motivo >= 10 chars) — Q4
-- =============================================================================

CREATE OR REPLACE FUNCTION public.revert_closure_period(p_period_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role  text := public.get_my_role()::text;
  v_status text;
  v_count int;
BEGIN
  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden',
      'message', 'Solo el CEO (super_admin) puede revertir un cierre.');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reason_required',
      'message', 'El motivo de la reversión debe tener al menos 10 caracteres.');
  END IF;
  SELECT status INTO v_status FROM public.accounting_closure_periods WHERE id = p_period_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found', 'message', 'Cierre no encontrado.');
  END IF;
  IF v_status <> 'confirmado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state',
      'message', 'Solo un cierre confirmado puede revertirse.');
  END IF;

  SELECT count(*) INTO v_count FROM public.accounting_closure_period_projects WHERE period_id = p_period_id;

  UPDATE public.accounting_closure_periods
    SET status = 'revertido', reverted_at = now(), reverted_by = v_actor,
        reverted_reason = p_reason, updated_at = now()
    WHERE id = p_period_id;

  INSERT INTO public.closure_audit_log (period_id, action, performed_by, previous_status, projects_count, reason)
  VALUES (p_period_id, 'reverted', v_actor, 'confirmado', v_count, p_reason);

  RETURN jsonb_build_object('success', true, 'period_id', p_period_id, 'status', 'revertido');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_closure_period(date, uuid[], text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_closure_period(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_closure_period(uuid, text)          TO authenticated;

COMMIT;

-- =============================================================================
-- Verificación
-- =============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema='public'
--   AND table_name LIKE 'accounting_closure_period%' OR table_name='closure_audit_log';
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('create_closure_period','confirm_closure_period','revert_closure_period');
-- -- create_closure_period falla con rol <> super_admin; revert exige motivo >= 10.
--
-- =============================================================================
-- Rollback
-- =============================================================================
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.revert_closure_period(uuid, text);
--   DROP FUNCTION IF EXISTS public.confirm_closure_period(uuid);
--   DROP FUNCTION IF EXISTS public.create_closure_period(date, uuid[], text);
--   DROP TABLE IF EXISTS public.closure_audit_log;
--   DROP TABLE IF EXISTS public.accounting_closure_period_expenses;
--   DROP TABLE IF EXISTS public.accounting_closure_period_projects;
--   DROP TABLE IF EXISTS public.accounting_closure_periods;
-- COMMIT;
