-- ============================================================================
-- ROLLBACK_phase_4.sql
-- Revierte las migraciones 030..038 de Fase 4 — Cotización y Aprobación
-- IDEMPOTENTE. Aplicar en orden DESCENDENTE de número.
--
-- IMPORTANTE: este rollback NO toca data del cliente (no hace DELETE de filas
-- de quotations, payments, projects). Solo elimina objetos schema-level.
-- Si necesitas revertir DATA generada por la fase, ejecutar limpieza aparte.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 038 — PDF generation hook
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_generate_pdf_on_project_creation ON public.projects;
DROP FUNCTION IF EXISTS public.fn_trigger_pdf_on_project_creation();
DROP FUNCTION IF EXISTS public.trigger_pdf_generation(UUID);
DROP TABLE IF EXISTS public.pdf_generation_log;

-- ---------------------------------------------------------------------------
-- 037 — Expiry + reminders
-- ---------------------------------------------------------------------------
SELECT cron.unschedule('wa-quotation-reminders-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='wa-quotation-reminders-daily');
SELECT cron.unschedule('wa-quotation-expiry-scan-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='wa-quotation-expiry-scan-daily');
DROP FUNCTION IF EXISTS public.enqueue_quotation_reminders_3d();
DROP FUNCTION IF EXISTS public.expire_quotations_scan();

-- ---------------------------------------------------------------------------
-- 036 — Payment flow
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_designer_on_project_assignment ON public.projects;
DROP FUNCTION IF EXISTS public.fn_notify_designer_on_project_assignment();
DROP FUNCTION IF EXISTS public.verify_payment(UUID, UUID);
DROP FUNCTION IF EXISTS public.submit_quotation_payment_proof(TEXT, NUMERIC, TEXT, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- 035 — Lock + sync triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_log_quotation_status_change ON public.quotations;
DROP TRIGGER IF EXISTS trg_notify_quotation_rejection ON public.quotations;
DROP TRIGGER IF EXISTS trg_notify_quotation_acceptance ON public.quotations;
DROP TRIGGER IF EXISTS trg_sync_opportunity_from_quotation ON public.quotations;
DROP TRIGGER IF EXISTS trg_lock_quotation_on_sent ON public.quotations;

DROP FUNCTION IF EXISTS public.fn_log_quotation_status_change();
DROP FUNCTION IF EXISTS public.fn_notify_quotation_rejection();
DROP FUNCTION IF EXISTS public.fn_notify_quotation_acceptance();
DROP FUNCTION IF EXISTS public.fn_sync_opportunity_from_quotation();
DROP FUNCTION IF EXISTS public.fn_lock_quotation_on_sent();
DROP FUNCTION IF EXISTS public.unlock_quotation(UUID, TEXT);
DROP FUNCTION IF EXISTS public.send_quotation_to_client(UUID);

-- ---------------------------------------------------------------------------
-- 034 — Public RPCs
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_quotation_reactivation(TEXT);
DROP FUNCTION IF EXISTS public.reject_public_quotation(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_public_quotation(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_public_quotation(TEXT);

-- ---------------------------------------------------------------------------
-- 033 — Storage buckets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "quotation_pdfs_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_anon_insert" ON storage.objects;
-- Buckets NO se borran (riesgo de perder data). Si querés borrarlos:
--   DELETE FROM storage.objects WHERE bucket_id IN ('payment-receipts','quotation-pdfs');
--   DELETE FROM storage.buckets WHERE id IN ('payment-receipts','quotation-pdfs');

-- ---------------------------------------------------------------------------
-- 032 — Designer QA seed
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_active_designers();
-- Profile del diseñador QA NO se borra automáticamente (puede tener data ligada).
-- Para limpiarlo manualmente:
--   DELETE FROM public.profiles WHERE email = 'diseno.test@innovar.local';
--   DELETE FROM auth.users WHERE email = 'diseno.test@innovar.local';
DELETE FROM public.system_settings WHERE key = 'qa_designer_id';

-- ---------------------------------------------------------------------------
-- 031 — Bank settings
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_bank_setting(TEXT);
DELETE FROM public.system_settings WHERE key IN (
  'bank_name','bank_account_number','bank_account_type','bank_holder_name',
  'bank_holder_id','nequi_phone','daviplata_phone'
);

-- ---------------------------------------------------------------------------
-- 030 — Quotations / clients new columns
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_quotations_viewed_pending;
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_client_rejection_subtype_check;
ALTER TABLE public.quotations
  DROP COLUMN IF EXISTS view_count,
  DROP COLUMN IF EXISTS viewed_at,
  DROP COLUMN IF EXISTS client_rejected_at,
  DROP COLUMN IF EXISTS client_approved_at,
  DROP COLUMN IF EXISTS client_rejection_subtype,
  DROP COLUMN IF EXISTS client_rejection_reason,
  DROP COLUMN IF EXISTS client_acceptance_note;

ALTER TABLE public.clients DROP COLUMN IF EXISTS first_project_at;

DO $$ BEGIN RAISE NOTICE 'ROLLBACK Fase 4 completo'; END $$;
