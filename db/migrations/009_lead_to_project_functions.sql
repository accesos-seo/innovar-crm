-- =====================================================
-- 009 — Lead → Project Flow · Funciones helper
-- =====================================================
-- Requiere: 008_lead_to_project_schema.sql aplicado
-- Siguiente: 010_lead_to_project_triggers.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. validate_public_token(token, scope) — valida tokens públicos
-- =====================================================
-- scope ∈ ('book_visit','submit_measurements','approve_quotation')
-- Retorna el row_id válido o NULL.
CREATE OR REPLACE FUNCTION public.validate_public_token(p_token TEXT, p_scope TEXT)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  CASE p_scope
    WHEN 'book_visit' THEN
      SELECT o.id INTO v_id
        FROM public.opportunities o
       WHERE o.public_token = p_token
         AND o.deleted_at IS NULL
         AND o.status IN ('new','contacted');

    WHEN 'submit_measurements' THEN
      SELECT v.id INTO v_id
        FROM public.visits v
       WHERE v.public_token = p_token
         AND v.deleted_at IS NULL
         AND v.modality = 'foto_remota'
         AND v.status = 'agendada';

    WHEN 'approve_quotation' THEN
      SELECT q.id INTO v_id
        FROM public.quotations q
       WHERE q.public_token = p_token
         AND q.deleted_at IS NULL
         AND q.status = 'sent'
         AND (q.valid_until IS NULL OR q.valid_until > CURRENT_DATE);

    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- 2. get_suggested_advance_pct() — lee de system_settings
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_suggested_advance_pct()
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT (value->>'pct')::NUMERIC FROM public.system_settings WHERE key = 'suggested_min_advance_pct'),
    30
  );
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- 3. calculate_refund_percentage(project_id) — política devolución
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_refund_percentage(p_project_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_mat   TIMESTAMPTZ;
  v_fab   TIMESTAMPTZ;
  v_ctd   TIMESTAMPTZ;
BEGIN
  SELECT materials_purchased_at, fabrication_started_at, created_at
    INTO v_mat, v_fab, v_ctd
    FROM public.projects
   WHERE id = p_project_id;

  IF v_fab IS NOT NULL THEN
    RETURN 0;
  ELSIF v_mat IS NOT NULL THEN
    RETURN 50;
  ELSIF v_ctd >= NOW() - INTERVAL '7 days' OR v_mat IS NULL THEN
    RETURN 90;
  ELSE
    RETURN 50;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 4. get_visit_slots(commercial_id, from_date, to_date)
-- =====================================================
-- Devuelve los 4 slots de Mar/Jue por día dentro del rango,
-- excluyendo holidays y slots ya ocupados.
CREATE OR REPLACE FUNCTION public.get_visit_slots(
  p_commercial_id UUID,
  p_from DATE,
  p_to   DATE
)
RETURNS TABLE (slot_start TIMESTAMPTZ, is_available BOOLEAN) AS $$
DECLARE
  v_slot_times TIME[] := ARRAY['09:00','11:00','13:30','15:30']::TIME[];
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT d::DATE AS day
      FROM generate_series(p_from, p_to, '1 day'::INTERVAL) d
     WHERE EXTRACT(DOW FROM d) IN (2, 4)
       AND NOT EXISTS (SELECT 1 FROM public.holidays h WHERE h.date = d::DATE)
  ),
  expanded AS (
    SELECT (d.day + t)::TIMESTAMPTZ AS slot_start
      FROM days d
     CROSS JOIN unnest(v_slot_times) t
  )
  SELECT e.slot_start,
         NOT EXISTS (
           SELECT 1 FROM public.visits v
            WHERE v.visited_by = p_commercial_id
              AND v.scheduled_at = e.slot_start
              AND v.status NOT IN ('cancelada','no_show')
              AND v.deleted_at IS NULL
         ) AS is_available
    FROM expanded e
   ORDER BY e.slot_start;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. assign_commercial_round_robin() — trigger function
