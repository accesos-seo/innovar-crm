# PRD: Fase 4 — Cotización y Aprobación del Proyecto

> **Versión**: 1.0 · **Estado**: Listo para ejecución · **Audiencia**: devs y agentes de IA ejecutores
> **Fuente**: Grill-me Fase 4 (2026-05-23) — 14 decisiones cerradas (D1-D14)
> **Idioma de identificadores**: inglés (código/DB) · **Idioma de UI y este documento**: español
> **Branch base a confirmar al iniciar Slice 1**: `master` (Fase 3 mergeada) o `ux-fixes` si Fase 3 sigue abierta
> **Modo de trabajo**: *"MVP simple — agregar después si las métricas lo piden"* — el usuario lo explicitó en D9

---

## 1. Problem Statement

La cotización es el punto de cierre comercial y el inicio operativo de un proyecto. Hoy hay infraestructura técnica significativa en la base de datos (tabla `quotations` con versionado, `payments` con flujo de verificación, enums de estado, varias RPCs y triggers) pero **el flujo no funciona end-to-end** para nadie:

1. **No existe la URL pública** que el cliente debería abrir para revisar y aprobar su cotización. La columna `quotations.public_token` está, pero ninguna página `/cotizacion/<token>` renderiza nada. El cliente no tiene cómo decir "acepto" desde afuera del CRM.
2. **No existe la RPC pública** `accept_public_quotation` (ni `reject_public_quotation`, ni `request_quotation_adjustments`). Los estados `client_approved` / `rejected` del enum existen pero nada los puede setear sin acceso autenticado al CRM.
3. **No hay mecánica de pago para el cliente**. Después de aceptar la propuesta, el cliente debería recibir datos bancarios por WhatsApp y poder subir el comprobante. Hoy no recibe nada y la mecánica de subida no existe.
4. **No hay datos bancarios configurables**. No hay tabla ni columna que almacene "a qué cuenta paga el cliente". Si existiera el WhatsApp, no sabría qué decirle.
5. **No hay diseñador en el sistema**. Cuando el proyecto se aprueba, debe asignarse a alguien que arme los renders 3D — pero `profiles` solo tiene 2 admins y 2 comerciales activos. Cero perfiles con `role='diseno'`. Verificado en producción.
6. **El estado machine de `quotation_status` tiene 7 estados** (`draft → sent → client_approved → pending_payment_verification → approved → rejected → expired`) pero **las transiciones no están claras**: ¿quién mueve `sent` a `client_approved`? ¿quién mueve a `approved`? ¿qué dispara cada transición?
7. **No hay aprobación por ítems** ni feedback estructurado del cliente al rechazar. Si el cliente quiere ajustes, hoy escribiría por WhatsApp y nada queda registrado en la cotización.
8. **No hay tracking de apertura del link**. Alvaro no sabe si el cliente vio la propuesta. Esto rompe el seguimiento comercial.
9. **No hay recordatorios automáticos** ni para "el cliente no aceptó en X días" ni para "el cliente aceptó pero no pagó en X días". La cron `fn_wa_quotation_expiry_3d_scan` existe pero solo cubre el caso `sent`.
10. **No hay PDF descargable** post-aprobación que sirva como copia para el archivo del cliente.
11. **`quotations.is_locked`** existe pero no hay UI que lo gestione ni regla clara de cuándo se activa/desactiva.
12. **El proyecto se crearía sin diseñador** cuando se apruebe el pago (porque no hay perfiles con ese rol), bloqueando el flujo si el campo es NOT NULL — y no hay aviso visible para Alvaro de que falta asignar.

Sin esto resuelto, ninguna venta real puede cerrarse a través del sistema. Todo el cierre comercial vive hoy fuera del CRM (WhatsApp manual + comprobantes por email) y no queda trazado.

---

## 2. Solution

Convertir la cotización en una experiencia end-to-end iniciada por Alvaro y completada por el cliente sin intervención manual entre cada paso, **reutilizando al máximo el schema y triggers ya existentes** (`quotations` con `version_number`, `public_token`, `valid_until`, `is_locked`; `payments` con `verification_status`; `convert_quotation_to_project`; `mark_quotation_historical_on_new_version`; `recalculate_quotation_totals`):

### Flujo macro (lo que cambia para los usuarios)

1. **Alvaro arma la cotización en el CRM** (página existente `QuotationCreate`) — sin cambios mayores.
2. **Alvaro clickea "Enviar al cliente"** → la cotización queda bloqueada para edición silenciosa, recibe `public_token`, `valid_until = now() + 30d`, y se manda un WhatsApp al cliente con el link `/cotizacion/<token>`.
3. **El cliente abre el link** → ve la propuesta en su celular: ítems, totales, condiciones, vigencia. Cada apertura incrementa el contador `view_count` (Alvaro lo ve en el CRM).
4. **El cliente tiene 3 botones**: **Aceptar propuesta** / **Solicitar ajustes** / **Rechazar**.
   - Si **Acepta** → cotización pasa a `client_approved` → se manda WhatsApp con datos bancarios → Alvaro recibe notificación.
   - Si **Solicita ajustes** → escribe qué quiere cambiar (texto obligatorio) → cotización pasa a `rejected` subtipo `adjustments_requested` → Alvaro recibe notificación con el feedback → Alvaro crea V2 (copia de V1 editable).
   - Si **Rechaza** → elige motivo (dropdown predefinido + texto opcional) → cotización pasa a `rejected` subtipo `declined`.
5. **El cliente sube el comprobante** en la misma URL pública (después de aceptar, aparece la sección "Subir comprobante"). Cualquier monto se acepta (si está bajo el sugerido del 30%, se marca con flag interno `below_suggested` para que Alvaro lo vea destacado al verificar).
6. **Cotización pasa a `pending_payment_verification`** → cola visual "Pagos pendientes" en el CRM.
7. **Alvaro abre la cola, revisa el comprobante, asigna el diseñador desde un selector, clickea "Verificar pago"** → la cotización pasa a `approved` → se crea el row en `projects` con `status='cotizacion_aprobada'` → se genera el PDF inmutable y se guarda en `projects.quotation_pdf_url` → el cliente recibe WhatsApp "tu pago fue confirmado, arrancamos diseño" → el diseñador asignado recibe notificación in-app + WhatsApp.

### Mecanismos transversales (lo que el sistema gestiona solo)

