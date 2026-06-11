-- 059: Nuevos roles — administradora y gerente.
--
-- administradora: coordinadora operativa con visibilidad amplia. Puede ver y
--   gestionar clientes, proyectos, tareas, citas y pagos recibidos. No accede
--   a gastos, cierres contables ni configuraciones del sistema.
--
-- gerente: observador de alto nivel (socio, dueño). Lectura total del negocio
--   incluida finanzas. Sin permisos de escritura en ninguna tabla.
--
-- IMPORTANTE: Las policies usan comparación TEXT ('gerente', 'administradora')
-- porque los valores del enum se agregan en el mismo bloque y PostgreSQL no
-- permite usar valores nuevos de enum en la misma transacción donde se crean.
-- get_my_role() ya devuelve TEXT, por lo que la comparación es equivalente.
--
-- Idempotente: ADD VALUE IF NOT EXISTS + DROP POLICY IF EXISTS + CREATE.

-- ── 1. Extender el enum user_role ────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administradora';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'gerente';

-- ════════════════════════════════════════════════════════════════════════════
-- GERENTE — SELECT en todas las tablas de negocio, sin escritura
-- ════════════════════════════════════════════════════════════════════════════

-- clients
DROP POLICY IF EXISTS "gerente_select_clients" ON public.clients;
CREATE POLICY "gerente_select_clients" ON public.clients
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- projects
DROP POLICY IF EXISTS "gerente_select_projects" ON public.projects;
CREATE POLICY "gerente_select_projects" ON public.projects
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- opportunities (leads)
DROP POLICY IF EXISTS "gerente_select_opportunities" ON public.opportunities;
CREATE POLICY "gerente_select_opportunities" ON public.opportunities
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- quotations
DROP POLICY IF EXISTS "gerente_select_quotations" ON public.quotations;
CREATE POLICY "gerente_select_quotations" ON public.quotations
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- quotation_items
DROP POLICY IF EXISTS "gerente_select_quotation_items" ON public.quotation_items;
CREATE POLICY "gerente_select_quotation_items" ON public.quotation_items
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- tasks
DROP POLICY IF EXISTS "gerente_select_tasks" ON public.tasks;
CREATE POLICY "gerente_select_tasks" ON public.tasks
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- visits (citas / agenda)
DROP POLICY IF EXISTS "gerente_select_visits" ON public.visits;
CREATE POLICY "gerente_select_visits" ON public.visits
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- payments
DROP POLICY IF EXISTS "gerente_select_payments" ON public.payments;
CREATE POLICY "gerente_select_payments" ON public.payments
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- expenses
DROP POLICY IF EXISTS "gerente_select_expenses" ON public.expenses;
CREATE POLICY "gerente_select_expenses" ON public.expenses
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- accounting_closures
DROP POLICY IF EXISTS "gerente_select_closures" ON public.accounting_closures;
CREATE POLICY "gerente_select_closures" ON public.accounting_closures
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- decision_questionnaires
DROP POLICY IF EXISTS "gerente_select_decision_questionnaires" ON public.decision_questionnaires;
CREATE POLICY "gerente_select_decision_questionnaires" ON public.decision_questionnaires
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- decision_questions
DROP POLICY IF EXISTS "gerente_select_decision_questions" ON public.decision_questions;
CREATE POLICY "gerente_select_decision_questions" ON public.decision_questions
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- notifications (solo las propias)
DROP POLICY IF EXISTS "gerente_select_notifications" ON public.notifications;
CREATE POLICY "gerente_select_notifications" ON public.notifications
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente' AND user_id = auth.uid());

-- profiles (para que los joins de nombre de equipo funcionen)
DROP POLICY IF EXISTS "gerente_select_profiles" ON public.profiles;
CREATE POLICY "gerente_select_profiles" ON public.profiles
  FOR SELECT TO public
  USING (public.get_my_role() = 'gerente');

-- ════════════════════════════════════════════════════════════════════════════
-- ADMINISTRADORA — CRUD operativo + lectura financiera parcial
-- ════════════════════════════════════════════════════════════════════════════

-- clients: acceso completo
DROP POLICY IF EXISTS "administradora_all_clients" ON public.clients;
CREATE POLICY "administradora_all_clients" ON public.clients
  FOR ALL TO public
  USING (public.get_my_role() = 'administradora')
  WITH CHECK (public.get_my_role() = 'administradora');

-- projects: lectura total + edición (no crear/eliminar)
DROP POLICY IF EXISTS "administradora_select_projects" ON public.projects;
DROP POLICY IF EXISTS "administradora_update_projects" ON public.projects;
CREATE POLICY "administradora_select_projects" ON public.projects
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora');
CREATE POLICY "administradora_update_projects" ON public.projects
  FOR UPDATE TO public
  USING (public.get_my_role() = 'administradora')
  WITH CHECK (public.get_my_role() = 'administradora');

-- opportunities (leads): solo lectura
DROP POLICY IF EXISTS "administradora_select_opportunities" ON public.opportunities;
CREATE POLICY "administradora_select_opportunities" ON public.opportunities
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora');

-- quotations: solo lectura
DROP POLICY IF EXISTS "administradora_select_quotations" ON public.quotations;
CREATE POLICY "administradora_select_quotations" ON public.quotations
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora');

-- quotation_items: solo lectura
DROP POLICY IF EXISTS "administradora_select_quotation_items" ON public.quotation_items;
CREATE POLICY "administradora_select_quotation_items" ON public.quotation_items
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora');

-- tasks: acceso completo
DROP POLICY IF EXISTS "administradora_all_tasks" ON public.tasks;
CREATE POLICY "administradora_all_tasks" ON public.tasks
  FOR ALL TO public
  USING (public.get_my_role() = 'administradora')
  WITH CHECK (public.get_my_role() = 'administradora');

-- visits (citas / agenda): acceso completo
DROP POLICY IF EXISTS "administradora_all_visits" ON public.visits;
CREATE POLICY "administradora_all_visits" ON public.visits
  FOR ALL TO public
  USING (public.get_my_role() = 'administradora')
  WITH CHECK (public.get_my_role() = 'administradora');

-- payments: solo lectura (seguimiento de pagos)
-- expenses: SIN política → RLS bloquea implícitamente (intencional)
-- accounting_closures: SIN política → RLS bloquea implícitamente (intencional)
DROP POLICY IF EXISTS "administradora_select_payments" ON public.payments;
CREATE POLICY "administradora_select_payments" ON public.payments
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora');

-- notifications (propias)
DROP POLICY IF EXISTS "administradora_select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "administradora_insert_notifications" ON public.notifications;
CREATE POLICY "administradora_select_notifications" ON public.notifications
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora' AND user_id = auth.uid());
CREATE POLICY "administradora_insert_notifications" ON public.notifications
  FOR INSERT TO public
  WITH CHECK (public.get_my_role() = 'administradora' AND user_id = auth.uid());

-- profiles (para joins de nombre de usuario en proyectos, tareas, etc.)
DROP POLICY IF EXISTS "administradora_select_profiles" ON public.profiles;
CREATE POLICY "administradora_select_profiles" ON public.profiles
  FOR SELECT TO public
  USING (public.get_my_role() = 'administradora');
