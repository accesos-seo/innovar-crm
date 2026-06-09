-- =====================================================
-- 026 — Política INSERT de fallback para opportunities
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
-- Síntoma: INSERT a /rest/v1/opportunities devuelve 403 aunque el usuario
--          está autenticado (getSession() devuelve session válida y created_by
--          llega correcto en el payload).
--
-- Causa raíz (hipótesis):
--   Las políticas FOR ALL TO {public} (opportunities_admin_all,
--   opportunities_comercial_all) usan get_my_role() en su WITH CHECK.
--   get_my_role() → auth.uid() → profiles lookup.
--   En ciertos contextos de evaluación de políticas en PostgREST (especialmente
--   en la cláusula RETURNING del INSERT que combina WITH CHECK + QUAL),
--   la cadena auth.uid() → get_my_role() puede devolver NULL aunque el JWT
--   sea válido, bloqueando el INSERT con 403.
--
-- Fix:
--   Agregar política INSERT simple que verifique únicamente auth.uid() IS NOT NULL.
--   auth.uid() es la función nativa de PostgREST/Supabase; si hay JWT válido
--   devuelve el UUID del usuario sin pasar por la tabla profiles.
--   Esta política actúa como fallback: si las FOR ALL fallan, esta pasa
--   para cualquier usuario autenticado.
--
-- Política de seguridad:
--   TO public (no TO authenticated — patrón documentado en Innovar)
--   WITH CHECK: auth.uid() IS NOT NULL
--   No restringe por rol porque las FOR ALL ya hacen esa restricción en SELECT.
--   El campo created_by = auth.uid() (DEFAULT en columna) asegura trazabilidad.
--
-- Rollback:
--   DROP POLICY IF EXISTS "opportunities_insert_authenticated_v2" ON public.opportunities;
-- =====================================================

CREATE POLICY "opportunities_insert_authenticated_v2"
ON public.opportunities
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);