- **Estado de cotización limpio** con transiciones explícitas y triggers que mantienen sincronizada `opportunities.status` (las 12 etapas ya existen en el CHECK).
- **Versionado natural**: V2 hereda el `quotation_number` de V1 y le suma a `version_number`. V1 queda `is_historical_copy=true` (trigger existente). Link viejo de V1 redirige a V2 con mensaje "esta cotización fue actualizada — ver versión vigente".
- **Comparación de versiones**: en la URL pública, toggle "Ver cambios respecto a V1" despliega una tabla diff (items eliminados / agregados / cambios de precio).
- **Bloqueo automático al enviar**: `is_locked = true` apenas pasa a `sent`. Solo admins pueden desbloquear puntualmente (con `change_reason TEXT NOT NULL` registrada en `audit_logs`). Comerciales no tienen acceso al botón.
- **Datos bancarios configurables sin deploy**: nuevas filas en `system_settings` con `bank_name`, `bank_account_number`, `bank_account_type`, `bank_holder_name`, `bank_holder_id`, `nequi_phone`, `daviplata_phone`. Alvaro los edita desde `/admin/configuracion`.
- **Tracking de apertura**: columnas `quotations.viewed_at` (primera vez) + `quotations.view_count` (total). Sin metadata de IP/user agent (respeta Q13 del grill).
- **Recordatorios MVP**: una sola cron diaria `wa-quotation-reminders-daily` (14:00 UTC, slot existente) que detecta cotizaciones con 27 días de antigüedad en estados `sent` o `client_approved` y manda WhatsApp "vence en 3 días"; cuando expira, manda WhatsApp al admin "cotización X expiró sin acción".
- **URL expirada con recurso**: cliente abre link expirado → ve mensaje "esta cotización venció" + botón "Solicitar nueva cotización" → manda WhatsApp a Alvaro → Alvaro decide en el CRM si extiende `valid_until` (mantiene `quotation_number`) o crea V2.
- **Asignación de diseñador**: Alvaro elige desde un selector al momento de verificar el pago. Si no hay diseñadores activos en el sistema, el campo queda nullable y aparece badge amarillo "Sin diseñador asignado" en el proyecto. **Slice 1 incluye crear un diseñador QA** en producción con WhatsApp = número de Alvaro para validar el flujo end-to-end.
- **PDF post-aprobación**: nueva Edge Function `generate-quotation-pdf` se dispara cuando `quotation_status → approved`. Renderiza HTML → PDF, sube a bucket `quotation-pdfs` (privado, con signed URL), guarda URL en `projects.quotation_pdf_url`. La URL pública muestra botón "Descargar PDF del contrato" solo cuando el estado es `approved`.

### Lo que NO cambia (queda intacto)

- Tabla `quotations` schema base: columnas existentes (`subtotal`, `discount_type`, `discount_value`, `transport_cost`, `total_amount`, `is_locked`, `version_number`, `parent_quotation_id`, `is_historical_copy`, `valid_until`, `quotation_number`, `public_token`, `quotation_type`, `bypassed_visit`).
- Tabla `payments` schema base: la mecánica de verificación (`verification_status`, `verified_by`, `verified_at`, `proof_url`) ya estaba bien diseñada.
- Triggers `mark_quotation_historical_on_new_version`, `recalculate_quotation_totals`, `prevent_changes_on_finalized_quotation_items`, `convert_quotation_to_project_on_insert`, `create_project_from_approved_quotation`, `handle_payment_approval`, `notify_payment_received`, `fn_wa_payment_received`.
- Cron `process-whatsapp-notifications-every-minute` (el worker existente despacha los nuevos mensajes sin cambios).
- IVA y descuentos: el schema actual queda como está. Cero columnas nuevas para impuestos. Validación de tipos de descuento permanece text libre.
- Enum `quotation_status`: ya tiene los 7 valores necesarios.
- Enum `project_status`: arranca en `cotizacion_aprobada` saltando `contacto` (que queda para usos legacy o se deprecia en una fase futura).
- Página `QuotationCreate`: solo se agrega el botón "Enviar al cliente" (hoy probablemente termina en "Guardar"); el wizard de armado no se rediseña.

---

## 3. User Stories

### Cliente (no autenticado, accede vía link público)
- Como **cliente**, quiero abrir el link de mi cotización en el celular y ver mi propuesta en una página clara (sin tener que descargar PDFs), para poder revisarla en cualquier momento.
- Como **cliente**, quiero ver los ítems, los totales, el plazo de validez y las condiciones en un formato fácil de leer en mobile, sin tener que hacer zoom.
- Como **cliente**, quiero poder aceptar la propuesta con un solo clic y opcionalmente dejar un comentario ("¿cuándo viene el diseñador?"), para confirmar mi intención sin fricción.
- Como **cliente**, quiero poder pedir ajustes describiendo qué quiero cambiar ("quiten el ítem de la isla", "rebaja del 10%"), para que el admin me prepare una nueva versión sin tener que escribir por WhatsApp aparte.
- Como **cliente**, quiero poder rechazar la propuesta eligiendo un motivo de una lista (sin tener que explicar mucho), para no quedarme en limbo si no me interesa.
- Como **cliente que acepté**, quiero recibir un WhatsApp con los datos bancarios (cuenta, titular, NIT, Nequi/Daviplata si aplica) para hacer el pago, sin tener que pedirlos por chat.
- Como **cliente que acepté**, quiero poder subir el comprobante de pago en la misma página donde acepté (foto o PDF), para no tener que mandarlo por WhatsApp y arriesgar que se pierda.
- Como **cliente con mi pago aprobado**, quiero recibir un WhatsApp confirmándolo y diciéndome qué viene después ("arrancamos diseño, te llega borrador en 7 días"), para tener expectativas claras.
- Como **cliente con mi pago aprobado**, quiero poder descargar un PDF de mi cotización aprobada para archivo personal, sin tener que pedirlo.
- Como **cliente con link vencido**, quiero ver claramente "esta cotización venció" + un botón para pedir una nueva, en lugar de un 404, para no quedarme sin recurso.
- Como **cliente con varias versiones**, quiero ver siempre la versión más reciente al abrir cualquier link (viejo o nuevo), para no firmar algo desactualizado por error.

### Alvaro (admin / super_admin)
- Como **admin**, quiero un botón claro "Enviar al cliente" en cada cotización en estado `draft`, que la bloquee automáticamente y le mande el link al cliente por WhatsApp.
- Como **admin**, quiero ver en cada cotización si el cliente la abrió y cuántas veces, para hacer seguimiento comercial sin adivinar.
- Como **admin**, quiero recibir notificación in-app + WhatsApp cada vez que un cliente acepta, pide ajustes o rechaza, para reaccionar rápido.
- Como **admin**, quiero una cola visual "Pagos pendientes de verificación" donde vea todos los comprobantes sin abrir cada cotización, con monto, fecha, cliente y un indicador si el monto está bajo el sugerido.
- Como **admin verificando un pago**, quiero un selector para asignar el diseñador en ese mismo momento (antes de confirmar la verificación), para no dejar el proyecto huérfano.
- Como **admin**, quiero un botón "Desbloquear y editar" en cotizaciones enviadas que me pida una razón obligatoria, registre quién/cuándo/qué cambió en un log, y muestre un warning amarillo, para tener escape hatch sin riesgo de cambios silenciosos.
- Como **admin**, quiero poder crear una nueva versión (V2) de una cotización rechazada con un solo clic — V2 nace como copia editable de V1 — para responder al feedback del cliente sin reescribir todo.
- Como **admin**, quiero recibir un WhatsApp cuando un cliente del link vencido pide reactivación, para decidir si extiendo la vigencia o creo V2 con precios actualizados.
- Como **admin**, quiero poder editar los datos bancarios (cuenta, titular, Nequi/Daviplata) desde una página de configuración sin pedir deploy al equipo técnico.

