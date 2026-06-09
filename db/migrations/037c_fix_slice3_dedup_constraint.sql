-- =============================================================================
-- 037c_fix_slice3_dedup_constraint.sql
-- Fase 4 · Slice 3 — Fix #4 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 4 — ON CONFLICT (dedup_key) en las RPCs S3 (verify_payment, reject_payment,
-- recalc_project_balance_due, expire_accepted_quotations_scan) requiere un
-- constraint/index UNIQUE sobre `(dedup_key)` SIN WHERE. En prod existen DOS
-- partial unique indexes sobre dedup_key (ambos WHERE dedup_key IS NOT NULL):
--   - uq_notification_dedup_key (pre-existente, S2)
--   - notification_queue_dedup_key_uniq (creado por mig 037 — redundante)
--
-- PG no acepta ON CONFLICT (column) sin WHERE cuando solo hay índices parciales
-- → "42P10: no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- Fix: drop ambos parciales + ADD CONSTRAINT UNIQUE (dedup_key) full. NULL no
-- viola UNIQUE en PG (cada NULL se trata distinto), así que filas con dedup_key
-- IS NULL siguen funcionando (verificado: 48 filas null + 0 duplicates en prod).
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS public.notification_queue_dedup_key_uniq;
DROP INDEX IF EXISTS public.uq_notification_dedup_key;

ALTER TABLE public.notification_queue
  ADD CONSTRAINT notification_queue_dedup_key_uniq UNIQUE (dedup_key);

COMMIT;

-- =============================================================================
-- END 037c_fix_slice3_dedup_constraint.sql
-- =============================================================================
