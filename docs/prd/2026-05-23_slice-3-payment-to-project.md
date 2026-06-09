# PRD: Fase 4 · Slice 3 — Pago → Proyecto

> **Versión**: 1.0 · **Estado**: Listo para ejecución (Fase 5)
> **Fecha**: 2026-05-23 · **Audiencia**: devs y agentes de IA ejecutores
> **Fuente**: Grill-me Fase 1 (2026-05-23 noche) — 13 decisiones cerradas (D1-D13) por Álvaro Ríos
> **Plan aprobado**: `C:\Users\ceoel\.claude\plans\stateless-plotting-wombat.md`
> **Handoff de diseño**: `docs/handover/2026-05-23_PHASE-4-SLICE-3-DESIGN.md`
> **Idioma de identificadores DB/código**: inglés · **Idioma de UI y este documento**: español
> **Reemplaza**: migración 036 (no desplegada). El trabajo arranca con migraciones 037+.
> **Branch base sugerida**: rama nueva `slice-3-payment-flow` cortada de la branch actual de S2 desplegada.

---

## 1. Problem Statement

Slice 2 cerró el bucle por el lado del cliente: hoy el cliente abre `/c/<short_code>`, ve su cotización, y dispara una de tres acciones (aceptar / pedir ajustes / rechazar) con WhatsApp automático al admin. **El flujo se corta justo ahí.** Después de que el cliente acepta:

1. **El cliente no sabe a dónde pagar.** No hay datos bancarios visibles en la propuesta. Tiene que pedirlos por WhatsApp y Álvaro los escribe a mano cada vez.
2. **El cliente no tiene cómo subir el comprobante.** Hoy lo manda por WhatsApp en una foto que se pierde en el chat y no queda asociada a la cotización.
3. **No existe una cola visible de "pagos por verificar".** Álvaro tiene que abrir cada cotización aceptada y preguntar manualmente si llegó el pago.
4. **No existe el puente automático "pago verificado → proyecto activo con diseñador".** El admin tiene que crear el proyecto a mano, copiarle el monto, asignar diseñador en otra pantalla, y notificarle. Cuatro pasos que se olvidan.
5. **No existe el concepto de saldo (`balance_due`).** Si el cliente paga el anticipo, no hay registro de cuánto debe. Si paga un abono posterior, hay que sumar/restar a mano. Cuando paga todo, nadie marca "totalmente pagado".
6. **No existe expiración automática de cotizaciones aceptadas sin pago.** Una cotización aceptada el 1 de enero sin pago el 31 de marzo sigue figurando como activa, contaminando reportes y métricas.
7. **No existe forma de cancelar una aceptación** ("el cliente me llamó y desistió"). El estado `client_approved` es de hecho terminal sin escape.
8. **No existe forma de versionar después de aceptar** ("el cliente aceptó pero quiere agregar un ítem"). Hoy hay que cancelar manualmente y armar otra cotización desde cero.
9. **No existen datos bancarios configurables.** Las 7 filas placeholder ya existen en `system_settings` desde Slice 2 (validado en prod: `bank_name`, `bank_account_number`, `bank_account_type`, `bank_holder_name`, `bank_holder_id`, `nequi_phone`, `daviplata_phone`) pero **todas están vacías** y no hay UI para editarlas.
10. **El rechazo de comprobante no existe.** Si Álvaro recibe una captura ilegible o de un pago equivocado, no tiene cómo decir "rechazado, mandá uno bueno" con trazabilidad — solo borraría el row a mano.
11. **El estado machine de `quotation_status` en producción tiene 7 valores** (`draft, sent, approved, rejected, client_approved, pending_payment_verification, expired`) pero **faltan dos**: `cancelled` (para Q9) y `superseded` (para Q3).
12. **`payments.verification_status` en producción es TEXT sin CHECK constraint** y solo se usa con `pending` y `verified`. **Falta el valor `rejected`** y faltan columnas de audit (`rejection_reason`, `rejected_by`, `rejected_at`) para Q7.
13. **`projects` en producción no tiene `balance_due` ni `is_fully_paid`** (validado contra schema vivo). Sin estos, Q11 (abonos post-anticipo) no se puede ejecutar.

Sin esto resuelto, el ciclo Lead→Project queda en limbo manual. El cliente acepta, le mandan datos por WhatsApp aparte, paga, manda foto al chat, Álvaro la mira, crea el proyecto manualmente. Cada paso es punto de fuga.

---

## 2. Solution

Cerrar el bucle agregando el flujo de pago end-to-end, gatillado por el primer pago verificado que convierte automáticamente la cotización aceptada en un proyecto activo con diseñador asignado, todo bajo un **feature flag** `slice_3_enabled` que permite a Álvaro deployar el código apagado y prenderlo solo para 1-2 clientes piloto antes de activarlo para todos.

### Flujo macro (lo que cambia para los usuarios)

1. **Álvaro configura datos bancarios una sola vez** en `Configuración → Datos Bancarios` (banco, cuenta, titular, NIT, Nequi, Daviplata).
2. **Álvaro prende el feature flag** desde `Configuración → Pagos` cuando esté listo para piloto.
3. **El cliente acepta la cotización** (Slice 2 ya hace esto). Trigger existente `fn_notify_quotation_acceptance` ya encola WhatsApp `payment_request_v1` al cliente con datos bancarios + WhatsApp `admin_quotation_accepted_v1` al admin + notif in-app.
4. **El cliente abre el mismo link `/c/<short_code>`** y ve nueva sección "Realizar pago": datos bancarios renderizados + uploader de comprobante (foto/PDF) + form (monto, método).
5. **Cliente sube comprobante** → RPC `submit_quotation_payment_proof` crea row en `payments` con `verification_status='pending'` + flag `below_suggested` si monto < 30% del total (`suggested_min_advance_pct`, ya existe en `system_settings`). Cotización pasa a `pending_payment_verification`. Cliente ve mensaje "comprobante recibido, te avisamos cuando esté verificado".
6. **Admin ve "1" en badge "Por verificar"** en `/pagos` tab por defecto. La página `Pagos.tsx` se refactoriza a 3 tabs: **Por verificar** | **Verificados** | **Rechazados**.
7. **Admin click "Verificar"** → modal `PaymentVerifyModal` muestra: preview del comprobante (imagen/PDF), datos cliente + cotización, monto, dropdown "Asignar diseñador" (con escape "asignar después"), dropdown "Tipo de pago" (`anticipo` por defecto en primer pago; `abono`/`pago_final` para pagos sobre proyecto ya creado), botón "Verificar y crear proyecto" o "Rechazar con motivo".
8. **Click "Verificar y crear proyecto"** → RPC `verify_payment`:
   - Marca `payments.verification_status='verified'`, `verified_by=current_user`, `verified_at=now()`.
   - Si es **primer pago verificado** de esta cotización: dispara trigger de conversión que crea row en `projects` con `status='cotizacion_aprobada'`, `approved_quotation_id`, `designer_id` (del modal), `total_amount`, `advance_amount`, `balance_due = total_amount - amount`, `is_fully_paid = (balance_due <= 0)`. Mueve cotización a `approved` + `is_locked=true`. Mueve opportunity a `converted_to_project`.
   - Si **NO es primer pago** (proyecto ya existe): solo actualiza `balance_due = total_amount - SUM(verified payments)` y `is_fully_paid` si llega a 0.
   - Encola WhatsApps: cliente recibe `payment_received` (template ya aprobado en Meta, 5 vars: nombre/monto/proyecto/método/saldo); diseñador asignado recibe `project_assigned_designer_v1`.
   - Si `balance_due` llegó a 0: encola adicional `project_fully_paid_v1` al cliente.
9. **Click "Rechazar con motivo"** → modal `PaymentRejectModal` pide razón obligatoria (textarea) → RPC `reject_payment`:
   - Marca `payments.verification_status='rejected'`, `rejection_reason`, `rejected_by`, `rejected_at`.
   - Encola WhatsApp `payment_proof_rejected_v1` al cliente con razón + link reintento (mismo `/c/<short_code>`).
   - Cotización vuelve a `client_approved` (sale de `pending_payment_verification`).
   - Pago queda visible en tab "Rechazados" del admin.
10. **Admin registra efectivo/cheque manualmente** desde botón "Registrar pago manual" en `/pagos` → modal elige cliente + cotización + monto + método (efectivo/cheque/transferencia/Nequi/Daviplata) + diseñador → crea `payments` con `verification_status='verified'` directo (no pasa por `pending`) → mismo trigger de conversión.
11. **Cron diario `expire_accepted_quotations_scan`** corre 14:30 UTC (después de los crons existentes): detecta cotizaciones en `client_approved` o `pending_payment_verification` con `client_approved_at < now() - INTERVAL 'N days'` (donde N = `system_settings.payment_window_days`, default 7) → marca `expired` → encola WhatsApp `admin_quotation_expired_v1` al admin con info para decidir "reactivar" (botón en `/pagos` que reinicia `client_approved_at = now()` y vuelve a `client_approved`) o ignorar.
12. **Admin cancela aceptación** (cliente desistió pre-pago) desde botón "Cancelar aceptación" en detalle de cotización aceptada → modal `QuotationCancelModal` pide motivo → RPC `cancel_quotation_acceptance`:
    - Cotización pasa a `cancelled` (nuevo estado del enum).
    - Opportunity vuelve a `lost` con la razón.
    - `short_code` invalidado (cliente abre link → ve "esta cotización fue cancelada").
13. **Admin crea revisión post-aceptación** (cliente aceptó pero pidió cambios) desde botón "Crear versión nueva" en detalle de cotización aceptada → RPC `create_quotation_revision`:
    - V1 actual pasa a `superseded` (nuevo estado del enum) + `is_locked=true`.
    - V2 nueva se crea como copia editable (`parent_quotation_id=V1.id`, `version_number=V1.version_number+1`).
    - Link de V1 (`/c/<short_code>`) invalidado.
    - V2 al ser enviada al cliente: encola WhatsApp `quotation_v2_sent_v1` con link nuevo `/c/<new_short_code>`.

### Mecanismos transversales (lo que el sistema gestiona solo)

- **`balance_due` siempre consistente**: trigger AFTER INSERT/UPDATE/DELETE en `payments` que recalcula `projects.balance_due = projects.total_amount - SUM(payments.amount WHERE verification_status='verified')` y `is_fully_paid = (balance_due <= 0)`. Maneja correctamente rechazos posteriores y reembolsos.
- **Anticipo bajo el sugerido (Q2)**: cuando admin verifica, si `payment.amount < total_amount * (suggested_min_advance_pct / 100)`, modal muestra warning amarillo "este pago está bajo el 30% sugerido — continuar igual?" pero **no bloquea**. Flag `below_suggested=true` queda guardado.
- **Feature flag `slice_3_enabled`** en `system_settings` (BOOLEAN, default `false`). Mientras esté OFF:
  - Sección "Realizar pago" no aparece en `/c/<short_code>` aunque la cotización esté aceptada.
  - Tabs nuevas de `/pagos` no aparecen (la página queda con su layout actual).
  - Botón "Registrar pago manual" no aparece.
  - Botones "Cancelar aceptación" y "Crear versión nueva" no aparecen.
  - Cron de expiración corre pero **sale antes de marcar nada** si flag OFF.
  - Flujo legacy de Álvaro (manual fuera del CRM) sigue funcionando exactamente igual.
