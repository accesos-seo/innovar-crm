-- =============================================================================
-- 037_slice3_payment_flow.sql
-- Fase 4 · Slice 3 — Pago → Proyecto
-- =============================================================================
--
-- Reemplaza la migración 036 (NO desplegada). Implementa el flujo end-to-end:
--   cliente sube comprobante / admin registra manual
--   → admin verifica/rechaza desde /pagos
--   → primer pago verificado crea proyecto con diseñador asignado y balance_due
--   → abonos posteriores actualizan balance_due hasta is_fully_paid
--   → admin puede cancelar aceptación (estado `cancelled`)
--   → admin puede emitir V2 (estado `superseded` para V1)
--   → cron diario expira aceptadas sin pago (mig 038)
--   → feature flag `slice_3_enabled` permite deploy apagado para piloto.
--
-- Validado contra schema vivo de producción (xdzbjptozeqcbnaqhtye) 2026-05-23.
-- Toda la migración es IDEMPOTENTE (re-aplicable sin error).
-- Convención: identificadores DB en INGLÉS, comentarios en ESPAÑOL.
--
-- Decisiones cerradas en grill: D1-D13 (ver PRD docs/prd/2026-05-23_slice-3-payment-to-project.md).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) ENUM EXTENSIONS — agregar `cancelled` y `superseded` a quotation_status
-- =============================================================================
-- PG no permite hacer estos ADD VALUE dentro de la misma transacción que los
-- usa, por eso van primero y los comandos posteriores los referencian sólo
-- por nombre (no por cast explícito a enum literal en CHECK constraints).
-- Si la migración corre en pieces, no falla en re-aplicación gracias a IF NOT EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quotation_status')
      AND enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE public.quotation_status ADD VALUE 'cancelled' AFTER 'expired';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quotation_status')
      AND enumlabel = 'superseded'
  ) THEN
    ALTER TYPE public.quotation_status ADD VALUE 'superseded' AFTER 'cancelled';
  END IF;
END $$;

COMMIT;
-- Fin del bloque de enum extension. Resto en transacción separada.

BEGIN;

-- =============================================================================
-- 2) NEW COLUMNS — quotations / payments / projects
-- =============================================================================

-- 2.1 quotations: columnas para D9 (cancel) y D3 (supersede)
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS cancellation_reason       TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL;

-- 2.2 payments: columnas para D7 (rejection audit) y D1 (source distinción)
-- Nota: verification_status YA tiene CHECK con ('pending','verified','rejected')
--       payment_type YA tiene CHECK con ('advance','installment','final','refund')
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_source   TEXT;

-- CHECK para payment_source (cliente subió comprobante vs admin registró manual)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_payment_source_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payment_source_check
      CHECK (payment_source IS NULL OR payment_source IN ('client_upload','admin_manual'));
  END IF;
END $$;

-- 2.3 projects: D2/D11 — balance_due, is_fully_paid, fully_paid_at, cancellation
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS balance_due         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_fully_paid       BOOLEAN       DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fully_paid_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- =============================================================================
-- 3) STORAGE POLICY UPDATE — extender INSERT a estado `approved` (D11 abonos)
-- =============================================================================
-- La policy existente `payment_receipts_anon_insert` (S2) sólo permite uploads
-- cuando quotation está en client_approved o pending_payment_verification.
-- Para D11 (abonos post-conversión sobre el mismo link) hay que incluir `approved`
-- siempre que el short_code siga seteado (no invalidado).

DROP POLICY IF EXISTS payment_receipts_anon_insert ON storage.objects;

CREATE POLICY payment_receipts_anon_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.quotations q
      WHERE q.id::text = (storage.foldername(objects.name))[1]
        AND q.status IN (
          'client_approved'::public.quotation_status,
          'pending_payment_verification'::public.quotation_status,
          'approved'::public.quotation_status
        )
        AND q.short_code IS NOT NULL
        AND q.deleted_at IS NULL
        AND (q.valid_until IS NULL OR q.valid_until > now())
    )
  );

-- =============================================================================
-- 4) HELPER — get_feature_flag(p_key TEXT) RETURNS BOOLEAN
-- =============================================================================
-- Lee system_settings.value y lo castea a BOOLEAN. Tolera valor JSON true/false
-- o string 'true'/'false'. Default false si no existe la fila.

