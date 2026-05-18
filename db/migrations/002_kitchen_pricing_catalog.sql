-- =====================================================
-- MIGRACIÓN 002: Catálogo de Precios — Cocinas Integrales
-- Fuente: Documento 1-COCINAS.docx (14/05/2026)
-- Motor: kitchen.engine.ts
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor.
--   Usa INSERT ... ON CONFLICT (code) DO UPDATE para ser
--   idempotente (se puede correr más de una vez sin duplicados).
--   Si pricing_catalog.code no tiene UNIQUE constraint, agregar:
--     ALTER TABLE public.pricing_catalog ADD CONSTRAINT pricing_catalog_code_unique UNIQUE (code);
-- =====================================================

-- Asegurar constraint único en code (si aún no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pricing_catalog_code_unique'
  ) THEN
    ALTER TABLE public.pricing_catalog
    ADD CONSTRAINT pricing_catalog_code_unique UNIQUE (code);
  END IF;
END$$;

-- =====================================================
-- SECCIÓN 1: Muebles Lineales
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  -- Standard ($900.000 por componente / ml)
  ('cocina', 'COCINA_INF_ML_STANDARD',
   'Mueble Inferior Standard',
   'Gabinete inferior cocina integral calidad Standard. Precio por metro lineal.',
   900000, 'ml'),

  ('cocina', 'COCINA_SUP_ML_STANDARD',
   'Mueble Superior Standard',
   'Gabinete superior cocina integral calidad Standard. Precio por metro lineal.',
   900000, 'ml'),

  -- Premium ($1.100.000 por componente / ml)
  ('cocina', 'COCINA_INF_ML_PREMIUM',
   'Mueble Inferior Premium',
   'Gabinete inferior cocina integral calidad Premium. Precio por metro lineal.',
   1100000, 'ml'),

  ('cocina', 'COCINA_SUP_ML_PREMIUM',
   'Mueble Superior Premium',
   'Gabinete superior cocina integral calidad Premium. Precio por metro lineal.',
   1100000, 'ml'),

  -- Deluxe ($1.350.000 por componente / ml)
  ('cocina', 'COCINA_INF_ML_DELUXE',
   'Mueble Inferior Deluxe',
   'Gabinete inferior cocina integral calidad Deluxe. Precio por metro lineal.',
   1350000, 'ml'),

  ('cocina', 'COCINA_SUP_ML_DELUXE',
   'Mueble Superior Deluxe',
   'Gabinete superior cocina integral calidad Deluxe. Precio por metro lineal.',
   1350000, 'ml'),

  -- Frente Pollo ($750.000 / ml) — solo frente con puertas y cajoneros
  ('cocina', 'COCINA_FRENTE_POLLO_ML',
   'Frente PLL (Pollo)',
   'Frente con puertas y cajoneros para cocinas vaciadas en concreto. Precio por metro lineal.',
   750000, 'ml')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- SECCIÓN 2: Módulos Especiales (muebles piso a techo)
-- =====================================================
-- REGLA (Fuente: ejemplos PASO 8 del documento 1-COCINAS.docx):
--   Los módulos SOLO descuentan metraje — NO se suman al subtotal.
--   "Precio: Incluido en muebles."
--   Los valores aquí son REFERENCIA INTERNA DE PRODUCCIÓN únicamente.
--   El descuento en ml vive en kitchen.engine.ts.

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('cocina_modulo', 'NICHO_NEVECON',
   'Nicho Nevecón',
   'Módulo piso a techo para nevecón / refrigerador integrado. Descuenta 1.0ml del metraje base.',
   1200000, 'unidad'),

  ('cocina_modulo', 'NICHO_NEVERA',
   'Nicho Nevera',
   'Módulo piso a techo para nevera estándar. Descuenta 0.75ml del metraje base.',
   1100000, 'unidad'),

  ('cocina_modulo', 'ALACENA_ENTREPAÑOS',
   'Alacena con Entrepaños',
   'Módulo tipo alacena con entrepaños fijos. Descuenta 0.5ml del metraje base.',
   1250000, 'unidad'),

  ('cocina_modulo', 'ALACENA_HERRAJE',
   'Alacena con Herraje',
   'Módulo tipo alacena con herraje interior. Descuenta 0.5ml del metraje base.',
   900000, 'unidad'),

  ('cocina_modulo', 'TORRE_HORNOS',
   'Torre de Hornos',
   'Módulo piso a techo para horno empotrado. Descuenta 0.7ml del metraje base.',
   1350000, 'unidad')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- SECCIÓN 3: Mesones (Countertops)