### Diseñador (rol `diseno`, asignado por admin al verificar pago)
- Como **diseñador**, quiero recibir notificación in-app + WhatsApp cuando me asignen un proyecto nuevo, con un link directo al detalle del proyecto.
- Como **diseñador**, quiero ver mis proyectos activos en una vista filtrada por mí (fuera del scope de esta fase — viene en fases siguientes).

### Comercial (rol `comercial`)
- Como **comercial**, quiero ver las cotizaciones de mis oportunidades en modo lectura una vez enviadas, pero **no** quiero (ni debo) poder editarlas ni desbloquearlas. La edición post-envío es exclusiva del admin.

### Sistema (automatizaciones)
- Como **sistema**, debo bloquear (`is_locked=true`) toda cotización al pasar a `sent` y rechazar UPDATEs en `quotation_items` salvo que un admin haya desbloqueado explícitamente con `change_reason`.
- Como **sistema**, debo sincronizar `opportunities.status` con `quotations.status` vía trigger (sent → `sent_to_client`, client_approved → `client_approved`, etc.) para que la oportunidad refleje el avance.
- Como **sistema**, debo trackear cada apertura de la URL pública incrementando `view_count` y seteando `viewed_at` la primera vez, sin guardar datos personales adicionales.
- Como **sistema**, debo encolar mensajes en `notification_queue` con `dedup_key` para evitar duplicados (especialmente en recordatorios cron).
- Como **sistema**, debo expirar automáticamente cotizaciones con `valid_until < now()` en estados activos vía cron diario, y notificar al admin.
- Como **sistema**, cuando una cotización pasa a `approved` debo: crear `projects` con `status='cotizacion_aprobada'`, asignar `designer_id` (o NULL si no se eligió), copiar `total_amount` y `advance_amount`, marcar `clients.first_project_at` si está vacío, mover `opportunities.status='converted_to_project'`, encolar notificaciones, y disparar generación de PDF.

---

## 4. Implementation Decisions

### 4.1 Módulos involucrados

