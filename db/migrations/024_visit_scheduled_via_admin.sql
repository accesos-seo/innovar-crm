-- Migración 024 — `scheduled_via='admin'` permitido (Fase 3 · Slice 2)
--
-- Fundamento (D19 del plan Fase 3):
--   Cuando un administrador agenda una visita manualmente desde el CRM (sin que
--   el cliente use el link público), `scheduled_via='admin'` es el valor semánticamente
--   correcto. El CHECK actual solo permite 'public_link' | 'comercial' | 'agent_a05'.
--   Sumamos 'admin' para distinguir en reportes futuros sin migrar datos existentes.

BEGIN;

ALTER TABLE public.visits
  DROP CONSTRAINT IF EXISTS visits_scheduled_via_check;

ALTER TABLE public.visits
  ADD CONSTRAINT visits_scheduled_via_check
  CHECK (scheduled_via IN ('public_link','comercial','admin','agent_a05'));

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid='public.visits'::regclass AND conname='visits_scheduled_via_check';
-- -- Debe incluir 'admin' en la lista permitida.

-- =============================================================================
-- Rollback
-- =============================================================================
-- ALTER TABLE public.visits DROP CONSTRAINT visits_scheduled_via_check;
-- ALTER TABLE public.visits ADD CONSTRAINT visits_scheduled_via_check
--   CHECK (scheduled_via IN ('public_link','comercial','agent_a05'));
-- Pre-condición: no debe haber filas con scheduled_via='admin' antes de revertir.
