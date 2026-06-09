-- =============================================================================
-- 039_slice3_settings_seeds.sql
-- Fase 4 · Slice 3 — Seeds en system_settings
-- =============================================================================
--
-- Decisión D4: ventana configurable de expiración (default 7 días).
-- Decisión D13: feature flag global apagado por defecto.
--
-- Las 7 filas de datos bancarios (bank_name, bank_account_number, bank_account_type,
-- bank_holder_name, bank_holder_id, nequi_phone, daviplata_phone) y la fila
-- suggested_min_advance_pct ya existen desde Slice 2 (validado contra prod 2026-05-23).
-- =============================================================================

BEGIN;

INSERT INTO public.system_settings (key, value, description, updated_at)
VALUES
  (
    'payment_window_days',
    '7'::jsonb,
    'Días tras la aceptación de la cotización para que expire si no se verifica un pago (D4). Modificable por admin desde Configuración → Pagos.',
    now()
  ),
  (
    'slice_3_enabled',
    'false'::jsonb,
    'Feature flag global del flujo Pago → Proyecto (Slice 3). Default false; admin lo prende desde Configuración → Pagos cuando arranca el piloto.',
    now()
  )
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- =============================================================================
-- END 039_slice3_settings_seeds.sql
-- =============================================================================
