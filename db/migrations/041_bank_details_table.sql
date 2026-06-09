-- =====================================================
-- 41. TABLA: bank_details (múltiples cuentas bancarias)
-- =====================================================
-- Migración: de system_settings (key/value) a tabla relacional
-- Permite guardar múltiples cuentas bancarias con una marcada como "activa"

CREATE TABLE IF NOT EXISTS public.bank_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name        TEXT NOT NULL,
  account_number   TEXT NOT NULL,
  account_type     TEXT NOT NULL
                   CHECK (account_type IN ('ahorro', 'corriente')),
  holder_name      TEXT NOT NULL,
  holder_id        TEXT NOT NULL,
  nequi_phone      TEXT,
  daviplata_phone  TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID REFERENCES public.profiles(id),
  updated_by       UUID REFERENCES public.profiles(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_details_is_active ON public.bank_details(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_details_created_at ON public.bank_details(created_at DESC);

-- RLS
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

-- Admin (roles: admin, comercial, diseño) pueden leer y modificar
CREATE POLICY "admin_can_view_bank_details" ON public.bank_details
  FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'comercial'));

CREATE POLICY "admin_can_modify_bank_details" ON public.bank_details
  FOR ALL
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Public (anon, client) puede ver el banco activo para show en cotización
CREATE POLICY "public_can_view_active_bank" ON public.bank_details
  FOR SELECT
  TO public
  USING (is_active = TRUE);

-- Auditoría
CREATE TRIGGER trg_bank_details_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW
  EXECUTE FUNCTION fn_audit_log_trigger();

-- =====================================================
-- Migración de datos: primero dato bancario activo
-- =====================================================
-- Si existen datos en system_settings, crear UN registro bank_details
-- con esos valores (marcado como activo).
INSERT INTO public.bank_details (
  bank_name,
  account_number,
  account_type,
  holder_name,
  holder_id,
  nequi_phone,
  daviplata_phone,
  is_active,
  created_at
)
SELECT
  COALESCE((SELECT value::text FROM public.system_settings WHERE key='bank_name'), 'Bancolombia') as bank_name,
  COALESCE((SELECT value::text FROM public.system_settings WHERE key='bank_account_number'), '') as account_number,
  COALESCE((SELECT value::text FROM public.system_settings WHERE key='bank_account_type'), 'ahorro') as account_type,
  COALESCE((SELECT value::text FROM public.system_settings WHERE key='bank_holder_name'), '') as holder_name,
  COALESCE((SELECT value::text FROM public.system_settings WHERE key='bank_holder_id'), '') as holder_id,
  (SELECT value::text FROM public.system_settings WHERE key='nequi_phone') as nequi_phone,
  (SELECT value::text FROM public.system_settings WHERE key='daviplata_phone') as daviplata_phone,
  TRUE,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.bank_details)
AND (
  SELECT COUNT(*) FROM public.system_settings
  WHERE key LIKE 'bank_%' OR key LIKE 'nequi_%' OR key LIKE 'daviplata_%'
) > 0;

-- Comentario
COMMENT ON TABLE public.bank_details IS 'Múltiples cuentas bancarias configurables. Solo la marcada con is_active=true se muestra en cotizaciones públicas.';
