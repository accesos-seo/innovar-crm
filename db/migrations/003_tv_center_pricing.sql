-- =====================================================
-- MIGRACIÓN 003: Catálogo de Precios — Centro de TV
-- Fuente: Documento 2-CENTRO_DE_TV.docx
-- Motor:  server/services/tv-center.engine.ts
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor.
--   Usa INSERT ... ON CONFLICT (code) DO UPDATE para ser
--   idempotente (se puede correr más de una vez sin duplicados).
--   Si pricing_catalog.code no tiene UNIQUE constraint, se crea aquí.
-- =====================================================

-- Asegurar constraint único en code (si aún no existe, idempotente)
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
-- Centro de TV — Precios por componente
-- =====================================================
-- Reglas del motor (tv-center.engine.ts):
--   width clamp a [1.20, 2.40]m
--   increments = round((width - 1.60) / 0.20)  → puede ser negativo
--   extraShelves = max(0, floatingShelves - 2) (las 2 primeras van en base)
--   subtotal = TV_BASE_PRICE
--            + increments × TV_INCREMENT_20CM
--            + (hasHighGloss ? TV_HIGH_GLOSS : 0)
--            + (hasLedLights ? TV_LED : 0)
--            + extraShelves × TV_EXTRA_SHELF
--            + equipmentSpaces × TV_EQUIPMENT_SPACE
--            + (includeTransport ? TV_TRANSPORT : 0)
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('tv_center', 'TV_BASE_PRICE',
   'Centro de TV — Precio base',
   'Precio base del centro de TV a ancho estándar 1.60m. Incluye 2 repisas flotantes.',
   2800000, 'unidad'),

  ('tv_center', 'TV_INCREMENT_20CM',
   'Incremento por 20cm de ancho',
   'Recargo (positivo o descuento si menor) por cada 20cm de diferencia respecto al ancho base de 1.60m.',
   500000, 'incremento'),

  ('tv_center', 'TV_HIGH_GLOSS',
   'Acabado Alto Brillo',
   'Recargo por acabado en alto brillo (toggle on/off).',
   350000, 'unidad'),

  ('tv_center', 'TV_LED',
   'Iluminación LED integrada',
   'Iluminación LED integrada en el centro de TV (toggle flat, no por metro).',
   250000, 'unidad'),

  ('tv_center', 'TV_EXTRA_SHELF',
   'Repisa flotante adicional',
   'Repisa flotante adicional sobre las 2 incluidas en el precio base. Precio por unidad.',
   100000, 'unidad'),

  ('tv_center', 'TV_EQUIPMENT_SPACE',
   'Espacio para equipo',
   'Compartimento adicional para equipo (consola, decodificador, etc.). Rango 0–4.',
   150000, 'unidad'),

  ('tv_center', 'TV_TRANSPORT',
   'Transporte e imprevistos',
   'Costo fijo de transporte e imprevistos del módulo Centro de TV.',
   150000, 'proyecto')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Después de ejecutar, validar con:
--   SELECT code, value, unit FROM public.pricing_catalog
--   WHERE category = 'tv_center'
--   ORDER BY code;
-- Deben aparecer 7 filas.
-- =====================================================
