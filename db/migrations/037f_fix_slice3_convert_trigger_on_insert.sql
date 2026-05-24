-- =============================================================================
-- 037f_fix_slice3_convert_trigger_on_insert.sql
-- Fase 4 · Slice 3 — Fix #7 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 7 — trg_payment_convert_to_project (S2) está definido como
-- BEFORE UPDATE on payments. register_manual_payment INSERTA directamente con
-- verification_status='verified' (Flow D path) → trigger NO se dispara →
-- proyecto NO se crea. El flow client_upload (submit + verify) funciona porque
-- verify_payment hace UPDATE.
--
-- Fix: recrear el trigger con BEFORE INSERT OR UPDATE. El body de
-- convert_quotation_to_project ya maneja correctamente OLD IS NULL (en INSERT
-- OLD es NULL, la condition `OLD.verification_status IS NOT NULL AND ...=verified`
-- es NULL IS NOT NULL = FALSE, y la condición sigue correctamente).
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_payment_convert_to_project ON public.payments;

CREATE TRIGGER trg_payment_convert_to_project
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.convert_quotation_to_project();

COMMIT;

-- =============================================================================
-- END 037f_fix_slice3_convert_trigger_on_insert.sql
-- =============================================================================
