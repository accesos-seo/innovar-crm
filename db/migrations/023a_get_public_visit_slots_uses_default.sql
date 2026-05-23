-- Migración 023a — `get_public_visit_slots` usa el visitante por defecto (Fase 3 · Slice 1)
--
-- Hallazgo del smoke 2026-05-23 (post-023):
--   Antes de S1, la pantalla pública /v/<short_code> mostraba slots libres del
--   comercial asignado a la opp. La 023 cambió `book_public_visit` para que
--   persista `visited_by = admin (Alvaro)`. Pero `get_public_visit_slots` siguió
--   delegando a `get_visit_slots(opp.assigned_to=COMERCIAL, ...)`, por lo que la
--   UI de booking mostraba huecos del comercial y, al confirmar, el trigger
--   `sync_task_availability_booking` reservaba el slot del admin → si el admin
--   ya tenía esa hora ocupada (caso real: "Visita técnica - heduin chacin"
--   28/05 14:00 Colombia), tiraba P0001 "El bloque de disponibilidad ya esta
--   reservado". Falsos positivos altísimos porque el admin centraliza TODAS
--   las visitas técnicas.
--
-- Regla de negocio (clarificada por el usuario): el comercial NO participa en
-- la visita técnica. Vende cocinas integrales en otra fase del proceso. La
-- visita es atención del DIRECTOR (Alvaro). Por eso la disponibilidad pública
-- DEBE ser la del admin, no la del comercial.
--
-- Fix: hacer que `get_public_visit_slots` delegue a `get_visit_slots` pasándole
-- `COALESCE(public.get_default_visitor(), v_staff_id)` — mismo patrón que la 023.
--
-- Idempotente. Si `default_visitor_id` no estuviera configurado, cae al
-- comercial (preserva el flujo histórico exactamente como estaba pre-S1).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_visit_slots(
  p_token text,
  p_from  date,
  p_to    date
)
RETURNS TABLE(slot_start timestamptz, is_available boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_staff_id  UUID;
  v_visitor   UUID;
BEGIN
  -- 1. Validar token + recuperar comercial asignado a la opp (dueño de la venta).
  SELECT staff_id INTO v_staff_id
    FROM public.get_public_booking_context(p_token);

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido, vencido o sin comercial asignado'
      USING ERRCODE = '22023';
  END IF;

  -- 2. Visitante real = admin default (Alvaro). Fallback al comercial sólo si
  --    `default_visitor_id` no está configurado en `system_settings`.
  v_visitor := COALESCE(public.get_default_visitor(), v_staff_id);

  -- 3. Delegar al cálculo existente de slots (martes/jueves, sin festivos).
  RETURN QUERY
  SELECT g.slot_start, g.is_available
    FROM public.get_visit_slots(v_visitor, p_from, p_to) g;
END;
$function$;

-- Mantiene grants originales.
GRANT EXECUTE ON FUNCTION public.get_public_visit_slots(text, date, date) TO anon, authenticated;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación
-- =============================================================================
-- 1. Crear una opp QA con público válido.
-- 2. SELECT * FROM public.get_public_visit_slots('<token>', CURRENT_DATE, CURRENT_DATE+21);
-- 3. Comparar contra los slots de Alvaro:
--      SELECT date, start_time, is_booked FROM public.availability_slots
--      WHERE staff_id = '09ca8b37-95b8-43dc-9b01-1100519d5ec5'
--      AND date BETWEEN CURRENT_DATE AND CURRENT_DATE+21
--      ORDER BY date, start_time;
--    Los slots `is_available=true` deben ser exactamente los que Alvaro
--    tiene libres (is_booked=false o sin row → libre por default).
--
-- =============================================================================
-- Rollback
-- =============================================================================
-- Restaurar versión previa (snapshot guardado en repo o regenerable):
--   1) Reemplazar `v_visitor := COALESCE(...)` por nada y pasar `v_staff_id`
--      directo a `get_visit_slots`.
--   2) Aplicar CREATE OR REPLACE.