CREATE OR REPLACE FUNCTION public.get_feature_flag(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val JSONB;
BEGIN
  SELECT value INTO v_val FROM public.system_settings WHERE key = p_key;
  IF v_val IS NULL THEN
    RETURN false;
  END IF;
  RETURN COALESCE((v_val::text)::boolean, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END $$;

GRANT EXECUTE ON FUNCTION public.get_feature_flag(TEXT) TO authenticated, anon;

-- =============================================================================
-- 5) HELPER — recalc_project_balance_due(p_project_id UUID)
-- =============================================================================
-- Calcula balance_due = total_amount - SUM(verified payments).
-- Setea is_fully_paid + fully_paid_at en el primer cruce a ≤0.
-- Encola WA `project_fully_paid_v1` UNA SOLA VEZ por proyecto (dedup_key).

CREATE OR REPLACE FUNCTION public.recalc_project_balance_due(p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total           NUMERIC;
  v_paid            NUMERIC;
  v_balance         NUMERIC;
  v_was_paid_before BOOLEAN;
  v_client          public.clients%ROWTYPE;
  v_project_name    TEXT;
  v_first_name      TEXT;
  v_dedup_key       TEXT;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  SELECT total_amount, is_fully_paid, name, client_id
    INTO v_total, v_was_paid_before, v_project_name, v_client.id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_total IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.payments
  WHERE project_id = p_project_id
    AND verification_status = 'verified';

  v_balance := GREATEST(v_total - v_paid, 0);

  UPDATE public.projects
  SET balance_due  = v_balance,
      is_fully_paid = (v_balance <= 0),
      fully_paid_at = CASE
        WHEN v_balance <= 0 AND fully_paid_at IS NULL THEN now()
        WHEN v_balance > 0 THEN NULL  -- si reembolso revierte, limpia el flag (no se re-encola WA tampoco)
        ELSE fully_paid_at
      END,
      updated_at = now()
  WHERE id = p_project_id;

  -- Encolar WA `project_fully_paid_v1` solo en el primer cruce
  IF v_balance <= 0 AND NOT COALESCE(v_was_paid_before, false) THEN
    SELECT * INTO v_client FROM public.clients WHERE id = v_client.id;

    IF v_client.whatsapp_phone IS NOT NULL AND trim(v_client.whatsapp_phone) <> '' THEN
      v_first_name := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);
      v_dedup_key  := 'project_fully_paid_v1:' || p_project_id::text;

      INSERT INTO public.notification_queue (
        event_type, event_reference_id,
        entity_type, entity_reference_id,
        recipient_type, recipient_reference_id, recipient_name, recipient_phone,
        channel, provider,
        template_name, template_language, template_parameters,
        payload, dedup_key
      )
      VALUES (
        'project.fully_paid', p_project_id::text,
        'project',            p_project_id::text,
        'client', v_client.id::text, v_first_name, v_client.whatsapp_phone,
        'whatsapp', 'meta_whatsapp',
        'project_fully_paid_v1', 'es',
        jsonb_build_array(v_first_name, COALESCE(v_project_name, 'tu proyecto')),
        jsonb_build_object('project_id', p_project_id, 'client_id', v_client.id),
        v_dedup_key
      )
      ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    -- Notif in-app al admin creador opportunity (audit)
    INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url)
    SELECT p.id,
           'Proyecto totalmente pagado',
           format('El proyecto «%s» quedó totalmente pagado.', COALESCE(v_project_name,'sin nombre')),
           'project_fully_paid', 'projects', p_project_id,
           format('/proyectos/%s', p_project_id)
    FROM public.profiles p
    WHERE p.role IN ('admin'::user_role, 'super_admin'::user_role)
      AND p.is_active = true;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.recalc_project_balance_due(UUID) TO authenticated;

-- Idempotencia del dedup_key en notification_queue
-- (puede no existir el UNIQUE — agregar parcial WHERE dedup_key IS NOT NULL si falta)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'notification_queue'
      AND indexname = 'notification_queue_dedup_key_uniq'
  ) THEN
    CREATE UNIQUE INDEX notification_queue_dedup_key_uniq
      ON public.notification_queue (dedup_key)
      WHERE dedup_key IS NOT NULL;
  END IF;
