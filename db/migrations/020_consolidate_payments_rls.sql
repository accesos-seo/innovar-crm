-- =====================================================
-- 020 — Consolidación de RLS en `payments`
-- =====================================================
-- Estado al 2026-05-23: la tabla `payments` tiene 14 policies activas
-- acumuladas de migraciones distintas (legacy + 011). Algunas son
-- duplicados exactos, otras tienen scoping inconsistente, y una
-- (`"Equipo lee pagos"`) tiene `USING (true)` que permite a CUALQUIER
-- usuario `authenticated` leer TODAS las filas — agujero de seguridad
-- porque PG combina policies con OR.
--
-- Esta migración:
--   1. DROP de las 9 policies legacy/duplicadas.
--   2. NO recrea las 5 canónicas de 011 — ya existen idempotentes.
--
-- Set canónico final (definido por 011_lead_to_project_rls.sql):
--   · payments_select               (SELECT — admin OR registered_by OR verified_by OR opp.assigned_to)
--   · payments_insert               (INSERT — admin/super_admin/comercial)
--   · payments_update_admin         (UPDATE — admin/super_admin)
--   · payments_update_pending_by_owner (UPDATE — owner sobre pending)
--   · payments_delete_admin         (DELETE — admin/super_admin)
--
-- Riesgo principal: el trigger `trg_payment_convert_to_project` necesita
-- que UPDATE sea posible para roles admin — `payments_update_admin`
-- canónica lo cubre, sin cambios.
--
-- ⚠️ AGUJERO DE SEGURIDAD CERRADO: `"Equipo lee pagos"` con USING(true)
--    permite que un comercial vea los pagos de otros comerciales. La
--    canónica `payments_select` filtra por owner/assigned.
-- =====================================================

BEGIN;

-- --- 1. Limpiar policies ALL (admin) duplicadas ---
DROP POLICY IF EXISTS "Admin todo en payments"        ON public.payments;
DROP POLICY IF EXISTS "admin: todo en payments"       ON public.payments;
DROP POLICY IF EXISTS "admin_all_payments"            ON public.payments;

-- --- 2. Limpiar policies INSERT (comercial) duplicadas ---
DROP POLICY IF EXISTS "Comercial registra pagos"       ON public.payments;
DROP POLICY IF EXISTS "comercial: insertar payments"   ON public.payments;
DROP POLICY IF EXISTS "user_payments_write"            ON public.payments;

-- --- 3. Limpiar policies SELECT laxas/legacy ---
DROP POLICY IF EXISTS "Equipo lee pagos"               ON public.payments;  -- 🔴 USING(true)
DROP POLICY IF EXISTS "comercial: insertar y ver payments" ON public.payments;
DROP POLICY IF EXISTS "user_payments"                  ON public.payments;

-- Verificación (no falla si las canónicas existen):
--   SELECT policyname, cmd FROM pg_policies
--     WHERE schemaname='public' AND tablename='payments'
--     ORDER BY cmd, policyname;
-- Esperado: 5 filas — payments_select / payments_insert /
--          payments_update_admin / payments_update_pending_by_owner /
--          payments_delete_admin.

COMMIT;

-- =====================================================
-- ROLLBACK (si algo se rompe)
-- =====================================================
-- BEGIN;
--   -- Recrear policies legacy: NO recomendado (el agujero de
--   -- "Equipo lee pagos" volvería). Re-aplicar 011 si necesitás
--   -- restaurar el set canónico.
-- ROLLBACK;
--
-- O simplemente re-aplicar 011_lead_to_project_rls.sql (es idempotente
-- con DROP POLICY IF EXISTS).
-- =====================================================