-- =====================================================
-- Asigna el comercial menos saturado en últimas 24h, activo,
-- excluyendo holidays para HOY (excepción manual permitida).
CREATE OR REPLACE FUNCTION public.assign_commercial_round_robin()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id
    INTO v_user_id
    FROM public.profiles p
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) AS recent_count
        FROM public.opportunities
       WHERE created_at >= NOW() - INTERVAL '24 hours'
         AND deleted_at IS NULL
       GROUP BY assigned_to
    ) c ON c.assigned_to = p.id
   WHERE p.role = 'comercial'
     AND p.is_active = true
   ORDER BY COALESCE(c.recent_count, 0) ASC, p.created_at ASC
   LIMIT 1;

  NEW.assigned_to := v_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. validate_opportunity_transition() — trigger function
-- =====================================================
-- Rechaza transiciones de status no permitidas.
CREATE OR REPLACE FUNCTION public.validate_opportunity_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_valid BOOLEAN := false;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Transición a 'lost' siempre permitida desde estados no terminales.
  IF NEW.status = 'lost' AND OLD.status NOT IN ('converted_to_project','cancelled_after_approval','lost') THEN
    v_valid := true;
  END IF;

  -- Mapa explícito de transiciones válidas.
  IF NOT v_valid THEN
    v_valid := CASE OLD.status || '|' || NEW.status
      WHEN 'new|contacted'                              THEN true
      WHEN 'contacted|visit_scheduled'                  THEN true
      WHEN 'visit_scheduled|visit_completed'            THEN true
      WHEN 'visit_completed|quoted'                     THEN true
      WHEN 'quoted|sent_to_client'                      THEN true
      WHEN 'sent_to_client|client_approved'             THEN true
      WHEN 'sent_to_client|quoted'                      THEN true  -- nueva versión, vuelve a draft
      WHEN 'client_approved|pending_payment_verification' THEN true
      WHEN 'pending_payment_verification|approved'      THEN true
      WHEN 'pending_payment_verification|sent_to_client' THEN true -- admin rechaza comprobante
      WHEN 'approved|converted_to_project'              THEN true
      WHEN 'converted_to_project|cancelled_after_approval' THEN true
      ELSE false
    END;
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Transición no permitida: % → %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  -- Actualizar last_activity_at automáticamente.
  NEW.last_activity_at := NOW();

  -- Marcar lost_at si entra a lost.
  IF NEW.status = 'lost' AND OLD.status <> 'lost' THEN
    NEW.lost_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. visit_to_task_mirror() — trigger function
-- =====================================================
-- Espejo de visits en tasks para que la agenda actual siga funcionando.
-- Fuente de verdad: visits. tasks es view-like.
CREATE OR REPLACE FUNCTION public.visit_to_task_mirror()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id  UUID;
  v_full_name  TEXT;
