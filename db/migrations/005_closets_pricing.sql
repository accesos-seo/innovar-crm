-- =====================================================
-- MIGRACIÓN 005: Catálogo de Precios — Closets a Medida
-- Fuente: Documento 4-CLOSETS.docx
-- Motor:  server/services/closets.engine.ts
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor.
--   Idempotente con ON CONFLICT (code) DO UPDATE.
--   Categoría 'closet' — alineada con el orquestador.
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
-- Closets — Precio por m² según tipo
-- =====================================================
-- Reglas del motor (closets.engine.ts):
--   area     = width × height        (en m²)
--   subtotal = area × precio/m² del tipo + transport (raw number del cliente)
--   El tipo de puerta (corrediza/batiente) NO afecta precio.
-- Validaciones (en UI):
--   width: 0.5–5.0m | height: 1.5–3.0m
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('closet', 'CLOSET_ESTANDAR',
   'Closet Estándar',
   'Closet a medida calidad estándar — profundidad 0.60m. Incluye maletero, divisor, doble colgadero, entrepaños, doble cajonero, zapatero, puertas.',
   750000, 'm2'),

  ('closet', 'CLOSET_ESPECIAL',
   'Closet Especial',
   'Closet a medida profundidad reducida 0.45m. Ideal espacios reducidos. Mismos accesorios internos que el estándar.',
   650000, 'm2'),

  ('closet', 'CLOSET_EMPOTRADO',
   'Closet Empotrado Premium',
   'Closet empotrado gama alta — profundidad 0.60m. Adiciona espaldar y laterales completos al estándar.',
   900000, 'm2')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Después de ejecutar, validar con:
--   SELECT code, value, unit FROM public.pricing_catalog
--   WHERE category = 'closet'
--   ORDER BY code;
-- Deben aparecer 3 filas.
-- =====================================================