-- =====================================================
-- Los recargos por profundidad se calculan en kitchen.engine.ts:
--   ≤ 60cm → ×1.00  |  61-90cm → ×1.30  |  91-120cm → ×2.00

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('cocina_meson', 'MESON_SINTERIZADO',
   'Mesón Sinterizado',
   'Mesón en piedra sinterizada (Dekton o similar). Alta resistencia. Precio por metro lineal a profundidad estándar (≤60cm).',
   1200000, 'ml'),

  ('cocina_meson', 'MESON_CUARZO',
   'Mesón Cuarzo / Quarzone',
   'Mesón en cuarzo o Quarzone. Material intermedio. Precio por metro lineal a profundidad estándar (≤60cm).',
   850000, 'ml'),

  ('cocina_meson', 'MESON_GRANITO',
   'Mesón Granito',
   'Mesón en granito natural. Precio por metro lineal a profundidad estándar (≤60cm).',
   700000, 'ml')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- SECCIÓN 4: Acabados Especiales
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('cocina_acabado', 'LED_ML',
   'Iluminación LED',
   'Tira LED bajo mueble superior. Precio por metro lineal.',
   220000, 'ml'),

  ('cocina_acabado', 'VIDRIO_AHUMADO_M2',
   'Puerta Vidrio Ahumado con Marco Aluminio Negro',
   'Puerta de vidrio ahumado con marco en aluminio negro. Precio por metro cuadrado (alto × ancho).',
   1200000, 'm2'),

  ('cocina_acabado', 'BISAGRA_PAR',
   'Par de Bisagras Adicionales',
   'Par de bisagras adicionales para puertas de mayor altura. Se aplica automáticamente: +1 par si alto > 80cm, +2 pares si alto > 140cm.',
   15000, 'par')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- SECCIÓN 5: Pintado Alto Brillo
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('cocina_pintado', 'PINTADO_PUERTA_SUP',
   'Pintado Alto Brillo — Puerta Superior',
   'Cambio de acabado a pintura de alto brillo. Puertas superiores de cocina. Precio por unidad.',
   120000, 'unidad'),

  ('cocina_pintado', 'PINTADO_PUERTA_INF',
   'Pintado Alto Brillo — Puerta Inferior',
   'Cambio de acabado a pintura de alto brillo. Puertas inferiores de cocina. Precio por unidad.',
   150000, 'unidad'),

  ('cocina_pintado', 'PINTADO_PUERTA_ALACENA',
   'Pintado Alto Brillo — Puerta Alacena',
   'Cambio de acabado a pintura de alto brillo. Puertas de alacena. Precio por unidad.',
   250000, 'unidad'),

  ('cocina_pintado', 'PINTADO_TAPA_CAJON',
   'Pintado Alto Brillo — Tapa Cajón',
   'Cambio de acabado a pintura de alto brillo. Tapas de cajón. Precio por unidad.',
   90000, 'unidad'),

  ('cocina_pintado', 'PINTADO_TAPA_ESPECIERO',
   'Pintado Alto Brillo — Tapa Especiero',
   'Cambio de acabado a pintura de alto brillo. Tapa especiero. Precio por unidad.',
   100000, 'unidad'),

  ('cocina_pintado', 'PINTADO_TAPA_GOLA',
   'Pintado Alto Brillo — Tapa Pequeña / Gola',
   'Cambio de acabado a pintura de alto brillo. Tapa pequeña o gola. Precio por unidad.',
   45000, 'unidad')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- SECCIÓN 6: Costos Fijos del Proyecto
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('fijo', 'COSTO_TRANSPORTE',
   'Transporte e Imprevistos',
   'Costo fijo de transporte e imprevistos por proyecto. Se activa a criterio del vendedor.',
   600000, 'proyecto'),

  ('fijo', 'DISEÑO_3D',
   'Diseño 3D',
   'Diseño en 3D del proyecto. Gratuito si adquiere cocina. $350.000 si solo contrata el diseño.',
   350000, 'proyecto'),

  ('cocina_isla', 'HERRAJE_BARRA_ISLA',
   'Herraje Barra Isla',
   'Herraje para barra de isla, acabado con pintura electrostática. Costo fijo por proyecto.',
   350000, 'proyecto')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;