BEGIN
  SELECT o.client_id INTO v_client_id
    FROM public.opportunities o WHERE o.id = NEW.opportunity_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tasks (
      id, client_id, assigned_to, created_by,
      title, status, due_date, time_slot, appointment_type, task_category
    )
    VALUES (
      NEW.id,                                       -- mismo UUID que la visit
      v_client_id,
      NEW.visited_by,
      NEW.created_by,
      'Visita ' || NEW.modality,
      CASE NEW.status
        WHEN 'agendada' THEN 'pendiente'
        WHEN 'confirmada' THEN 'pendiente'
        WHEN 'realizada' THEN 'completada'
        WHEN 'cancelada' THEN 'cancelada'
        WHEN 'no_show' THEN 'cancelada'
        ELSE 'pendiente'
      END,
      NEW.scheduled_at::DATE,
      to_char(NEW.scheduled_at, 'HH24:MI'),
      'visita',
      'visit_mirror'
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.tasks
       SET assigned_to    = NEW.visited_by,
           due_date       = NEW.scheduled_at::DATE,
           time_slot      = to_char(NEW.scheduled_at, 'HH24:MI'),
           status         = CASE NEW.status
                              WHEN 'agendada' THEN 'pendiente'
                              WHEN 'confirmada' THEN 'pendiente'
                              WHEN 'realizada' THEN 'completada'
                              WHEN 'cancelada' THEN 'cancelada'
                              WHEN 'no_show' THEN 'cancelada'
                              ELSE 'pendiente'
                            END,
           completed_at   = CASE WHEN NEW.status = 'realizada' THEN COALESCE(NEW.realized_at, NOW()) ELSE NULL END,
           updated_at     = NOW()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. auto_generate_quotation() — trigger function (stub)
-- =====================================================
-- Cuando una visit pasa a 'realizada', crea una quotation v1 en estado
-- draft con quotation_type='initial'. El cálculo real de items vive en
-- la edge function `auto_generate_quotation` que Supabase Webhooks
-- dispara al detectar el INSERT en quotations con status='draft' y
-- bypass=false. Aquí solo creamos el esqueleto.
CREATE OR REPLACE FUNCTION public.auto_generate_quotation()
RETURNS TRIGGER AS $$
DECLARE
  v_opp        public.opportunities%ROWTYPE;
  v_quot_id    UUID;
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
    quotation_type, is_locked, valid_until, notes, created_by
  )
  VALUES (
    v_opp.client_id,
    v_opp.id,
    'draft',
    1,
    'initial',
    false,
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    'Generada automáticamente desde visita ' || NEW.id || '. Revisar items.',
    v_opp.assigned_to
  )
  RETURNING id INTO v_quot_id;

  -- Mover opportunity a 'quoted'.
  UPDATE public.opportunities
     SET status = 'quoted'
   WHERE id = v_opp.id
     AND status IN ('visit_completed','visit_scheduled');

  -- TODO: La edge function `auto_generate_quotation` (configurada vía
  -- Supabase Database Webhook AFTER INSERT en quotations cuando
  -- quotation_type='initial' AND version_number=1) llena los items
  -- corriendo las calculadoras sobre visits.measurements.

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. mark_visit_completed_on_data() — trigger function
-- =====================================================
-- Cuando la visit recibe medidas y >=3 fotos, propone 'realizada'.
-- NO la marca sola — el comercial debe confirmar. Solo valida que los
-- datos mínimos estén presentes si alguien la marca como realizada.
CREATE OR REPLACE FUNCTION public.validate_visit_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'realizada' AND (OLD.status IS NULL OR OLD.status <> 'realizada') THEN
    IF NEW.measurements IS NULL OR NEW.measurements = '{}'::jsonb THEN
      RAISE EXCEPTION 'No se puede marcar visita como realizada sin medidas'
        USING ERRCODE = '23514';
    END IF;
    IF jsonb_array_length(COALESCE(NEW.photos, '[]'::jsonb)) < 3 THEN
      RAISE EXCEPTION 'Se requieren al menos 3 fotos para marcar visita como realizada'
        USING ERRCODE = '23514';
    END IF;
    NEW.realized_at := COALESCE(NEW.realized_at, NOW());
  END IF;

  -- Propagar status a la opportunity ligada.
  IF NEW.status IN ('agendada','reagendada') AND (OLD.status IS NULL OR OLD.status NOT IN ('agendada','reagendada')) THEN
    UPDATE public.opportunities
       SET status = 'visit_scheduled'
     WHERE id = NEW.opportunity_id
       AND status IN ('new','contacted');
  ELSIF NEW.status = 'realizada' AND (OLD.status IS NULL OR OLD.status <> 'realizada') THEN
    UPDATE public.opportunities
       SET status = 'visit_completed'
     WHERE id = NEW.opportunity_id
       AND status = 'visit_scheduled';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. convert_quotation_to_project() — trigger function
-- =====================================================
-- Cuando un payment pasa a verification_status='verified' y es el primer
-- pago verificado de la quotation, crea el project y bloquea cotización.
CREATE OR REPLACE FUNCTION public.convert_quotation_to_project()
RETURNS TRIGGER AS $$
DECLARE
  v_quot        public.quotations%ROWTYPE;
  v_opp         public.opportunities%ROWTYPE;
  v_existing    UUID;
  v_project_id  UUID;
  v_measurements JSONB;
  v_first_visit UUID;