| Capa | Módulo | Tipo | Cambio |
|---|---|---|---|
| **DB schema** | `quotations.client_acceptance_note` | Nueva columna | TEXT NULLABLE — comentario opcional del cliente al aceptar |
| **DB schema** | `quotations.client_rejection_reason` | Nueva columna | TEXT NULLABLE — razón libre al rechazar/pedir ajustes |
| **DB schema** | `quotations.client_rejection_subtype` | Nueva columna | TEXT CHECK IN (`adjustments_requested`, `declined`) NULLABLE |
| **DB schema** | `quotations.viewed_at` | Nueva columna | TIMESTAMPTZ NULLABLE — primera apertura |
| **DB schema** | `quotations.view_count` | Nueva columna | INT DEFAULT 0 |
| **DB schema** | `quotations.client_approved_at` | Nueva columna | TIMESTAMPTZ NULLABLE — cuando cliente apretó Aceptar |
| **DB schema** | `quotations.client_rejected_at` | Nueva columna | TIMESTAMPTZ NULLABLE — cuando cliente apretó Rechazar/Ajustes |
| **DB schema** | `clients.first_project_at` | Nueva columna | TIMESTAMPTZ NULLABLE — para reporting "clientes nuevos del mes" |
| **DB schema** | `system_settings` | Existente | 7 filas nuevas: `bank_name`, `bank_account_number`, `bank_account_type`, `bank_holder_name`, `bank_holder_id`, `nequi_phone`, `daviplata_phone` |
| **DB schema** | `audit_logs` (si existe) o tabla nueva | A verificar | Registrar eventos: lock/unlock, status transitions, payment verification, designer assignment |
| **DB function** | `get_public_quotation(p_token TEXT)` | Nueva RPC | SECURITY DEFINER, retorna cotización completa + ítems + flag `is_latest_version`. Si no es la última versión, retorna `redirect_to_token` con el token de V2. Incrementa `view_count` y setea `viewed_at` si NULL. |
| **DB function** | `accept_public_quotation(p_token TEXT, p_note TEXT)` | Nueva RPC | SECURITY DEFINER, valida que esté en `sent` y no expirada. Setea `status='client_approved'`, `client_approved_at=now()`, `client_acceptance_note`. Encola WhatsApp con datos bancarios al cliente + notif al admin. |
| **DB function** | `reject_public_quotation(p_token TEXT, p_subtype TEXT, p_reason TEXT)` | Nueva RPC | SECURITY DEFINER. Valida `p_subtype` ∈ (`adjustments_requested`, `declined`); si `adjustments_requested`, `p_reason` NOT NULL. Setea `status='rejected'`, campos correspondientes. Encola notif al admin. |
| **DB function** | `submit_quotation_payment_proof(p_token, p_amount, p_method, p_proof_url)` | Nueva RPC | SECURITY DEFINER. Valida estado `client_approved`. Inserta `payments` con `verification_status='pending'`, calcula `below_suggested = (p_amount < total_amount * 0.30)`. Mueve cotización a `pending_payment_verification`. |
| **DB function** | `request_quotation_reactivation(p_token TEXT)` | Nueva RPC | SECURITY DEFINER. Solo si estado es `expired`. Encola WhatsApp al admin con info del cliente y la cotización solicitada. No modifica el estado. |
| **DB function** | `verify_payment(p_payment_id UUID, p_designer_id UUID NULLABLE)` | Nueva RPC | SECURITY DEFINER. Solo admin/super_admin. Setea `payments.verification_status='verified'`. Trigger encadenado mueve cotización a `approved` y crea `projects` con `designer_id=p_designer_id`. |
| **DB function** | `create_quotation_version_v2(p_quotation_id UUID)` | Existente refinada | Reutilizar `create_quotation_version` ya existente. Asegurar que copia items y setea `parent_quotation_id`. |
| **DB function** | `unlock_quotation(p_quotation_id UUID, p_change_reason TEXT)` | Nueva RPC | SECURITY DEFINER. Solo admin/super_admin. Setea `is_locked=false`, guarda `change_reason`, inserta row en `audit_logs`. |
| **DB function** | `expire_quotations_scan()` | Nueva | Marca como `expired` toda cotización con `valid_until < now()` en estados `sent`, `client_approved`, `pending_payment_verification`. Encola notif al admin por cada una. |
| **DB function** | `enqueue_quotation_reminders_3d()` | Nueva | Detecta cotizaciones con `valid_until - now() BETWEEN INTERVAL '2 days' AND INTERVAL '3 days'` en estados `sent` o `client_approved`. Encola WhatsApp al cliente con `dedup_key`. |
| **DB trigger** | `sync_opportunity_status_from_quotation` | Nueva | AFTER UPDATE OF status ON quotations. Mapea estados de cotización a estados de opportunity. |
| **DB trigger** | `notify_quotation_acceptance` | Nueva | AFTER UPDATE (sent → client_approved). Encola WhatsApp datos bancarios al cliente + notif in-app al admin. |
| **DB trigger** | `notify_quotation_rejection` | Nueva | AFTER UPDATE (sent → rejected). Notif al admin con feedback. |
| **DB trigger** | `notify_project_created` | Existente | Verificar que dispare correctamente cuando se crea proyecto desde quotation approved. |
| **DB trigger** | `lock_quotation_on_sent` | Nueva | BEFORE UPDATE OF status. Si pasa a `sent`, setea `is_locked=true` y `valid_until = now() + INTERVAL '30 days'` si NULL. |
| **DB cron** | `wa-quotation-reminders-daily` | Nueva | `0 14 * * *` — corre `enqueue_quotation_reminders_3d()` |
| **DB cron** | `wa-quotation-expiry-scan-daily` | Nueva | `5 14 * * *` — corre `expire_quotations_scan()` |
| **DB cron** | `wa-quotation-expiry-3d-daily` | Existente | Mantener tal cual (ya funciona) |
| **Edge function** | `process-whatsapp-notifications` | Existente (v12) | Agregar builders para 6 templates nuevos en TEMPLATE_REGISTRY |
| **Edge function** | `generate-quotation-pdf` | Nueva | Trigger por DB webhook (o llamada explícita desde `verify_payment`). Renderiza HTML→PDF. Sube a bucket `quotation-pdfs`. Guarda URL en `projects.quotation_pdf_url`. |
| **Storage bucket** | `payment-receipts` | Nuevo | Privado. INSERT anónimo permitido (vía RLS), READ solo admin. |
| **Storage bucket** | `quotation-pdfs` | Nuevo | Privado. INSERT solo service_role (desde Edge Function). READ vía signed URL para cliente. |
| **External** | Meta Business Manager | — | Aprobar 6 templates UTILITY/ES (bloqueador 24-48h, ver §4.4) |
| **Frontend page** | `PublicQuotation` | Nueva | Ruta `/cotizacion/<token>`. Renderiza cotización + 3 botones + (si aplica) sección de pago + (si aplica) banner expirada. |
| **Frontend page** | `QuotationCreate` / `QuotationDetail` | Existente | Agregar botón "Enviar al cliente" (transición draft → sent). Mostrar `viewed_at`, `view_count`, `is_locked`, botón "Desbloquear" para admins. |
| **Frontend page** | `Quotations` (lista) | Existente | Agregar columna "Visto" (icono ✓ + view_count), filtros por estado nuevo. |
| **Frontend page** | `PendingPayments` | Nueva | Ruta `/admin/pagos-pendientes`. Cola de `payments` con `verification_status='pending'`. Modal de verificación con preview del comprobante + selector de diseñador + botón "Verificar". |
| **Frontend page** | `BankSettings` | Nueva | Ruta `/admin/configuracion/bancarios`. CRUD sobre las 7 filas de `system_settings`. |
| **Frontend page** | `App.tsx` | Existente | Registrar las nuevas rutas (`/cotizacion/:token`, `/admin/pagos-pendientes`, `/admin/configuracion/bancarios`). |
| **Frontend component** | `QuotationPublicView` | Nuevo | Layout mobile-first con ítems, totales, validez, tracking implícito. |
| **Frontend component** | `QuotationActionButtons` | Nuevo | 3 botones (Aceptar / Solicitar ajustes / Rechazar) + modals correspondientes. |
| **Frontend component** | `QuotationPaymentUpload` | Nuevo | Después de aceptar: form con monto, método, upload de comprobante. |
| **Frontend component** | `QuotationVersionsDiff` | Nuevo | Toggle "Ver cambios respecto a V1" — tabla diff. |
| **Frontend component** | `QuotationExpiredView` | Nuevo | Vista para estado `expired` con botón "Solicitar nueva cotización". |
| **Frontend component** | `QuotationRedirectView` | Nuevo | Vista cuando el token apunta a versión no-última: "Esta cotización fue actualizada — ver versión vigente [link]". |
| **Frontend component** | `DesignerPicker` | Nuevo | Selector de profiles con `role='diseno'`, usado en `PaymentVerificationModal`. |
| **Frontend component** | `PaymentVerificationModal` | Nuevo | Preview del comprobante + selector diseñador + botón verificar. |
| **Frontend component** | `QuotationLockBadge` | Nuevo | Badge con icono candado + botón "Desbloquear" (solo admin). Modal pide `change_reason` obligatorio. |
| **Frontend hook** | `usePublicQuotation` | Nuevo | `useQuery(['public-quotation', token])` — llama RPC, maneja redirect/expired. |
| **Frontend hook** | `useAcceptQuotation` | Nuevo | Mutation contra `accept_public_quotation`. |
| **Frontend hook** | `useRejectQuotation` | Nuevo | Mutation contra `reject_public_quotation`. |
| **Frontend hook** | `useSubmitPaymentProof` | Nuevo | Mutation con upload a storage + RPC. |
| **Frontend hook** | `useRequestReactivation` | Nuevo | Mutation contra `request_quotation_reactivation`. |
| **Frontend hook** | `useVerifyPayment` | Nuevo | Mutation contra `verify_payment`. |
| **Frontend hook** | `usePendingPayments` | Nuevo | `useQuery` lista de payments pending. |
| **Frontend hook** | `useUnlockQuotation` | Nuevo | Mutation contra `unlock_quotation`. |
| **Frontend hook** | `useBankSettings` | Nuevo | CRUD sobre `system_settings` filas bancarias. |
| **Frontend hook** | `useActiveDesigners` | Nuevo | Lista profiles `role='diseno'` AND `is_active=true`. |
| **Frontend hook** | `useSendQuotation` | Nuevo | Mutation que llama RPC interna `send_quotation_to_client` (que setea status, lock, valid_until, encola WhatsApp). |
| **Frontend schema** | `quotation-public.ts` (Zod) | Nuevo | Schemas para acceptance, rejection, payment submission. |
| **DB seed** | Diseñador QA | Nuevo (Slice 1) | Profile `full_name='Diseñador QA'`, `email='diseno.test@innovar.local'`, `role='diseno'`, `is_active=true`, `whatsapp_phone=<número de Alvaro>` — para validar el flujo end-to-end. Documentado en `db/migrations/030_designer_qa_seed.sql`. |

### 4.2 Numeración de migraciones SQL

Fase 3 cerró en `029_scheduled_job_log_rls.sql`. **Fase 4 arranca en `030`**.

Distribución sugerida (cierra los 5 slices):

