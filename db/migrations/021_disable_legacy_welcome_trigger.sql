-- =====================================================
-- 021 — Desactivar trigger legacy de bienvenida en `clients`
-- =====================================================
-- ⏸ NO APLICAR HASTA QUE:
--   1. Meta apruebe `welcome_lead_v1` Y `booking_link_v1`, Y
--   2. El worker process-whatsapp-notifications haya enviado al menos
--      un par de welcomes nuevos con status='sent' en producción.
--
-- Contexto:
--   El trigger `trg_enqueue_whatsapp_new_lead` (clients AFTER INSERT)
--   encola un evento `lead.form_submitted` con template
--   `bienvenidas_clientes`. Existe desde antes del flujo nuevo de
--   opportunities (014_whatsapp_lead_followup_flow.sql), que ya encola
--   por su lado `welcome_lead_v1` + `booking_link_v1` en cada nueva opp.
--
--   Resultado actual: cada lead nuevo dispara 3 mensajes
--   (1 legacy + 2 nuevos) en lugar de los 2 del diseño.
--
-- Estado de los templates (verificado 2026-05-23 vía notification_queue):
--   · `bienvenidas_clientes`: 9 sent / 11 failed (error Meta 131049
--     "healthy ecosystem engagement" — Meta lo está limitando).
--   · `welcome_lead_v1`:       0 sent / 2 failed / 1 skipped (no aprobado).
--   · `booking_link_v1`:       0 sent / 2 failed / 1 skipped (no aprobado).
--
-- Por qué NO desactivarlo aún: si lo borramos hoy, ningún welcome se
-- entrega (los nuevos están bloqueados y el legacy es lo único que
-- llega cuando Meta deja de throttlear).
--
-- Por qué SÍ desactivarlo eventualmente:
--   · El contenido del welcome nuevo es más rico (incluye el nombre del
--     comercial asignado y el link de agendamiento en el mensaje 2).
--   · Reduce ruido en notification_queue.
--   · Elimina la responsabilidad implícita de mantener
--     `bienvenidas_clientes` aprobado en Meta.
-- =====================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_enqueue_whatsapp_new_lead ON public.clients;

-- Nota: NO se borra la función `fn_enqueue_whatsapp_new_lead()` para
-- permitir rehabilitarla rápido si surge un problema con el flujo nuevo.

COMMIT;

-- =====================================================
-- ROLLBACK
-- =====================================================
-- BEGIN;
--   CREATE TRIGGER trg_enqueue_whatsapp_new_lead
--     AFTER INSERT ON public.clients
--     FOR EACH ROW
--     EXECUTE FUNCTION public.fn_enqueue_whatsapp_new_lead();
-- COMMIT;
-- =====================================================
