-- =============================================================================
-- 037j_fix_slice3_quotation_number_unique_composite.sql
-- Fase 4 · Slice 3 — Fix #11 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 11 — create_quotation_revision (PRD §5.3 / D3) hereda `quotation_number`
-- de V1 a V2 con `version_number+1`, pero el constraint actual
-- `quotations_quotation_number_key UNIQUE (quotation_number)` no permite el
-- duplicado.
--
-- Fix: drop el UNIQUE simple y add UNIQUE composite (quotation_number, version_number).
-- Permite múltiples versiones con el mismo number, una por version_number.
-- Verificado: 0 duplicados pre-existentes en prod (validación previa al fix).
-- =============================================================================

BEGIN;

ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_quotation_number_key;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_quotation_number_version_uniq
  UNIQUE (quotation_number, version_number);

COMMIT;
