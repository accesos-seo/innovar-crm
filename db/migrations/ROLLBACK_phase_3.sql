-- ROLLBACK Fase 3 (migraciones 022–028) — Visita técnica en sitio
--
-- ⚠️  Este script revierte TODO el trabajo de Fase 3. Úsalo como contención de
-- emergencia, no como flujo normal de mantenimiento. Cada migración tiene su
-- propio bloque "Rollback" comentado al pie — preferir revertir granularmente
-- una migración a la vez antes de tirar este script entero.
--
-- Pre-condiciones para que el rollback sea seguro:
--   - Frontend NO debe estar referenciando `assign_visit_to`, `/agenda/hoy`,
--     ni el bucket `visit_photos` cuando se ejecute, o las features rotas
--     dejan de funcionar inmediatamente.
--   - No debe haber filas en `visits` con scheduled_via='admin' antes de
--     revertir el CHECK (migración 024). Si las hay, normalizalas primero
--     a 'comercial' o 'public_link'.
--
-- Orden inverso: 028 → 027 → 026 → 025 → 024 → 023 → 022.

BEGIN;

-- ============================================================================
-- 028: summary + watchdog
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='visit-overdue-alerts') THEN
    PERFORM cron.unschedule('visit-overdue-alerts');
  END IF;
END$$;
DROP TRIGGER IF EXISTS trg_notify_visit_summary_client ON public.visits;
DROP FUNCTION IF EXISTS public.notify_visit_summary_client();
DROP FUNCTION IF EXISTS public.enqueue_visit_overdue_alerts();

-- ============================================================================
-- 027: storage bucket
-- ============================================================================
DROP POLICY IF EXISTS "visit_photos_delete_admin" ON storage.objects;
DROP POLICY IF EXISTS "visit_photos_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "visit_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "visit_photos_insert" ON storage.objects;
DROP FUNCTION IF EXISTS public.fn_can_access_visit_photo(text);
-- ⚠️ Borrar el bucket también borra TODOS los objects dentro.
-- Comentado por defecto: descomentar si estás seguro.
-- DELETE FROM storage.objects WHERE bucket_id = 'visit_photos';
-- DELETE FROM storage.buckets WHERE id = 'visit_photos';

-- ============================================================================
-- 026: WhatsApp triggers + crons 24h-internal + 2h
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='visit-reminders-2h') THEN
    PERFORM cron.unschedule('visit-reminders-2h');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='visit-reminders-24h-internal') THEN
    PERFORM cron.unschedule('visit-reminders-24h-internal');
  END IF;
END$$;
DROP TRIGGER IF EXISTS trg_notify_visit_assigned_admin ON public.visits;
DROP FUNCTION IF EXISTS public.notify_visit_assigned_admin();
DROP FUNCTION IF EXISTS public.enqueue_visit_reminders_24h_internal();
DROP FUNCTION IF EXISTS public.enqueue_visit_reminders_2h();

-- ============================================================================
-- 025: assign_visit_to + column-level grants
-- ============================================================================
DROP FUNCTION IF EXISTS public.assign_visit_to(uuid, uuid);
-- Restaurar UPDATE total (volver al estado pre-S2).
GRANT UPDATE ON public.visits TO authenticated, anon;

-- ============================================================================
-- 024: scheduled_via='admin'
-- ============================================================================
-- ⚠️ Si hay filas con scheduled_via='admin', el ALTER falla. Ejecutar primero:
-- UPDATE public.visits SET scheduled_via='comercial' WHERE scheduled_via='admin';
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_scheduled_via_check;
ALTER TABLE public.visits
  ADD CONSTRAINT visits_scheduled_via_check
  CHECK (scheduled_via IN ('public_link','comercial','agent_a05'));

-- ============================================================================
-- 023: book_public_visit revert
-- ============================================================================
-- Restauración del book_public_visit original (con el bug latente — solo emergencia).
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
BEGIN
  SELECT * INTO v_ctx FROM public.get_public_booking_context(p_token);
  IF v_ctx.opportunity_id IS NULL THEN
    RAISE EXCEPTION 'Este link ya no es válido. Contacta a Innovar.'
      USING ERRCODE = '22023';
  END IF;
  IF v_ctx.staff_id IS NULL THEN
    RAISE EXCEPTION 'No hay comercial asignado a esta oportunidad.'
      USING ERRCODE = '22023';
  END IF;
  SELECT v.id INTO v_existing
    FROM public.visits v
   WHERE v.visited_by = v_ctx.staff_id
     AND v.scheduled_at = p_scheduled_at
     AND v.status NOT IN ('cancelada','no_show')
     AND v.deleted_at IS NULL
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Ese horario ya no está disponible. Por favor elige otro.'
      USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.visits (
    opportunity_id, scheduled_at, visited_by, modality,
    status, scheduled_via, created_by, notes
  ) VALUES (
    v_ctx.opportunity_id, p_scheduled_at, v_ctx.staff_id,
    'presencial', 'agendada', 'public_link', v_ctx.staff_id,
    'Agendada por el cliente desde link público (WhatsApp).'
  )
  RETURNING id INTO v_visit_id;
  RETURN jsonb_build_object(
    'visit_id',     v_visit_id,
    'scheduled_at', p_scheduled_at,
    'staff_name',   v_ctx.staff_name,
    'client_name',  v_ctx.client_name
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.book_public_visit(text, timestamptz) TO anon, authenticated;

-- ============================================================================
-- 022: default visitor setting + helper
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_default_visitor();
DELETE FROM public.system_settings WHERE key = 'default_visitor_id';

COMMIT;
