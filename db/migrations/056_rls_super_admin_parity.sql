-- 056: Paridad RLS para super_admin en tablas core.
--
-- Contexto (carta cliente 2026-06-11): varias policies legacy solo cubren
-- role = 'admin'. El enum user_role incluye 'super_admin' y la migración 055
-- ya corrigió esto para las tablas de postventa ("staff_all_*"). Esta migración
-- consolida los pares duplicados "admin: todo en X" / "admin_all_X" en una sola
-- policy por tabla que cubre admin Y super_admin, con USING + WITH CHECK.
--
-- Idempotente: DROP POLICY IF EXISTS + CREATE. ROLLBACK: recrear las policies
-- originales solo-admin (ver pg_policies en snapshot previo si hiciera falta).

-- ── clients ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin: todo en clients" ON public.clients;
DROP POLICY IF EXISTS "admin_all_clients" ON public.clients;
CREATE POLICY "admin_all_clients" ON public.clients
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── projects ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin: todo en projects" ON public.projects;
DROP POLICY IF EXISTS "admin_all_projects" ON public.projects;
CREATE POLICY "admin_all_projects" ON public.projects
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── quotations ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin: todo en quotations" ON public.quotations;
DROP POLICY IF EXISTS "admin_all_quotations" ON public.quotations;
CREATE POLICY "admin_all_quotations" ON public.quotations
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── tasks ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin: todo en tasks" ON public.tasks;
DROP POLICY IF EXISTS "admin_all_tasks" ON public.tasks;
CREATE POLICY "admin_all_tasks" ON public.tasks
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── payments (las policies payments_insert/update/delete ya cubren super_admin;
--    aquí solo se consolidan las legacy solo-admin) ─────────────────────────────
DROP POLICY IF EXISTS "admin: todo en payments" ON public.payments;
DROP POLICY IF EXISTS "Admin todo en payments" ON public.payments;
DROP POLICY IF EXISTS "admin_all_payments" ON public.payments;
CREATE POLICY "admin_all_payments" ON public.payments
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── expenses ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin todo en expenses" ON public.expenses;
DROP POLICY IF EXISTS "admin_all_expenses" ON public.expenses;
CREATE POLICY "admin_all_expenses" ON public.expenses
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── accounting_closures ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin gestiona cierres" ON public.accounting_closures;
DROP POLICY IF EXISTS "admin_all_closures" ON public.accounting_closures;
CREATE POLICY "admin_all_closures" ON public.accounting_closures
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));

-- ── notifications ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_notifications" ON public.notifications;
CREATE POLICY "admin_all_notifications" ON public.notifications
  FOR ALL TO public
  USING (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role))
  WITH CHECK (public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role));
