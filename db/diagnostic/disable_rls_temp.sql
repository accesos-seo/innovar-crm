-- =====================================================
-- DIAGNÓSTICO TEMPORAL — Desactivar RLS para probar hipótesis
-- =====================================================
-- USO:
--   1. Ejecuta SECCIÓN 1 (inspección) — guarda el output como respaldo.
--   2. Ejecuta SECCIÓN 2 (desactivación) — RLS off en tablas problemáticas.
--   3. Prueba la app — si los módulos cargan, RLS era el problema.
--   4. Ejecuta SECCIÓN 3 (reactivación) cuando termines la prueba.
--
-- ⚠ SEGURIDAD:
--   Con RLS desactivado, CUALQUIER usuario autenticado ve TODOS los datos.
--   NO dejar esto en producción. Es solo para diagnóstico local.
-- =====================================================


-- =====================================================
-- SECCIÓN 1 — INSPECCIÓN (read-only, ejecuta primero)
-- =====================================================
-- Lista todas las policies actuales de las tablas sospechosas.
-- Copia el output completo antes de desactivar RLS — sirve de respaldo.

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual              AS using_expression,
  with_check        AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'projects',
    'quotations',
    'quotation_items',
    'materials',
    'pricing_catalog',
    'holidays',
    'profiles'
  )
ORDER BY tablename, policyname;


-- Lista qué tablas tienen RLS habilitado actualmente
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'projects',
    'quotations',
    'quotation_items',
    'materials',
    'pricing_catalog',
    'holidays',
    'profiles',
    'clients',          -- referencia: esta funciona
    'tasks',            -- referencia: esta funciona
    'payments'          -- referencia: esta funciona
  )
ORDER BY tablename;


-- =====================================================
-- SECCIÓN 2 — DESACTIVAR RLS (test, modifica estado)
-- =====================================================
-- Desactiva RLS en las tablas que reportan timeout/hang.
-- Si las queries que antes colgaban ahora responden rápido,
-- el problema es RLS (recursión, función lenta, o policy mal escrita).

ALTER TABLE public.projects        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_catalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays        DISABLE ROW LEVEL SECURITY;

-- profiles es el sospechoso #1 de recursión — también lo desactivamos.
-- Las otras tablas (projects, quotations, etc.) tienen policies que
-- consultan profiles para chequear rol. Si profiles tiene RLS con un
-- subquery a sí misma → recursión infinita.
ALTER TABLE public.profiles        DISABLE ROW LEVEL SECURITY;


-- Verificación: confirma que quedaron en false
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects','quotations','quotation_items','materials','pricing_catalog','holidays','profiles')
ORDER BY tablename;


-- =====================================================
-- SECCIÓN 3 — REACTIVAR RLS (revertir cuando termines)
-- =====================================================
-- Cuando hayas confirmado el diagnóstico, ejecuta esto para volver
-- al estado anterior. Las policies se preservan al desactivar RLS
-- (no las borra), así que reactivar las restaura tal cual.

ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- SECCIÓN 4 — DROP DE POLICIES (NUCLEAR — solo si Sección 3 vuelve a romper)
-- =====================================================
-- Si reactivar RLS reproduce el bug, las policies actuales están mal.
-- Esta sección las borra TODAS de las tablas problemáticas. Después
-- de esto, necesitarás crear nuevas policies sanas (te las daré aparte).
--
-- ⚠ NO ejecutar todavía. Solo si la sección 3 confirma el bug.

-- DO $$
-- DECLARE
--   pol RECORD;
-- BEGIN
--   FOR pol IN
--     SELECT schemaname, tablename, policyname
--     FROM pg_policies
--     WHERE schemaname = 'public'
--       AND tablename IN ('projects','quotations','quotation_items','materials','pricing_catalog','holidays','profiles')
--   LOOP
--     EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
--     RAISE NOTICE 'Dropped: %.%.%', pol.schemaname, pol.tablename, pol.policyname;
--   END LOOP;
-- END $$;
