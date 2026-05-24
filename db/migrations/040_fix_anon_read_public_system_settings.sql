-- =============================================================================
-- 040 — Fix: anon read selectivo de system_settings para flujo público Slice 3
-- =============================================================================
-- Bug descubierto en smoke S3.5 (2026-05-24):
-- El frontend público (/c/:code → PublicQuotation) usa `useFeatureFlag('slice_3_enabled')`
-- y `useSetting('bank_block' | 'suggested_min_advance_pct')` para gatear el flujo
-- Slice 3 (BankDetailsCard + PaymentProofUploader). Esos hooks hacen
-- `from('system_settings').select(...)` con el rol `anon` del JWT público.
--
-- Pero la policy `system_settings_select` actual sólo permite SELECT a
-- `authenticated`. Resultado: cualquier llamada anon → RLS bloquea → hook
-- devuelve undefined → `useFeatureFlag` cae al default `false` →
-- siempre se renderiza el `PendingPaymentNotice` legacy. Bloqueante de go-live S3.
--
-- Esta migración agrega una policy paralela que permite anon SELECT pero SÓLO
-- sobre un allowlist explícito de keys "safe to expose": el flag de Slice 3
-- + las keys de datos bancarios que el cliente ya recibe por WhatsApp + el
-- porcentaje mínimo de anticipo + la base URL pública. NO expone tokens Meta,
-- ni flags internas, ni claves administrativas.
--
-- Idempotente: DROP IF EXISTS + CREATE.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS system_settings_select_public ON public.system_settings;

CREATE POLICY system_settings_select_public
  ON public.system_settings
  FOR SELECT
  TO anon
  USING (key = ANY (ARRAY[
    -- Flag del slice (controla si la UI cliente entra al flujo S3)
    'slice_3_enabled',
    -- Datos bancarios (ya se comparten por WhatsApp en flujo legacy)
    'bank_name',
    'bank_account_number',
    'bank_account_type',
    'bank_holder_name',
    'bank_holder_id',
    'nequi_phone',
    'daviplata_phone',
    -- UX (porcentaje mínimo sugerido para warning amber)
    'suggested_min_advance_pct',
    -- URL base usada al construir links en triggers (no es secreto)
    'public_app_base_url'
  ]::text[]));

COMMIT;

DO $$ BEGIN RAISE NOTICE '040 OK — anon puede leer 10 keys de system_settings (allowlist)'; END $$;
