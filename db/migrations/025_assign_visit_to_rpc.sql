-- Migración 025 — RPC `assign_visit_to` + hardening de UPDATE sobre `visits` (Fase 3 · Slice 2)
--
-- Fundamento (D2 del plan Fase 3):
--   Solo administradores pueden reasignar quién va a una visita. Hoy las RLS de
--   `visits` permiten UPDATE de cualquier columna al admin, al comercial dueño
--   de la opportunity y al `visited_by`. Eso significa que un comercial puede
--   reasignarse visitas a sí mismo (riesgo).
--
-- Estrategia:
--   1. RPC `assign_visit_to(visit_id, new_visitor_id)` SECURITY DEFINER con check
--      explícito de rol admin/super_admin. Hace:
--        a) libera el availability_slot del visitante anterior (is_booked=false,
--           task_id=NULL).
--        b) UPDATE `visits.visited_by = p_new_visitor_id`, `scheduled_via='admin'`.
--           Los triggers existentes (visit_to_task_mirror UPDATE branch + sync_task_
--           availability_booking) re-asignan tasks.assigned_to y reservan el nuevo
--           slot al nuevo visitante.
--   2. Column-level GRANT: REVOKE UPDATE total + GRANT UPDATE solo sobre las
--      columnas operacionales. `visited_by` y `created_by` quedan no-actualizables
--      directamente desde clientes autenticados — la única vía válida es la RPC.

BEGIN;

-- =============================================================================
-- 1) RPC assign_visit_to — única vía para cambiar `visited_by`
-- =============================================================================

CREATE OR REPLACE FUNCTION public.assign_visit_to(
  p_visit_id uuid,
  p_new_visitor_id uuid
)
RETURNS public.visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role public.user_role;
  v_old         public.visits%ROWTYPE;
  v_visitor     RECORD;
  v_new         public.visits%ROWTYPE;
BEGIN
  -- 1.1 Auth check: solo admin/super_admin pueden reasignar.
  v_caller_role := public.get_my_role();
  IF v_caller_role NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden reasignar visitas (rol actual: %)', v_caller_role
      USING ERRCODE = '42501';
  END IF;

  -- 1.2 Validar visita existente y no eliminada.
  SELECT * INTO v_old
    FROM public.visits
   WHERE id = p_visit_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visita % no existe o fue eliminada', p_visit_id
      USING ERRCODE = '22023';
  END IF;

  -- 1.3 Validar nuevo visitante: profile activo con rol admin/super_admin/comercial.
  SELECT id, role, is_active INTO v_visitor
    FROM public.profiles
   WHERE id = p_new_visitor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % no existe', p_new_visitor_id
      USING ERRCODE = '22023';
  END IF;
  IF v_visitor.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Profile % no está activo', p_new_visitor_id
      USING ERRCODE = '22023';
  END IF;
  IF v_visitor.role NOT IN ('admin','super_admin','comercial') THEN
    RAISE EXCEPTION 'El visitante debe tener rol admin, super_admin o comercial (rol actual: %)', v_visitor.role
      USING ERRCODE = '22023';
  END IF;

  -- 1.4 Noop si no cambia nada.
  IF v_old.visited_by = p_new_visitor_id THEN
    RETURN v_old;
  END IF;

  -- 1.5 Liberar slot anterior (si existe). El task espejo conserva su id, por eso
  --     el slot anterior tiene task_id = visit_id.
  IF v_old.visited_by IS NOT NULL THEN
    UPDATE public.availability_slots
       SET is_booked = false,
           task_id   = NULL
     WHERE staff_id   = v_old.visited_by
       AND date       = v_old.scheduled_at::date
       AND start_time = v_old.scheduled_at::time;
  END IF;

  -- 1.6 UPDATE visits. El trigger visit_to_task_mirror (UPDATE branch) propaga
  --     a tasks.assigned_to y pre-crea el nuevo availability_slot.
  UPDATE public.visits
     SET visited_by    = p_new_visitor_id,
         scheduled_via = CASE
                           WHEN scheduled_via IN ('public_link') THEN scheduled_via
                           ELSE 'admin'
                         END,
         updated_at    = NOW()
   WHERE id = p_visit_id
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_visit_to(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_visit_to(uuid, uuid) FROM anon;

-- =============================================================================
-- 2) Column-level UPDATE hardening sobre public.visits
--    Comerciales y visitantes pueden actualizar campos operacionales pero NO
--    `visited_by`, `created_by`, `opportunity_id` ni `public_token` desde SQL
--    directo. Solo la RPC assign_visit_to (SECURITY DEFINER) puede cambiarlos.
-- =============================================================================

REVOKE UPDATE ON public.visits FROM authenticated, anon;

-- Columnas operacionales que sí pueden actualizarse vía SQL directo (sujetas a RLS).
GRANT UPDATE (
  measurements,
  photos,
  notes,
  status,
  modality,
  scheduled_at,
  duration_minutes,
  client_confirmed_at,
  realized_at,
  reschedule_count,
  is_exception,
  exception_reason,
  deleted_at,
  updated_at
) ON public.visits TO authenticated;

-- Anon mantiene solo INSERT (vía RPC pública book_public_visit, SECURITY DEFINER
-- corre como dueño y no usa estos grants). No reciben UPDATE de ninguna columna.

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
--
-- 1) RPC funcional (logueado como admin):
--    SELECT * FROM public.assign_visit_to('<visit_id>', '<other_admin_uuid>');
--    -- Debe devolver el row actualizado con visited_by = nuevo uuid.
--
-- 2) Restricción de rol (logueado como comercial):
--    SELECT * FROM public.assign_visit_to('<visit_id>', '<comercial_uuid>');
--    -- Debe fallar con SQLSTATE 42501 "Solo administradores pueden reasignar visitas".
--
-- 3) Hardening de columna (logueado como comercial):
--    UPDATE public.visits SET visited_by = '<other_uuid>' WHERE id = '<visit_id>';
--    -- Debe fallar con "permission denied for column visited_by".
--
-- 4) Operacional funciona (logueado como visitante):
--    UPDATE public.visits SET notes = 'test' WHERE id = '<visit_id>';
--    -- Debe pasar.

-- =============================================================================
-- Rollback
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.assign_visit_to(uuid, uuid);
-- GRANT UPDATE ON public.visits TO authenticated, anon;
-- (No revierte el cambio de scheduled_via aplicado a filas — sin daño.)
