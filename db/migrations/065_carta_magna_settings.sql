-- =============================================================================
-- 065_carta_magna_settings.sql
-- Carta Magna · S0 — Parámetros configurables del flujo (system_settings)
-- =============================================================================
--
-- Origen: 2ª encuesta del dueño (docs/decisiones/2da-encuesta-respuestas-dueno.md),
-- sección "Parámetros configurables". Todos editables por admin desde Configuración.
-- Defaults sensatos provistos por el dueño como ejemplo.
--
--   Q5  cobro por ronda adicional de diseño: $80.000–$150.000 COP
--   Q5  rondas incluidas: 2 modelado + 1 render (contadas por etapa)
--   Q8  umbral de valor que exige aprobación de admin en "sin diseño": $500.000 COP
--   Q6  días de transición de estados: pausa a los 7, archivado a los 30,
--       revisión de precios si se reactiva tras 90 días archivado
--
-- Idempotente: ON CONFLICT (key) DO NOTHING. No pisa valores ya ajustados por admin.
-- ROLLBACK: ver bloque al final.
-- =============================================================================

BEGIN;

INSERT INTO public.system_settings (key, value, description, updated_at)
VALUES
  (
    'design_rounds_modelado_included',
    '2'::jsonb,
    'Rondas de cambios de MODELADO incluidas en el precio antes de cobrar extra (Q5). Contadas por etapa.'
    , now()
  ),
  (
    'design_rounds_render_included',
    '1'::jsonb,
    'Rondas de cambios de RENDER incluidas en el precio antes de cobrar extra (Q5). Contadas por etapa.'
    , now()
  ),
  (
    'design_extra_round_charge_min',
    '80000'::jsonb,
    'Cobro mínimo (COP) por ronda adicional de diseño a partir de la ronda 3 (Q5). Según complejidad.'
    , now()
  ),
  (
    'design_extra_round_charge_max',
    '150000'::jsonb,
    'Cobro máximo (COP) por ronda adicional de diseño a partir de la ronda 3 (Q5). Según complejidad.'
    , now()
  ),
  (
    'skip_design_admin_threshold',
    '500000'::jsonb,
    'Umbral de valor (COP) sobre el cual marcar un proyecto "sin diseño" exige aprobación de admin (Q8). Bajo el umbral el comercial decide solo.'
    , now()
  ),
  (
    'project_pause_after_days',
    '7'::jsonb,
    'Días sin respuesta del cliente (desde el envío del diseño) tras los cuales el proyecto pasa a "En pausa" (Q6). Anticipo pagado nunca se pausa/archiva automático.'
    , now()
  ),
  (
    'project_archive_after_days',
    '30'::jsonb,
    'Días totales sin respuesta tras los cuales el proyecto pasa a "Archivado" (Q6). No se elimina: medidas, plano y cotización quedan guardados.'
    , now()
  ),
  (
    'project_price_review_after_days',
    '90'::jsonb,
    'Días archivado tras los cuales, al reactivar, el sistema exige revisión de precios antes de continuar (Q6).'
    , now()
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =============================================================================
-- ROLLBACK (manual):
--   DELETE FROM public.system_settings WHERE key IN (
--     'design_rounds_modelado_included','design_rounds_render_included',
--     'design_extra_round_charge_min','design_extra_round_charge_max',
--     'skip_design_admin_threshold','project_pause_after_days',
--     'project_archive_after_days','project_price_review_after_days');
-- =============================================================================
-- END 065_carta_magna_settings.sql
-- =============================================================================
