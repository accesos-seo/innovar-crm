-- =====================================================
-- 023 — Agregar columna assigned_at a opportunities
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
-- Razón: El trigger assign_commercial_round_robin() (migración 022)
--        hace NEW.assigned_at := NOW() pero la columna no existía en prod,
--        causando error 400 al guardar cualquier lead nuevo.
-- =====================================================

BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Retroactivo: llenar assigned_at = created_at para oportunidades ya asignadas
UPDATE public.opportunities
  SET assigned_at = created_at
  WHERE assigned_to IS NOT NULL AND assigned_at IS NULL;

COMMIT;
