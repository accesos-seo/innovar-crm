-- ============================================================================
-- 031_phase4_bank_settings_seeds.sql
-- Fase 4 · Slice 1 — Datos bancarios editables sin deploy (D8.1)
-- Idempotente. Aplicar vía Management API.
--
-- Después de aplicar, Alvaro DEBE editar estos valores desde la UI
-- /admin/configuracion/bancarios (Slice 3) ANTES de salir a producción.
-- Mientras los valores estén vacíos, los WhatsApps de payment_request
-- saldrán con strings vacíos y darán mala imagen al cliente.
-- ============================================================================

INSERT INTO public.system_settings (key, value, description, updated_at) VALUES
  ('bank_name',           '""'::jsonb, 'Nombre del banco principal (ej: Bancolombia)', now()),
  ('bank_account_number', '""'::jsonb, 'Número de cuenta donde el cliente paga el abono inicial', now()),
  ('bank_account_type',   '""'::jsonb, 'Tipo de cuenta: ahorros / corriente', now()),
  ('bank_holder_name',    '""'::jsonb, 'Titular de la cuenta', now()),
  ('bank_holder_id',      '""'::jsonb, 'NIT / cédula del titular', now()),
  ('nequi_phone',         '""'::jsonb, 'Número Nequi (opcional, vacío si no aplica)', now()),
  ('daviplata_phone',     '""'::jsonb, 'Número Daviplata (opcional, vacío si no aplica)', now())
ON CONFLICT (key) DO NOTHING;

-- Helper para leer un setting bancario rápido desde SQL (usado por templates WA)
CREATE OR REPLACE FUNCTION public.get_bank_setting(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(value #>> '{}', '')
  FROM public.system_settings
  WHERE key = p_key;
$$;

COMMENT ON FUNCTION public.get_bank_setting(TEXT) IS 'Lee un setting bancario por key. Retorna string vacío si no existe.';

-- Smoke test
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.system_settings
  WHERE key IN ('bank_name','bank_account_number','bank_account_type','bank_holder_name','bank_holder_id','nequi_phone','daviplata_phone');

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'Faltan filas de bank settings: esperadas 7, encontradas %', v_count;
  END IF;

  RAISE NOTICE 'Migración 031 OK — 7 filas bancarias en system_settings';
END $$;
