-- Migración 014 — Fix de transiciones de oportunidad
--
-- Bug detectado en QA del 2026-05-23:
--   - validate_visit_completion intenta UPDATE opportunities.status = 'visit_scheduled'
--     cuando el status actual es 'new' o 'contacted' (al insertar una visita).
--   - validate_opportunity_transition solo permite 'new → contacted', no 'new → visit_scheduled'.
--   - Resultado: era imposible agendar una visita sobre una opportunity recién creada
--     (todos los INSERTs en visits fallaban con ERRCODE 23514).
--
-- Fix: agregar dos transiciones legítimas que el PRD §3 y §4 contemplaban
-- pero que la migración 009 no incluyó en el CASE:
--   - new → visit_scheduled  : cliente auto-agenda por link público antes del primer contacto.
--   - contacted → quoted     : admin bypass (cotización sin visita), bypassed_visit=true.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_opportunity_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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

  -- Mapa explícito de transiciones válidas.
  IF NOT v_valid THEN
    v_valid := CASE OLD.status || '|' || NEW.status
      WHEN 'new|contacted'                                THEN true
      WHEN 'new|visit_scheduled'                          THEN true  -- self-booking público antes de primer contacto
      WHEN 'contacted|visit_scheduled'                    THEN true
      WHEN 'contacted|quoted'                             THEN true  -- bypass admin (quotation sin visita)
      WHEN 'visit_scheduled|visit_completed'              THEN true
      WHEN 'visit_completed|quoted'                       THEN true
      WHEN 'quoted|sent_to_client'                        THEN true
      WHEN 'sent_to_client|client_approved'               THEN true
      WHEN 'sent_to_client|quoted'                        THEN true  -- nueva versión vuelve a draft
      WHEN 'client_approved|pending_payment_verification' THEN true
      WHEN 'pending_payment_verification|approved'        THEN true
      WHEN 'pending_payment_verification|sent_to_client'  THEN true  -- admin rechaza comprobante
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
END;
$function$;

COMMIT;
