-- =============================================================================
-- ROLLBACK_slice_3.sql
-- Reverse las migraciones 037, 038, 039.
-- =============================================================================
--
-- ⚠️  ADVERTENCIA: PostgreSQL NO soporta `ALTER TYPE ... DROP VALUE`. Los enum
-- values `cancelled` y `superseded` agregados en mig 037 NO se eliminan. Esto
-- es benigno (no rompe nada; los valores siguen existiendo aunque ninguna fila
-- los use).
--
-- ⚠️  El bucket Storage `payment-receipts` y sus policies originales (S2) NO se
-- restauran a la versión pre-037. La policy `payment_receipts_anon_insert`
-- queda con la versión extendida (acepta estado `approved`). Para revertir,
-- correr manualmente:
--
--   DROP POLICY IF EXISTS payment_receipts_anon_insert ON storage.objects;
--   CREATE POLICY payment_receipts_anon_insert ON storage.objects
--     FOR INSERT WITH CHECK (
--       bucket_id = 'payment-receipts'
--       AND (storage.foldername(name))[1] IS NOT NULL
--       AND EXISTS (
--         SELECT 1 FROM quotations q
--         WHERE q.id::text = (storage.foldername(objects.name))[1]
--           AND q.status IN ('client_approved'::quotation_status, 'pending_payment_verification'::quotation_status)
--           AND (q.valid_until IS NULL OR q.valid_until > now())
--       )
--     );
--
-- ⚠️  Datos en tablas (rows en payments con verification_status='rejected',
-- quotations en estado cancelled/superseded, projects con balance_due/is_fully_paid
-- seteado) NO se borran. Este rollback es SCHEMA-only.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) UNSCHEDULE CRON (mig 038)
-- =============================================================================

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'slice3-expire-accepted-quotations-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- =============================================================================
-- 2) DROP TRIGGERS (orden inverso a creación)
-- =============================================================================

DROP TRIGGER IF EXISTS trg_payment_recalc_balance         ON public.payments;
DROP TRIGGER IF EXISTS trg_quotation_invalidate_short_code ON public.quotations;

-- =============================================================================
-- 3) DROP FUNCIONES nuevas + helpers
-- =============================================================================

