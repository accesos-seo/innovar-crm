-- =====================================================
-- 060 — Normalizar action_url en notificaciones (deep-link universal)
-- =====================================================
--
-- Problema: distintas funciones de trigger generaban action_urls
-- inconsistentes que no coincidían con las rutas reales del frontend:
--
--   /proyectos/{id}            → ruta inexistente → 404
--   /cotizaciones/{id}         → ruta inexistente → 404
--   /pagos?tab=por-verificar   → sin ID → no abre el pago específico
--   /admin/pagos-pendientes    → ruta admin → sin ID
--
-- Rutas correctas del router:
--   /projects/{id}             (ProjectDetailPage)
--   /quotations/{id}           (QuotationDetailPage)
--   /finanzas/pagos?payment_id={id}  (PagosPage, abre PaymentDetailPanel)
--
-- Estrategia: BEFORE INSERT trigger en notifications que normaliza las URLs
-- en el origen — sin tocar ninguna función existente. Las filas ya existentes
-- se corrigen con UPDATE.
--
-- Fecha: 2026-06-12
-- =====================================================

BEGIN;

-- ─────────────────────────────────────────────────────────
-- 1. Función normalizadora (BEFORE INSERT OR UPDATE)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_normalize_notification_url()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.action_url IS NULL THEN
    RETURN NEW;
  END IF;

  -- /proyectos/<id> → /projects/<id>
  IF NEW.action_url LIKE '/proyectos/%' THEN
    NEW.action_url := '/projects/' || substring(NEW.action_url FROM length('/proyectos/') + 1);
  END IF;

  -- /cotizaciones/<id> → /quotations/<id>
  IF NEW.action_url LIKE '/cotizaciones/%' THEN
    NEW.action_url := '/quotations/' || substring(NEW.action_url FROM length('/cotizaciones/') + 1);
  END IF;

  -- /pagos* o /admin/pagos* (pago con related_id) → /finanzas/pagos?payment_id=<id>
  IF (NEW.action_url LIKE '/pagos%' OR NEW.action_url LIKE '/admin/pagos%')
     AND NEW.related_table = 'payments'
     AND NEW.related_id IS NOT NULL THEN
    NEW.action_url := '/finanzas/pagos?payment_id=' || NEW.related_id::text;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 2. Trigger BEFORE INSERT OR UPDATE
-- ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_normalize_notification_url ON public.notifications;

CREATE TRIGGER trg_normalize_notification_url
  BEFORE INSERT OR UPDATE OF action_url ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_notification_url();

-- ─────────────────────────────────────────────────────────
-- 3. Backfill — corregir filas existentes
-- ─────────────────────────────────────────────────────────

-- /proyectos/<id> → /projects/<id>
UPDATE public.notifications
   SET action_url = '/projects/' || substring(action_url FROM length('/proyectos/') + 1)
 WHERE action_url LIKE '/proyectos/%';

-- /cotizaciones/<id> → /quotations/<id>
UPDATE public.notifications
   SET action_url = '/quotations/' || substring(action_url FROM length('/cotizaciones/') + 1)
 WHERE action_url LIKE '/cotizaciones/%';

-- /pagos* o /admin/pagos* con ID → /finanzas/pagos?payment_id=<id>
UPDATE public.notifications
   SET action_url = '/finanzas/pagos?payment_id=' || related_id::text
 WHERE (action_url LIKE '/pagos%' OR action_url LIKE '/admin/pagos%')
   AND related_table = 'payments'
   AND related_id IS NOT NULL;

COMMIT;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT action_url, related_table, notification_type
--   FROM public.notifications
--  WHERE action_url LIKE '/proyectos/%'
--     OR action_url LIKE '/cotizaciones/%'
--     OR action_url LIKE '/pagos%'
--     OR action_url LIKE '/admin/pagos%'
-- ORDER BY created_at DESC
-- LIMIT 20;
-- → Debe devolver 0 filas.
--
-- SELECT action_url, related_table, notification_type
--   FROM public.notifications
--  WHERE notification_type IN (
--    'project_fully_paid','project_assigned','project_created_from_payment',
--    'quotation_accepted','quotation_rejected','quotation_adjustments_requested',
--    'payment_proof_uploaded'
--  )
-- ORDER BY created_at DESC
-- LIMIT 20;
-- → action_url debe mostrar /projects/..., /quotations/..., /finanzas/pagos?payment_id=...

-- =====================================================
-- ROLLBACK
-- =====================================================
-- DROP TRIGGER IF EXISTS trg_normalize_notification_url ON public.notifications;
-- DROP FUNCTION IF EXISTS public.fn_normalize_notification_url();
-- (Las filas ya actualizadas no se pueden revertir automáticamente — usar snapshot pre-060)
-- =====================================================