| # | Migración | Propósito | Slice |
|---|---|---|---|
| 030 | `phase4_quotations_new_columns.sql` | ALTER TABLE `quotations` agregando 7 columnas nuevas (notes, subtypes, viewed_at, view_count, client_*_at) + ALTER `clients.first_project_at` | S1 |
| 031 | `phase4_bank_settings_seeds.sql` | INSERT en `system_settings` con keys vacíos | S1 |
| 032 | `phase4_designer_qa_seed.sql` | INSERT profile diseñador QA | S1 |
| 033 | `phase4_storage_buckets.sql` | CREATE bucket `payment-receipts` + `quotation-pdfs` con RLS | S1 |
| 034 | `phase4_public_quotation_rpcs.sql` | `get_public_quotation`, `accept_public_quotation`, `reject_public_quotation`, `request_quotation_reactivation` | S2 |
| 035 | `phase4_lock_and_sync_triggers.sql` | `lock_quotation_on_sent`, `sync_opportunity_status_from_quotation`, `notify_quotation_acceptance`, `notify_quotation_rejection`, `unlock_quotation` RPC | S2 |
| 036 | `phase4_payment_flow.sql` | `submit_quotation_payment_proof`, `verify_payment`, update `handle_payment_approval` para asignar designer, integration con `create_project_from_approved_quotation` | S3 |
| 037 | `phase4_quotation_expiry_and_reminders.sql` | `expire_quotations_scan`, `enqueue_quotation_reminders_3d`, 2 crons | S4 |
| 038 | `phase4_pdf_generation_hook.sql` | Trigger/webhook que llama Edge Function `generate-quotation-pdf` al `approved` | S5 |
| ROLLBACK | `ROLLBACK_phase_4.sql` | DROP de todo en orden inverso | — |

### 4.3 Estado machine final de `quotation_status`

```
draft  ──[admin: enviar]──>  sent  ──[cliente: aceptar]──>  client_approved
                              │                                │
                              ├──[cliente: rechazar/ajustes]──> rejected
                              │                                │
                              ├──[cron: 30d]──> expired         ├──[cliente: subir comprobante]──> pending_payment_verification
                              │                                │                                    │
                                                                │                                    ├──[admin: verificar pago]──> approved
                                                                │                                    │
                                                                └──[cron: 30d sin pago]──> expired   └──[cron: 30d sin verificación]──> expired
```

**Transiciones permitidas** (validar en cada RPC):
- `draft → sent` — admin con permiso
- `draft → DELETE` — admin
- `sent → client_approved` — RPC pública `accept_public_quotation`
- `sent → rejected` — RPC pública `reject_public_quotation`
- `sent → expired` — cron
- `client_approved → pending_payment_verification` — RPC pública `submit_quotation_payment_proof`
- `client_approved → expired` — cron
- `pending_payment_verification → approved` — RPC `verify_payment` (admin)
- `pending_payment_verification → expired` — cron
- `approved` — terminal (proyecto creado, cotización inmutable)
- `rejected` — terminal (admin puede crear V2 que reactiva V1 implícitamente al marcar `is_historical_copy=true` en V1)
- `expired` — terminal (admin extiende `valid_until` y vuelve a `sent` con audit, o crea V2)

### 4.4 Templates Meta UTILITY/ES a aprobar

6 templates nuevos. Cada uno se crea en Meta Business Manager → WhatsApp Manager → Message Templates.

| Key Meta | Vars | Wording sugerido | Trigger |
|---|---|---|---|
| `quotation_sent_v1` | {{1=nombre}} {{2=quotation_number}} {{3=link}} | "Hola {{1}}, te enviamos tu cotización N° {{2}}. Revisala acá: {{3}}" | RPC `send_quotation_to_client` |
| `quotation_v2_sent_v1` | {{1=nombre}} {{2=quotation_number}} {{3=link}} | "Hola {{1}}, preparamos una nueva versión de tu cotización N° {{2}} basada en tu feedback. Revisala acá: {{3}}" | Al enviar V2 |
| `payment_request_v1` | {{1=nombre}} {{2=banco}} {{3=cuenta}} {{4=titular}} {{5=monto_sugerido}} | "Hola {{1}}, ¡gracias por aceptar! El siguiente paso es el abono inicial. Datos: {{2}} cuenta {{3}} a nombre de {{4}}. Sugerido: {{5}}. Subí tu comprobante en el mismo link de la cotización." | Trigger `notify_quotation_acceptance` |
| `payment_received_v1` | {{1=nombre}} | "¡{{1}}, pago confirmado! Arrancamos el diseño de tu proyecto. Te avisamos cuando esté el primer borrador." | Trigger en `quotation → approved` |
| `quotation_reminder_3d_client_v1` | {{1=nombre}} {{2=quotation_number}} {{3=fecha_vencimiento}} {{4=link}} | "Hola {{1}}, tu cotización N° {{2}} vence el {{3}}. Revisala: {{4}}" | Cron diario |
| `project_assigned_designer_v1` | {{1=designer_nombre}} {{2=client_nombre}} {{3=link_proyecto}} | "Hola {{1}}, te asignaron un nuevo proyecto: {{2}}. Detalles: {{3}}" | Cuando se asigna `designer_id` |

**Mientras no estén aprobados**, los rows en `notification_queue` quedan `failed`. Cero rotura del resto del sistema: al aprobarlos, los nuevos mensajes fluyen automáticamente.

### 4.5 Eventos de notificación in-app

Insertar en tabla `notifications` (existente) con `action_url` que llevan al CRM:

| Evento | Destinatario | `notification_type` | `action_url` |
|---|---|---|---|
| Cliente aceptó cotización | Admin (creador o asignado) | `quotation_accepted` | `/cotizaciones/<id>` |
| Cliente pidió ajustes | Admin | `quotation_adjustments_requested` | `/cotizaciones/<id>` |
| Cliente rechazó | Admin | `quotation_rejected` | `/cotizaciones/<id>` |
| Cliente subió comprobante | Admin | `payment_proof_uploaded` | `/admin/pagos-pendientes` |
| Pago verificado, proyecto creado | Diseñador asignado (o Admin si NULL) | `project_assigned` | `/proyectos/<id>` |
| Cotización expiró | Admin (creador) | `quotation_expired` | `/cotizaciones/<id>` |
| Cliente pidió reactivación | Admin | `quotation_reactivation_requested` | `/cotizaciones/<id>` |

### 4.6 Audit log

Tabla `audit_logs` (verificar si existe; si no, crear). Registrar como mínimo:
- `quotation_unlocked`: `{quotation_id, admin_id, change_reason, timestamp}`
- `quotation_status_changed`: `{quotation_id, from_status, to_status, actor (admin_id o 'public'), timestamp}`
- `payment_verified`: `{payment_id, admin_id, designer_assigned_id, timestamp}`
- `quotation_reactivated`: `{quotation_id, admin_id, action ('extended' o 'new_version'), timestamp}`

