-- =============================================================================
-- 037i_fix_slice3_revision_search_path.sql
-- Fase 4 · Slice 3 — Fix #10 descubierto durante smoke E2E S3.1 (2026-05-24)
-- =============================================================================
--
-- BUG 10 — create_quotation_revision tiene `SET search_path = public` y dentro
-- llama `gen_random_bytes(16)` que vive en `extensions` schema → falla con
-- 42883 "function gen_random_bytes(integer) does not exist".
--
-- Fix: extender search_path a `public, extensions` para cubrir pgcrypto.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_quotation_revision(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
    encode(extensions.gen_random_bytes(16), 'hex'), v_new_short_code
  RETURNING id INTO v_v2_id;

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
