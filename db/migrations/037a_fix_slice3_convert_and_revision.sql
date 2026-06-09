-- =============================================================================
-- 037a_fix_slice3_convert_and_revision.sql
-- Fase 4 · Slice 3 — Fixes descubiertos durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 1 — convert_quotation_to_project (introducido al hacer CREATE OR REPLACE
-- en mig 037): el body usa `array_to_string(services, ', ') FROM public.clients c`
-- pero `clients.services` en prod es TEXT (no array). El cast a array_to_string
-- explota con "function array_to_string(text, text) does not exist" en la
-- primera ejecución real. Bug heredado de la versión S2 (probablemente nunca
-- se ejecutó con datos en prod porque convert se dispara raramente). Fix:
-- usar `v_opp.services` (que sí es text[]) y separar la concatenación con
-- subquery solo para clients.name.
--
-- BUG 2 — create_quotation_revision (mig 037 líneas 1102-1111): el INSERT
-- INTO quotation_items referencia columnas inexistentes (`item_type`, `name`,
-- `total_price`, `sort_order`). Las columnas reales son: id, quotation_id,
-- description, quantity, unit_price, product_category, configuration,
-- created_at, updated_at. Fix: listar explícitamente las columnas correctas.
--
-- Ambos fixes son CREATE OR REPLACE — idempotentes. Sin migración de schema.
-- =============================================================================

BEGIN;

-- =============================================================================
-- FIX 1 — convert_quotation_to_project (project name uses v_opp.services)
-- =============================================================================

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

  -- FIX: usar v_opp.services (text[]) en vez de clients.services (text).
  SELECT name INTO v_client_name FROM public.clients WHERE id = v_opp.client_id;

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
    array_to_string(v_opp.services, ', '),
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

-- =============================================================================
-- FIX 2 — create_quotation_revision (correct columns for quotation_items)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_quotation_revision(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_v1   public.quotations%ROWTYPE;
  v_v2_id UUID;
  v_new_short_code TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_v1 FROM public.quotations WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;
  IF v_v1.id IS NULL THEN
    RAISE EXCEPTION 'quotation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_v1.status NOT IN ('client_approved'::quotation_status,
                         'pending_payment_verification'::quotation_status) THEN
    RAISE EXCEPTION 'invalid_state_for_revision' USING ERRCODE = '22023',
      DETAIL = format('status=%s', v_v1.status);
  END IF;

  v_new_short_code := public.generate_unique_quotation_short_code();

  INSERT INTO public.quotations (
    client_id, opportunity_id, total_amount, subtotal,
    discount_type, discount_value, transport_cost,
    notes, status, is_locked,
    version_number, parent_quotation_id,
    valid_until, quotation_number, quotation_type, bypassed_visit, bypass_reason,
    public_token, short_code
  )
  SELECT
    v_v1.client_id, v_v1.opportunity_id, v_v1.total_amount, v_v1.subtotal,
    v_v1.discount_type, v_v1.discount_value, v_v1.transport_cost,
    v_v1.notes, 'draft'::quotation_status, false,
    v_v1.version_number + 1, v_v1.id,
    now() + INTERVAL '30 days', v_v1.quotation_number, 'initial', v_v1.bypassed_visit, v_v1.bypass_reason,
    encode(gen_random_bytes(16), 'hex'), v_new_short_code
  RETURNING id INTO v_v2_id;

  -- FIX: columnas reales son id, quotation_id, description, quantity, unit_price,
  -- product_category, configuration, created_at, updated_at. NO existen item_type,
  -- name, total_price, sort_order.
  INSERT INTO public.quotation_items (
    id, quotation_id,
    description, quantity, unit_price,
    product_category, configuration,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(), v_v2_id,
    description, quantity, unit_price,
    product_category, configuration,
    now(), now()
  FROM public.quotation_items
  WHERE quotation_id = v_v1.id;

  UPDATE public.quotations
  SET status                     = 'superseded'::quotation_status,
      is_locked                  = true,
      superseded_at              = now(),
      superseded_by_quotation_id = v_v2_id,
      updated_at                 = now()
  WHERE id = v_v1.id;

  INSERT INTO public.audit_logs ("userId","userName",action,"tableName","recordId","changesSummary","timestamp")
  SELECT auth.uid(),
         (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
         'quotation_superseded', 'quotations', p_quotation_id::text,
         format('new_quotation_id=%s', v_v2_id::text),
         now();

  RETURN jsonb_build_object(
    'ok', true,
    'new_quotation_id', v_v2_id,
    'new_short_code', v_new_short_code
  );
END $$;

REVOKE ALL ON FUNCTION public.create_quotation_revision(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_quotation_revision(UUID) TO authenticated;

COMMIT;

-- =============================================================================
-- END 037a_fix_slice3_convert_and_revision.sql
-- =============================================================================