### 4.7 Permisos por rol

| Acción | super_admin | admin | comercial | diseno |
|---|---|---|---|---|
| Ver lista cotizaciones | Todas | Todas | Solo de sus oportunidades | Solo de proyectos asignados |
| Crear cotización draft | ✅ | ✅ | ✅ | ❌ |
| Editar cotización draft | ✅ | ✅ | ✅ (las suyas) | ❌ |
| Enviar al cliente | ✅ | ✅ | ❌ | ❌ |
| Desbloquear cotización enviada | ✅ | ✅ | ❌ | ❌ |
| Crear V2 (nueva versión) | ✅ | ✅ | ❌ | ❌ |
| Verificar pago | ✅ | ✅ | ❌ | ❌ |
| Asignar diseñador | ✅ | ✅ | ❌ | ❌ |
| Ver datos bancarios (configurar) | ✅ | ✅ | ❌ | ❌ |
| Cliente público (sin auth) | — vía `public_token` único, solo lectura limitada y RPCs públicas — |

Aplicar vía RLS y/o checks dentro de cada RPC (`SECURITY DEFINER` con `get_my_role()` o equivalente).

### 4.8 Slices de ejecución (orden estricto)

#### Slice 1 — Cimientos (schema + seeds + buckets)
**Goal**: dejar la DB y storage listos. Sin frontend.
**Migraciones**: 030, 031, 032, 033.
**Frontend**: ninguno.
**Verificación**: chequear que el diseñador QA existe, los buckets están creados, las columnas nuevas no rompen las queries existentes (smoke `SELECT * FROM quotations LIMIT 5`).
**Soak antes de S2**: 24h.

#### Slice 2 — URL pública + RPCs de cliente + bloqueo + sync de opportunity
**Goal**: el cliente puede abrir el link, aceptar/rechazar/pedir ajustes. La cotización se sincroniza con la opportunity. Sin pago todavía.
**Migraciones**: 034, 035.
**Frontend**: `PublicQuotation`, `QuotationPublicView`, `QuotationActionButtons`, `QuotationVersionsDiff`, `QuotationExpiredView`, `QuotationRedirectView`, `QuotationLockBadge`, hooks correspondientes, ruta en `App.tsx`. Botón "Enviar al cliente" en `QuotationDetail`. Botón "Desbloquear" para admin.
**Bloqueador externo**: Meta aprueba `quotation_sent_v1`, `quotation_v2_sent_v1` (de los 6 totales, solo estos 2 bloquean S2).
**Verificación E2E**: crear cotización QA → enviar → abrir URL en incógnito mobile → aceptar → ver que status pasa a `client_approved`, opportunity.status sync, notif al admin in-app.
**Soak antes de S3**: 48h.

#### Slice 3 — Pago (upload + verificación + cola pendientes)
**Goal**: cliente sube comprobante. Admin lo verifica desde una cola visual. Proyecto se crea con diseñador asignado.
**Migraciones**: 036.
**Frontend**: `QuotationPaymentUpload`, `PendingPayments`, `PaymentVerificationModal`, `DesignerPicker`, `BankSettings`, hooks correspondientes, rutas nuevas.
**Bloqueador externo**: Meta aprueba `payment_request_v1`, `payment_received_v1`, `project_assigned_designer_v1`.
**Verificación E2E**: continuar el QA de S2 → cliente sube comprobante → admin lo ve en cola → verifica → proyecto se crea con `designer_id=diseñador QA` → notif in-app al diseñador + WhatsApp al cliente.
**Soak antes de S4**: 48h.

#### Slice 4 — Recordatorios + expiración automática
**Goal**: el sistema gestiona solo el ciclo de vida temporal.
**Migraciones**: 037.
**Frontend**: ninguno (solo backend).
**Bloqueador externo**: Meta aprueba `quotation_reminder_3d_client_v1`.
**Verificación**: insertar cotización QA con `valid_until = now() + INTERVAL '2 days 23 hours'` → correr cron manual → verificar WhatsApp encolado con `dedup_key`. Avanzar reloj o setear `valid_until = now() - INTERVAL '1 hour'` → correr scan → verificar `status='expired'` y notif al admin.

#### Slice 5 — PDF inmutable post-aprobación
**Goal**: cliente con pago verificado puede descargar PDF del contrato.
**Migraciones**: 038.
**Frontend**: en `QuotationPublicView`, mostrar botón "Descargar PDF" cuando status=`approved` y `quotation_pdf_url IS NOT NULL`.
**Edge function**: `generate-quotation-pdf` (nueva).
**Verificación**: completar flujo QA hasta `approved` → verificar que el PDF aparece en bucket `quotation-pdfs` → URL guardada en `projects.quotation_pdf_url` → botón funciona en URL pública.

**Cierre de Fase 4** al terminar S5.

### 4.9 Feature flag

`VITE_FF_PHASE_4_QUOTATION_PUBLIC` (default `false`). Mientras esté OFF:
- La ruta `/cotizacion/:token` retorna 404.
- El botón "Enviar al cliente" no aparece en `QuotationDetail`.
- La cola `/admin/pagos-pendientes` no aparece en el menú.
- El flujo legacy (cotización por PDF/WhatsApp manual) sigue funcionando exactamente igual.

Al activar `VITE_FF_PHASE_4_QUOTATION_PUBLIC=true` en staging primero, luego en prod tras soak.

---

## 5. Testing Decisions

### 5.1 QA por Slice (en orden, cada uno bloquea el siguiente)

**Slice 1**:
- [ ] Diseñador QA aparece en `SELECT * FROM profiles WHERE role='diseno'`.
- [ ] Buckets `payment-receipts` y `quotation-pdfs` existen en Supabase Storage.
- [ ] Columnas nuevas presentes (verificar con `information_schema.columns`).
- [ ] Queries existentes en `useQuotations`, `useClients` no rompen (load la página `/cotizaciones` y `/clientes` y verificar zero errores en consola).

**Slice 2** (E2E manual + automatizado):
- [ ] Crear cotización QA desde el CRM (admin) → guardar como `draft`.
- [ ] Botón "Enviar al cliente" aparece en `draft`; al clickear, cotización pasa a `sent`, `is_locked=true`, `valid_until = now() + 30d`, recibe WhatsApp encolado.
- [ ] Abrir `/cotizacion/<token>` en incógnito (simular cliente) → ver propuesta correctamente renderizada en mobile.
- [ ] `view_count` incrementa y `viewed_at` se setea en la primera apertura.
- [ ] Botón "Aceptar" → modal con campo opcional → confirmar → cotización pasa a `client_approved` → opportunity.status sync → admin recibe notif in-app.
- [ ] Botón "Solicitar ajustes" → modal exige texto obligatorio → submit → cotización a `rejected` subtipo `adjustments_requested` → admin notif con feedback.
- [ ] Botón "Rechazar" → dropdown motivos + texto opcional → submit → cotización a `rejected` subtipo `declined`.
- [ ] Crear V2 desde V1 rechazada → V1 queda `is_historical_copy=true` → abrir link viejo de V1 → muestra "esta cotización fue actualizada" + link a V2.
- [ ] Admin desbloquea cotización `sent` → modal exige `change_reason` → confirmar → `is_locked=false` → audit log creado → warning visual en pantalla.
- [ ] Comercial NO puede ver botón "Desbloquear" ni "Enviar al cliente" (verificar como user `comercial.test@innovar.local`).

