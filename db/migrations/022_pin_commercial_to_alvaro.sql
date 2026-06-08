-- =====================================================
-- 022 — Pin commercial assignment to Álvaro Ríos (temporal)
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
-- Razón: Fase de arranque del CRM — concentrar todas las nuevas
--        oportunidades en Álvaro Ríos para supervisión directa.
--        El round-robin automático se activa de nuevo con la migración
--        023_restore_round_robin.sql cuando haya más comerciales.
--
-- Qué hace:
--   Reemplaza la función assign_commercial_round_robin() para que
--   siempre asigne el UUID fijo de Álvaro Ríos (09ca8b37-95b8-43dc-9b01-1100519d5ec5)
--   en lugar de hacer rotación automática entre comerciales.
--
-- Rollback:
--   Restaurar la versión con rotación (ver versión anterior en git)
--   o aplicar 023_restore_round_robin.sql.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_commercial_round_robin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- TEMPORAL: siempre asignar a Álvaro Ríos mientras arranca el CRM.
  -- UUID: 09ca8b37-95b8-43dc-9b01-1100519d5ec5 (role=admin, Álvaro Ríos)
  -- Para reactivar round-robin real: aplicar migración 023.
  NEW.assigned_to := '09ca8b37-95b8-43dc-9b01-1100519d5ec5'::UUID;
  NEW.assigned_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- ROLLBACK (comentado):
-- =====================================================
-- Para restaurar el round-robin real, aplicar la función original de
-- la migración 008 o ejecutar 023_restore_round_robin.sql.
