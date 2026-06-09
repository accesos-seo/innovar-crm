-- Migración 022 — Visitante por defecto configurable (Fase 3 · Slice 1)
--
-- Fundamento (D1 del plan Fase 3):
--   Hoy `book_public_visit` setea `visits.visited_by = opportunities.assigned_to`,
--   que es el comercial del round-robin. Pero el negocio exige que por defecto
--   el visitante físico sea EL ADMIN (Alvaro Rios). El comercial atiende el
--   WhatsApp; el admin visita. Por eso "ir por lo seguro" = guardar el visitante
--   default en `system_settings` (configurable sin deploy) y leerlo con un helper.
--
-- Reúsa la tabla `system_settings` existente (PK=key, value jsonb NOT NULL).
-- El helper `get_default_visitor()` lo usa el slice 023 y cualquier path futuro
-- donde `visited_by` quede NULL.

BEGIN;

-- 1) Insertar la configuración inicial. Idempotente.
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'default_visitor_id',
  jsonb_build_object('id', '09ca8b37-95b8-43dc-9b01-1100519d5ec5'),
  'UUID del profile (rol admin/comercial) que recibe por defecto las visitas técnicas cuando un cliente las confirma desde el link público. Cambiable por admin sin redeploy.'
)
ON CONFLICT (key) DO NOTHING;

-- 2) Helper SQL stable que lo lee. SECURITY DEFINER para que anon (vía
--    book_public_visit que también es SD) pueda leer sin RLS issues.
CREATE OR REPLACE FUNCTION public.get_default_visitor()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NULLIF(value->>'id', '')::uuid
  FROM public.system_settings
  WHERE key = 'default_visitor_id';
$$;

GRANT EXECUTE ON FUNCTION public.get_default_visitor() TO anon, authenticated;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- SELECT public.get_default_visitor();
-- -- Debe devolver: 09ca8b37-95b8-43dc-9b01-1100519d5ec5
--
-- SELECT key, value FROM public.system_settings WHERE key = 'default_visitor_id';
-- -- Debe devolver 1 fila con {"id":"09ca8b37-..."}.

-- =============================================================================
-- Rollback
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.get_default_visitor();
-- DELETE FROM public.system_settings WHERE key = 'default_visitor_id';
