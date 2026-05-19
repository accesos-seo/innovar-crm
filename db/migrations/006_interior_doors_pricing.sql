-- =====================================================
-- MIGRACIÓN 006: Catálogo de Precios — Puertas Interiores
-- Fuente: Documento 6-PUERTAS.docx
-- Motor:  server/services/interior-doors.engine.ts
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor.
--   Idempotente con ON CONFLICT (code) DO UPDATE.
--   Categoría 'puerta' (singular) — para puertas interiores
--   (NO confundir con 'puertas' plural = repuestos de cocina).
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
-- Puertas Interiores — Precios por tipo y rango de ancho
-- =====================================================
-- Reglas del motor (interior-doors.engine.ts):
--   Rango de ancho:
--     ancho ≤ 85cm  → "50-85"
--     ancho > 85cm  → "85-110"
--   Por cada puerta:
--     lineTotal = cantidad × DOOR_PRICES[tipo][rango]
--   subtotal     = Σ lineTotal + (incluyeTransporte ? FIN_TRANSPORT : 0)
--   Color herraje y dintel: NO afectan precio (UI-only).
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('puerta', 'DOOR_BATIENTE_50_85',
   'Puerta Batiente 50-85cm',
   'Puerta interior batiente con bisagras. Rango de ancho 50-85cm. Precio por unidad.',
   890000, 'unidad'),

  ('puerta', 'DOOR_BATIENTE_85_110',
   'Puerta Batiente 85-110cm',
   'Puerta interior batiente con bisagras. Rango de ancho 85-110cm. Precio por unidad.',
   950000, 'unidad'),

  ('puerta', 'DOOR_CORREDIZA_50_85',
   'Puerta Corrediza 50-85cm',
   'Puerta interior corrediza con rieles. Rango de ancho 50-85cm. Precio por unidad.',
   1250000, 'unidad'),

  ('puerta', 'DOOR_CORREDIZA_85_110',
   'Puerta Corrediza 85-110cm',
   'Puerta interior corrediza con rieles. Rango de ancho 85-110cm. Precio por unidad.',
   1350000, 'unidad'),

  ('puerta', 'DOOR_TRANSPORT',
   'Transporte e imprevistos (puertas)',
   'Costo fijo de transporte e imprevistos del módulo Puertas Interiores.',
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
--   WHERE category = 'puerta'
--   ORDER BY code;
-- Deben aparecer 5 filas.
-- =====================================================