- **Apagable con 1 click** desde `Configuración → Pagos` toggle. Si Álvaro detecta un bug en piloto, apaga el flag sin redeploy y vuelve al flujo manual hasta que se arregle.
- **`is_locked` en cotización aprobada**: cuando primer pago verifica → `quotations.is_locked = true`. Pero RPC `submit_quotation_payment_proof` acepta uploads aun con `is_locked=true` (necesario para Q11 abonos post-conversión sobre el mismo link).
- **`short_code` se invalida** (col `is_active=false` o vía trigger) en transiciones: `cancelled`, `superseded`, `expired`, `rejected`. PublicQuotation muestra mensaje correspondiente.

### Lo que NO cambia (queda intacto)

- **Slice 2 desplegado**: ruta `/c/<short_code>`, RPCs `accept_public_quotation` / `reject_public_quotation` / `request_quotation_adjustments`, modales del cliente (Aceptar/Rechazar/Ajustes), bell, NotificationsPage.
- **Tabla `quotations` schema base** (columnas existentes): `subtotal`, `discount_type`, `discount_value`, `transport_cost`, `total_amount`, `is_locked`, `version_number`, `parent_quotation_id`, `is_historical_copy`, `valid_until`, `quotation_number`, `public_token`, `short_code`, `quotation_type`, `bypassed_visit`, `viewed_at`, `view_count`, `client_approved_at`, `client_rejection_reason`, `client_rejection_subtype`, `client_acceptance_note`, `project_id`, `is_locked`.
- **Tabla `payments` schema base**: todas las columnas existentes (`quotation_id`, `project_id`, `amount`, `payment_method`, `payment_type`, `proof_url`, `verification_status`, `received_at`, `verified_at`, `verified_by`, `below_suggested`, `registered_by`, `receipt_url`, `notes`).
- **Triggers existentes**: `fn_notify_quotation_acceptance` (mig 035b), `fn_notify_quotation_rejection`, `handle_payment_approval`, `convert_quotation_to_project`, `create_project_from_approved_quotation`, `notify_project_created` (mig 009). El trigger nuevo de Slice 3 (`trg_payment_convert_to_project`) **complementa** sin reemplazar — orquesta la lógica de balance + WhatsApp.
- **Edge function `process-whatsapp-notifications`**: estructura sin cambios. Solo se extiende `TEMPLATE_REGISTRY` con builders para los templates nuevos cuando estén aprobados.
- **Cron `process-whatsapp-notifications-every-minute`**: despacha automáticamente los rows nuevos en `notification_queue`.
- **Página `/notifications`**: ya construida en Slice anterior. Acepta nuevos `notification_type` sin cambios.

---

## 3. Decisiones cerradas (autoritativas, NO renegociar)

Las 13 decisiones del grill 2026-05-23 son input del PRD, no salida. Cualquier ambigüedad durante ejecución se resuelve preguntando al usuario, **no reabriendo estas**.

| # | Pregunta | Decisión cerrada |
|---|---|---|
| **D1** | Quién registra el pago | **Coexisten dos caminos**: (a) cliente sube comprobante desde `/c/<short_code>` para métodos remotos (transferencia, Nequi, Daviplata, PSE); (b) admin registra manual desde `/pagos` para métodos presenciales (efectivo, cheque). Ambos generan rows en `payments`; el camino admin entra ya como `verified`. |
| **D2** | Monto que dispara conversión a proyecto | **Primer pago verificado** de la cotización convierte a proyecto. Saldo restante queda en `projects.balance_due` (calculado: `total_amount - SUM(verified payments)`). **Sin umbral mínimo bloqueante**: si el anticipo está bajo el sugerido (`suggested_min_advance_pct`, default 30%, ya existe en `system_settings`), se muestra warning visible al admin pero se permite verificar. |
| **D3** | Versionado al pedir ajustes post-aceptación | Versión nueva **reemplaza** la anterior: V1 pasa a `superseded` (nuevo estado del enum) + `is_locked=true` + link viejo invalidado. V2 nace editable como copia (`parent_quotation_id=V1.id`, `version_number=V1.version_number+1`, nuevo `short_code`). WhatsApp automático `quotation_v2_sent_v1` al cliente con link nuevo. Reusa las columnas `parent_quotation_id` + `version_number` ya existentes en `quotations`. |
| **D4** | Expiración tras aceptar sin pago | Cron diario marca `expired` toda cotización en `client_approved` o `pending_payment_verification` con `client_approved_at < now() - INTERVAL '<N> days'`, donde `N = system_settings.payment_window_days` (default **7**, configurable). Encola notif in-app + WhatsApp `admin_quotation_expired_v1` al admin con botón "Reactivar" que vuelve la cotización a `client_approved` y reinicia `client_approved_at = now()`. |
| **D5** | Asignación de diseñador | Dropdown en `PaymentVerifyModal` con escape "asignar después" (deja `projects.designer_id = NULL` y badge amarillo "Sin diseñador" en el proyecto). Lista de diseñadores: `profiles WHERE role='diseno' AND is_active=true`. |
| **D6** | Datos bancarios | **Una cuenta principal + Nequi + Daviplata.** Pantalla nueva `Configuración → Datos Bancarios` (`/admin/configuracion/bancarios`) edita las 7 filas placeholder de `system_settings` ya existentes (`bank_name`, `bank_account_number`, `bank_account_type`, `bank_holder_name`, `bank_holder_id`, `nequi_phone`, `daviplata_phone`). Sin tabla nueva. |
| **D7** | Rechazo de comprobante | Dos botones en `PaymentVerifyModal`: "Verificar y crear proyecto" / "Rechazar con motivo". El de rechazo abre `PaymentRejectModal` con textarea obligatoria. RPC `reject_payment` marca el pago con `verification_status='rejected'` + razón + audit; encola WhatsApp `payment_proof_rejected_v1` al cliente con la razón + link para reintentar (mismo `/c/<short_code>`). Cotización vuelve a `client_approved`. Pago rechazado queda visible en tab "Rechazados" del admin (historial). |
| **D8** | Permisos para verificar | **Cualquier admin** puede verificar (`role IN ('admin', 'super_admin')`). RPC `verify_payment` valida con `get_my_role()`. Audit obligatorio: `verified_by` (uuid del admin) + `verified_at` (timestamp) + `amount` queda persistido en el row de payment para trazabilidad. |
| **D9** | Cancelar aceptación pre-pago | Solo admin/super_admin, desde botón "Cancelar aceptación" en detalle de cotización aceptada. Modal pide motivo (textarea obligatoria). RPC `cancel_quotation_acceptance` marca `quotations.status='cancelled'` (nuevo estado del enum), invalida `short_code`, vuelve `opportunities.status='lost'` con razón. Cliente NO tiene este botón. |
| **D10** | UX pantalla `/pagos` | Refactor a **3 tabs**: **Por verificar** (default, con badge contador) | **Verificados** | **Rechazados**. Construir sobre `Pagos.tsx` existente. Botón "Registrar pago manual" siempre visible en header. |
| **D11** | Abonos post-anticipo | **Mismo link `/c/<short_code>`** sirve para abonos posteriores. RPC `submit_quotation_payment_proof` acepta uploads aun con `is_locked=true`. Admin al verificar elige `payment_type` (`anticipo` por defecto en primer pago, `abono` o `pago_final` en posteriores). Cuando `balance_due` llega a 0 (calculado por trigger): se setea `projects.is_fully_paid=true`, se encola WhatsApp `project_fully_paid_v1` al cliente. |
| **D12** | Notif al admin (WA) | **Mínimo crítico**: solo 2 templates WA admin nuevos (`admin_quotation_accepted_v1` que ya existe del S2 + nuevo `admin_quotation_expired_v1`). El resto de eventos admin van por notif in-app (badge en `/pagos`, bell) sin WA. **Cliente sí recibe WA en cada evento** (request, received, rejected, fully_paid). **Diseñador sí recibe WA al asignación** (`project_assigned_designer_v1`). |
| **D13** | Rollout | **Feature flag** `slice_3_enabled` en `system_settings` (BOOLEAN, default `false`). Deploy de Slice 3 completo con flag OFF. Álvaro prende para 1-2 clientes piloto desde `Configuración → Pagos`, valida flujo end-to-end, después activa para todos. **Apagable con 1 click sin redeploy** desde el toggle. Mientras esté OFF: el flujo legacy (manual fuera del CRM) sigue funcionando intacto. |

---

## 4. User Stories

### Cliente (no autenticado, accede vía link `/c/<short_code>`)

- Como **cliente que aceptó mi cotización**, quiero ver en el mismo link los datos bancarios (banco, cuenta, titular, NIT, Nequi, Daviplata) para hacer el pago sin tener que pedirlos por WhatsApp.
- Como **cliente que ya pagué**, quiero poder subir el comprobante (foto o PDF) en la misma página, indicando el monto y el método, para que quede asociado a mi cotización y no se pierda en un chat.
- Como **cliente que subí comprobante**, quiero ver un mensaje claro "comprobante recibido, te confirmamos cuando esté verificado" para tener expectativa de qué viene.
- Como **cliente con pago verificado**, quiero recibir un WhatsApp confirmándolo, con el monto, el nombre del proyecto y mi saldo restante, para tener tranquilidad y saber cuánto debo todavía.
- Como **cliente con comprobante rechazado**, quiero recibir un WhatsApp explicando la razón (ej: "captura ilegible") + link para subir uno nuevo, sin perder la cotización.
- Como **cliente con saldo pendiente**, quiero poder volver al mismo link en cualquier momento para hacer un abono más, sin que me pidan datos nuevos.
- Como **cliente que terminé de pagar**, quiero recibir un WhatsApp "¡proyecto totalmente pagado!" para confirmar que cerré mi compromiso.

### Álvaro (admin / super_admin)

