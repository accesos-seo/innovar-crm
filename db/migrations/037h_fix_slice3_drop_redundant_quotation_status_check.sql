-- =============================================================================
-- 037h_fix_slice3_drop_redundant_quotation_status_check.sql
-- Fase 4 · Slice 3 — Fix #9 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 9 — Existe un CHECK constraint `quotations_status_check` que explícitamente
-- lista los 7 estados pre-S3 (draft, sent, client_approved, pending_payment_verification,
-- approved, expired, rejected) y bloquea los nuevos `cancelled` y `superseded`.
-- Es redundante con el enum (que ya tiene esos values pero está validado en
-- columna por type), y la mig 037 no lo actualizó.
--
-- Fix: DROP del CHECK redundante. El enum quotation_status ya garantiza valores
-- válidos por sí solo.
-- =============================================================================

BEGIN;

ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;

COMMIT;
