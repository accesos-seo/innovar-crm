-- =============================================================================
-- 041 — Extender allowlist anon de system_settings con company_certificate_url
-- =============================================================================
-- El componente CompanyTrustSection (PublicQuotation) lee 'company_certificate_url'
-- con el rol anon para mostrar el enlace al certificado bancario de Bancolombia.
-- La policy creada en 040 solo tenía 10 keys; esta migración la recrea con 11.
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
    -- Flag del slice
    'slice_3_enabled',
    -- Datos bancarios
    'bank_name',
    'bank_account_number',
    'bank_account_type',
    'bank_holder_name',
    'bank_holder_id',
    'nequi_phone',
    'daviplata_phone',
    -- UX
    'suggested_min_advance_pct',
    -- URL base de links en triggers
    'public_app_base_url',
    -- URL del certificado bancario para sección empresa verificada
    'company_certificate_url'
  ]::text[]));

COMMIT;

DO $$ BEGIN RAISE NOTICE '041 OK — company_certificate_url añadida al allowlist anon de system_settings (11 keys)'; END $$;
