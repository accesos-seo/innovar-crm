-- =====================================================
-- 025 — Fix 403 en INSERT de opportunities (RLS TO authenticated)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
-- Síntoma: INSERT a /rest/v1/opportunities devuelve 403 aunque el usuario
--          tiene role=admin y está autenticado.
--
-- Causa raíz (patrón documentado en Innovar):
--   La política "opportunities_insert_authenticated" estaba marcada TO {authenticated}.
--   En este proyecto, las políticas TO authenticated interfieren con la evaluación
--   de auth.uid() y get_my_role(), devolviendo NULL → WITH CHECK falla → 403.
--   Las políticas FOR ALL TO {public} (opportunities_admin_all, opportunities_comercial_all)
--   funcionan correctamente y ya cubren INSERT para admin y comercial.
--
-- Fix:
--   1. DROP de la política problemática TO authenticated.
--      Las FOR ALL TO public ya cubren todos los roles válidos para INSERT.
--   2. ALTER COLUMN created_by SET DEFAULT auth.uid() para que el DB
--      rellene el campo aunque el front no lo envíe explícitamente.
--
-- Rollback:
--   Recrear la política si se necesita granularidad adicional en INSERT,
--   pero usando TO public en lugar de TO authenticated.
-- =====================================================

DROP POLICY IF EXISTS "opportunities_insert_authenticated" ON public.opportunities;

ALTER TABLE public.opportunities
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Verificación: las políticas FOR ALL TO public cubren INSERT implícitamente:
--   opportunities_admin_all  : get_my_role() IN ('admin','super_admin')
--   opportunities_comercial_all: get_my_role() = 'comercial'
-- No se necesita política INSERT adicional.