END $$;

-- =============================================================================
-- 6) TRIGGER — trg_payment_recalc_balance (recalcula balance tras cualquier cambio)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_payment_recalc_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
BEGIN
  v_pid := COALESCE(NEW.project_id, OLD.project_id);
  IF v_pid IS NOT NULL THEN
    PERFORM public.recalc_project_balance_due(v_pid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_payment_recalc_balance ON public.payments;
CREATE TRIGGER trg_payment_recalc_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_payment_recalc_balance();

-- =============================================================================
-- 7) TRIGGER — trg_quotation_invalidate_short_code (invalida en estados terminales)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_quotation_invalidate_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN (
       'cancelled'::quotation_status,
       'superseded'::quotation_status,
       'expired'::quotation_status,
       'rejected'::quotation_status
     )
     AND NEW.short_code IS NOT NULL
  THEN
    UPDATE public.quotations SET short_code = NULL WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quotation_invalidate_short_code ON public.quotations;
CREATE TRIGGER trg_quotation_invalidate_short_code
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_quotation_invalidate_short_code();

-- =============================================================================
-- 8) REPLACE — fn_sync_opportunity_from_quotation (agregar mapping cancelled)
-- =============================================================================
-- Trigger existente (S2) sincroniza opp.status con quotation.status pero no
-- contempla los nuevos estados. Lo extendemos para mapear cancelled → según
-- contexto (lost si no hay proyecto, cancelled_after_approval si lo hay).
-- `superseded` deliberadamente no sincroniza (V2 toma el relevo con su propia
-- transición de status).

CREATE OR REPLACE FUNCTION public.fn_sync_opportunity_from_quotation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_opp_status TEXT;
  v_has_project    BOOLEAN := false;
BEGIN
  IF NEW.opportunity_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled'::quotation_status THEN
    SELECT EXISTS (
      SELECT 1 FROM public.projects
      WHERE approved_quotation_id = NEW.id AND deleted_at IS NULL
    ) INTO v_has_project;

    v_new_opp_status := CASE
      WHEN v_has_project THEN 'cancelled_after_approval'
      ELSE 'lost'
    END;
  ELSE
    v_new_opp_status := CASE NEW.status
      WHEN 'sent'::quotation_status                          THEN 'sent_to_client'
      WHEN 'client_approved'::quotation_status               THEN 'client_approved'
      WHEN 'pending_payment_verification'::quotation_status  THEN 'pending_payment_verification'
      WHEN 'approved'::quotation_status                      THEN 'approved'
      ELSE NULL  -- rejected, expired, draft, superseded: no sync automático
    END;
  END IF;

  IF v_new_opp_status IS NOT NULL THEN
    UPDATE public.opportunities
      SET status = v_new_opp_status,
          updated_at = now(),
          last_activity_at = now(),
          lost_reason = CASE
            WHEN v_new_opp_status IN ('lost','cancelled_after_approval')
              THEN COALESCE(NEW.cancellation_reason, lost_reason)
            ELSE lost_reason
          END,
          lost_at = CASE
            WHEN v_new_opp_status IN ('lost','cancelled_after_approval') AND lost_at IS NULL
              THEN now()
            ELSE lost_at
          END
      WHERE id = NEW.opportunity_id;
  END IF;

  RETURN NEW;
END $$;

