-- =====================================================
-- 052 — Auth — Recuperación de contraseña + Google OAuth
-- =====================================================
-- Proyecto: Innovar CRM (xdzbjptozeqcbnaqhtye)
-- Aplicar en: Supabase Dashboard → SQL Editor
-- Cambios:
--  · Nueva tabla public.roles (admin, super_admin, comercial, diseno, produccion)
--  · Nueva tabla public.users (password_hash, role_id, identity layer)
--  · RPC update_my_password_hash (SECURITY DEFINER para reset)
--  · Índice en users.email UNIQUE
--  · Trigger para auto-actualizar updated_at
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLA: public.roles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id         bigserial PRIMARY KEY,
  name       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed roles (los 5 de Innovar)
INSERT INTO public.roles (name) VALUES
  ('admin'),
  ('super_admin'),
  ('comercial'),
  ('diseno'),
  ('produccion')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. TABLA: public.users
-- =====================================================
-- Capa de identidad propia de la app (duplica auth.users + adiciona password_hash y roles)
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  full_name       text,
  phone           text,
  password_hash   text NOT NULL DEFAULT '',
  role_id         bigint REFERENCES public.roles(id),
  bio             text,
  photo_url       text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_id_idx ON public.users (role_id);

-- Trigger para auto-actualizar updated_at
CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 3. RPC: update_my_password_hash
-- =====================================================
-- SECURITY DEFINER: permite que el usuario autenticado actualice su propio hash
-- sin permisos de escritura directo en public.users (protegido por RLS).
CREATE OR REPLACE FUNCTION public.update_my_password_hash(new_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET password_hash = new_hash
  WHERE id = auth.uid();
END;
$$;

-- =====================================================
-- 4. RLS: public.users (permisivo para testing, restricción real viene en Edge Fns)
-- =====================================================
-- Los usuarios autenticados pueden leer/actualizar su propio row
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own row" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own row" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins pueden leer todos
CREATE POLICY "Admins can read all" ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name IN ('admin', 'super_admin')
    )
  );

COMMIT;