BEGIN
  -- Solo actuamos al pasar a verified.
  IF NEW.verification_status <> 'verified'
     OR (OLD.verification_status IS NOT NULL AND OLD.verification_status = 'verified')
     OR NEW.quotation_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.verified_at := COALESCE(NEW.verified_at, NOW());

  -- Idempotencia: si ya hay project ligado a esta quotation, salir.
  SELECT id INTO v_existing FROM public.projects WHERE approved_quotation_id = NEW.quotation_id AND deleted_at IS NULL LIMIT 1;
  IF v_existing IS NOT NULL THEN
    -- Aun así actualizamos below_suggested si aplica.
    NEW.below_suggested := (NEW.amount < (
      SELECT total_amount * public.get_suggested_advance_pct() / 100
        FROM public.quotations WHERE id = NEW.quotation_id
    ));
    RETURN NEW;
  END IF;

  SELECT * INTO v_quot FROM public.quotations WHERE id = NEW.quotation_id;
  IF v_quot.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo conversión cuando es initial; addendums siguen otro flujo.
  IF v_quot.quotation_type <> 'initial' THEN
    RETURN NEW;
  END IF;

  -- Calcular below_suggested.
  NEW.below_suggested := (NEW.amount < (v_quot.total_amount * public.get_suggested_advance_pct() / 100));

  SELECT * INTO v_opp FROM public.opportunities WHERE id = v_quot.opportunity_id;

  -- Heredar measurements de la última visita realizada de la oportunidad.
  SELECT id, measurements
    INTO v_first_visit, v_measurements
    FROM public.visits
   WHERE opportunity_id = v_opp.id
     AND status = 'realizada'
     AND deleted_at IS NULL
   ORDER BY realized_at DESC NULLS LAST
   LIMIT 1;

  -- 1. Crear project.
  INSERT INTO public.projects (
    client_id, approved_quotation_id, opportunity_id,
    name, work_type, status,
    total_amount, advance_amount,
    initial_measurements, data_origin, created_by,
    client_approved_at
  )
  VALUES (
    v_opp.client_id,
    v_quot.id,
    v_opp.id,
    COALESCE(
      (SELECT array_to_string(services, ', ') || ' - ' || c.name
         FROM public.clients c WHERE c.id = v_opp.client_id),
      'Proyecto sin nombre'
    ),
    array_to_string(v_opp.services, ', '),
    'cotizacion_aprobada',
    v_quot.total_amount,
    NEW.amount,
    v_measurements,
    'system',
    NEW.verified_by,
    NOW()
  )
  RETURNING id INTO v_project_id;

  -- 2. Bloquear quotation + status approved.
  UPDATE public.quotations
     SET status = 'approved',
         is_locked = true,
         project_id = v_project_id,
         updated_at = NOW()
   WHERE id = v_quot.id;

  -- 3. Actualizar opportunity.
  UPDATE public.opportunities
     SET status = 'converted_to_project',
         updated_at = NOW()
   WHERE id = v_opp.id;

  -- 4. Ligar el payment al project recién creado.
  NEW.project_id := v_project_id;

  -- 5. Notificación al equipo de diseño (insert directo).
  INSERT INTO public.notifications (user_id, title, body, notification_type, related_table, related_id, action_url)
  SELECT p.id,
         'Nuevo proyecto creado',
         'Se aprobó cotización y se creó proyecto: ' || (SELECT name FROM public.projects WHERE id = v_project_id),
         'project_created',
         'projects',
         v_project_id,
         '/projects/' || v_project_id
    FROM public.profiles p
   WHERE p.role IN ('admin','diseñador','disenador')
     AND p.is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. mark_quotation_historical_on_new_version()
-- =====================================================
-- Cuando se inserta una nueva version_number de una quotation, marca
-- la previa como is_historical_copy=true.
CREATE OR REPLACE FUNCTION public.mark_quotation_historical_on_new_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_quotation_id IS NOT NULL AND NEW.version_number > 1 THEN
    UPDATE public.quotations
       SET is_historical_copy = true
     WHERE parent_quotation_id = NEW.parent_quotation_id
       AND version_number < NEW.version_number
       AND id <> NEW.id;

    -- También marcar el padre directo.
    UPDATE public.quotations
       SET is_historical_copy = true
     WHERE id = NEW.parent_quotation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. log_opportunity_assignment_change()
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_opportunity_assignment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.opportunity_assignment_history (
      opportunity_id, from_user, to_user, changed_by, reason
    )
    VALUES (
      NEW.id,
      OLD.assigned_to,
      NEW.assigned_to,
      COALESCE(auth.uid(), NEW.assigned_to),
      'Reasignación'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- FIN 009 · Funciones helper aplicadas
-- Siguiente: 010_lead_to_project_triggers.sql
-- =====================================================