- Como **admin**, quiero configurar mis datos bancarios (cuenta, titular, NIT, Nequi, Daviplata) una sola vez desde una pantalla `/admin/configuracion/bancarios`, para que el cliente los vea automáticamente en cada cotización aceptada sin tener que decírselos por chat.
- Como **admin**, quiero abrir `/pagos` y ver inmediatamente en la tab "Por verificar" todos los comprobantes nuevos con un badge contador, para no tener que cazarlos uno por uno.
- Como **admin verificando un pago**, quiero ver el comprobante embebido + datos del cliente + monto + warning si el pago está bajo el 30% sugerido + dropdown para asignar diseñador, todo en un modal, para decidir en un solo gesto.
- Como **admin verificando primer pago**, quiero que al confirmar se cree automáticamente el proyecto con el diseñador asignado, se le mande WhatsApp al cliente y al diseñador, y se bloquee la cotización, sin tener que ir a otras pantallas.
- Como **admin rechazando un comprobante**, quiero un modal que me pida razón obligatoria, dispare WhatsApp al cliente con esa razón + link para reintentar, y mueva el pago a la tab "Rechazados" para trazabilidad.
- Como **admin registrando un pago en efectivo**, quiero un botón "Registrar pago manual" en `/pagos` que me deje cargar cliente + cotización + monto + método sin pasar por el flujo de comprobante (porque el cliente pagó cash en persona).
- Como **admin**, quiero recibir notif in-app + WhatsApp cuando una cotización aceptada expira sin pago (7 días), con botón "Reactivar" que reinicia el plazo, para no perder ventas por olvido.
- Como **admin**, quiero un botón "Cancelar aceptación" en cotizaciones aceptadas que pida motivo, marque el estado `cancelled` y devuelva la opportunity a `lost`, para los casos donde el cliente desiste antes de pagar.
- Como **admin**, quiero un botón "Crear versión nueva" en cotizaciones aceptadas que cree una V2 editable como copia, marque V1 como `superseded`, e invalide el link viejo, para responder a ajustes post-aceptación sin reescribir.
- Como **admin**, quiero un toggle `slice_3_enabled` en `Configuración → Pagos` para encender/apagar todo este flujo con un click, sin pedir redeploy al equipo técnico, para hacer piloto seguro con 1-2 clientes antes de activar para todos.
- Como **admin**, quiero un slider o input `payment_window_days` en `Configuración → Pagos` para cambiar el plazo de expiración (default 7) sin tocar SQL.

### Diseñador (rol `diseno`, asignado por admin al verificar primer pago)

- Como **diseñador**, quiero recibir WhatsApp + notif in-app cuando me asignen un proyecto nuevo, con un link directo al detalle del proyecto, para arrancar sin esperar que me avisen verbalmente.

### Sistema (automatizaciones)

- Como **sistema**, debo aceptar uploads de comprobante aun con `quotations.is_locked=true` (para abonos post-conversión sobre cotización ya aprobada).
- Como **sistema**, debo recalcular `projects.balance_due` y `projects.is_fully_paid` después de cada INSERT/UPDATE/DELETE en `payments` (trigger), para mantener consistencia automática.
- Como **sistema**, debo invalidar el `short_code` (impide nuevos accesos al `/c/<code>`) en transiciones a `cancelled`, `superseded`, `expired` o `rejected`. La página pública renderiza el mensaje apropiado por estado.
- Como **sistema**, debo encolar mensajes con `dedup_key` (especialmente cron de expiración) para evitar duplicados si el cron corre dos veces el mismo día.
- Como **sistema**, debo respetar el feature flag `slice_3_enabled` en cada surface: si OFF, ningún UI nuevo aparece y el cron de expiración sale antes de mutar nada.
- Como **sistema**, debo encolar `project_fully_paid_v1` exactamente una vez por proyecto (cuando `balance_due` cruza de >0 a ≤0), no en cada pago posterior.

---

## 5. Implementation Decisions

### 5.1 Módulos involucrados