DROP FUNCTION IF EXISTS public.expire_accepted_quotations_scan();
DROP FUNCTION IF EXISTS public.reactivate_expired_quotation(UUID);
DROP FUNCTION IF EXISTS public.create_quotation_revision(UUID);
DROP FUNCTION IF EXISTS public.cancel_quotation_acceptance(UUID, TEXT);
DROP FUNCTION IF EXISTS public.register_manual_payment(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_payment(UUID, TEXT);
DROP FUNCTION IF EXISTS public.verify_payment(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.submit_quotation_payment_proof(TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_payment_recalc_balance();
DROP FUNCTION IF EXISTS public.fn_quotation_invalidate_short_code();
DROP FUNCTION IF EXISTS public.recalc_project_balance_due(UUID);
DROP FUNCTION IF EXISTS public.get_feature_flag(TEXT);

-- =============================================================================
-- 4) RESTAURAR fn_sync_opportunity_from_quotation a versión S2 (pre-037)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_opportunity_from_quotation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_opp_status TEXT;
BEGIN
  IF NEW.opportunity_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  v_new_opp_status := CASE NEW.status
    WHEN 'sent'::quotation_status                          THEN 'sent_to_client'
    WHEN 'client_approved'::quotation_status               THEN 'client_approved'
    WHEN 'pending_payment_verification'::quotation_status  THEN 'pending_payment_verification'
    WHEN 'approved'::quotation_status                      THEN 'approved'
    ELSE NULL
  END;

  IF v_new_opp_status IS NOT NULL THEN
    UPDATE public.opportunities
      SET status = v_new_opp_status, updated_at = now(), last_activity_at = now()
      WHERE id = NEW.opportunity_id;
  END IF;

  RETURN NEW;
END $$;

-- =============================================================================
-- 5) RESTAURAR convert_quotation_to_project a versión S2 (sin balance_due / fully_paid)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_quotation_to_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quot         public.quotations%ROWTYPE;
  v_opp          public.opportunities%ROWTYPE;
  v_existing     UUID;
  v_project_id   UUID;
  v_measurements JSONB;
  v_first_visit  UUID;
BEGIN
  IF NEW.verification_status <> 'verified'
     OR (OLD.verification_status IS NOT NULL AND OLD.verification_status = 'verified')
     OR NEW.quotation_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.verified_at := COALESCE(NEW.verified_at, NOW());

  SELECT id INTO v_existing FROM public.projects WHERE approved_quotation_id = NEW.quotation_id AND deleted_at IS NULL LIMIT 1;
  IF v_existing IS NOT NULL THEN
    NEW.below_suggested := (NEW.amount < (
      SELECT total_amount * public.get_suggested_advance_pct() / 100 FROM public.quotations WHERE id = NEW.quotation_id
    ));
    RETURN NEW;
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = NEW.quotation_id;
  IF v_quot.id IS NULL THEN RETURN NEW; END IF;
  IF v_quot.quotation_type <> 'initial' THEN RETURN NEW; END IF;

  NEW.below_suggested := (NEW.amount < (v_quot.total_amount * public.get_suggested_advance_pct() / 100));

  SELECT * INTO v_opp FROM public.opportunities WHERE id = v_quot.opportunity_id;

  SELECT id, measurements INTO v_first_visit, v_measurements
    FROM public.visits
   WHERE opportunity_id = v_opp.id AND status = 'realizada' AND deleted_at IS NULL
   ORDER BY realized_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.projects (
    client_id, approved_quotation_id, opportunity_id,
    name, work_type, status, total_amount, advance_amount,
    initial_measurements, data_origin, created_by, client_approved_at
  )
  VALUES (
    v_opp.client_id, v_quot.id, v_opp.id,
    COALESCE((SELECT array_to_string(services, ', ') || ' - ' || c.name FROM public.clients c WHERE c.id = v_opp.client_id), 'Proyecto sin nombre'),
    array_to_string(v_opp.services, ', '),
    'cotizacion_aprobada', v_quot.total_amount, NEW.amount,
    v_measurements, 'system', NEW.verified_by, NOW()
  )
  RETURNING id INTO v_project_id;

  UPDATE public.quotations SET status = 'approved', is_locked = true, updated_at = NOW() WHERE id = v_quot.id;
  UPDATE public.opportunities SET status = 'converted_to_project', updated_at = NOW() WHERE id = v_opp.id;
  NEW.project_id := v_project_id;

  INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url)
  SELECT p.id, 'Nuevo proyecto creado',
         'Se aprobó cotización y se creó proyecto: ' || (SELECT name FROM public.projects WHERE id = v_project_id),
         'project_created', 'projects', v_project_id, '/projects/' || v_project_id
    FROM public.profiles p
   WHERE p.role IN ('admin','diseñador','disenador') AND p.is_active = true;

  RETURN NEW;
END $$;

-- =============================================================================
-- 6) DROP CONSTRAINTS añadidos en mig 037
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_source_check') THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_payment_source_check;
  END IF;
END $$;

-- =============================================================================
-- 7) DROP COLUMNAS nuevas (data loss aceptado en rollback)
-- =============================================================================

ALTER TABLE public.quotations
  DROP COLUMN IF EXISTS cancellation_reason,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancelled_by,
  DROP COLUMN IF EXISTS superseded_at,
  DROP COLUMN IF EXISTS superseded_by_quotation_id;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS rejected_by,
  DROP COLUMN IF EXISTS rejected_at,
  DROP COLUMN IF EXISTS payment_source;

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS balance_due,
  DROP COLUMN IF EXISTS is_fully_paid,
  DROP COLUMN IF EXISTS fully_paid_at,
  DROP COLUMN IF EXISTS cancellation_reason;

-- =============================================================================
-- 8) DROP INDEX dedup_key (si fue creado por mig 037)
-- =============================================================================

DROP INDEX IF EXISTS public.notification_queue_dedup_key_uniq;

-- =============================================================================
-- 9) DROP SEEDS (mig 039)
-- =============================================================================

DELETE FROM public.system_settings WHERE key IN ('payment_window_days', 'slice_3_enabled');

COMMIT;

-- =============================================================================
-- END ROLLBACK_slice_3.sql
-- =============================================================================
