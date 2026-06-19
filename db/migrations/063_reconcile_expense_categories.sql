-- Migración 063 — Reconciliar categorías de gasto: BODEGA → las 13 del cliente (Q2)
--
-- Decisión del dueño (2026-06-19, Cuestionario 1 · Q2):
--   "Eliminamos las 10 que teníamos anteriormente y usamos las 13 que aporta el cliente."
--
-- Sutileza técnica (verificada en prod): el enum `expense_category` lo COMPARTEN los
-- gastos de PROYECTO (materiales, subcontrato, transporte…) y los de BODEGA/empresa.
-- Las 13 categorías del cliente son específicas de BODEGA. Reemplazar el enum en bruto
-- por solo 13 dejaría huérfanos los gastos de proyecto y rompería el cálculo de utilidad
-- por proyecto del cierre de período. Por eso el enum nuevo = {categorías de proyecto que
-- se conservan} ∪ {las 13 de bodega}. La UI (NewExpenseModal) ya separa por clase y
-- mostrará exactamente las 13 cuando la clase sea "empresa/bodega".
--
-- Postgres no permite DROP de valores de enum en uso, así que se usa el patrón
-- "rename-dance": crear tipo nuevo → migrar columna (remapeando) → drop viejo → renombrar.
-- Es 100% transaccional (a diferencia de ALTER TYPE ... ADD VALUE).
--
-- Único valor eliminado: `servicios_publicos` (2 filas históricas de bodega). El cliente
-- lo desglosó en luz/agua/internet; como no podemos saber a cuál correspondía cada fila
-- histórica, se remapea a `otro` (decisión honesta; el cliente puede recategorizar a mano).
--
-- Dependencias verificadas (vía Management API, 2026-06-19): solo `expenses.category` usa
-- el tipo; sin column default; sin vistas/matviews/funciones que lo fijen → drop seguro.

DO $$
BEGIN
  -- Idempotencia: si ya existe 'luz_energia', la migración ya corrió → salir.
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'expense_category' AND e.enumlabel = 'luz_energia'
  ) THEN
    RAISE NOTICE 'Migración 063 ya aplicada (luz_energia presente). Skip.';
    RETURN;
  END IF;

  -- 1. Tipo nuevo: unión exacta (proyecto conservado + 13 de bodega)
  CREATE TYPE public.expense_category_new AS ENUM (
    -- Gastos de PROYECTO (se conservan; el cierre calcula la utilidad desde estos)
    'materiales',
    'subcontrato',
    'transporte',
    'herramientas',
    'operativo',
    'dietas',
    -- Gastos de BODEGA / EMPRESA — las 13 del cliente (Q2)
    'arriendo',
    'luz_energia',
    'agua',
    'internet',
    'insumos_aseo',
    'insumos_papeleria',
    'cortesia_atencion_cliente',
    'gasolina_vehiculos',
    'mantenimiento_moto',
    'mantenimiento_bodega',
    'mantenimiento_maquinaria',
    'nomina',
    -- Compartida (proyecto y bodega)
    'otro'
  );

  -- 2. Migrar la columna, remapeando el único valor eliminado
  ALTER TABLE public.expenses
    ALTER COLUMN category TYPE public.expense_category_new
    USING (
      CASE category::text
        WHEN 'servicios_publicos' THEN 'otro'
        ELSE category::text
      END::public.expense_category_new
    );

  -- 3. Reemplazar el tipo viejo
  DROP TYPE public.expense_category;
  ALTER TYPE public.expense_category_new RENAME TO expense_category;

  RAISE NOTICE 'Migración 063 aplicada: enum expense_category reconciliado (19 valores; servicios_publicos→otro).';
END $$;

-- =============================================================================
-- Verificación
-- =============================================================================
-- SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
--   WHERE t.typname='expense_category' ORDER BY e.enumsortorder;
-- -- Debe listar 19 valores, incluir luz_energia..mantenimiento_maquinaria, NO servicios_publicos.
-- SELECT category::text, count(*) FROM public.expenses GROUP BY 1 ORDER BY 2 DESC;
-- -- Ninguna fila debe quedar en 'servicios_publicos'.
--
-- =============================================================================
-- Rollback
-- =============================================================================
-- Reconstruye el enum previo (10 valores) y remapea los nuevos valores de bodega → 'otro'
-- (no hay forma de recuperar el desglose; los gastos de proyecto se conservan tal cual):
-- BEGIN;
--   CREATE TYPE public.expense_category_old AS ENUM
--     ('materiales','operativo','nomina','transporte','herramientas',
--      'servicios_publicos','arriendo','subcontrato','otro','dietas');
--   ALTER TABLE public.expenses ALTER COLUMN category TYPE public.expense_category_old
--     USING (CASE category::text
--       WHEN 'luz_energia' THEN 'servicios_publicos'
--       WHEN 'agua' THEN 'servicios_publicos'
--       WHEN 'internet' THEN 'servicios_publicos'
--       WHEN 'insumos_aseo' THEN 'otro'
--       WHEN 'insumos_papeleria' THEN 'otro'
--       WHEN 'cortesia_atencion_cliente' THEN 'otro'
--       WHEN 'gasolina_vehiculos' THEN 'transporte'
--       WHEN 'mantenimiento_moto' THEN 'otro'
--       WHEN 'mantenimiento_bodega' THEN 'otro'
--       WHEN 'mantenimiento_maquinaria' THEN 'otro'
--       ELSE category::text END::public.expense_category_old);
--   DROP TYPE public.expense_category;
--   ALTER TYPE public.expense_category_old RENAME TO expense_category;
-- COMMIT;
