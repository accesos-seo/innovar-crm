-- =====================================================
-- 029a — REVOKE de grants a nivel tabla en `public.scheduled_job_log`
-- =====================================================
-- Complemento crítico de 029_scheduled_job_log_rls.sql.
--
-- Por qué 029 no fue suficiente:
--   · 029 activó RLS y creó una policy SELECT solo para admin/super_admin.
--   · Eso bloquea SELECT/INSERT/UPDATE/DELETE por fila (default DENY).
--   · PERO `TRUNCATE` en PostgreSQL NO es evaluado por RLS — se autoriza
--     únicamente por el grant de tabla. Citando los docs:
--       "Row-level security does not apply to TRUNCATE; the TRUNCATE
--        privilege is required and is checked against the role of the
--        user executing TRUNCATE."
--   · Los grants iniciales (heredados del bootstrap automático de
--     Supabase para tablas `public`) incluían DELETE/INSERT/TRUNCATE/UPDATE
--     para `anon` y `authenticated`. Eso deja una superficie real:
--     cualquier holder de la anon key podía truncar la tabla.
--
-- Qué hace esta migración:
--   · REVOKE ALL para `anon` y `authenticated` → quedan sin grant alguno
--     a nivel tabla. PostgREST consulta como `authenticated`/`anon` y
--     simplemente no encontrará la tabla en su schema cache → 404.
--   · NO toca grants de `postgres` (owner) ni `service_role`
--     (ambos bypassan RLS por default en Supabase, los writers
--     SECURITY DEFINER + cualquier Edge Function siguen funcionando).
--
-- Smoke esperado post-migración:
--   · `SET ROLE anon; TRUNCATE public.scheduled_job_log;`
--     → ERROR: permission denied for table scheduled_job_log
--   · `SET ROLE anon; SELECT * FROM public.scheduled_job_log;`
--     → ERROR: permission denied (sin grant SELECT, ya no llega a evaluar RLS)
--   · `SELECT public.run_archive_inactive_projects();` (corre como postgres)
--     → escribe normalmente (postgres tiene todos los grants + BYPASSRLS).
--
-- Idempotente: REVOKE no falla si el privilegio ya no estaba.
-- =====================================================

BEGIN;

REVOKE ALL ON TABLE public.scheduled_job_log FROM anon;
REVOKE ALL ON TABLE public.scheduled_job_log FROM authenticated;

COMMENT ON TABLE public.scheduled_job_log IS
  'Log de ejecuciones de jobs SECURITY DEFINER (run_*, generate_weekly_report). Escritura solo via postgres/service_role (BYPASSRLS). Lectura: admin/super_admin via policy. anon/authenticated sin grants a nivel tabla → invisible para PostgREST.';

COMMIT;
