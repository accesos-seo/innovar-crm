-- =====================================================
-- MIGRACIÓN 007: Catálogo de Precios — Mesones standalone
-- Fuente: Documento 5-MESONES.docx
-- Motor:  server/services/mesones.engine.ts
-- =====================================================
-- INSTRUCCIONES:
--   Ejecutar en Supabase > SQL Editor.
--   Idempotente con ON CONFLICT (code) DO UPDATE.
--   Categoría 'mesones'.
--
-- NOTA: Las 3 entradas MESON_GRANITO / MESON_CUARZO / MESON_SINTERIZADO
-- (profundidad estándar ≤60cm) YA EXISTEN en migración 002 con
-- category 'cocina_meson'. El motor de mesones standalone las reutiliza
-- (precio idéntico entre módulo cocina-mesón y módulo mesones-standalone).
-- Si quieres dedicar precios distintos por canal en el futuro, duplica los
-- codes con un prefijo diferente.
--
-- Esta migración añade SOLO los precios nuevos:
--   * Barra angosta (35-45cm) por cada material
--   * Lavaplatos (fijo $130.000)
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
-- Mesones standalone — Reglas del motor (mesones.engine.ts)
-- =====================================================
--   precioBase = barra angosta (fondo 35-45cm) ? MATERIAL_BARRA : MATERIAL (estándar)
--   multiplicador = barra angosta             → 1.0
--                   fondo ≤ 65cm              → 1.0
--                   fondo 66-90cm             → 1.3
--                   fondo 91-120cm            → 2.0
--   subtotalMeson = ml × precioBase × multiplicador
--
--   Por tipo:
--     meson:  + lavaplatos plano $130.000 (NO se multiplica)
--             + opcional salpicadero alto = ml × precioBase × multiplicador
--     isla:   + laterales (opcional) = 1.8 × precioBase × multiplicador
--             + regrueso (opcional)  = 0.9 × precioBase × 1.0 (siempre a 60cm)
--     barra:  + lateral (altura/100) × precioBase × multiplicador
--             + opcional salpicadero alto
--
--   subtotal = Σ subtotal_item + transport (raw del cliente)
-- =====================================================

INSERT INTO public.pricing_catalog (category, code, name, description, value, unit) VALUES

  ('mesones', 'MESON_GRANITO_BARRA',
   'Mesón Granito — Barra angosta',
   'Mesón en granito natural, profundidad 35-45cm (barra angosta). Precio por metro lineal.',
   490000, 'ml'),

  ('mesones', 'MESON_CUARZO_BARRA',
   'Mesón Cuarzo — Barra angosta',
   'Mesón en cuarzo, profundidad 35-45cm (barra angosta). Precio por metro lineal.',
   600000, 'ml'),

  ('mesones', 'MESON_SINTERIZADO_BARRA',
   'Mesón Sinterizado — Barra angosta',
   'Mesón en piedra sinterizada, profundidad 35-45cm (barra angosta). Precio por metro lineal.',
   1000000, 'ml'),

  ('mesones', 'MESON_LAVAPLATOS',
   'Lavaplatos integrado',
   'Lavaplatos 45×37cm pegado al mesón. Solo aplica a tipo "Mesón Estándar". Precio plano (NO se multiplica por profundidad ni metraje).',
   130000, 'unidad')

ON CONFLICT (code) DO UPDATE SET
  value       = EXCLUDED.value,
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Después de ejecutar, validar con:
--   SELECT code, value, unit FROM public.pricing_catalog
--   WHERE category = 'mesones'
--   ORDER BY code;
-- Deben aparecer 4 filas.
--
-- Verificación adicional — confirma que los precios estándar
-- siguen disponibles desde migración 002:
--   SELECT code, value FROM public.pricing_catalog
--   WHERE code IN ('MESON_GRANITO', 'MESON_CUARZO', 'MESON_SINTERIZADO');
-- =====================================================