-- =============================================================================
-- 9) REPLACE — convert_quotation_to_project (extender con balance_due + designer WA)
-- =============================================================================
-- Trigger existente ya crea proyecto + locks quotation + mueve opp. Lo extendemos:
--   - Setea balance_due = total_amount - amount (primer pago)
--   - Si NEW.payload incluye designer asignado (vía verify_payment RPC que lo setea
--     ANTES de UPDATE), el RPC en sí hace el UPDATE designer_id post-trigger.
--     Acá NO recibimos designer_id; lo asignamos NULL y la RPC lo completa.
--   - Encola WA `project_assigned_designer_v1` SOLO si project.designer_id se setea
--     (lo decide la RPC verify_payment, no este trigger).
-- Mantiene 100% de la lógica previa, solo agrega balance_due y notif al admin.

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
BEGIN
  IF NEW.verification_status <> 'verified'
     OR (OLD.verification_status IS NOT NULL AND OLD.verification_status = 'verified')
     OR NEW.quotation_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.verified_at := COALESCE(NEW.verified_at, now());

  -- Idempotencia: si ya hay project ligado a esta quotation, sólo recalculamos below_suggested.
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

  -- 1. Crear project con balance_due = total - amount.
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
      (SELECT array_to_string(services, ', ') || ' - ' || c.name
       FROM public.clients c WHERE c.id = v_opp.client_id),
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

  -- 2. Bloquear quotation + status approved.
  UPDATE public.quotations
  SET status = 'approved',
      is_locked = true,
      updated_at = now()
  WHERE id = v_quot.id;

  -- 3. Ligar payment al project recién creado (NEW.project_id se actualiza por NEW.* sin re-UPDATE).
  NEW.project_id := v_project_id;

  -- 4. Notif in-app al admin creador del opp (no a "diseñador" — eso lo hace verify_payment RPC tras setear designer_id).
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
-- 10) RPC — submit_quotation_payment_proof (PUBLIC — cliente desde /c/<code>)
-- =============================================================================
-- Validaciones: feature flag ON, short_code activo, estado de quotation válido
-- (client_approved | pending_payment_verification | approved para abonos),
-- valid_until no vencida, amount > 0.
-- Crea row en payments con verification_status='pending', payment_source='client_upload'.
-- Si quotation aún en client_approved, mueve a pending_payment_verification.
-- Encola notif in-app al admin.

CREATE OR REPLACE FUNCTION public.submit_quotation_payment_proof(
  p_token   TEXT,
  p_amount  NUMERIC,
  p_method  TEXT,
  p_proof_url TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quot     public.quotations%ROWTYPE;
  v_payment_id UUID;
  v_below    BOOLEAN := false;
  v_admin    UUID;
BEGIN
  IF NOT public.get_feature_flag('slice_3_enabled') THEN
    RAISE EXCEPTION 'slice_3_disabled' USING ERRCODE = '22023', HINT = 'Feature flag slice_3_enabled is OFF.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF p_method IS NULL OR p_method NOT IN ('transferencia','nequi','daviplata','pse','tarjeta') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '22023',
      HINT = 'Allowed: transferencia, nequi, daviplata, pse, tarjeta (client-facing).';
  END IF;

  IF p_proof_url IS NULL OR trim(p_proof_url) = '' THEN
    RAISE EXCEPTION 'proof_url_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quot
  FROM public.quotations
  WHERE public_token = p_token AND deleted_at IS NULL
  FOR UPDATE;

  IF v_quot.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quot.short_code IS NULL THEN
    RAISE EXCEPTION 'short_code_inactive' USING ERRCODE = '22023';
  END IF;

  IF v_quot.status NOT IN ('client_approved'::quotation_status,
                           'pending_payment_verification'::quotation_status,
                           'approved'::quotation_status) THEN
    RAISE EXCEPTION 'invalid_state_for_payment_proof'
      USING ERRCODE = '22023', DETAIL = format('status=%s', v_quot.status);
  END IF;

  IF v_quot.valid_until IS NOT NULL AND v_quot.valid_until < now()
     AND v_quot.status <> 'approved'::quotation_status THEN
    RAISE EXCEPTION 'quotation_expired' USING ERRCODE = '22023';
  END IF;

  v_below := (p_amount < (v_quot.total_amount * public.get_suggested_advance_pct() / 100));

  -- Insertar payment pending.
  INSERT INTO public.payments (
    quotation_id, client_id, project_id,
    amount, payment_method, payment_type,
    proof_url, notes,
    verification_status, payment_source,
    below_suggested,
    received_at
  )
  VALUES (
    v_quot.id, v_quot.client_id,
    (SELECT id FROM public.projects WHERE approved_quotation_id = v_quot.id AND deleted_at IS NULL LIMIT 1),
    p_amount,
    p_method::public.payment_method,
    CASE WHEN v_quot.status = 'approved'::quotation_status THEN 'installment' ELSE 'advance' END,
    p_proof_url, NULLIF(trim(p_notes), ''),
    'pending', 'client_upload',
    v_below,
    now()
  )
  RETURNING id INTO v_payment_id;

  -- Si era client_approved → mover a pending_payment_verification.
  IF v_quot.status = 'client_approved'::quotation_status THEN
    UPDATE public.quotations
    SET status = 'pending_payment_verification'::quotation_status,
        updated_at = now()
    WHERE id = v_quot.id;
  END IF;

  -- Notif in-app al admin creador opportunity (o todos los admin si no se identifica).
  v_admin := (
    SELECT created_by FROM public.opportunities
    WHERE id = v_quot.opportunity_id AND created_by IS NOT NULL
    LIMIT 1
  );

  IF v_admin IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url, priority)
    VALUES (
      v_admin,
      'Comprobante de pago recibido',
      format('El cliente subió comprobante por $%s para cotización N° %s.',
             to_char(p_amount, 'FM999G999G999'),
             COALESCE(v_quot.quotation_number, '?')),
      'payment_proof_uploaded', 'payments', v_payment_id,
      '/pagos?tab=por-verificar', 1
    );
  ELSE
    INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url, priority)
    SELECT p.id,
           'Comprobante de pago recibido',
           format('Comprobante por $%s para cotización N° %s.',
                  to_char(p_amount, 'FM999G999G999'),
                  COALESCE(v_quot.quotation_number, '?')),
           'payment_proof_uploaded', 'payments', v_payment_id,
           '/pagos?tab=por-verificar', 1
    FROM public.profiles p
    WHERE p.role IN ('admin'::user_role, 'super_admin'::user_role) AND p.is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'quotation_status', (SELECT status FROM public.quotations WHERE id = v_quot.id),
    'below_suggested', v_below
  );
