-- Migración 023 — `book_public_visit` usa el visitante por defecto (Fase 3 · Slice 1)
--
-- Fix del bug latente confirmado en la auditoría 2026-05-23:
--   La versión original (creada en migración 014) asigna `visited_by = v_ctx.staff_id`,
--   donde `v_ctx.staff_id = opportunities.assigned_to` (el comercial del round-robin).
--   Consecuencia: la visita queda en el calendario del comercial, no del admin que
--   realmente visita.
--
-- Fix: usar `COALESCE(public.get_default_visitor(), v_ctx.staff_id)` para que el
-- admin default tome la visita; si por alguna razón no hay default configurado,
-- preserva el fallback histórico (no rompe nada).
--
-- Resto del cuerpo idéntico al original — solo cambia esa línea.

BEGIN;

CREATE OR REPLACE FUNCTION public.book_public_visit(
  p_token text,
  p_scheduled_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx        RECORD;
  v_existing   UUID;
  v_visit_id   UUID;
  v_visitor    UUID;
BEGIN
  -- 1. Validar contexto
  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token);
  IF v_ctx.opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Este link ya no es válido. Contacta a Innovar.'
      USING ERRCODE = '22023';
  END IF;

  IF v_ctx.staff_id IS NULL THEN
    RAISE EXCEPTION 'No hay comercial asignado a esta oportunidad.'
      USING ERRCODE = '22023';
  END IF;

  -- 2. Resolver visitante por defecto (admin) con fallback al staff comercial.
  v_visitor := COALESCE(public.get_default_visitor(), v_ctx.staff_id);

  -- 3. Validar que el slot solicitado todavía esté disponible para el visitante real.
  --    Nota: la verificación se hace contra `visited_by` (no contra staff_id como en
  --    la versión original) porque ese es ahora el dueño efectivo del slot.
  SELECT v.id INTO v_existing
    FROM public.visits v
   WHERE v.visited_by = v_visitor
     AND v.scheduled_at = p_scheduled_at
     AND v.status NOT IN ('cancelada','no_show')
     AND v.deleted_at IS NULL
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Ese horario ya no está disponible. Por favor elige otro.'
      USING ERRCODE = '23505';
  END IF;

  -- 4. Crear visit. duration_minutes=90 es default del schema.
  --    visited_by = admin default; staff_id (comercial) sigue siendo dueño de la opp.
  INSERT INTO public.visits (
    opportunity_id, scheduled_at, visited_by, modality,
    status, scheduled_via, created_by, notes
  ) VALUES (
    v_ctx.opportunity_id,
    p_scheduled_at,
    v_visitor,
    'presencial',
    'agendada',
    'public_link',
    v_ctx.staff_id,  -- atribución: el comercial figura como creador (cerró la conversación)
    'Agendada por el cliente desde link público (WhatsApp).'
  )
  RETURNING id INTO v_visit_id;

  -- 5. Devolver datos para la pantalla de confirmación (sigue mostrando al comercial
  --    como asesor — el admin como visitante físico es transparente para el cliente).
  RETURN jsonb_build_object(
    'visit_id',     v_visit_id,
    'scheduled_at', p_scheduled_at,
    'staff_name',   v_ctx.staff_name,
    'client_name',  v_ctx.client_name
  );
END;
$function$;

-- Mantiene los grants originales (anon + authenticated pueden ejecutarla).
GRANT EXECUTE ON FUNCTION public.book_public_visit(text, timestamptz) TO anon, authenticated;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- Tras crear una opportunity QA con público válido y llamar book_public_visit:
--   SELECT visited_by FROM public.visits
--    WHERE opportunity_id = (SELECT id FROM opportunities ORDER BY created_at DESC LIMIT 1);
--   -- Debe devolver el UUID del admin default (09ca8b37-...), NO el comercial.

-- =============================================================================
-- Rollback (versión previa con bug latente — solo para emergencia)
-- =============================================================================
-- Ver migración 014. Restaurar reemplazando `v_visitor` por `v_ctx.staff_id` en
-- los 2 sitios (validación de slot + INSERT.visited_by).
