-- Migración 062 — Snapshot versionado de create_accounting_closure (deuda técnica)
--
-- La RPC `create_accounting_closure` existía SUELTA en producción, sin migración
-- que la respaldara (el repo no era fuente de verdad para ella). Esta migración
-- la captura tal cual está viva el 19/06/2026 (vía pg_get_functiondef), SIN cambiar
-- su comportamiento — es un snapshot 1:1 para cumplir la regla de arnés
-- "triggers/funciones SQL versionados (CREATE OR REPLACE + migración snapshot)".
--
-- NO modifica nada en prod (la definición es idéntica a la que ya corre).
-- El rediseño del cierre (capa de período, PDFs, reversión auditada, categorías)
-- vive en PRD-decisiones-finanzas.md y está GATED en decisiones del dueño — NO acá.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_accounting_closure(p_project_id uuid, p_closed_by uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_closure_id uuid;
  v_income numeric;
  v_expenses numeric;
  v_net numeric;
  v_margin numeric;
BEGIN
  -- Verificar que el proyecto existe y está entregado
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND status = 'entregado') THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_not_delivered', 'message', 'Solo se pueden cerrar proyectos entregados');
  END IF;

  -- Verificar que no tenga cierre previo
  IF EXISTS (SELECT 1 FROM public.accounting_closures WHERE project_id = p_project_id AND status = 'closed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_closed', 'message', 'Este proyecto ya tiene cierre contable');
  END IF;

  -- Calcular totales
  SELECT COALESCE(SUM(amount), 0) INTO v_income FROM public.payments WHERE project_id = p_project_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses FROM public.expenses WHERE project_id = p_project_id AND approval_status = 'aprobado';
  v_net := v_income - v_expenses;
  v_margin := CASE WHEN v_income > 0 THEN ROUND((v_net / v_income) * 100, 1) ELSE 0 END;

  -- Crear cierre
  INSERT INTO public.accounting_closures (project_id, closed_by, total_income, total_expenses, net_profit, profit_margin, notes, status)
  VALUES (p_project_id, p_closed_by, v_income, v_expenses, v_net, v_margin, p_notes, 'closed')
  RETURNING id INTO v_closure_id;

  -- Vincular al proyecto
  UPDATE public.projects SET accounting_closure_id = v_closure_id WHERE id = p_project_id;

  -- Audit log
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_data)
  VALUES (p_closed_by, 'ACCOUNTING_CLOSURE', 'accounting_closures', v_closure_id,
    jsonb_build_object('income', v_income, 'expenses', v_expenses, 'net', v_net, 'margin', v_margin));

  RETURN jsonb_build_object(
    'success', true, 'closure_id', v_closure_id,
    'total_income', v_income, 'total_expenses', v_expenses,
    'net_profit', v_net, 'profit_margin', v_margin
  );
END;
$function$;

COMMIT;

-- =============================================================================
-- Verificación
-- =============================================================================
-- SELECT proname, prosecdef FROM pg_proc WHERE proname='create_accounting_closure';
-- -- Debe existir, prosecdef=true. Comportamiento idéntico al previo (snapshot).
--
-- =============================================================================
-- Rollback
-- =============================================================================
-- No aplica: es un snapshot de una función que ya existía en prod. Revertir esta
-- migración no elimina la función (sigue viva). Para borrarla:
-- DROP FUNCTION IF EXISTS public.create_accounting_closure(uuid, uuid, text);
