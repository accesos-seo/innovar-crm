-- =====================================================
-- 050 — Agregar 'completado' al enum project_status
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-09
--
-- Objetivo: el trigger fn_cierre_automatico_proyecto
-- (migración 049) asigna NEW.status := 'completado'
-- pero el enum no tenía ese valor. Esta migración lo
-- agrega de forma idempotente.
-- =====================================================

ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'completado';

-- =====================================================
-- ROLLBACK
-- =====================================================
-- Los valores de enum en PostgreSQL no se pueden
-- eliminar sin recrear el tipo. Para revertir:
--   1. Migrar todas las filas con status='completado'
--      a otro valor.
--   2. Recrear el tipo sin 'completado' y restaurar.
-- =====================================================
