-- =====================================================
-- 007a — Pre-008/011: extender ENUMs existentes
-- =====================================================
-- Las migraciones 008 y 011 referencian valores de enum que no existen
-- en la DB real:
--  · `quotation_status`: faltan 'client_approved', 'pending_payment_verification', 'expired'
--  · `user_role`: falta 'super_admin' (lo usan las policies RLS de 011)
--
-- `ALTER TYPE ... ADD VALUE` en PG 12+ acepta IF NOT EXISTS y es idempotente.
-- Debe correr como statements INDIVIDUALES (PG no permite usar un valor
-- recién agregado en la misma transacción que lo agrega).
-- =====================================================

ALTER TYPE public.quotation_status ADD VALUE IF NOT EXISTS 'client_approved';
ALTER TYPE public.quotation_status ADD VALUE IF NOT EXISTS 'pending_payment_verification';
ALTER TYPE public.quotation_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.user_role        ADD VALUE IF NOT EXISTS 'super_admin';
