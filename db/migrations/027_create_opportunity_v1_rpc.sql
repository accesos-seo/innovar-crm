-- =====================================================
-- 027 — RPC SECURITY DEFINER para crear oportunidades
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Fecha: 2026-06-08
--
-- Problema raíz:
--   INSERT directo a opportunities via PostgREST retorna 403 porque
--   auth.uid() llega NULL al contexto de PostgreSQL. Esto ocurre aunque
--   el cliente Supabase tenga una sesión válida en memoria. La cadena
--   supabase-js → PostgREST → RLS WITH CHECK(auth.uid()) falla porque
--   el JWT no se propaga correctamente al contexto de evaluación de políticas.
--   Con la política simple auth.uid() IS NOT NULL (migración 026) también
--   retorna 403, confirmando que auth.uid() = NULL llega al DB.
--
-- Solución:
--   Función SECURITY DEFINER que:
--     1. Corre como propietario de la función (postgres = superuser)
--     2. Bypasea RLS en la tabla opportunities
--     3. Valida auth.uid() internamente — si NULL, lanza excepción
--     4. Hace el INSERT y retorna la fila como json
--
-- Nota de seguridad:
--   SECURITY DEFINER es seguro aquí porque:
--     a) Valida auth.uid() IS NOT NULL antes de cualquier write
--     b) SET search_path = public previene búsqueda en schemas del llamador
--     c) No expone datos de otras rows (solo retorna la row recién insertada)
--     d) Los parámetros son tipados (no concatenación SQL)
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.create_opportunity_v1(
--     UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, UUID
--   );
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_opportunity_v1(
  p_client_id   UUID,
  p_status      TEXT,
  p_services    TEXT[],
  p_priority    TEXT,
  p_data_origin TEXT,
  p_notes       TEXT DEFAULT NULL,
  p_city        TEXT DEFAULT NULL,
  p_address     TEXT DEFAULT NULL,
  p_created_by  UUID DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_opp_id  UUID;
  v_result  json;
BEGIN
  -- Validate caller is authenticated via JWT
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'PGRST116',
            HINT    = 'Valid JWT required';
  END IF;

  -- Insert bypassing RLS (SECURITY DEFINER runs as function owner = postgres)
  INSERT INTO public.opportunities (
    client_id, status, services, priority, data_origin,
    notes, city, address, created_by
  ) VALUES (
    p_client_id,
    p_status,
    p_services,
    p_priority,
    p_data_origin,
    p_notes,
    p_city,
    p_address,
    COALESCE(p_created_by, v_uid)
  )
  RETURNING id INTO v_opp_id;

  -- Return the full row (SELECT inside SECURITY DEFINER also bypasses RLS)
  SELECT row_to_json(o.*)
    INTO v_result
    FROM public.opportunities o
   WHERE o.id = v_opp_id;

  RETURN v_result;
END;
$$;

-- Grant execution to all roles (auth controlled inside via auth.uid())
GRANT EXECUTE ON FUNCTION public.create_opportunity_v1 TO anon, authenticated;
