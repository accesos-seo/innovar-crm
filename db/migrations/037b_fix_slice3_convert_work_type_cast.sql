-- =============================================================================
-- 037b_fix_slice3_convert_work_type_cast.sql
-- Fase 4 · Slice 3 — Fix #3 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 3 (heredado de S2 + arrastrado por mig 037 y 037a) —
-- convert_quotation_to_project intenta INSERT en projects.work_type sin cast,
-- pero work_type es ENUM (cocina/closet/puertas/centro_tv/otro). El expresión
-- `array_to_string(v_opp.services, ', ')` devuelve TEXT y no se castea →
-- "column work_type is of type work_type but expression is of type text".
--
-- Fix: tomar el primer elemento de services y castear a work_type. Si el primer
-- service no calza con el enum, usa 'otro'.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.convert_quotation_to_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quot         public.quotations%ROWTYPE;
  v_opp          public.opportunities%ROWTYPE;
  v_existing     UUID;
  v_project_id   UUID;
  v_measurements JSONB;
  v_first_visit  UUID;
  v_client_name  TEXT;
  v_work_type    public.work_type;
  v_first_service TEXT;
BEGIN
  IF NEW.verification_status <> 'verified'
     OR (OLD.verification_status IS NOT NULL AND OLD.verification_status = 'verified')
     OR NEW.quotation_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.verified_at := COALESCE(NEW.verified_at, now());

  SELECT id INTO v_existing
  FROM public.projects
  WHERE approved_quotation_id = NEW.quotation_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    NEW.below_suggested := (NEW.amount < (
      SELECT total_amount * public.get_suggested_advance_pct() / 100
      FROM public.quotations WHERE id = NEW.quotation_id
    ));
    NEW.project_id := COALESCE(NEW.project_id, v_existing);
    RETURN NEW;
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = NEW.quotation_id;
  IF v_quot.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_quot.quotation_type <> 'initial' THEN
    RETURN NEW;
  END IF;

  NEW.below_suggested := (NEW.amount < (v_quot.total_amount * public.get_suggested_advance_pct() / 100));

  SELECT * INTO v_opp FROM public.opportunities WHERE id = v_quot.opportunity_id;

  SELECT id, measurements INTO v_first_visit, v_measurements
  FROM public.visits
  WHERE opportunity_id = v_opp.id AND status = 'realizada' AND deleted_at IS NULL
  ORDER BY realized_at DESC NULLS LAST
  LIMIT 1;

  SELECT name INTO v_client_name FROM public.clients WHERE id = v_opp.client_id;

  -- Resolver work_type del primer service. Si no calza con el enum, usar 'otro'.
  v_first_service := COALESCE(v_opp.services[1], 'otro');
  BEGIN
    v_work_type := v_first_service::public.work_type;
  EXCEPTION WHEN invalid_text_representation OR others THEN
    v_work_type := 'otro'::public.work_type;
  END;

  INSERT INTO public.projects (
    client_id, approved_quotation_id, opportunity_id,
    name, work_type, status,
    total_amount, advance_amount,
    balance_due, is_fully_paid, fully_paid_at,
    initial_measurements, data_origin, created_by,
    client_approved_at
  )
  VALUES (
    v_opp.client_id, v_quot.id, v_opp.id,
    COALESCE(
      array_to_string(v_opp.services, ', ') || ' - ' || COALESCE(v_client_name, 'Cliente sin nombre'),
      'Proyecto sin nombre'
    ),
    v_work_type,
    'cotizacion_aprobada',
    v_quot.total_amount,
    NEW.amount,
    GREATEST(COALESCE(v_quot.total_amount, 0) - NEW.amount, 0),
    (GREATEST(COALESCE(v_quot.total_amount, 0) - NEW.amount, 0) <= 0),
    CASE WHEN GREATEST(COALESCE(v_quot.total_amount, 0) - NEW.amount, 0) <= 0 THEN now() ELSE NULL END,
    v_measurements,
    'system',
    NEW.verified_by,
    now()
  )
  RETURNING id INTO v_project_id;

  UPDATE public.quotations
  SET status = 'approved',
      is_locked = true,
      updated_at = now()
  WHERE id = v_quot.id;

  NEW.project_id := v_project_id;

  INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url)
  SELECT p.id,
         'Proyecto creado por pago verificado',
         format('Pago verificado convirtió cotización N° %s en proyecto.', COALESCE(v_quot.quotation_number, '?')),
         'project_created_from_payment',
         'projects', v_project_id,
         format('/proyectos/%s', v_project_id)
  FROM public.profiles p
  WHERE p.role IN ('admin'::user_role, 'super_admin'::user_role)
    AND p.is_active = true;

  RETURN NEW;
END $$;

COMMIT;

-- =============================================================================
-- END 037b_fix_slice3_convert_work_type_cast.sql
-- =============================================================================
