-- =============================================================================
-- 037d_fix_slice3_opp_transitions.sql
-- Fase 4 · Slice 3 — Fix #5 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 5 — validate_opportunity_transition (función S2 que valida transiciones
-- de opportunities.status) no contempla las transiciones que el flujo Slice 3
-- requiere para reject_payment, cancel_quotation_acceptance y reactivate.
-- Errores reproducidos:
--   reject_payment → UPDATE quotations SET status=client_approved dispara
--     fn_sync_opportunity_from_quotation que intenta opp.pending_payment_verification
--     → opp.client_approved → falla con 23514 "Transición no permitida".
--   cancel_quotation_acceptance desde pending_payment_verification → opp.lost
--     ya está permitido por la rama early-exit "transición a lost siempre
--     permitida". OK.
--   reactivate_expired_quotation → expired → client_approved no está mapeado
--     en fn_sync_opportunity_from_quotation (CASE no contempla expired),
--     entonces sync devuelve NULL y no actualiza opp. Por ahora OK; opp se
--     queda en 'lost'. Validador NO se invoca.
--
-- Fix: agregar al validador las 2 transiciones que faltan:
--   pending_payment_verification → client_approved  (reject_payment retrocede)
--   approved → client_approved                       (escape teórico, no usado
--                                                     en S3 pero coherente)
--   approved → pending_payment_verification          (nuevo pago sobre proyecto
--                                                     ya creado regresa estado;
--                                                     no aplica con D11 abonos
--                                                     que mantienen approved,
--                                                     pero queda por si acaso)
--
-- NO se toca el "lost siempre permitido" — ya está cubierto.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_opportunity_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_valid BOOLEAN := false;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Transición a 'lost' siempre permitida desde estados no terminales.
  IF NEW.status = 'lost'
     AND OLD.status NOT IN ('converted_to_project','cancelled_after_approval','lost') THEN
    v_valid := true;
  END IF;

  -- Transición a 'cancelled_after_approval' siempre permitida desde estados post-conversión.
  IF NEW.status = 'cancelled_after_approval'
     AND OLD.status IN ('approved','converted_to_project','client_approved','pending_payment_verification') THEN
    v_valid := true;
  END IF;

  -- Mapa explícito de transiciones válidas.
  IF NOT v_valid THEN
    v_valid := CASE OLD.status || '|' || NEW.status
      WHEN 'new|contacted'                                THEN true
      WHEN 'new|visit_scheduled'                          THEN true
      WHEN 'contacted|visit_scheduled'                    THEN true
      WHEN 'contacted|quoted'                             THEN true
      WHEN 'visit_scheduled|visit_completed'              THEN true
      WHEN 'visit_completed|quoted'                       THEN true
      WHEN 'quoted|sent_to_client'                        THEN true
      WHEN 'sent_to_client|client_approved'               THEN true
      WHEN 'sent_to_client|quoted'                        THEN true
      WHEN 'client_approved|pending_payment_verification' THEN true
      WHEN 'pending_payment_verification|approved'        THEN true
      WHEN 'pending_payment_verification|sent_to_client'  THEN true
      -- S3 additions (2026-05-24):
      WHEN 'pending_payment_verification|client_approved' THEN true  -- reject_payment vuelve atrás
      WHEN 'approved|client_approved'                     THEN true  -- escape teórico
      WHEN 'approved|pending_payment_verification'        THEN true  -- nuevo proof sobre proyecto
      WHEN 'approved|converted_to_project'                THEN true
      WHEN 'converted_to_project|cancelled_after_approval' THEN true
      ELSE false
    END;
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Transición no permitida: % → %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  NEW.last_activity_at := NOW();

  IF NEW.status = 'lost' AND OLD.status <> 'lost' THEN
    NEW.lost_at := NOW();
  END IF;

  RETURN NEW;
END $$;

COMMIT;

-- =============================================================================
-- END 037d_fix_slice3_opp_transitions.sql
-- =============================================================================