| Capa | Módulo | Tipo | Cambio |
|---|---|---|---|
| **DB enum** | `quotation_status` | Existente | Agregar valores `cancelled`, `superseded` con `ALTER TYPE ... ADD VALUE`. |
| **DB constraint** | `payments.verification_status` | Existente (TEXT sin CHECK) | Agregar CHECK constraint con `IN ('pending', 'verified', 'rejected')`. |
| **DB columns** | `payments.rejection_reason` | Nueva | TEXT NULLABLE — motivo cuando admin rechaza comprobante (Q7). |
| **DB columns** | `payments.rejected_by` | Nueva | UUID NULLABLE REFERENCES profiles(id) — admin que rechazó. |
| **DB columns** | `payments.rejected_at` | Nueva | TIMESTAMPTZ NULLABLE. |
| **DB columns** | `payments.payment_type` | Existente (TEXT) | Agregar CHECK `IN ('anticipo', 'abono', 'pago_final', 'reembolso')`. |
| **DB columns** | `projects.balance_due` | Nueva | NUMERIC(12,2) DEFAULT 0 — saldo restante calculado por trigger. |
| **DB columns** | `projects.is_fully_paid` | Nueva | BOOLEAN DEFAULT false — true cuando `balance_due <= 0`. |
| **DB columns** | `projects.fully_paid_at` | Nueva | TIMESTAMPTZ NULLABLE — cuando `is_fully_paid` cruzó a true. |
| **DB columns** | `projects.cancellation_reason` | Nueva | TEXT NULLABLE — motivo si proyecto se cancela post-creación (caso D9 cuando ya hubo conversión accidental). |
| **DB columns** | `quotations.cancellation_reason` | Nueva | TEXT NULLABLE — motivo registrado por admin al cancelar aceptación (D9). |
| **DB columns** | `quotations.cancelled_at` | Nueva | TIMESTAMPTZ NULLABLE. |
| **DB columns** | `quotations.cancelled_by` | Nueva | UUID NULLABLE REFERENCES profiles(id). |
| **DB columns** | `quotations.superseded_at` | Nueva | TIMESTAMPTZ NULLABLE — cuando admin creó V2 que reemplazó esta. |
| **DB columns** | `quotations.superseded_by_quotation_id` | Nueva | UUID NULLABLE REFERENCES quotations(id) — puntero a la V_n+1 que la reemplazó. |
| **DB rows (seed)** | `system_settings.payment_window_days` | Nueva fila | INTEGER, default `7`. Configurable por admin desde `Configuración → Pagos`. |
| **DB rows (seed)** | `system_settings.slice_3_enabled` | Nueva fila | BOOLEAN, default `false`. Feature flag (D13). |
| **DB function** | `submit_quotation_payment_proof(p_short_code TEXT, p_amount NUMERIC, p_method TEXT, p_proof_url TEXT, p_notes TEXT)` | Nueva RPC pública | SECURITY DEFINER. Valida `short_code` activo, cotización en `client_approved` o `approved`+`is_locked`. Inserta `payments` con `verification_status='pending'`. Calcula `below_suggested = amount < total_amount * (settings.suggested_min_advance_pct / 100)`. Si cotización aún en `client_approved`, mueve a `pending_payment_verification`. Sale silenciosamente si `slice_3_enabled=false`. |
| **DB function** | `verify_payment(p_payment_id UUID, p_designer_id UUID NULLABLE, p_payment_type TEXT)` | Nueva RPC | SECURITY DEFINER. Solo admin/super_admin (RAISE EXCEPTION 42501 si no). Setea `verification_status='verified'`, `verified_by`, `verified_at`, `payment_type` (si vino). Trigger encadenado crea proyecto si es primer pago verificado, asigna `designer_id`. Recalcula `balance_due`. Encola WhatsApps cliente + diseñador. |
| **DB function** | `reject_payment(p_payment_id UUID, p_reason TEXT)` | Nueva RPC | SECURITY DEFINER. Solo admin. Marca `verification_status='rejected'`, `rejection_reason`, `rejected_by`, `rejected_at`. Mueve cotización de `pending_payment_verification` a `client_approved`. Encola WhatsApp `payment_proof_rejected_v1`. |
| **DB function** | `register_manual_payment(p_quotation_id UUID, p_amount NUMERIC, p_method TEXT, p_payment_type TEXT, p_designer_id UUID NULLABLE, p_notes TEXT)` | Nueva RPC | SECURITY DEFINER. Solo admin. Inserta `payments` con `verification_status='verified'` directo (registered_by=current_user, verified_by=current_user, verified_at=now()). Dispara mismo trigger de conversión. Camino para D1.b (efectivo/cheque presencial). |
| **DB function** | `cancel_quotation_acceptance(p_quotation_id UUID, p_reason TEXT)` | Nueva RPC | SECURITY DEFINER. Solo admin. Valida estado `client_approved` o `pending_payment_verification`. Setea `status='cancelled'`, `cancellation_reason`, `cancelled_by`, `cancelled_at`. Invalida `short_code`. Vuelve `opportunities.status='lost'` con razón. |
| **DB function** | `create_quotation_revision(p_quotation_id UUID)` | Nueva RPC | SECURITY DEFINER. Solo admin. Valida estado `client_approved` o `pending_payment_verification`. Crea nueva fila copiando todos los `quotation_items`, hereda `quotation_number`, `parent_quotation_id=p_quotation_id`, `version_number = parent.version_number + 1`, nuevo `short_code`, `status='draft'`. Marca V1 `status='superseded'`, `superseded_at=now()`, `superseded_by_quotation_id=V2.id`, invalida short_code de V1. Retorna `(new_quotation_id, new_short_code)`. |
| **DB function** | `reactivate_expired_quotation(p_quotation_id UUID)` | Nueva RPC | SECURITY DEFINER. Solo admin. Valida estado `expired`. Vuelve a `client_approved`, setea `client_approved_at=now()` (reinicia ventana). Re-emite `short_code` activo si fue invalidado. |
| **DB function** | `expire_accepted_quotations_scan()` | Nueva | Lee `system_settings.slice_3_enabled` y `payment_window_days`. Si flag OFF, return. Si ON, UPDATE quotations SET status='expired' WHERE status IN ('client_approved', 'pending_payment_verification') AND client_approved_at < now() - (N \|\| ' days')::interval. Por cada fila afectada, encola WA `admin_quotation_expired_v1` con `dedup_key`. |
| **DB function** | `recalc_project_balance_due(p_project_id UUID)` | Nueva helper | UPDATE projects SET balance_due = total_amount - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE project_id=p_project_id AND verification_status='verified'), is_fully_paid = (balance_due <= 0), fully_paid_at = CASE WHEN is_fully_paid AND fully_paid_at IS NULL THEN now() ELSE fully_paid_at END. Si `fully_paid_at` cruzó de NULL a NOT NULL: encola WA `project_fully_paid_v1` (dedup por project_id). |
| **DB trigger** | `trg_payment_verified_convert_to_project` | Nueva | AFTER UPDATE OF verification_status ON payments. Si NEW.verification_status='verified' AND OLD.verification_status<>'verified': verifica si es primer pago verificado de la cotización; si sí, crea proyecto con `designer_id` (que vino del RPC), copia totales, asigna `balance_due = total_amount - NEW.amount`, marca quotation `approved` + `is_locked=true`, mueve opportunity `converted_to_project`. Si no es primer pago: solo asocia `payment.project_id = existing_project.id`. Llama `recalc_project_balance_due`. Encola WAs (cliente `payment_received` aprobado + diseñador `project_assigned_designer_v1`). |
| **DB trigger** | `trg_payment_recalc_balance` | Nueva | AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW. Llama `recalc_project_balance_due(NEW.project_id OR OLD.project_id)`. |
| **DB trigger** | `trg_quotation_invalidate_short_code` | Nueva | AFTER UPDATE OF status ON quotations. Si NEW.status IN ('cancelled', 'superseded', 'expired', 'rejected'): marca `short_code` inactivo (vía columna `short_code_active=false` o tabla `quotation_short_codes` si existe — verificar con schema vivo en Fase 3). |
| **DB cron** | `slice3-expire-accepted-quotations-daily` | Nueva | `30 14 * * *` (14:30 UTC = 09:30 Colombia). Corre `expire_accepted_quotations_scan()`. |
| **Edge function** | `process-whatsapp-notifications` | Existente (v13) | Extender `TEMPLATE_REGISTRY` con 5 templates nuevos cuando estén aprobados en Meta. Redeploy via `supabase functions deploy`. |
| **Frontend route** | `App.tsx` | Existente | Registrar nuevas rutas: `/admin/configuracion/bancarios`, `/admin/configuracion/pagos`. Ya existen `/pagos` y `/c/:short_code`. |
| **Frontend page** | `src/pages/Pagos.tsx` | Refactor mayor | Convertir a layout 3-tabs (`Por verificar` default + badge contador, `Verificados`, `Rechazados`). Botón "Registrar pago manual" en header. Tab actual queda como contenido de "Verificados". |
| **Frontend page** | `src/pages/PublicQuotation.tsx` | Modificación | Si `quotation.status IN ('client_approved', 'pending_payment_verification', 'approved')` AND `slice_3_enabled=true`: renderizar sección "Realizar pago" con datos bancarios + `PaymentProofUploader`. Si `status IN ('cancelled', 'superseded', 'expired', 'rejected')`: renderizar mensaje correspondiente con CTA acorde (ej: link a versión nueva si `superseded`). |
| **Frontend page** | `src/pages/BankSettings.tsx` | Nueva | Ruta `/admin/configuracion/bancarios`. Form con 7 campos editando filas de `system_settings`. |
| **Frontend page** | `src/pages/PaymentSettings.tsx` | Nueva | Ruta `/admin/configuracion/pagos`. Toggle `slice_3_enabled` + input numérico `payment_window_days` (default 7, mínimo 1, máximo 60) + input numérico `suggested_min_advance_pct` (default 30, ya existente). |
| **Frontend component** | `src/components/public/PaymentProofUploader.tsx` | Nuevo | File picker (image/* + application/pdf, max 5MB) + form (monto NUMERIC, método dropdown `transferencia/nequi/daviplata/pse`, notas opcional). Upload a bucket `payment-receipts` (vía storage RLS pública INSERT, READ admin) → llama RPC `submit_quotation_payment_proof`. |
| **Frontend component** | `src/components/payments/PaymentVerifyModal.tsx` | Nuevo | Preview del comprobante (img embebida o PDF iframe) + datos cliente + cotización + monto + warning amarillo si `below_suggested=true` + dropdown `DesignerPicker` con escape "asignar después" + dropdown `payment_type` (default `anticipo` si primer pago, `abono`/`pago_final` si proyecto ya existe) + botones "Verificar y crear proyecto" / "Rechazar con motivo". |
| **Frontend component** | `src/components/payments/PaymentRejectModal.tsx` | Nuevo | Textarea obligatoria "Motivo del rechazo" (min 10 chars) + botón "Confirmar rechazo". Llama RPC `reject_payment`. |
| **Frontend component** | `src/components/payments/ManualPaymentModal.tsx` | Nuevo | Form: selector de cotización aceptada (autocomplete `client_approved` o `pending_payment_verification`) + monto + método (efectivo/cheque/...) + `DesignerPicker` (si primer pago) + `payment_type` + notas. Llama RPC `register_manual_payment`. |
| **Frontend component** | `src/components/quotations/QuotationCancelModal.tsx` | Nuevo | Textarea obligatoria "Motivo de cancelación" + botón "Confirmar cancelación". Llama RPC `cancel_quotation_acceptance`. |
| **Frontend component** | `src/components/quotations/QuotationRevisionButton.tsx` | Nuevo | Botón "Crear versión nueva" + confirmación. Llama RPC `create_quotation_revision`, navega a edición de la V2 recién creada. |
| **Frontend component** | `src/components/payments/DesignerPicker.tsx` | Nuevo | Select con `useActiveDesigners` + opción "asignar después" (UUID NULL). |
| **Frontend component** | `src/components/settings/BankSettingsForm.tsx` | Nuevo | Form con 7 inputs (banco, número cuenta, tipo cuenta, titular, NIT, Nequi, Daviplata). Usa `useSystemSettings` para read/write. |
| **Frontend component** | `src/components/settings/PaymentSettingsForm.tsx` | Nuevo | Toggle + 2 inputs numéricos. Usa `useSystemSettings`. |
| **Frontend hook** | `src/hooks/useSubmitPaymentProof.ts` | Nuevo | Mutation con upload a Storage + RPC. Maneja error de tamaño/tipo. |
| **Frontend hook** | `src/hooks/useVerifyPayment.ts` | Nuevo | Mutation contra `verify_payment`. Invalida queries `payments`, `projects`, `quotations`. |
| **Frontend hook** | `src/hooks/useRejectPayment.ts` | Nuevo | Mutation contra `reject_payment`. |
| **Frontend hook** | `src/hooks/useRegisterManualPayment.ts` | Nuevo | Mutation contra `register_manual_payment`. |
| **Frontend hook** | `src/hooks/useCancelQuotationAcceptance.ts` | Nuevo | Mutation contra `cancel_quotation_acceptance`. |
| **Frontend hook** | `src/hooks/useCreateQuotationRevision.ts` | Nuevo | Mutation contra `create_quotation_revision`. |
| **Frontend hook** | `src/hooks/useReactivateExpiredQuotation.ts` | Nuevo | Mutation contra `reactivate_expired_quotation`. |
| **Frontend hook** | `src/hooks/usePendingPayments.ts` | Nuevo | useQuery: `payments WHERE verification_status='pending'` con JOIN a quotation+client. |
| **Frontend hook** | `src/hooks/useVerifiedPayments.ts` | Nuevo | useQuery: `payments WHERE verification_status='verified'`. |
| **Frontend hook** | `src/hooks/useRejectedPayments.ts` | Nuevo | useQuery: `payments WHERE verification_status='rejected'`. |
| **Frontend hook** | `src/hooks/useActiveDesigners.ts` | Nuevo | useQuery: `profiles WHERE role='diseno' AND is_active=true`. |
| **Frontend hook** | `src/hooks/useSystemSettings.ts` | Posiblemente existente | Verificar si existe; si no, crear. CRUD genérico sobre tabla `system_settings`. |
| **Frontend hook** | `src/hooks/useFeatureFlag.ts` | Nuevo | Lee `system_settings.slice_3_enabled` con cache corta (5min). Hook usado en surfaces que gated por flag. |
| **Frontend schema** | `src/schemas/payment-proof.ts` | Nuevo | Zod schemas para `submit_quotation_payment_proof`, `verify_payment`, `reject_payment`, `register_manual_payment`. Idioma valores DB en inglés. |
| **Frontend schema** | `src/schemas/quotation-cancel.ts` | Nuevo | Zod schemas para `cancel_quotation_acceptance`, `create_quotation_revision`. |
| **Storage bucket** | `payment-receipts` | Verificar existencia | Privado. INSERT permitido a anon vía RLS que valida `short_code` activo (path: `<quotation_id>/<uuid>.<ext>`). READ solo admin/super_admin. Tamaño máx 5MB, MIME `image/*` o `application/pdf`. |
| **DB migration files** | `db/migrations/037_slice3_payment_flow.sql` | Nuevo | Enum, columnas, todas las RPCs, todos los triggers. |
| **DB migration files** | `db/migrations/038_slice3_expiry_cron.sql` | Nuevo | Cron `slice3-expire-accepted-quotations-daily`. |
| **DB migration files** | `db/migrations/039_slice3_settings_seeds.sql` | Nuevo | INSERT en `system_settings` para `payment_window_days=7` y `slice_3_enabled=false`. Idempotente con `ON CONFLICT (key) DO NOTHING`. |
| **DB migration files** | `db/migrations/ROLLBACK_slice_3.sql` | Nuevo | DROP de todo en orden inverso. |

### 5.2 Numeración de migraciones SQL

Slice 2 cerró en `035b`. Slice 3 arranca en **`037`** (la `036` queda DROP'd o renombrada `.archived` antes de aplicar 037, decisión a tomar en Fase 3 según si ya tocó prod — verificación rápida: el handoff dice "036 NO desplegada", validado por ausencia de las funciones `submit_quotation_payment_proof`/`verify_payment` en prod).

| # | Migración | Propósito | Idempotente |
|---|---|---|---|
| 037 | `037_slice3_payment_flow.sql` | Enum (cancelled, superseded), CHECK en payments.verification_status, columnas nuevas en payments/projects/quotations, 7 RPCs (submit, verify, reject, register_manual, cancel, revision, reactivate), 3 triggers (convert, recalc_balance, invalidate_short_code), helper `recalc_project_balance_due`. | Sí — `IF NOT EXISTS`, `DROP ... IF EXISTS`, `ON CONFLICT DO NOTHING`. |
| 038 | `038_slice3_expiry_cron.sql` | Función `expire_accepted_quotations_scan` + cron. | Sí — usa `SELECT cron.unschedule()` antes de re-schedule. |
| 039 | `039_slice3_settings_seeds.sql` | Seeds `payment_window_days=7`, `slice_3_enabled=false`. | Sí — `ON CONFLICT (key) DO NOTHING`. |
| ROLLBACK | `ROLLBACK_slice_3.sql` | DROP cron, DROP triggers, DROP funciones, DROP CHECK, DROP columnas. NO toca enum (`ALTER TYPE ... DROP VALUE` no existe en PG; documentar). | — |

### 5.3 Máquinas de estado finales

#### `quotations.status` (agregando `cancelled` y `superseded`)

```
draft
  └─[admin envía]──> sent
                       │
                       ├─[cliente acepta]──> client_approved
                       │                       │
                       │                       ├─[cliente sube comprobante]──> pending_payment_verification
                       │                       │                                 │
                       │                       │                                 ├─[admin verifica]──> approved (+ is_locked, + project created)
                       │                       │                                 │                       │
                       │                       │                                 │                       └─[más pagos verifican]──> approved (balance_due baja)
                       │                       │                                 │
                       │                       │                                 ├─[admin rechaza pago]──> client_approved (vuelve)
                       │                       │                                 │
                       │                       │                                 └─[cron 7d]──> expired
                       │                       │
                       │                       ├─[cron 7d]──> expired
                       │                       │
                       │                       ├─[admin cancela]──> cancelled (terminal)
                       │                       │
                       │                       └─[admin crea V2]──> superseded (terminal, link a V2 vía superseded_by_quotation_id)
                       │
                       ├─[cliente rechaza]──> rejected (terminal)
                       │
                       └─[cron 30d]──> expired
                                          │
                                          └─[admin reactiva]──> client_approved (resetea client_approved_at)
```

**Transiciones permitidas** (validar en cada RPC):
- `draft → sent` — admin (cubierto en S2)
- `sent → client_approved` — RPC pública `accept_public_quotation` (S2)
- `sent → rejected` — RPC pública `reject_public_quotation` (S2)
- `sent → expired` — cron existente (S2)
- `client_approved → pending_payment_verification` — RPC pública `submit_quotation_payment_proof` (S3 nueva)
- `client_approved → cancelled` — RPC admin `cancel_quotation_acceptance` (S3 nueva)
- `client_approved → superseded` — RPC admin `create_quotation_revision` (S3 nueva)
- `client_approved → expired` — cron nuevo `expire_accepted_quotations_scan` (S3 nueva)
- `pending_payment_verification → approved` — trigger `trg_payment_verified_convert_to_project` (S3 nueva)
- `pending_payment_verification → client_approved` — RPC admin `reject_payment` (S3 nueva)
- `pending_payment_verification → cancelled` — RPC admin `cancel_quotation_acceptance` (S3 nueva)
- `pending_payment_verification → expired` — cron nuevo (S3 nueva)
- `expired → client_approved` — RPC admin `reactivate_expired_quotation` (S3 nueva)
- `approved` — terminal (proyecto creado; cotización inmutable salvo nuevos pagos sobre la misma)
- `cancelled` — terminal (opportunity a `lost`)
- `superseded` — terminal (link invalidado, V2 toma el relevo)
- `rejected` — terminal (cliente puede revivir si admin emite V2 desde sent)
- `expired` — semi-terminal (admin puede `reactivate`)

#### `payments.verification_status` (agregando `rejected` con CHECK)

```
pending  (cliente sube comprobante)
  ├─[admin verifica]──> verified  (terminal, dispara conversión si es primer pago)
  └─[admin rechaza]──> rejected   (terminal, queda en historial)
```

Pagos `verified` directos (camino D1.b admin manual): nacen en `verified` sin pasar por `pending`.

#### `projects` + nuevas columnas

- `balance_due` (NUMERIC, default 0): recalculado por trigger `trg_payment_recalc_balance` después de cada cambio en `payments`. Fórmula: `total_amount - SUM(payments.amount WHERE verification_status='verified')`.
- `is_fully_paid` (BOOLEAN, default false): true cuando `balance_due <= 0`.
- `fully_paid_at` (TIMESTAMPTZ): marcado por trigger la primera vez que `is_fully_paid` cruza a true.
- `cancellation_reason` (TEXT NULLABLE): para casos extraordinarios donde se cancela proyecto post-creación.

### 5.4 Templates Meta WhatsApp (dependencia externa)

**Optimización detectada al validar prod**: el template `payment_received` (sin sufijo `_v1`) **ya está aprobado en Meta** con 5 vars (`{{1}}=nombre`, `{{2}}=monto`, `{{3}}=proyecto`, `{{4}}=método`, `{{5}}=saldo`). Reusarlo para el evento "pago verificado" del cliente en lugar de pedir aprobar `payment_received_v1` nuevo. Esto baja el conteo de templates Slice 3 nuevos a aprobar de 6 a **5**.

| # | Template | Audiencia | Vars | Wording sugerido | Trigger | Estado |
|---|---|---|---|---|---|---|
| 1 | `payment_received` *(reuso aprobado)* | Cliente | {{1}}=nombre, {{2}}=monto, {{3}}=proyecto, {{4}}=método, {{5}}=saldo | (ya aprobado, wording existente) | `trg_payment_verified_convert_to_project` | ✅ Aprobado |
| 2 | `payment_proof_rejected_v1` | Cliente | {{1}}=nombre, {{2}}=quotation_number, {{3}}=motivo, {{4}}=link_corto | "Hola {{1}}, recibimos tu comprobante para la cotización N° {{2}} pero no pudimos verificarlo. Motivo: «{{3}}». Subí uno nuevo acá: {{4}}" | RPC `reject_payment` | ❌ Por crear/aprobar en Meta |
| 3 | `project_assigned_designer_v1` | Diseñador | {{1}}=designer_nombre, {{2}}=client_nombre, {{3}}=link_proyecto | "Hola {{1}}, te asignaron un nuevo proyecto: {{2}}. Detalles: {{3}}" | `trg_payment_verified_convert_to_project` (primer pago) | ❌ Por crear/aprobar en Meta |
| 4 | `project_fully_paid_v1` | Cliente | {{1}}=nombre, {{2}}=proyecto | "¡{{1}}, tu proyecto «{{2}}» está totalmente pagado! Gracias. Seguimos con la fabricación e instalación." | `recalc_project_balance_due` (cruce a is_fully_paid=true) | ❌ Por crear/aprobar en Meta |
| 5 | `quotation_v2_sent_v1` | Cliente | {{1}}=nombre, {{2}}=quotation_number, {{3}}=link_corto | "Hola {{1}}, preparamos una nueva versión de tu cotización N° {{2}} con los cambios solicitados. Revisala: {{3}}" | Al enviar V2 (admin click "Enviar al cliente" sobre la V2 nueva, ya cubierto por S2) | ❌ Por crear/aprobar en Meta |
| 6 | `admin_quotation_expired_v1` | Admin | {{1}}=admin_nombre, {{2}}=cliente, {{3}}=quotation_number, {{4}}=dias_sin_pago | "{{1}}, la cotización N° {{3}} de {{2}} expiró sin pago tras {{4}} días. Reactivá o creá V2 desde /pagos." | Cron `expire_accepted_quotations_scan` | ❌ Por crear/aprobar en Meta |

**Adicionalmente, pendientes heredados de S2** (sin solución desde Slice 3): `payment_request_v1`, `admin_quotation_accepted_v1`, `admin_quotation_adjustments_v1`, `admin_quotation_rejected_v1`. Total bloqueante externo = **5 nuevos S3 + 4 S2 = 9 templates** que Felipe debe aprobar en Meta Business Manager.

**Mientras no estén aprobados**: los rows en `notification_queue` quedan `status='failed'` con `template not found`. Cuando se aprueben: `UPDATE notification_queue SET status='pending' WHERE template_name=<aprobado> AND status='failed'` los reactiva. Cero rotura del resto del sistema.

**Worker `process-whatsapp-notifications`**: hoy registra 7 templates. Extender `TEMPLATE_REGISTRY` para incluir los 5 nuevos S3 con su builder de params. Redeploy con `supabase functions deploy process-whatsapp-notifications --project-ref xdzbjptozeqcbnaqhtye` cuando se aprueben.

### 5.5 Eventos de notificación in-app

Insertar **directo en `public.notifications`** (NO usar helper `enqueue_notification` que es WhatsApp-only — feedback documentado en MEMORY.md). Campos: `user_id`, `title`, `body`, `is_read=false`, `notification_type`, `priority`, `action_url`, `related_table`, `related_id`, `created_at`.

| Evento | Destinatario | `notification_type` | `action_url` | `priority` |
|---|---|---|---|---|
| Cliente subió comprobante | Admin (creador opportunity) | `payment_proof_uploaded` | `/pagos?tab=por-verificar` | `normal` |
| Pago verificado, proyecto creado | Diseñador asignado (o Admin si NULL) | `project_assigned` | `/proyectos/<id>` | `high` |
| Comprobante rechazado | Admin (creador) | `payment_rejected` | `/pagos?tab=rechazados` | `normal` |
| Cotización expiró sin pago | Admin (creador) | `quotation_expired_payment` | `/pagos?action=reactivate&id=<quotation_id>` | `normal` |
| Cotización cancelada por admin | Resto de admins (audit) | `quotation_cancelled` | `/cotizaciones/<id>` | `low` |
| Cotización superseded (V2 creada) | Resto de admins (audit) | `quotation_superseded` | `/cotizaciones/<v2_id>` | `low` |
| Proyecto totalmente pagado | Admin (creador opportunity) | `project_fully_paid` | `/proyectos/<id>` | `normal` |

### 5.6 Audit log

Tabla `audit_logs` (verificar existencia en Fase 3; el handoff dice que su existencia depende de S2). Si existe, registrar como mínimo (sino crear en mig 037 como tabla nueva):

- `payment_verified`: `{payment_id, project_id_created OR existing, admin_id, designer_assigned_id, amount, timestamp}`
- `payment_rejected`: `{payment_id, admin_id, rejection_reason, timestamp}`
- `quotation_cancelled`: `{quotation_id, admin_id, cancellation_reason, timestamp}`
- `quotation_superseded`: `{quotation_id, new_quotation_id, admin_id, timestamp}`
- `quotation_reactivated`: `{quotation_id, admin_id, timestamp}`

### 5.7 Permisos por rol

| Acción | super_admin | admin | comercial | diseno | cliente público |
|---|---|---|---|---|---|
| Ver tab "Por verificar" en `/pagos` | ✅ | ✅ | ❌ | ❌ | — |
| Click "Verificar" sobre un pago | ✅ | ✅ | ❌ | ❌ | — |
| Click "Rechazar con motivo" | ✅ | ✅ | ❌ | ❌ | — |
| Click "Registrar pago manual" | ✅ | ✅ | ❌ | ❌ | — |
| Click "Cancelar aceptación" | ✅ | ✅ | ❌ | ❌ | — |
| Click "Crear versión nueva" | ✅ | ✅ | ❌ | ❌ | — |
| Click "Reactivar" en expiradas | ✅ | ✅ | ❌ | ❌ | — |
| Editar `Configuración → Datos Bancarios` | ✅ | ✅ | ❌ | ❌ | — |
| Editar `Configuración → Pagos` (flag + días) | ✅ | ✅ | ❌ | ❌ | — |
| Subir comprobante vía RPC pública | — | — | — | — | ✅ (vía short_code activo) |
| Ver datos bancarios en `/c/<code>` | — | — | — | — | ✅ (si cotización aceptada y flag ON) |
| Recibir WA `project_assigned_designer_v1` | — | — | — | ✅ | — |

Aplicar vía RLS y/o checks dentro de cada RPC (`SECURITY DEFINER` con `get_my_role()`). Comerciales y diseñadores **no ven** los botones (gated en frontend con `useRole()`).

### 5.8 Slices internos de ejecución (orden estricto para Fase 5)

> Cada sub-slice termina con verificación end-to-end + commit local por el agente. Push y `vercel --prod` los corre Álvaro. NO mergear al final — Fase 5 entrega rama lista para review/deploy.

#### S3.1 — Backend (DB schema, RPCs, triggers, cron)
**Goal**: toda la lógica server-side lista, validable con smoke SQL. Sin frontend.
**Archivos**: `db/migrations/037_slice3_payment_flow.sql`, `038_slice3_expiry_cron.sql`, `039_slice3_settings_seeds.sql`, `ROLLBACK_slice_3.sql`.
**Aplicación**: Management API directo (es idempotente; el agente lo aplica).
**Verificación**: smoke SQL — insertar cotización fake en `client_approved` → llamar `submit_quotation_payment_proof` → verificar payment `pending` + status `pending_payment_verification` → llamar `verify_payment` → verificar proyecto creado, balance_due correcto, is_fully_paid correcto, opportunity convertida, quotation locked. Repetir para `reject_payment`, `cancel_quotation_acceptance`, `create_quotation_revision`, `register_manual_payment`, `reactivate_expired_quotation`. Smoke cron: insertar cotización con `client_approved_at = now() - INTERVAL '8 days'` + flag ON → `SELECT expire_accepted_quotations_scan()` → verificar `status='expired'` + WA encolado.

#### S3.2 — UI admin (settings + cola refactorizada + modales)
**Goal**: admin puede configurar bancos, ver cola 3-tabs, verificar/rechazar/cancelar.
**Archivos**: 
- `src/pages/BankSettings.tsx`, `src/pages/PaymentSettings.tsx`
- Refactor `src/pages/Pagos.tsx` a 3 tabs
- `src/components/payments/PaymentVerifyModal.tsx`, `PaymentRejectModal.tsx`, `ManualPaymentModal.tsx`, `DesignerPicker.tsx`
- `src/components/quotations/QuotationCancelModal.tsx`, `QuotationRevisionButton.tsx`
- Hooks: `useSubmitPaymentProof`, `useVerifyPayment`, `useRejectPayment`, `useRegisterManualPayment`, `useCancelQuotationAcceptance`, `useCreateQuotationRevision`, `useReactivateExpiredQuotation`, `usePendingPayments`, `useVerifiedPayments`, `useRejectedPayments`, `useActiveDesigners`, `useFeatureFlag`
- Schemas Zod: `payment-proof.ts`, `quotation-cancel.ts`
- Sidebar admin: agregar entradas `Configuración → Datos Bancarios` y `Configuración → Pagos`.
**Verificación**: build OK + `npm run preview` (puerto 4173) en OneDrive. Login admin → /configuracion/bancarios → guardar datos → /pagos → ver 3 tabs (vacías). Smoke con `register_manual_payment` desde modal → verificar proyecto creado → /proyectos → ver diseñador asignado.

#### S3.3 — UI cliente (PublicQuotation con uploader + estados extra)
**Goal**: cliente puede ver datos bancarios + subir comprobante + ver mensajes de estado para cancelled/superseded/expired.
**Archivos**:
- Modificar `src/pages/PublicQuotation.tsx` (sección "Realizar pago" gated por flag + estado, mensajes de estado terminal)
- `src/components/public/PaymentProofUploader.tsx`
**Verificación**: `vite preview` + cloudflared tunnel (patrón S2). Abrir `/c/<code>` de cotización aceptada con flag ON → ver datos bancarios + uploader → subir PDF → admin ve en `/pagos` tab "Por verificar" con badge.

#### S3.4 — Edge function TEMPLATE_REGISTRY extension
**Goal**: worker `process-whatsapp-notifications` despacha los 5 templates nuevos S3 cuando se aprueben.
**Archivos**: `supabase/functions/process-whatsapp-notifications/index.ts` (extender registry).
**Deploy**: `supabase functions deploy process-whatsapp-notifications` (el agente lo aplica con PAT del .env).
**Verificación**: row de smoke con cada template en `notification_queue` → worker en cron → verificar logs. Mientras templates no estén aprobados, esperar `failed` con `template not found` (esperado, no es bug).

#### S3.5 — Smoke E2E con flag ON en cotización de prueba
**Goal**: validación end-to-end completa de un flujo dorado antes de activar para piloto real.
**Pasos** (con flag ON en seed `[SMOKE-S3-2026-XX-XX]`):
1. Crear cotización fake (admin) → enviar → cliente acepta vía link.
2. Cliente sube comprobante PDF de 1MB → admin ve badge "1" en `/pagos`.
3. Admin click "Verificar" → modal abre con preview + dropdown diseñador → selecciona diseñador → confirma → proyecto creado, balance_due correcto, WAs encolados (verificar en `notification_queue`).
4. Admin sube segundo abono → admin verifica con `payment_type='abono'` → balance_due baja.
5. Cuando balance llega a 0 → `is_fully_paid=true` + WA `project_fully_paid_v1` encolado.
6. Repetir con flujo de rechazo → cliente recibe WA `payment_proof_rejected_v1`.
7. Repetir con flujo de cancelación → opportunity vuelve a `lost`.
8. Repetir con flujo de versionado V2.
9. Modificar `client_approved_at` a 8 días atrás → correr cron manual → verificar `expired` + WA admin.

Cleanup post-smoke: `DELETE FROM payments WHERE notes LIKE '[SMOKE-S3-%]'` + `DELETE FROM projects WHERE name LIKE '[SMOKE-S3-%]'` + `DELETE FROM quotations WHERE notes LIKE '[SMOKE-S3-%]'`.

#### S3.6 — Activación piloto
**Goal**: Álvaro prende flag para 1-2 clientes reales.
**Acción**: `UPDATE system_settings SET value='true' WHERE key='slice_3_enabled'` (o desde UI `Configuración → Pagos`).
**Validación piloto**: Álvaro monitorea durante 48h. Si todo OK, queda activado permanente. Si bug: apaga flag desde UI, debug, vuelve a prender.

### 5.9 Feature flag — surfaces afectadas

`system_settings.slice_3_enabled` (BOOLEAN, default `false`). Comprobado por `useFeatureFlag('slice_3_enabled')` en frontend y `(SELECT (value)::boolean FROM system_settings WHERE key='slice_3_enabled')` en SQL.

**Cuando OFF**:
- `PublicQuotation.tsx`: sección "Realizar pago" NO se renderiza aunque la cotización esté aceptada.
- `Pagos.tsx`: queda con su layout actual (sin 3 tabs, sin botón "Registrar pago manual").
- Sidebar: entradas `Configuración → Datos Bancarios` y `Configuración → Pagos` igual aparecen (Álvaro las necesita para activar el flag).
- Botones "Cancelar aceptación" y "Crear versión nueva" en `/cotizaciones/<id>` NO se renderizan.
- Cron `slice3-expire-accepted-quotations-daily` corre pero la función `expire_accepted_quotations_scan` sale temprano (`RETURN` después de leer flag OFF).
- Flujo legacy de Álvaro (manual fuera del CRM) sigue funcionando 100% igual.

**Cuando ON**: todo lo anterior se activa.

**Cambio sin redeploy**: toggle desde `/admin/configuracion/pagos`. Cache de `useFeatureFlag` de 5min (clientes en sesión activa ven el cambio al siguiente render dentro de 5 min; aceptable para piloto).

---

## 6. Testing Decisions

### 6.1 Criterios de aceptación por flujo

#### Flujo A — Cliente sube comprobante, admin verifica primer pago
- [ ] Cliente abre `/c/<short_code>` de cotización en `client_approved` con flag ON → ve sección "Realizar pago" con datos bancarios renderizados desde `system_settings`.
- [ ] Cliente selecciona archivo (PDF, 1MB) + monto + método → click "Enviar comprobante" → upload OK + mensaje "recibido, esperá verificación".
- [ ] Row creado en `payments` con `verification_status='pending'`, `proof_url` set, `client_id` vinculado, `quotation_id` vinculado, `below_suggested` calculado.
- [ ] Cotización pasa a `pending_payment_verification`.
- [ ] Admin recibe notif in-app `payment_proof_uploaded` con link a `/pagos?tab=por-verificar`.
- [ ] Badge "1" aparece en tab "Por verificar" de `/pagos`.
- [ ] Admin click "Verificar" → modal abre con preview del PDF (iframe), warning amarillo si `below_suggested=true`, dropdown diseñador, dropdown payment_type default `anticipo`.
- [ ] Admin selecciona diseñador → click "Verificar y crear proyecto".
- [ ] Row en `projects` creado con `status='cotizacion_aprobada'`, `approved_quotation_id`, `designer_id`, `total_amount`, `advance_amount=NEW.amount`, `balance_due=total_amount - NEW.amount`, `is_fully_paid=false` (a menos que haya pagado todo).
- [ ] Quotation pasa a `approved` + `is_locked=true`.
- [ ] Opportunity pasa a `converted_to_project`.
- [ ] Payment marcado `verified` + `verified_by` + `verified_at`.
- [ ] WA `payment_received` (template aprobado) encolado al cliente con vars correctas (nombre, monto, proyecto, método, saldo).
- [ ] WA `project_assigned_designer_v1` encolado al diseñador.
- [ ] Notif in-app `project_assigned` al diseñador con link `/proyectos/<id>`.
- [ ] Pago aparece en tab "Verificados" de `/pagos`.

#### Flujo B — Admin rechaza comprobante
- [ ] Mismo setup que Flujo A hasta el modal de verificación.
- [ ] Admin click "Rechazar con motivo" → modal `PaymentRejectModal` abre.
- [ ] Textarea vacía o <10 chars → botón deshabilitado.
- [ ] Admin escribe motivo válido → click "Confirmar rechazo".
- [ ] Payment marcado `verification_status='rejected'`, `rejection_reason`, `rejected_by`, `rejected_at`.
- [ ] Cotización vuelve a `client_approved` (sale de `pending_payment_verification`).
- [ ] WA `payment_proof_rejected_v1` encolado al cliente con razón + link corto.
- [ ] Pago aparece en tab "Rechazados" de `/pagos`.
- [ ] Cliente puede volver a `/c/<short_code>` y subir nuevo comprobante (no se invalida el link en rechazo).

#### Flujo C — Admin registra efectivo manual
- [ ] Admin en `/pagos` click "Registrar pago manual" → modal `ManualPaymentModal` abre.
- [ ] Selector de cotización: autocomplete sobre cotizaciones en `client_approved`, `pending_payment_verification` o `approved` (para abonos).
- [ ] Admin selecciona cotización → carga total_amount + cliente.
- [ ] Admin completa monto + método (efectivo/cheque/...) + diseñador (si primer pago) + tipo (default `anticipo` o `abono` según contexto) + notas.
- [ ] Click "Registrar" → payment creado con `verification_status='verified'` directo, `registered_by=current_user`, `verified_by=current_user`, `verified_at=now()`.
- [ ] Mismo trigger de conversión se dispara como en Flujo A.
- [ ] Cliente recibe WA `payment_received` igual.

#### Flujo D — Cron expiración 7d
- [ ] Setup: cotización en `client_approved` con `client_approved_at = now() - INTERVAL '8 days'`.
- [ ] Setup: `slice_3_enabled=true` y `payment_window_days=7`.
- [ ] `SELECT expire_accepted_quotations_scan();` manualmente o esperar cron.
- [ ] Cotización pasa a `expired`.
- [ ] Short_code invalidado.
- [ ] WA `admin_quotation_expired_v1` encolado al admin con vars correctas.
- [ ] Notif in-app `quotation_expired_payment` con link `/pagos?action=reactivate&id=<id>`.
- [ ] Admin click "Reactivar" → cotización vuelve a `client_approved`, `client_approved_at=now()` (reinicia ventana), short_code reactivado.
- [ ] Re-correr cron mismo día: `dedup_key` previene segundo WA al admin para la misma cotización.

#### Flujo E — Abono post-conversión
- [ ] Setup: proyecto creado en Flujo A con `balance_due > 0`.
- [ ] Cliente vuelve a `/c/<short_code>` (la quotation está en `approved` + `is_locked=true`, pero el uploader sigue visible).
- [ ] Cliente sube nuevo comprobante → row payment `pending` creado, **NO** cambia `quotations.status` (sigue `approved`).
- [ ] Admin verifica con `payment_type='abono'`.
- [ ] `recalc_project_balance_due` actualiza `balance_due` (resta el monto del nuevo pago).
- [ ] Si `balance_due` llega a 0: `is_fully_paid=true`, `fully_paid_at=now()`, WA `project_fully_paid_v1` encolado **una sola vez** (dedup_key por project_id).
- [ ] Pagos posteriores que pasaran de 0 (caso reembolso negativo) no re-disparan el WA.

#### Flujo F — Admin cancela aceptación
- [ ] Cotización en `client_approved` o `pending_payment_verification` (NO en `approved` — esa es post-pago verificado).
- [ ] Admin abre detalle cotización → ve botón "Cancelar aceptación" (gated por flag + estado).
- [ ] Click → modal `QuotationCancelModal` con textarea obligatoria.
- [ ] Click "Confirmar" → cotización pasa a `cancelled`, `cancellation_reason`, `cancelled_by`, `cancelled_at`.
- [ ] Opportunity vuelve a `status='lost'` con `lost_reason` derivada de `cancellation_reason`.
- [ ] Short_code invalidado.
- [ ] Cliente que abra link → ve mensaje "esta cotización fue cancelada".
- [ ] Notif in-app `quotation_cancelled` a otros admins (audit).

#### Flujo G — Admin crea revisión post-aceptación (V2)
- [ ] Cotización V1 en `client_approved` o `pending_payment_verification`.
- [ ] Admin abre detalle → ve botón "Crear versión nueva".
- [ ] Click → RPC `create_quotation_revision` → V2 creada como copia editable, V1 pasa a `superseded`.
- [ ] V1: `superseded_at`, `superseded_by_quotation_id=V2.id`, `is_locked=true`, short_code invalidado.
- [ ] V2: `status='draft'`, `parent_quotation_id=V1.id`, `version_number=V1.version_number+1`, items copiados, nuevo short_code, sin payments asociados.
- [ ] Admin navega a edición de V2, modifica items, click "Enviar al cliente" (flujo S2 existente).
- [ ] V2 pasa a `sent`, WA `quotation_v2_sent_v1` encolado al cliente.
- [ ] Cliente abre link nuevo → ve V2.
- [ ] Cliente abre link viejo de V1 → ve mensaje "esta cotización fue actualizada, ver versión vigente <link>".

### 6.2 Tests unitarios (Vitest)

- `submit_quotation_payment_proof`: short_code activo + cotización en estado válido → ok; short_code inactivo → error; cotización en `draft`/`rejected`/`cancelled` → error; monto < 1000 → error.
- `verify_payment`: solo admin/super_admin → 42501 si rol distinto; designer_id NULL → proyecto creado sin asignar pero con badge `designer_id IS NULL`; primer pago verificado dispara creación de project; segundo pago verificado solo actualiza balance_due.
- `reject_payment`: cotización vuelve a `client_approved` correctamente; no muta proyecto si ya existe; razón <10 chars → error de validación.
- `cancel_quotation_acceptance`: opportunity vuelve a `lost`; falla si cotización ya está en `approved` (post-pago).
- `create_quotation_revision`: items se copian con todos los campos; version_number incrementa; short_code de V1 inactivo.
- `expire_accepted_quotations_scan`: flag OFF → no muta; flag ON + 0 expiradas → no encola; flag ON + 1 expirada → 1 row notif; re-correr mismo día → 0 rows adicionales (dedup).
- `recalc_project_balance_due`: cruce de balance >0 a ≤0 → seteo de `is_fully_paid=true` + `fully_paid_at` + 1 WA encolado; segundo pago sobre proyecto fully_paid → no encola WA nuevo.

### 6.3 Tests de seguridad

- Comercial intenta llamar `verify_payment` directamente → permission denied (42501).
- Anon intenta llamar `verify_payment` → permission denied.
- Anon intenta `submit_quotation_payment_proof` con short_code de otra cotización → permission denied.
- Anon intenta `submit_quotation_payment_proof` con short_code inactivo → permission denied.
- Upload de archivo > 5MB al bucket → rechazado por RLS de storage.
- Upload de archivo no-imagen/no-pdf → rechazado.
- Admin intenta cancelar cotización en estado `approved` (post-pago) → permission denied (estado inválido).

### 6.4 Tests E2E manuales con feature flag

- Flag OFF: ningún UI nuevo aparece en ningún rol. Flujo legacy intacto.
- Flag ON con cero pagos pendientes: tab "Por verificar" vacía, badge sin contador.
- Toggle ON → OFF en sesión activa: dentro de 5 min, el cliente que recargue `/c/<code>` ya no ve uploader (cache `useFeatureFlag`).

---

## 7. Out of Scope

Excluido explícitamente de Slice 3 (cada uno puede ser fase futura si métricas lo piden):

- **Pasarela de pago online** (Wompi, PayU, Mercado Pago): cliente sigue pagando por transferencia/Nequi y subiendo comprobante manual. La integración de gateway será fase aparte.
- **OCR automático de comprobantes**: verificación 100% manual por admin. Cero ML/OCR en este slice.
- **Webhook bancario** (Bancolombia/Davivienda APIs): no se intenta integración directa con bancos.
- **Reembolsos completos**: la columna `payment_type='reembolso'` queda en el enum pero el flujo de "devolver dinero al cliente con WhatsApp + audit" no se construye. Es admisible como pago manual con monto negativo si necesario, pero sin UI dedicada.
- **Multi-moneda**: todo en COP (peso colombiano). No hay columna de currency en payments.
- **Refactor de gestión de archivos**: el bucket `payment-receipts` se usa con patrón actual de Storage. Si hay deuda técnica de manejo de archivos (compresión, thumbnails, soft delete), queda para fase aparte.
- **Page "Mis proyectos" para diseñador**: el diseñador recibe WA + notif in-app del proyecto asignado, pero la vista filtrada "proyectos de Juan" no se construye acá. Hoy navegan vía `/proyectos` (lista general).
- **Plan de pagos personalizado por cotización**: hoy es "anticipo + abonos libres hasta saldar". No se construyen schedules tipo "30/30/40" ni recordatorios automáticos por cuota.
- **Recordatorios al cliente antes de expirar**: el cron solo notifica al admin cuando expira. No hay WA al cliente "vence en X días sin pago". Si métricas lo piden, fase futura.
- **Métricas / dashboard de pagos**: la página `/pagos` muestra cola operativa. No hay gráficos de "ingresos por mes", "tiempo promedio de verificación", "% de comprobantes rechazados". Reportes en fase aparte.
- **Configuración multi-banco**: 1 cuenta principal + Nequi + Daviplata (Q6). Si se necesitan múltiples cuentas (ej: cuenta sucursal A, sucursal B), fase futura — schema requiere migrar a tabla `bank_accounts` en vez de filas en `system_settings`.
- **Firma digital de cotización aprobada**: la aprobación cliente es comercial, no jurídica. Sin firma electrónica certificada en este slice.
- **Email transaccional**: cero correos, solo WhatsApp + in-app. Si las métricas piden duplicar canal por email, fase futura.
- **Integración con DIAN / facturación electrónica**: completamente out of scope.
- **Generación de PDF inmutable post-aprobación**: el bucket `quotation-pdfs` y la Edge Function `generate-quotation-pdf` fueron mencionados como Slice 5 del PRD anterior de Fase 4. **Este slice 3 NO los implementa**; quedan como fase futura.

---

## 8. Further Notes

### 8.1 Métricas de éxito

A observar 60 días post-activación global:

- **Tiempo promedio entre `client_approved` y primer pago verificado**: target <72h. Si >7 días en >30% de casos, revisar UX del uploader.
- **% de comprobantes verificados sin rechazo**: target >85%. Si <70%, indica que los datos bancarios o instrucciones al cliente no son claros; revisar wording de `payment_request_v1`.
- **% de cotizaciones aceptadas que terminan en pago verificado** (drop-off pago): target >70%. Si <50%, problema serio de fricción.
- **Tiempo promedio entre payment `pending` y `verified`**: target <4h en horario laboral. Mide cuán rápido Álvaro atiende la cola.
- **% de cotizaciones que llegan a `is_fully_paid=true`**: target >90% para proyectos cerrados (no entregados como saldo abierto eterno).
- **Cantidad de cancelaciones de aceptación**: monitor sin target — informa estabilidad del pipeline. Si crece, revisar calidad de cotizaciones enviadas.
- **Cantidad de superseded (V2+ post-aceptación)**: monitor — alto indica que las V1 se envían sin afinar.
- **Cantidad de expiraciones por cron**: monitor — alto indica fricción en pago o cliente fantasma.

### 8.2 Riesgos y mitigaciones

1. **5 templates Meta nuevos pendientes de aprobación (+ 4 heredados de S2 = 9 total)**: bloquea WAs hasta aprobación de Felipe. **Mitigación**: deployar con flag OFF; rows quedan en `notification_queue` con status `failed`; al aprobar templates, `UPDATE ... SET status='pending'` reactiva. Flujo in-app funciona independientemente (admin ve cola en `/pagos`, badge sin depender de WA).

2. **OneDrive sync race**: si el agente corre `npm run dev` con watcher Vite, HMR se rompe aleatoriamente. **Mitigación**: usar `npm run build` + `npm run preview` (puerto 4173) para verificación local. Para cliente en preview público, usar `vite preview --host` + cloudflared tunnel con `preview.allowedHosts` en `vite.config` (patrón validado en Slice 2).

3. **Trigger `trg_payment_verified_convert_to_project` puede crashear si `designer_id` viene NULL y el schema lo exige NOT NULL**: validado en prod que `projects.designer_id` es nullable. ✅ Riesgo mitigado.

4. **`fully_paid_at` con cruces múltiples**: si un pago verificado se reembolsa luego (negativo) y el saldo cruza >0, después otro pago la cruza ≤0 de nuevo. **Mitigación**: la lógica del trigger solo encola `project_fully_paid_v1` cuando `fully_paid_at IS NULL` previo. Si ya se encoló una vez, segundo cruce no re-encola (idempotente por dedup_key `project_fully_paid_<project_id>`).

5. **RLS gaps en storage**: bucket `payment-receipts` con INSERT público sin RLS estricta = cualquiera podría subir. **Mitigación**: RLS verifica que el `quotation_id` en el path corresponde a una cotización con short_code activo + estado válido + límite tamaño 5MB + MIME whitelist.

6. **Conflicto con Slice 2 desplegado**: la migración 037 modifica el trigger `fn_notify_quotation_acceptance` o el RPC `accept_public_quotation` de S2? **Respuesta**: NO. Slice 3 deja S2 intacto. Solo agrega RPCs/triggers nuevos. La integración es por estado (cuando S2 mueve cotización a `client_approved`, S3 toma el relevo con uploader gated por flag).

7. **Schema `db/supabase_schema.sql` desactualizado**: lección histórica. **Mitigación**: la Fase 3 (`supabase-schema`) valida cada CHECK/columna/enum contra prod vía Management API antes de escribir SQL. Ya hecho durante este PRD para validar el estado.

8. **Anti-patrón Supabase onAuthStateChange**: el feature flag se lee con `useFeatureFlag` que hace query a `system_settings`. **NO debe** disparar esta query dentro del callback de `onAuthStateChange` (deadlock documentado en MEMORY.md). Hook usa `useQuery` de react-query con cache 5min, separado del flujo de auth.

9. **Anti-patrón Realtime singleton**: si Slice 3 quiere suscribirse a cambios en `payments` (badge counter en tiempo real), usar nombre de channel único con `crypto.randomUUID()` o reusar el channel existente de notificaciones del Layout. NO crear `supabase.channel('payments-updates')` hardcoded.

10. **Helper `enqueue_notification` es WhatsApp-only**: feedback documentado. **Mitigación**: notif in-app van por INSERT directo en `public.notifications`. WhatsApp van por `notification_queue` (que es WhatsApp outbox).

### 8.3 Dependencias entre sub-slices

```
S3.1 (backend) ──> S3.2 (UI admin) ──> S3.3 (UI cliente) ──> S3.5 (smoke E2E) ──> S3.6 (activación)
                                                              ↑
S3.4 (edge fn registry) ─────────────────────────────────────┘  (independiente, se puede hacer en paralelo con S3.2/S3.3)
```

S3.4 (extender TEMPLATE_REGISTRY) puede correrse en paralelo con S3.2/S3.3 — no hay dependencia hard salvo que sin él los WAs no se despachan (pero quedan encolados).

### 8.4 Preguntas abiertas para resolver durante ejecución (Fase 5)

1. **¿Bucket `payment-receipts` ya existe?** Verificar al iniciar S3.1. Si no, crear con RLS.
2. **¿Tabla `audit_logs` existe?** Verificar al iniciar S3.1. Si no, crear como parte de mig 037 o decidir si Slice 3 vive sin audit explícito (solo audit en columnas de las tablas afectadas).
3. **¿`short_code_active` es columna en `quotations` o tabla `quotation_short_codes` separada?** Verificar contra prod en Fase 3. El trigger de invalidación se adapta a lo que exista.
4. **¿`opportunities.status` ya tiene `converted_to_project` y `lost` como valores válidos?** Verificar enum en Fase 3 antes de escribir trigger.
5. **`payment_received` (template aprobado) usa el footer viejo "Álvaro Ríos Cocinas Integrales"**: el catálogo de templates dice que está pendiente el cambio a "Innovar Cocinas Integrales". Decisión menor: usar el template tal cual está aprobado en Slice 3 (footer queda con texto viejo durante piloto). Felipe puede actualizar el footer en Meta sin afectar el slug.

### 8.5 Convenciones operativas (no negociables)

Leer **antes** de tocar código:
- `Innovar-App-main/CLAUDE.md` — convenciones del proyecto (errors via `mapSupabaseError`, Zod en mutations, retry:0, design tokens dark premium, idioma DB en inglés / UI en español).
- `Innovar-App-main/docs/CONVENTIONS.md` si existe.
- Memoria global `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` — anti-patrones reutilizables.

**Idioma:** DB en inglés (enums, CHECK constraints, valores Zod). UI en español. **CHECK doble:** antes de tocar schema, validar contra DB de PRODUCCIÓN con Management API — `db/supabase_schema.sql` y `src/types/database.types.ts` están desactualizados (bug histórico).

**RLS/grants:** Tablas internas (logs, queues) → `ENABLE RLS` + `REVOKE ALL FROM anon, authenticated`. RLS sola no basta porque TRUNCATE bypassa RLS. (Lección `scheduled_job_log` mig 029 + 029a).

**Notif in-app:** INSERTar directo en `public.notifications`. NO usar `enqueue_notification` (WhatsApp-only).

**Git:** commits locales los hace el agente; push y `vercel --prod` los hace Álvaro. Nunca `--no-verify`. Nunca tocar git config.

**Sin watcher en OneDrive:** usar `npm run build` + `npm run preview`. Nunca `npm run dev`.

**Slice 3 no rompe Slice 2.** Si una RPC nueva pisa una de S2, parar y reabrir diseño.

---

## 9. Rollout Plan

| Fase | Acción | Quién | Verificación |
|---|---|---|---|
| 1 | Deploy de mig 037+038+039 a prod | Agente (Management API) | Smoke SQL flujos A-G con flag OFF (solo lectura). |
| 2 | Deploy de frontend con flag OFF | Álvaro (`vercel --prod`) | Build OK, preview vacío de cambios visibles (flag OFF). |
| 3 | Felipe aprueba 5 templates Meta nuevos S3 | Felipe (externo) | Cada template aprobado: `UPDATE notification_queue SET status='pending' WHERE template_name=<...> AND status='failed'`. |
| 4 | Extender TEMPLATE_REGISTRY + redeploy edge fn | Agente | Smoke con row de prueba en `notification_queue` por cada template nuevo. |
| 5 | Álvaro completa datos bancarios en `/admin/configuracion/bancarios` | Álvaro | Render visible de los 7 campos. |
| 6 | Álvaro define `payment_window_days` (default 7 OK) | Álvaro | Setting visible en `/admin/configuracion/pagos`. |
| 7 | Smoke E2E S3.5 con flag ON sobre cotización de prueba `[SMOKE-S3-2026-XX-XX]` | Agente + Álvaro confirma visualmente | Flujos A-G OK end-to-end. Cleanup post-smoke. |
| 8 | Álvaro activa flag para 1-2 clientes reales (piloto) | Álvaro | 48h de observación: 0 incidentes críticos. |
| 9 | Si piloto OK: flag queda activado global | Álvaro | — |
| 10 | Si piloto KO: flag a OFF (1 click), debug, fix, repeat S3.5 | Agente | — |

**Rollback de emergencia**: flag OFF desde UI o `UPDATE system_settings SET value='false' WHERE key='slice_3_enabled'`. Sistema vuelve a flujo legacy sin redeploy. Si hace falta rollback de schema: `ROLLBACK_slice_3.sql` (NO destruye datos en payments/projects existentes — solo elimina columnas vacías, funciones, triggers, crons; los rows ya creados se mantienen).

---

## 10. Anexos

### A. Mapeo de cada decisión del grill a su sección en este PRD

| Decisión | Resumen | Implementada en sección |
|---|---|---|
| D1 | Coexisten cliente sube + admin manual | §2 (flujo macro pasos 5 y 10), §5.1 (RPCs `submit_quotation_payment_proof` + `register_manual_payment`) |
| D2 | Primer pago verificado convierte; balance_due rastrea; warning si <30% no bloquea | §2 (flujo paso 8), §5.1 (`projects.balance_due`, `recalc_project_balance_due`), §5.3 (máquina de estados projects) |
| D3 | V2 reemplaza V1 con `superseded`; link invalidado; WA con nuevo link | §2 (flujo paso 13), §5.1 (`create_quotation_revision`, `quotations.superseded_*`), §5.3 (transiciones), §5.4 (template `quotation_v2_sent_v1`) |
| D4 | Cron 7d configurables expira; reactivar reinicia | §2 (flujo paso 11), §5.1 (`expire_accepted_quotations_scan`, `reactivate_expired_quotation`, `payment_window_days`), §5.4 (template `admin_quotation_expired_v1`) |
| D5 | Dropdown diseñador en modal verify + escape | §2 (flujo paso 7), §5.1 (`PaymentVerifyModal`, `DesignerPicker`), §5.4 (template `project_assigned_designer_v1`) |
| D6 | 1 cuenta + Nequi + Daviplata en system_settings; pantalla edita | §2 (flujo paso 1), §5.1 (`BankSettings`, `BankSettingsForm`), §8.4 (validación schema) |
| D7 | Verify/Reject buttons; WA con razón + link reintento | §2 (flujo paso 9), §5.1 (`PaymentRejectModal`, `reject_payment`, columnas `rejection_*`), §5.4 (template `payment_proof_rejected_v1`) |
| D8 | Cualquier admin verifica; audit obligatorio | §5.1 (`verify_payment` con `get_my_role()`), §5.6 (audit logs), §5.7 (permisos) |
| D9 | Solo admin cancela con motivo; estado `cancelled`; opp `lost` | §2 (flujo paso 12), §5.1 (`cancel_quotation_acceptance`, `QuotationCancelModal`, columnas `cancellation_*`), §5.3 (enum nuevo) |
| D10 | `/pagos` 3 tabs | §5.1 (refactor `Pagos.tsx`), §6.1 (criterios aceptación) |
| D11 | Abonos por mismo link; admin elige tipo; fully_paid al saldar | §2 (flujo macro), §5.1 (uploader acepta `is_locked=true`, `recalc_project_balance_due`, columna `fully_paid_at`), §5.4 (template `project_fully_paid_v1`) |
| D12 | WA admin mínimo (2 templates), resto in-app | §5.4 (tabla templates: solo `admin_quotation_accepted_v1` ya de S2 + `admin_quotation_expired_v1` nuevo), §5.5 (notif in-app para el resto de eventos admin) |
| D13 | Feature flag `slice_3_enabled` apagable sin redeploy | §2 (Mecanismos transversales), §5.1 (`slice_3_enabled` en system_settings), §5.9 (surfaces afectadas), §9 (rollout plan) |

### B. Glosario para no-técnicos (Álvaro y stakeholders)

- **Cotización aceptada**: el cliente apretó "Aceptar" en su link `/c/<código>`. La cotización entra en `client_approved` esperando pago.
- **Cotización aprobada**: el primer pago fue verificado por un admin. La cotización pasa a `approved`, queda bloqueada (no se puede editar), y se crea automáticamente el proyecto.
- **Comprobante**: archivo (foto o PDF) que el cliente sube como prueba de su pago. Se asocia a la cotización y queda visible para el admin que verifica.
- **Verificación**: acto del admin de mirar el comprobante y decir "este pago llegó" (verificar) o "este pago no es válido, mandá otro" (rechazar).
- **`balance_due`**: cuánto le falta pagar al cliente. Se calcula automáticamente: total cotizado menos suma de pagos verificados.
- **`is_fully_paid`**: bandera que se prende sola cuando el cliente terminó de pagar todo (`balance_due` llega a cero).
- **Abono**: pago parcial sobre un proyecto ya creado. Distinto de "anticipo" (primer pago que crea el proyecto).
- **Cancelar aceptación**: opción del admin cuando el cliente desistió antes de pagar. Cierra la cotización, deshace la oportunidad.
- **Superseded** (reemplazada): cuando el admin crea una V2 que sustituye a V1. V1 queda histórica, V2 toma el relevo.
- **Expirada**: cotización aceptada que pasó N días (default 7) sin pago. El sistema la marca sola; el admin puede reactivar.
- **Feature flag** (`slice_3_enabled`): interruptor que prende o apaga todo este flujo sin pedir deploy. Álvaro lo controla desde `Configuración → Pagos`.
- **Piloto**: período inicial donde el feature flag está ON solo para 1-2 clientes específicos, para validar antes de activar para todos.
- **RPC**: función en la base de datos que el frontend (o el cliente público) puede llamar. Como un endpoint.
- **Trigger**: regla automática en la base que se ejecuta al cambiar algo (ej: cuando un pago pasa a `verified`, dispara la creación del proyecto).
- **Cron**: tarea programada que el sistema ejecuta cada cierto tiempo (ej: el de expiración corre cada día a las 9:30 Colombia).
- **Bucket**: contenedor de archivos en Supabase Storage. Los comprobantes viven en el bucket `payment-receipts`.
- **`short_code`**: código corto (6 chars base62) de la URL pública `/c/<código>`. Distinto del `public_token` largo de la URL legacy `/cotizacion/<token>`. Se invalida cuando la cotización cambia de estado terminal.
