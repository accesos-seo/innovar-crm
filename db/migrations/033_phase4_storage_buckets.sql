-- ============================================================================
-- 033_phase4_storage_buckets.sql
-- Fase 4 · Slice 1 — Buckets de storage para comprobantes y PDFs (D8.2, D12)
-- Idempotente. Aplicar vía Management API.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. payment-receipts: comprobantes de pago que sube el cliente
--    - Privado (signed URLs solo para admin desde el CRM)
--    - INSERT anónimo permitido vía RLS con validación de path
--    - READ solo para admin/super_admin
--    - Límite 5MB, tipos: image/* + application/pdf
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. quotation-pdfs: PDFs inmutables generados post-aprobación
--    - Privado (signed URLs para cliente vía URL pública)
--    - INSERT solo service_role (desde Edge Function generate-quotation-pdf)
--    - READ vía signed URL temporal
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotation-pdfs',
  'quotation-pdfs',
  false,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. RLS en storage.objects para payment-receipts
--    Path convention: payment-receipts/<quotation_id>/<filename>
--    INSERT anónimo OK solo si el quotation_id existe en estado client_approved
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "payment_receipts_anon_insert" ON storage.objects;
CREATE POLICY "payment_receipts_anon_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id::text = (storage.foldername(name))[1]
        AND q.status IN ('client_approved'::quotation_status, 'pending_payment_verification'::quotation_status)
        AND (q.valid_until IS NULL OR q.valid_until > now())
    )
  );

DROP POLICY IF EXISTS "payment_receipts_admin_read" ON storage.objects;
CREATE POLICY "payment_receipts_admin_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role)
  );

DROP POLICY IF EXISTS "payment_receipts_admin_delete" ON storage.objects;
CREATE POLICY "payment_receipts_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role)
  );

-- ---------------------------------------------------------------------------
-- 4. RLS en storage.objects para quotation-pdfs
--    Path convention: quotation-pdfs/<quotation_id>/<version>.pdf
--    INSERT: solo service_role (la Edge Function corre con service_role)
--    SELECT: authenticated admin + anon via signed URL (signed URLs bypassean RLS)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "quotation_pdfs_admin_read" ON storage.objects;
CREATE POLICY "quotation_pdfs_admin_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'quotation-pdfs'
    AND public.get_my_role() IN ('admin'::user_role, 'super_admin'::user_role, 'comercial'::user_role, 'diseno'::user_role)
  );

-- INSERT no necesita policy explícita: service_role bypassea RLS.

-- ---------------------------------------------------------------------------
-- Smoke test
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_pr_exists BOOLEAN;
  v_qp_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id='payment-receipts') INTO v_pr_exists;
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id='quotation-pdfs') INTO v_qp_exists;

  IF NOT v_pr_exists OR NOT v_qp_exists THEN
    RAISE EXCEPTION 'Buckets no creados: payment-receipts=%, quotation-pdfs=%', v_pr_exists, v_qp_exists;
  END IF;

  RAISE NOTICE 'Migración 033 OK — buckets payment-receipts + quotation-pdfs creados';
END $$;
