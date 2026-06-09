-- ============================================================================
-- 032_phase4_designer_qa_seed.sql
-- Fase 4 · Slice 1 — Diseñador de prueba (D14)
-- Idempotente. Aplicar vía Management API.
--
-- PRE-REQUISITO MANUAL (correr ANTES de esta migración):
-- Crear el usuario en auth.users vía la Management API o el Dashboard.
-- Patrón usado en Fase 2 (commercial test profile):
--
--   curl -X POST 'https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/auth/v1/admin/users' \
--     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
--     -H "Content-Type: application/json" \
--     -d '{
--       "id": "d1591a8e-2026-4f4d-9d11-1100519d5ccc",
--       "email": "diseno.test@innovar.local",
--       "password": "InnovarTest2026!DisenoQA",
--       "email_confirm": true
--     }'
--
-- O usar el helper script: db/scripts/create_designer_qa_user.sh
--
-- IMPORTANTE: el WhatsApp configurado en este seed apunta al número de Alvaro
-- (+573183061286, confirmado 2026-05-23).
-- Cuando se contrate un diseñador real, cambiar full_name + email + whatsapp_phone
-- en este mismo row.
-- ============================================================================

-- UUID estable para el diseñador QA (referenciable desde otras migraciones)
DO $$
DECLARE
  v_designer_id UUID := 'd1591a8e-2026-4f4d-9d11-1100519d5ccc';
  v_auth_exists BOOLEAN;
BEGIN
  -- Verificar que el auth.user ya fue creado (pre-requisito manual)
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_designer_id)
    INTO v_auth_exists;

  IF NOT v_auth_exists THEN
    RAISE EXCEPTION 'auth.users.id=% no existe. Crear el usuario primero con la Management API (ver header de esta migración).', v_designer_id;
  END IF;

  -- Insertar o actualizar el profile
  INSERT INTO public.profiles (
    id, email, full_name, role, is_active, whatsapp_phone,
    notification_preferences, created_at, updated_at
  ) VALUES (
    v_designer_id,
    'diseno.test@innovar.local',
    'Diseñador QA',
    'diseno'::user_role,
    true,
    '+573183061286',  -- Número confirmado por Alvaro 2026-05-23
    '{"wa_visit_assigned": true, "wa_project_assigned": true, "wa_payment_received": false}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role      = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        whatsapp_phone = EXCLUDED.whatsapp_phone,
        notification_preferences = EXCLUDED.notification_preferences,
        updated_at = now();

  -- Guardar el UUID en system_settings para referencias futuras
  INSERT INTO public.system_settings (key, value, description, updated_at)
  VALUES (
    'qa_designer_id',
    to_jsonb(v_designer_id),
    'UUID del perfil diseñador QA (Fase 4 D14). Reemplazar cuando se contrate diseñador real.',
    now()
  )
  ON CONFLICT (key) DO UPDATE SET value = to_jsonb(v_designer_id), updated_at = now();

  RAISE NOTICE 'Migración 032 OK — Diseñador QA id=%', v_designer_id;
END $$;

-- Helper: lista de diseñadores activos para asignación manual (usado por DesignerPicker UI)
CREATE OR REPLACE FUNCTION public.get_active_designers()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  whatsapp_phone TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.whatsapp_phone
  FROM public.profiles p
  WHERE p.role = 'diseno'::user_role
    AND p.is_active = true
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_designers() TO authenticated;

COMMENT ON FUNCTION public.get_active_designers() IS 'Lista de diseñadores activos para el DesignerPicker (Fase 4 D3.1)';
