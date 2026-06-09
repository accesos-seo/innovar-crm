-- =====================================================
-- 029 — RLS para `public.scheduled_job_log`
-- =====================================================
-- Estado pre-migración (verificado 2026-05-23 via Management API):
--   · `public.scheduled_job_log` tenía RLS DESHABILITADO.
--     Cualquier holder de la anon key podía SELECT/INSERT/UPDATE/DELETE
--     filas (riesgo medio: la tabla puede registrar `error_msg` que
--     filtre detalles internos de jobs).
--   · 0 filas al momento del fix (tabla creada pero sin escrituras
--     activas todavía).
--
-- Quién escribe en la tabla (auditado en `pg_proc`):
--   4 funciones SECURITY DEFINER owned por `postgres`:
--     · public.generate_weekly_report
--     · public.run_archive_inactive_projects
--     · public.run_daily_task_escalation
--     · public.run_payment_reminders
--   Ninguna está agendada en `cron.job` actualmente, pero existen como
--   scaffolding y deben seguir funcionando si se invocan.
--   → `postgres` tiene BYPASSRLS por ser superuser, así que las
--     SECURITY DEFINER bajo postgres NO requieren policy de INSERT.
--   → `service_role` (Edge Functions / cron HTTP) también BYPASSRLS por
--     default en Supabase.
--
-- Quién lee la tabla:
--   · Frontend (`src/`): solo aparece en `database.types.ts` autogenerado.
--     NO hay queries en componentes/hooks.
--   · Edge Functions (`supabase/functions/`): no la referencian.
--   · Conclusión: ningún consumidor `authenticated` la usa actualmente.
--     Se concede SELECT a admin/super_admin para futuras pantallas de
--     observabilidad y para que un admin pueda investigar via PostgREST.
--
-- Policies finales (todas con `DROP IF EXISTS` para ser idempotentes):
--   · scheduled_job_log_select_admin     (SELECT — admin/super_admin)
--   · No hay policies INSERT/UPDATE/DELETE para `authenticated` o `anon`
--     → default DENY. service_role/postgres siguen escribiendo via BYPASSRLS.
--
-- Riesgo de rollback: si alguna future Edge Function usa la anon key
-- para escribir aquí (anti-patrón), fallará silenciosamente. Las edge
-- functions deben usar service_role para insert.
-- =====================================================

BEGIN;

-- 1. Activar RLS
ALTER TABLE public.scheduled_job_log ENABLE ROW LEVEL SECURITY;

-- 2. SELECT solo para admin/super_admin
DROP POLICY IF EXISTS scheduled_job_log_select_admin ON public.scheduled_job_log;
CREATE POLICY scheduled_job_log_select_admin
  ON public.scheduled_job_log
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() IN ('admin','super_admin'));

-- 3. (Intencionalmente sin policies INSERT/UPDATE/DELETE)
--    · service_role y postgres BYPASSRLS → cron y SECURITY DEFINER funcs siguen escribiendo.
--    · authenticated y anon quedan denegados por default.

COMMIT;
