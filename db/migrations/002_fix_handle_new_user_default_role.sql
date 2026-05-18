-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Fix handle_new_user trigger — minimum privilege default
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEM:
--   The trigger `handle_new_user` (in supabase_schema.sql line 49-62) inserts
--   new profiles with `role = 'admin'` by default. This means anyone who
--   registers directly via Supabase Auth gets full admin access.
--
--   The frontend `authStore.ensureProfile()` was patched in Phase 1 to assign
--   'comercial' instead, but only when going through the app's flow. The
--   trigger fires on EVERY auth.users insert — including:
--     - Direct API calls to Supabase Auth
--     - Magic links
--     - OAuth provider sign-ins
--     - Admin-created users via Supabase Dashboard
--
-- SOLUTION:
--   Update the trigger to use 'comercial' (minimum useful role) by default.
--   Existing profiles with role='admin' are NOT touched — only future inserts.
--
-- DEPLOY:
--   Run in Supabase SQL Editor. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      INITCAP(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', ' '))
    ),
    NEW.email,
    'comercial'    -- ← Minimum privilege. Was 'admin' (security risk).
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Re-attach the trigger (idempotent: DROP IF EXISTS + CREATE).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification (uncomment to inspect after running)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT
--   trigger_name,
--   event_manipulation,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
--
-- -- See current admin count (do NOT auto-downgrade them, but be aware):
-- SELECT role, COUNT(*) FROM public.profiles GROUP BY role ORDER BY COUNT(*) DESC;
