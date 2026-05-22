-- =====================================================
-- 012 — Lead → Project Flow · Seed inicial
-- =====================================================
-- Requiere: 008 + 009 + 010 + 011 aplicados
-- Última migración del paquete Lead → Project.
-- =====================================================

BEGIN;

-- =====================================================
-- system_settings: configuración por defecto
-- =====================================================
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('suggested_min_advance_pct',
   '{"pct": 30}'::jsonb,
   'Porcentaje sugerido de abono inicial sobre el total de la cotización. No es bloqueante.'),

  ('visit_slot_times',
   '["09:00","11:00","13:30","15:30"]'::jsonb,
   'Horarios de inicio de los 4 slots de visita (martes y jueves).'),

  ('visit_slot_duration_minutes',
   '90'::jsonb,
   'Duración por defecto de cada visita en minutos.'),

  ('quotation_validity_days',
   '30'::jsonb,
   'Días de validez por defecto de una cotización antes de marcarse como expired.'),

  ('dormancy_warning_days',
   '30'::jsonb,
   'Días sin movimiento tras los que una oportunidad se marca como dormant.'),

  ('dormancy_auto_lost_days',
   '60'::jsonb,
   'Días sin movimiento tras los que una oportunidad pasa automáticamente a lost.'),

  ('refund_policy',
   '{"before_materials_pct": 90, "after_materials_pct": 50, "after_fabrication_pct": 0, "before_materials_grace_days": 7}'::jsonb,
   'Política de devolución en cancelación post-aprobación.')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =====================================================
-- FIN 012 · Seed aplicado
-- =====================================================
-- Migración Lead → Project completa.
-- Rollback en: ROLLBACK_lead_to_project.sql
-- =====================================================
