-- =============================================================================
-- 037g_fix_slice3_opp_transitions_v2.sql
-- Fase 4 · Slice 3 — Fix #8 (extiende 037d) durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 8 — extensión de 037d. Faltó la transición `client_approved → approved`
-- que se dispara cuando register_manual_payment inserta payment con
-- verification_status='verified' directo y el trigger convert mueve
-- quotation client_approved → approved, lo cual via sync intenta mover opp
-- client_approved → approved → "Transición no permitida".
--
-- Fix: agregar al validator todas las transiciones que el flujo S3 puede
-- disparar a través de fn_sync_opportunity_from_quotation y convert.
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

  IF NEW.status = 'lost'
     AND OLD.status NOT IN ('converted_to_project','cancelled_after_approval','lost') THEN
    v_valid := true;
  END IF;

  IF NEW.status = 'cancelled_after_approval'
     AND OLD.status IN ('approved','converted_to_project','client_approved','pending_payment_verification') THEN
    v_valid := true;
  END IF;

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
      WHEN 'client_approved|approved'                     THEN true  -- S3: manual payment salta pending
      WHEN 'pending_payment_verification|approved'        THEN true
      WHEN 'pending_payment_verification|sent_to_client'  THEN true
      WHEN 'pending_payment_verification|client_approved' THEN true  -- S3: reject vuelve atrás
      WHEN 'approved|client_approved'                     THEN true  -- S3: escape teórico
      WHEN 'approved|pending_payment_verification'        THEN true  -- S3: nuevo proof sobre proyecto
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