**Slice 3** (E2E continuando con QA de S2):
- [ ] En URL pública post-aceptación, sección "Subir comprobante" aparece. Upload de imagen funciona → crea row en `payments` con `verification_status='pending'`.
- [ ] Cotización pasa a `pending_payment_verification`.
- [ ] Admin abre `/admin/pagos-pendientes` → ve el pago en cola con preview del comprobante.
- [ ] Modal de verificación → selector de diseñador (lista al QA) → seleccionar → "Verificar" → cotización a `approved` → proyecto creado con `designer_id` correcto → PDF queue (S5).
- [ ] Diseñador QA recibe notif in-app + WhatsApp (verificar en `notification_queue` que esté `sent`).
- [ ] Cliente recibe WhatsApp `payment_received_v1`.
- [ ] `clients.first_project_at` se llena con `now()` (solo si era NULL).
- [ ] `opportunities.status = 'converted_to_project'`.
- [ ] Página `BankSettings` permite editar las 7 filas y los cambios se reflejan en el próximo WhatsApp `payment_request_v1`.
- [ ] Pago bajo el sugerido (ej: 10% del total) se acepta igual y queda con `below_suggested=true` (verificar visualmente en cola con badge).

**Slice 4** (verificación de crons):
- [ ] Insertar cotización con `valid_until = now() + INTERVAL '2 days 23 hours'` en estado `sent` → correr `enqueue_quotation_reminders_3d()` manualmente → verificar 1 row en `notification_queue` con `dedup_key` correcto.
- [ ] Re-correr → no se duplica (idempotencia).
- [ ] Insertar cotización con `valid_until = now() - INTERVAL '1 hour'` en estado `sent` → correr `expire_quotations_scan()` → cotización pasa a `expired` + notif al admin.
- [ ] Abrir URL pública de cotización expirada → ver `QuotationExpiredView` con botón funcional.
- [ ] Clickear "Solicitar nueva cotización" → admin recibe WhatsApp `quotation_reactivation_requested` (a verificar template; alternativamente notif in-app sin WhatsApp si no se aprueba template — decisión menor).

**Slice 5**:
- [ ] Completar QA hasta `approved` → verificar PDF generado en bucket `quotation-pdfs`.
- [ ] URL guardada en `projects.quotation_pdf_url`.
- [ ] Botón "Descargar PDF" aparece en URL pública post-aprobación.
- [ ] Clickear → signed URL válida por 1 hora se genera y abre el PDF.
- [ ] PDF contiene: logo, datos cliente, ítems, subtotal, descuento si aplica, transport, total, fecha aprobación, número cotización + versión.

### 5.2 Tests unitarios (Vitest)

- `accept_public_quotation`: token válido en `sent` → ok; token en otro estado → error; token inexistente → 404; cotización expirada → error.
- `verify_payment`: solo admin → 42501 si rol distinto; designer_id NULL → proyecto creado sin asignar pero con badge.
- `lock_quotation_on_sent` trigger: setea is_locked y valid_until correctamente.
- `submit_quotation_payment_proof`: `below_suggested` correctamente calculado.

### 5.3 Tests de seguridad

- Comercial intenta llamar `verify_payment` directamente → permission denied.
- Anon intenta llamar `verify_payment` → permission denied.
- `accept_public_quotation` con token de versión histórica (is_historical_copy=true) → error o redirect.
- Subida de archivo > 5MB al bucket `payment-receipts` → rechazada.
- Subida de archivo no-imagen/no-pdf → rechazada.

---

## 6. Out of Scope

- **Email transaccional**: explícitamente excluido en D11. Si las métricas lo piden post-launch, se abre mini-proyecto aparte.
- **Firma digital** (validez legal): excluido por Q11-Q13. La aprobación es comercial, no jurídica.
- **Aprobación por ítem** (parcial): excluido por D1. Cliente acepta todo o pide ajustes (que genera V2).
- **OCR de comprobantes**: excluido por D8.4. Verificación 100% manual.
- **Webhook bancario automático** (Bancolombia, Davivienda): excluido. Verificación manual.
- **Recordatorios extra** (3d, 7d después de envío, etc.): excluido por D9. MVP solo 1 recordatorio (3d antes de vencer) + 1 aviso de expiración.
- **Flag `reminders_paused` en cotización**: excluido por D9.2.
- **IVA discriminado** + columnas `tax_amount` / `tax_rate`: excluido por D13. Schema queda como está.
- **CHECK constraint en `discount_type`**: excluido por D13. Validación queda en frontend opcional.
- **Restricciones de rol para descuentos**: excluido por D13. Cualquier admin/comercial que pueda editar cotización puede descontar.
- **Factura electrónica / DIAN integration**: completamente out of scope. Cuando se necesite, será otra fase.
- **Página "Mis proyectos" para diseñadores**: out of scope. Acá solo se asigna; la vista del diseñador se construye en Fase 5+.
- **Tracking de IP / dispositivo del cliente** al abrir el link: excluido por Q13.
- **Modificar la página `QuotationCreate` (wizard)**: queda como está. Solo se agrega el botón "Enviar al cliente" en `QuotationDetail`.
- **Refactor del enum `project_status`**: el valor `'contacto'` queda como legacy; los nuevos proyectos arrancan en `'cotizacion_aprobada'`. Deprecar `'contacto'` es decisión de otra fase.

---

## 7. Further Notes

### 7.1 Riesgos conocidos