END $$;

REVOKE ALL ON FUNCTION public.submit_quotation_payment_proof(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quotation_payment_proof(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =============================================================================
-- 11) RPC — verify_payment (ADMIN — convierte primer pago en proyecto + asigna diseñador)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_payment(
  p_payment_id   UUID,
  p_designer_id  UUID DEFAULT NULL,
  p_payment_type TEXT DEFAULT NULL  -- 'advance' | 'installment' | 'final' — opcional, default ya gestionado por trigger
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          public.user_role;
  v_payment       public.payments%ROWTYPE;
  v_project_id    UUID;
  v_designer      public.profiles%ROWTYPE;
  v_client        public.clients%ROWTYPE;
  v_project_name  TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT public.get_feature_flag('slice_3_enabled') THEN
    RAISE EXCEPTION 'slice_3_disabled' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.verification_status = 'verified' THEN
    RAISE EXCEPTION 'already_verified' USING ERRCODE = '22023';
  END IF;

  -- Validar designer si vino: debe existir, ser activo, y rol diseno.
  IF p_designer_id IS NOT NULL THEN
    SELECT * INTO v_designer FROM public.profiles
    WHERE id = p_designer_id AND is_active = true AND role = 'diseno'::user_role;
    IF v_designer.id IS NULL THEN
      RAISE EXCEPTION 'invalid_designer' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Validar payment_type si vino.
  IF p_payment_type IS NOT NULL AND p_payment_type NOT IN ('advance','installment','final','refund') THEN
    RAISE EXCEPTION 'invalid_payment_type' USING ERRCODE = '22023';
  END IF;

  -- Actualizar payment → verified. El trigger convert_quotation_to_project se dispara.
  UPDATE public.payments
  SET verification_status = 'verified',
      verified_by         = auth.uid(),
      verified_at         = now(),
      payment_type        = COALESCE(p_payment_type, payment_type)
  WHERE id = p_payment_id;

  -- Después del trigger, el payment tiene project_id seteado.
  SELECT project_id INTO v_project_id FROM public.payments WHERE id = p_payment_id;

  -- Si vino designer y proyecto recién creado/existente sin designer: asignar.
  IF p_designer_id IS NOT NULL AND v_project_id IS NOT NULL THEN
    UPDATE public.projects
    SET designer_id = p_designer_id,
        updated_at  = now()
    WHERE id = v_project_id
      AND (designer_id IS NULL OR designer_id <> p_designer_id);

    -- Encolar WA al diseñador (template a aprobar; fallará gracefully si no existe).
    SELECT * INTO v_client FROM public.clients
    WHERE id = (SELECT client_id FROM public.projects WHERE id = v_project_id);

    SELECT name INTO v_project_name FROM public.projects WHERE id = v_project_id;

    IF v_designer.whatsapp_phone IS NOT NULL AND trim(v_designer.whatsapp_phone) <> '' THEN
      INSERT INTO public.notification_queue (
        event_type, event_reference_id,
        entity_type, entity_reference_id,
        recipient_type, recipient_reference_id, recipient_name, recipient_phone,
        channel, provider,
        template_name, template_language, template_parameters,
        payload, dedup_key
      )
      VALUES (
        'project.designer_assigned', v_project_id::text,
        'project',                    v_project_id::text,
        'designer', v_designer.id::text, split_part(v_designer.full_name, ' ', 1), v_designer.whatsapp_phone,
        'whatsapp', 'meta_whatsapp',
        'project_assigned_designer_v1', 'es',
        jsonb_build_array(
          COALESCE(split_part(v_designer.full_name, ' ', 1), 'Equipo'),
          COALESCE(v_client.name, 'Cliente'),
          format('/proyectos/%s', v_project_id)
        ),
        jsonb_build_object('project_id', v_project_id, 'designer_id', v_designer.id),
        'project_assigned:' || v_project_id::text || ':' || v_designer.id::text
      )
      ON CONFLICT (dedup_key) DO NOTHING;
    END IF;

    -- Notif in-app al diseñador.
    INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url, priority)
    VALUES (
      v_designer.id,
      'Te asignaron un proyecto',
      format('Te asignaron el proyecto «%s».', COALESCE(v_project_name, 'sin nombre')),
      'project_assigned', 'projects', v_project_id,
      format('/proyectos/%s', v_project_id), 2
    );
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs ("userId", "userName", action, "tableName", "recordId", "changesSummary", "timestamp")
  SELECT auth.uid(),
         (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
         'payment_verified', 'payments', p_payment_id::text,
         format('amount=%s designer=%s payment_type=%s',
                v_payment.amount,
                COALESCE(p_designer_id::text, 'none'),
                COALESCE(p_payment_type, 'auto')),
         now();

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', p_payment_id,
    'project_id', v_project_id,
    'designer_id', p_designer_id
  );
END $$;

REVOKE ALL ON FUNCTION public.verify_payment(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_payment(UUID, UUID, TEXT) TO authenticated;

-- =============================================================================
-- 12) RPC — reject_payment (ADMIN — rechaza comprobante con motivo, WA al cliente)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_payment(
  p_payment_id UUID,
  p_reason     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     public.user_role;
  v_payment  public.payments%ROWTYPE;
  v_quot     public.quotations%ROWTYPE;
  v_client   public.clients%ROWTYPE;
  v_first    TEXT;
  v_link     TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT public.get_feature_flag('slice_3_enabled') THEN
    RAISE EXCEPTION 'slice_3_disabled' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_too_short' USING ERRCODE = '22023', HINT = 'Minimum 10 chars.';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'only_pending_payments_can_be_rejected' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payments
  SET verification_status = 'rejected',
      rejection_reason    = trim(p_reason),
      rejected_by         = auth.uid(),
      rejected_at         = now()
  WHERE id = p_payment_id;

  -- Quotation vuelve a client_approved si estaba pending_payment_verification.
  SELECT * INTO v_quot FROM public.quotations WHERE id = v_payment.quotation_id;
  IF v_quot.status = 'pending_payment_verification'::quotation_status THEN
    UPDATE public.quotations
    SET status = 'client_approved'::quotation_status,
        updated_at = now()
    WHERE id = v_quot.id;
  END IF;

  -- WA al cliente con razón + link reintento.
  SELECT * INTO v_client FROM public.clients WHERE id = v_quot.client_id;
  IF v_client.whatsapp_phone IS NOT NULL AND trim(v_client.whatsapp_phone) <> '' THEN
    v_first := split_part(COALESCE(v_client.name, 'Cliente'), ' ', 1);
    v_link := format('%s/c/%s',
                     COALESCE((SELECT (value->>'url') FROM public.system_settings WHERE key='public_app_base_url'),
                              'https://crm-innovar-app-2026.vercel.app'),
                     v_quot.short_code);

    INSERT INTO public.notification_queue (
      event_type, event_reference_id, entity_type, entity_reference_id,
      recipient_type, recipient_reference_id, recipient_name, recipient_phone,
      channel, provider,
      template_name, template_language, template_parameters,
      payload, dedup_key
    )
    VALUES (
      'payment.proof_rejected', p_payment_id::text,
      'payment',                p_payment_id::text,
      'client', v_client.id::text, v_first, v_client.whatsapp_phone,
      'whatsapp', 'meta_whatsapp',
      'payment_proof_rejected_v1', 'es',
      jsonb_build_array(v_first, COALESCE(v_quot.quotation_number,'?'), trim(p_reason), v_link),
      jsonb_build_object('payment_id', p_payment_id, 'quotation_id', v_quot.id),
      'payment_rejected:' || p_payment_id::text
    )
    ON CONFLICT (dedup_key) DO NOTHING;
  END IF;

  -- Audit
  INSERT INTO public.audit_logs ("userId","userName",action,"tableName","recordId","changesSummary","timestamp")
  SELECT auth.uid(),
         (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
         'payment_rejected', 'payments', p_payment_id::text,
         format('reason="%s"', trim(p_reason)),
         now();

  RETURN jsonb_build_object('ok', true, 'payment_id', p_payment_id);
END $$;

REVOKE ALL ON FUNCTION public.reject_payment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_payment(UUID, TEXT) TO authenticated;

-- =============================================================================
-- 13) RPC — register_manual_payment (ADMIN — efectivo / cheque / depósito presencial)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.register_manual_payment(
  p_quotation_id  UUID,
  p_amount        NUMERIC,
  p_method        TEXT,
  p_payment_type  TEXT DEFAULT NULL,
  p_designer_id   UUID DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      public.user_role;
  v_quot      public.quotations%ROWTYPE;
  v_payment_id UUID;
  v_below     BOOLEAN := false;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT public.get_feature_flag('slice_3_enabled') THEN
    RAISE EXCEPTION 'slice_3_disabled' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  IF p_method IS NULL OR p_method NOT IN ('efectivo','cheque','transferencia','nequi','daviplata','tarjeta','pse') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;
  IF v_quot.id IS NULL THEN
    RAISE EXCEPTION 'quotation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quot.status NOT IN ('client_approved'::quotation_status,
                           'pending_payment_verification'::quotation_status,
                           'approved'::quotation_status) THEN
    RAISE EXCEPTION 'invalid_state_for_manual_payment' USING ERRCODE = '22023',
      DETAIL = format('status=%s', v_quot.status);
  END IF;

  v_below := (p_amount < (v_quot.total_amount * public.get_suggested_advance_pct() / 100));

  -- Insert directo como verified (no pasa por pending). El trigger convert_quotation_to_project
  -- se dispara igual y crea el proyecto si es el primero.
  INSERT INTO public.payments (
    quotation_id, client_id, project_id,
    amount, payment_method,
    payment_type,
    verification_status, payment_source,
    below_suggested,
    registered_by, verified_by, verified_at,
    notes, received_at
  )
  VALUES (
    v_quot.id, v_quot.client_id,
    (SELECT id FROM public.projects WHERE approved_quotation_id = v_quot.id AND deleted_at IS NULL LIMIT 1),
    p_amount,
    p_method::public.payment_method,
    COALESCE(p_payment_type,
             CASE WHEN v_quot.status = 'approved'::quotation_status THEN 'installment' ELSE 'advance' END),
    'verified', 'admin_manual',
    v_below,
    auth.uid(), auth.uid(), now(),
    NULLIF(trim(p_notes), ''), now()
  )
  RETURNING id INTO v_payment_id;

  -- Si admin asignó designer, aplicamos como en verify_payment.
  IF p_designer_id IS NOT NULL THEN
    PERFORM public.verify_payment(v_payment_id, p_designer_id, COALESCE(p_payment_type,
             CASE WHEN v_quot.status = 'approved'::quotation_status THEN 'installment' ELSE 'advance' END));
  END IF;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id);
END $$;

REVOKE ALL ON FUNCTION public.register_manual_payment(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_manual_payment(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- =============================================================================
-- 14) RPC — cancel_quotation_acceptance (ADMIN — D9)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_quotation_acceptance(
  p_quotation_id UUID,
  p_reason       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_quot public.quotations%ROWTYPE;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_too_short' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;
  IF v_quot.id IS NULL THEN
    RAISE EXCEPTION 'quotation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quot.status NOT IN ('client_approved'::quotation_status,
                           'pending_payment_verification'::quotation_status) THEN
    RAISE EXCEPTION 'invalid_state_for_cancel'
      USING ERRCODE = '22023', DETAIL = format('status=%s (only client_approved/pending_payment_verification allowed)', v_quot.status);
  END IF;

  UPDATE public.quotations
  SET status              = 'cancelled'::quotation_status,
      cancellation_reason = trim(p_reason),
      cancelled_by        = auth.uid(),
      cancelled_at        = now(),
      updated_at          = now()
  WHERE id = p_quotation_id;
  -- El trigger fn_sync_opportunity_from_quotation pasa la opp a lost / cancelled_after_approval.
  -- El trigger fn_quotation_invalidate_short_code setea short_code = NULL.

  INSERT INTO public.audit_logs ("userId","userName",action,"tableName","recordId","changesSummary","timestamp")
  SELECT auth.uid(),
         (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
         'quotation_cancelled', 'quotations', p_quotation_id::text,
         format('reason="%s"', trim(p_reason)),
         now();

  RETURN jsonb_build_object('ok', true, 'quotation_id', p_quotation_id);
END $$;

REVOKE ALL ON FUNCTION public.cancel_quotation_acceptance(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_quotation_acceptance(UUID, TEXT) TO authenticated;

-- =============================================================================
-- 15) RPC — create_quotation_revision (ADMIN — D3 versionado V2)
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

  -- Copiar fila de quotations como V2 draft.
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

  -- Copiar quotation_items.
  INSERT INTO public.quotation_items
  SELECT
    gen_random_uuid() AS id,
    v_v2_id AS quotation_id,
    -- Resto de columnas copiadas tal cual:
    item_type, name, description, unit_price, quantity,
    total_price, sort_order, configuration, created_at, updated_at
  FROM public.quotation_items
  WHERE quotation_id = v_v1.id;

  -- Marcar V1 como superseded.
  UPDATE public.quotations
  SET status                     = 'superseded'::quotation_status,
      is_locked                  = true,
      superseded_at              = now(),
      superseded_by_quotation_id = v_v2_id,
      updated_at                 = now()
  WHERE id = v_v1.id;
  -- Trigger fn_quotation_invalidate_short_code setea short_code = NULL en V1.

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

-- =============================================================================
-- 16) RPC — reactivate_expired_quotation (ADMIN — D4 botón "Reactivar")
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reactivate_expired_quotation(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_quot public.quotations%ROWTYPE;
  v_new_short_code TEXT;
BEGIN
  v_role := public.get_my_role();
  IF v_role IS NULL OR v_role NOT IN ('admin'::user_role, 'super_admin'::user_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = p_quotation_id AND deleted_at IS NULL FOR UPDATE;
  IF v_quot.id IS NULL THEN
    RAISE EXCEPTION 'quotation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_quot.status <> 'expired'::quotation_status THEN
    RAISE EXCEPTION 'only_expired_can_be_reactivated' USING ERRCODE = '22023';
  END IF;

  -- Re-emitir short_code (el trigger lo había invalidado).
  v_new_short_code := COALESCE(v_quot.short_code, public.generate_unique_quotation_short_code());

  UPDATE public.quotations
  SET status              = 'client_approved'::quotation_status,
      client_approved_at  = now(),
      short_code          = v_new_short_code,
      valid_until         = now() + INTERVAL '30 days',
      updated_at          = now()
  WHERE id = p_quotation_id;

  INSERT INTO public.audit_logs ("userId","userName",action,"tableName","recordId","changesSummary","timestamp")
  SELECT auth.uid(),
         (SELECT full_name FROM public.profiles WHERE id = auth.uid()),
         'quotation_reactivated', 'quotations', p_quotation_id::text,
         format('short_code=%s', v_new_short_code),
         now();

  RETURN jsonb_build_object('ok', true, 'short_code', v_new_short_code);
END $$;

REVOKE ALL ON FUNCTION public.reactivate_expired_quotation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_expired_quotation(UUID) TO authenticated;

COMMIT;

-- =============================================================================
-- END 037_slice3_payment_flow.sql
-- =============================================================================
