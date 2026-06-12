-- 058: Quick wins de la carta del cliente (2026-06-11).
--
-- 1. visits.address — dirección exacta por visita (la UI v1 usa la descripción
--    de la cita; esta columna queda lista para el PRD del ciclo de diseño).
-- 2. expense_category += 'dietas' — alimentación/extras de empleados.
-- 3. Aviso in-app al equipo de diseño cuando el cliente aprueba la cotización
--    (hoy el primer aviso real llega al verificar el pago).
-- 4. Aviso in-app a gerencia/comercial cuando un proyecto se entrega con saldo
--    pendiente (recordatorio del 40% restante). El WhatsApp al cliente final
--    queda para cuando exista template Meta aprobada.
--
-- Idempotente. ROLLBACK:
--   ALTER TABLE public.visits DROP COLUMN IF EXISTS address;
--   DROP TRIGGER IF EXISTS trg_notify_design_on_client_approval ON public.quotations;
--   DROP TRIGGER IF EXISTS trg_notify_pending_balance_on_delivery ON public.projects;
--   (los valores de enum no se pueden quitar sin recrear el tipo)

-- ── 1. Dirección exacta por visita ───────────────────────────────────────────
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS address text;

-- ── 2. Categoría de gasto "dietas" ───────────────────────────────────────────
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'dietas';

-- ── 3. Aviso a diseño al aprobar el cliente la cotización ────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_design_on_client_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'client_approved'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications
      (user_id, title, body, notification_type, related_table, related_id, action_url)
    SELECT p.id,
           'Cotización aprobada — preparar diseño',
           format('El cliente aprobó la cotización N° %s. El equipo de diseño puede ir preparando el modelado.',
                  COALESCE(NEW.quotation_number, '?')),
           'quotation_approved_design',
           'quotations',
           NEW.id,
           format('/quotations/%s', NEW.id)
    FROM public.profiles p
    WHERE p.role IN ('diseno'::user_role, 'admin'::user_role, 'super_admin'::user_role)
      AND p.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_design_on_client_approval ON public.quotations;
CREATE TRIGGER trg_notify_design_on_client_approval
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_design_on_client_approval();

-- ── 4. Saldo pendiente al entregar (recordatorio del 40%) ────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_pending_balance_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregado'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(NEW.balance_due, 0) > 0 THEN
    INSERT INTO public.notifications
      (user_id, title, body, notification_type, related_table, related_id, action_url)
    SELECT p.id,
           'Proyecto entregado con saldo pendiente',
           format('El proyecto "%s" se entregó con saldo pendiente de $%s. Recordar al cliente el pago del saldo restante.',
                  NEW.name,
                  to_char(NEW.balance_due, 'FM999G999G999G999')),
           'delivery_balance_reminder',
           'projects',
           NEW.id,
           format('/projects/%s', NEW.id)
    FROM public.profiles p
    WHERE p.role IN ('admin'::user_role, 'super_admin'::user_role, 'comercial'::user_role)
      AND p.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_pending_balance_on_delivery ON public.projects;
CREATE TRIGGER trg_notify_pending_balance_on_delivery
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_pending_balance_on_delivery();