1. **`db/supabase_schema.sql` está desactualizado** (lección de Fases 2-3). Toda validación de schema debe ir contra producción vía Management API, no contra el archivo local.
2. **6 templates Meta a aprobar** — bloquea S2 (2 templates) y S3 (3 templates) y S4 (1 template). Aprobar en paralelo desde el inicio de Fase 4. Tiempo típico: 24-48h por template.
3. **Diseñador QA con WhatsApp = número de Alvaro**: en producción, los WhatsApps al "diseñador" llegan al teléfono de Alvaro durante el período de pruebas. Cuando se contrate un diseñador real, cambiar `whatsapp_phone` en su profile. Decisión consciente para validar el flujo sin contratar antes.
4. **Bucket `payment-receipts` con INSERT público**: riesgo de uploads no relacionados. Mitigación: RLS que verifica que el `quotation_id` en el path corresponde a una cotización en estado `client_approved` con `public_token` válido + límite de tamaño (5MB).
5. **PDF generation**: implementación inicial puede usar `puppeteer` (peso ~150MB en cold start) o `@react-pdf/renderer` (peso menor pero menos flexible con CSS). Decisión final en Slice 5 según fricción real. Fallback: dejar `quotation_pdf_url=NULL` y el botón "Descargar PDF" no aparece — el resto del flujo funciona igual.
6. **Sync trigger `sync_opportunity_status_from_quotation`**: si la opp tiene múltiples cotizaciones (raro pero posible con V1 + V2 + ...), debe sincronizar usando la "última versión activa" no histórica. Validar lógica en Slice 2.
7. **`audit_logs` puede no existir todavía**: verificar al iniciar Slice 2. Si no existe, crearla en migración 035.
8. **Cron `wa-quotation-reminders-daily` corre a 14:00 UTC = 09:00 Colombia**: confirmar que es horario aceptable para mandar WhatsApps comerciales (no muy temprano para clientes).
9. **Public URL via SSR o CSR**: hoy el resto del frontend es SPA con Vite. La URL `/cotizacion/<token>` debe ser SPA también (no requiere SSR). El SEO no importa (es un link privado).

### 7.2 Dependencias entre slices

```
S1 ──> S2 ──> S3 ──> S4 (independiente de S5)
              └─────> S5 (independiente de S4)
```

S4 y S5 pueden ejecutarse en cualquier orden o en paralelo después de S3. S2 y S3 son secuenciales.

### 7.3 Métricas a observar post-launch

- **Tiempo promedio** entre `sent` y `client_approved` (cuánto tarda el cliente en decidir).
- **% de cotizaciones aceptadas** vs rechazadas vs expiradas.
- **% de aceptaciones que terminan en pago verificado** (drop-off en el paso de pago).
- **`view_count` promedio antes de aceptar** (¿la gente revisa varias veces?).
- **Distribución de motivos de rechazo** (alimenta decisiones de pricing y oferta).
- **Tiempo entre `pending_payment_verification` y `approved`** (cuánto tarda Alvaro en verificar).

Si en 60 días post-launch:
- > 20% drop-off entre aceptación y pago → considerar agregar recordatorios extra (revisar exclusión D9).
- > 30% expiran sin acción → considerar recordatorios más agresivos.
- < 80% de aprobaciones → revisar UX de la URL pública (probablemente fricción que no anticipamos).

### 7.4 Preguntas abiertas para resolver durante la ejecución

1. **¿`audit_logs` ya existe?** Si sí, schema actual; si no, definir en 035.
2. **¿`system_settings` actualmente tiene RLS?** Definir permisos lectura/escritura por rol antes de S1.
3. **Diseño visual de la URL pública**: mockup pendiente. Recomendación: mobile-first, paleta de la marca Innovar, tipografía grande, botones claros.
4. **¿El número de Alvaro para el diseñador QA?** Confirmar antes de Slice 1.

---

## 8. Anexos

### A. Mapeo de cada decisión del grill a su sección en este PRD

| Decisión | Resumen | Implementada en sección |
|---|---|---|
| D1 | Aceptación todo-o-nada | §2 (User Stories cliente), §4.1 (RPCs `accept`/`reject`), §6 (out of scope: parcial) |
| D2 | Aceptación = intención; pago verificado = cliente | §2 (flujo macro), §4.3 (state machine), §4.1 (`verify_payment`) |
| D3.1 | Designer asignado manual por Alvaro | §4.1 (`DesignerPicker`, `PaymentVerificationModal`) |
| D3.2 | `design_deadline` vacío al crear proyecto | §4.1 (sin default), §6 (out of scope: vista diseñador) |
| D3.3 | Agregar `clients.first_project_at` | §4.1, §4.2 (migración 030) |
| D3.4 | Notif in-app + WA al diseñador | §4.4 (template `project_assigned_designer_v1`), §4.5 |
| D4 | URL expirada con botón "solicitar nueva" | §4.1 (`request_quotation_reactivation`), §4.1 (`QuotationExpiredView`) |
| D5 | 3 botones (Aceptar/Ajustes/Rechazar) + motivos predefinidos | §4.1 (`QuotationActionButtons`), §4.1 (columnas `client_rejection_*`) |
| D6 | Versionado: mismo número, V2 copia editable, redirect | §2 (flujo), §4.1 (`create_quotation_version_v2`, `QuotationRedirectView`, `QuotationVersionsDiff`), §4.4 (template V2) |
| D7 | `/cotizacion/<token>` + `viewed_at` + `view_count` | §4.1 (`get_public_quotation` incrementa), §4.1 (`PublicQuotation` route) |
| D8 | Bank info en `system_settings`, cliente sube comprobante, cualquier monto, verificación manual | §4.1 (`system_settings`, `submit_quotation_payment_proof`, `PendingPayments`, `BankSettings`) |
| D9 | MVP: solo 1 recordatorio 3d antes + aviso expiración | §4.1 (`enqueue_quotation_reminders_3d`, `expire_quotations_scan`), §4.4 (1 template) |
| D10 | Lock al `sent`, admin desbloquea con `change_reason` + audit | §4.1 (`lock_quotation_on_sent`, `unlock_quotation`, `QuotationLockBadge`), §4.6 (audit) |
| D11 | Solo WhatsApp | §6 (out of scope: email) |
| D12 | PDF post-aprobación inmutable | §4.1 (`generate-quotation-pdf` Edge Function, bucket `quotation-pdfs`), §4.8 (Slice 5) |
| D13 | Status quo IVA y descuentos | §6 (out of scope explícito) |
| D14 | Diseñador QA en Slice 1 con WA de Alvaro | §4.1 (DB seed), §4.2 (migración 032), §7.1 (riesgo) |

### B. Glosario para no-técnicos (Alvaro y stakeholders)

- **RPC**: función en la base de datos que el frontend o un cliente puede llamar. Como un "endpoint" pero dentro de Supabase.
- **Trigger**: regla automática en la base de datos que se ejecuta cuando algo cambia (ej: cuando se actualiza un campo).
- **Cron**: tarea programada que el sistema ejecuta cada X tiempo (ej: cada día a las 14:00).
- **Edge Function**: pieza de código que se ejecuta en los servidores de Supabase, no en el navegador del usuario.
- **RLS** (Row Level Security): regla que define qué filas de una tabla puede ver/editar cada usuario.
- **Migración SQL**: script que cambia la estructura de la base de datos (agregar columnas, crear tablas, etc.). Numeradas para aplicar en orden.
- **Slice**: una porción del trabajo total que se puede entregar de forma independiente y va a producción antes de pasar a la siguiente.
- **Soak**: período de "reposo" entre que se libera una slice y se empieza la siguiente, para detectar bugs en producción real.
- **Feature flag**: interruptor que permite encender/apagar una funcionalidad sin tener que hacer deploy nuevo.
- **Bucket**: contenedor de archivos en Supabase Storage. Los comprobantes y PDFs viven en buckets.
