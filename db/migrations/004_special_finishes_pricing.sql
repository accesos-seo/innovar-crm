-- =====================================================
-- MIGRACIÓN 004: Catálogo de Precios — Acabados Especiales
-- Fuente: Documento 3-ACABADOS.docx
-- Motor:  server/services/special-finishes.engine.ts
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor.
--   Idempotente con ON CONFLICT (code) DO UPDATE.
--   Categoría 'especiales' — alineada con el orquestador
--   QuotationDesignStep.tsx y useQuotationBuilder.ts.
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
-- Acabados Especiales — Puertas en perfilería de aluminio
-- con vidrio ahumado, iluminación LED y transporte.
-- =====================================================
-- Reglas del motor (special-finishes.engine.ts):
--   Por cada puerta:
--     area       = height × width   (en m²)
--     hingesPairs= height ≤ 0.80 → 1 par
--                  height ≤ 1.40 → 2 pares
--                  height >  1.40 → 3 pares
--     costPuerta = area × FIN_DOOR_M2 + hingesPairs × FIN_HINGE_PAIR
--   ledCost      = includeLed ? ledMl × FIN_LED_ML : 0
--   transport    = includeTransport ? FIN_TRANSPORT : 0
--   subtotal     = Σ costPuerta + ledCost + transport
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('especiales', 'FIN_DOOR_M2',
   'Puerta acabado especial — m²',
   'Puerta en perfilería de aluminio con vidrio ahumado. Precio por metro cuadrado (alto × ancho).',
   1200000, 'm2'),

  ('especiales', 'FIN_HINGE_PAIR',
   'Par de bisagras (acabados especiales)',
   'Par de bisagras para puertas de acabados especiales. Se aplican automáticamente: 1 par si alto ≤ 0.80m, 2 pares si alto ≤ 1.40m, 3 pares si alto > 1.40m.',
   15000, 'par'),

  ('especiales', 'FIN_LED_ML',
   'Iluminación LED — metro lineal',
   'Iluminación LED para acabados especiales. Precio por metro lineal.',
   150000, 'ml'),

  ('especiales', 'FIN_TRANSPORT',
   'Transporte e imprevistos (acabados)',
   'Costo fijo de transporte e imprevistos del módulo Acabados Especiales.',
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
--   WHERE category = 'especiales'
--   ORDER BY code;
-- Deben aparecer 4 filas.
-- =====================================================
