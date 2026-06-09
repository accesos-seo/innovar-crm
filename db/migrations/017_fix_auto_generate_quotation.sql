-- Migración 017 — Fix de auto_generate_quotation
--
-- Bug detectado en QA del 2026-05-23 al mover una visit a 'realizada':
--   El INSERT en quotations incluía la columna `created_by`, que NO existe en
--   la tabla. La migración 009 asumió incorrectamente su existencia.
--
-- Decisión: quitamos `created_by` del INSERT. La información del comercial
-- responsable es derivable vía `opportunity_id → opportunities.assigned_to`,
-- así que no se pierde nada. Esto evita una migración de schema.

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_generate_quotation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_opp     public.opportunities%ROWTYPE;
  v_quot_id UUID;
BEGIN
  IF NEW.status <> 'realizada' OR (OLD.status IS NOT NULL AND OLD.status = 'realizada') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_opp FROM public.opportunities WHERE id = NEW.opportunity_id;

  -- Idempotencia: si ya existe quotation v1 initial para esta opportunity, no duplicar.
  IF EXISTS (
    SELECT 1 FROM public.quotations
     WHERE opportunity_id = v_opp.id
       AND quotation_type = 'initial'
       AND version_number = 1
       AND deleted_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.quotations (
    client_id, opportunity_id, status, version_number,
    quotation_type, is_locked, valid_until, notes
  )
  VALUES (
    v_opp.client_id,
    v_opp.id,
    'draft',
    1,
    'initial',
    false,
    NOW() + INTERVAL '30 days',
    'Generada automáticamente desde visita ' || NEW.id || '. Revisar items.'
  )
  RETURNING id INTO v_quot_id;

  -- Mover opportunity a 'quoted' (la transición legal es visit_completed → quoted).
  UPDATE public.opportunities
     SET status = 'quoted'
   WHERE id = v_opp.id
     AND status IN ('visit_completed','visit_scheduled');

  RETURN NEW;
END;
$function$;

COMMIT;
