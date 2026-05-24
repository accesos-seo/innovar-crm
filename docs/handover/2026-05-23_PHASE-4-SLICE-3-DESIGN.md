# Handoff — Fase 4 · Slice 3 (Pago → Proyecto) · Diseño cerrado

**Fecha:** 2026-05-23 (noche)
**Estado del slice:** Diseño cerrado (grill-me Fase 1 completa, plan aprobado). Pendiente Fase 2 PRD + Fase 3 schema SQL + Fase 4 refactor map + Fase 5 ejecución.
**Plan aprobado:** `C:\Users\ceoel\.claude\plans\stateless-plotting-wombat.md` (leer ANTES de arrancar — tiene el plan completo con diseño técnico, máquinas de estado, componentes a crear, migraciones tentativas, y verificación end-to-end).

---

## TL;DR para la próxima sesión

Slice 3 es el puente automático entre **cotización aceptada por el cliente** y **proyecto activo con diseñador asignado**, gatillado por la verificación de un pago. Slice 2 está desplegado (cliente acepta/rechaza/pide cambios en `/c/:código`). Slice 3 cierra el ciclo lead→project agregando el flujo de pago end-to-end.

El **diseño está cerrado** (13 decisiones tomadas con el usuario en sesión de grill-me). Falta:

1. **Fase 2 (PRD)** — formalizar el diseño en documento PRD
2. **Fase 3 (schema)** — diseñar migraciones SQL 037–039 (reemplaza 036 no desplegada)
3. **Fase 4 (refactor map)** — mapear componentes nuevos/modificados
4. **Fase 5 (ejecución)** — backend → UI admin → UI cliente → smoke tests → activación de flag piloto

---

## Decisiones cerradas (autoritativas)

| # | Decisión | Resolución |
|---|---|---|
| 1 | Quién registra el pago | Cliente sube comprobante (transferencia/Nequi/Daviplata) **Y** admin registra manual (efectivo/cheque). **Dos caminos coexisten.** |
| 2 | Monto que dispara conversión a proyecto | **Primer pago verificado** convierte. Saldo restante queda en `projects.balance_due`. Advertencia visible si anticipo < umbral configurable (default 20%). |
| 3 | Versionado al pedir ajustes | Versión nueva **reemplaza** (`status='superseded'` para v1). Link viejo invalidado. WA automático con link nuevo. Reutiliza `parent_quotation_id` + `version_number` ya existentes. |
| 4 | Expiración tras aceptar | Cron diario marca `expired` lo que pasa de **7 días configurables** sin pago. Setting: `system_settings.payment_window_days`. Notif a admin con botón "reactivar" que reinicia ventana. |
| 5 | Asignación de diseñador | Dropdown en el modal de verificación de pago, con escape "asignar después". |
| 6 | Datos bancarios | **1 cuenta principal + Nequi + Daviplata.** Pantalla `Configuración → Datos Bancarios` edita filas de `system_settings` (placeholders ya existen). |
| 7 | Rechazo de comprobante | Botones "Verificar" / "Rechazar con motivo". WA automático al cliente con razón + link para reintentar. Pago rechazado queda en historial. Cotización sigue `client_approved`. |
| 8 | Permisos verificación | **Cualquier admin.** RPC `verify_payment` restringida a `role=admin`. Audit log obligatorio (`verified_by` + `verified_at` + `amount`). |
| 9 | Cancelar aceptación pre-pago | Solo admin, con motivo registrado. Nuevo estado `quotations.status='cancelled'`. Link invalidado. Opportunity vuelve a `lost`. Cliente NO puede cancelar desde el link. |
| 10 | UX pantalla `/pagos` | **3 tabs**: `Por verificar` (default + badge contador), `Verificados`, `Rechazados`. Construir sobre `Pagos.tsx` existente. |
| 11 | Abonos post-anticipo | **Mismo link `/c/:código`**. RPC `submit_quotation_payment_proof` debe aceptar uploads aun con `is_locked=true`. Admin al verificar elige tipo (`abono` / `pago_final`). Cuando `balance_due=0` → evento `project_fully_paid` + WA cliente. |
| 12 | Notif al admin (WA) | **Mínimo crítico**: solo 2 templates WA admin (`admin_quotation_accepted_v1` + nuevo `admin_quotation_expired_v1`). Resto in-app (badge en `/pagos`, bell). Cliente sí recibe WA en cada evento. Diseñador recibe WA al asignarle proyecto. |
| 13 | Rollout | **Feature flag** `slice_3_enabled` en `system_settings` (default `false`). Deploy con todo armado y apagado. Álvaro prende para 1-2 pilotos, valida, después activa para todos. Apagable con 1 click sin redeploy. |

---

## Estado actual de la base de datos (qué ya existe en producción)

**Proyecto Supabase:** `xdzbjptozeqcbnaqhtye` (FUERA del scope del MCP nativo — usar Management API con `SUPABASE_ACCESS_TOKEN` del `.env` local; patrón en MEMORY → [[reference-innovar-management-api]]).

**Slice 2 desplegado (migraciones 030-035 + 035a + 035b):**
- `quotations` con: `status` (enum `draft|sent|approved|rejected|client_approved|pending_payment_verification|expired`), `public_token`, `short_code` (6-char base62), `viewed_at`, `view_count`, `client_approved_at`, `client_rejection_reason`, `client_rejection_subtype`, `client_acceptance_note`, `is_locked`, `project_id`, `is_historical_copy`, `parent_quotation_id`, `version_number`.
- `payments` con: `quotation_id`, `project_id`, `amount`, `payment_method` (efectivo|transferencia|credito|cheque|nequi|daviplata|pse), `payment_type` (anticipo|abono|pago_final|reembolso), `proof_url`, `verification_status` (pending|verified — **falta `rejected`**), `received_at`, `verified_at`, `verified_by`, `below_suggested`, `registered_by`, `receipt_url`, `notes`.
- `projects` con: `approved_quotation_id`, `opportunity_id`, `designer_id`, `status` (cotizacion_aprobada|en_diseno|...), `total_amount`, `advance_amount`, `client_approved_at`, `name`, `work_type`. **Falta `balance_due` y `is_fully_paid`.**
- `system_settings` (k/v JSONB) con placeholders `bank_name`, `bank_account_number`, `bank_account_type`, `bank_holder_name`, `bank_holder_id`, `nequi_phone`, `daviplata_phone` (todos vacíos).
- Trigger `fn_notify_quotation_acceptance` (cuando cliente acepta) → encola WA al cliente (`payment_request_v1`) + notif in-app admin + WA admin (`admin_quotation_accepted_v1`). **Los WA están encolados pero no se envían** porque los templates aún no están aprobados en Meta.

**Migración 036 (NO desplegada):** Contiene un primer draft de Slice 3 (RPC `submit_quotation_payment_proof`, RPC `verify_payment` con asignación de diseñador, trigger `trg_payment_convert_to_project`). **Hay que reemplazarla** por una nueva (037) que incorpore las decisiones de este grill (especialmente: `rejected` en payments, `cancelled` en quotations, `balance_due` en projects, feature flag, RPC adicionales `reject_payment` + `cancel_quotation_acceptance` + `create_quotation_revision`).

**Migración 037 a diseñar (Fase 3):** Reemplaza 036.

---

## Bloqueadores externos (sin solución desde código)

### 1. Templates WhatsApp en Meta — 6 nuevos + 4 ya pendientes = 10 a aprobar

Sin estos aprobados, los WA quedan en `notification_queue.status='failed'`. Los rows del flujo quedan persistidos: cuando un template se aprueba, basta con `UPDATE notification_queue SET status='pending' WHERE template_name = '<aprobado>' AND status='failed'` y el worker `process-whatsapp-notifications` los reintenta.

**Pendientes de aprobar (lista completa):**

| Template | Audiencia | Origen | Estado |
|---|---|---|---|
| `payment_request_v1` | cliente | mig 035b (Slice 2) | pendiente Meta |
| `admin_quotation_accepted_v1` | admin | mig 035b (Slice 2) | pendiente Meta |
| `admin_quotation_adjustments_v1` | admin | mig 035b (Slice 2) | pendiente Meta |
| `admin_quotation_rejected_v1` | admin | mig 035b (Slice 2) | pendiente Meta |
| `admin_quotation_expired_v1` | admin | **nuevo Slice 3 (Q4+Q12)** | a crear y aprobar |
| `payment_received_v1` | cliente | mig 036 (planeado) | pendiente Meta |
| `payment_proof_rejected_v1` | cliente | **nuevo Slice 3 (Q7)** | a crear y aprobar |
| `project_assigned_designer_v1` | diseñador | mig 036 (planeado) | pendiente Meta |
| `project_fully_paid_v1` | cliente | **nuevo Slice 3 (Q11)** | a crear y aprobar |
| `quotation_v2_sent_v1` | cliente | **nuevo Slice 3 (Q3)** | a crear y aprobar |

Felipe es quien aprueba/crea templates en Meta Business Manager. Convención de wording y variables: `reference_innovar_whatsapp_templates.md` en `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\`.

### 2. Worker `process-whatsapp-notifications` (Edge Function) tiene `TEMPLATE_REGISTRY` hardcoded

Hoy registra solo 7 templates (los de booking + visita). Cuando Felipe apruebe los nuevos, hay que **extender el registry y redeployar** la edge function (`supabase functions deploy process-whatsapp-notifications`). El token está en `.env` local (`SUPABASE_ACCESS_TOKEN`).

### 3. ⚠️ Race condition OneDrive con git/dev

- **NUNCA** correr `npm run dev` con watcher Vite en el path OneDrive: rompe HMR aleatoriamente. Usar `npm run build` + `npm run preview` (puerto 4173) en su lugar para verificación manual.
- **NUNCA** hacer `git commit` desde el agente; preparar comando y el usuario lo corre.
- Para previews públicos: `vite preview --host` + tunnel cloudflared, con `preview.allowedHosts` configurado en vite.config (ver memoria sobre Slice 2 QA).

---

## Convenciones críticas a respetar (no negociables)

Leer **antes** de tocar código:
- `Innovar-App-main\CLAUDE.md` — convenciones del proyecto (errors via `mapSupabaseError`, Zod en mutations, retry:0, design tokens dark premium, idioma DB en inglés / UI en español).
- `Innovar-App-main\docs\CONVENTIONS.md` si existe — más convenciones.
- Memoria global `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` — anti-patrones reutilizables (especialmente: **nunca llamar SDK Supabase desde `onAuthStateChange`** → causa deadlock; channels Realtime con nombre hardcoded son singletons; `enqueue_notification` es WhatsApp-only; etc.).

**Idioma:** DB en inglés (enums, CHECK constraints, valores Zod). UI en español. **CHECK doble:** antes de tocar schema, validar contra DB de PRODUCCIÓN con Management API — los archivos `db/supabase_schema.sql` y `src/types/database.types.ts` están desactualizados (bug histórico documentado).

**RLS/grants:** Tablas internas (logs, queues) → `ENABLE RLS` + `REVOKE ALL FROM anon, authenticated`. RLS solo no basta porque TRUNCATE bypassa RLS. Lección de `scheduled_job_log` (mig 029 + 029a).

**Notificaciones in-app:** INSERTar directo en `public.notifications`. NO usar el helper `enqueue_notification` que es WhatsApp-only (exige template NOT NULL).

---

## Próximos pasos del ciclo (Fases 2-5)

| Fase | Skill | Entregable | Quién |
|---|---|---|---|
| 2 | `to-prd` | PRD formal en `Innovar-App-main\docs\prd\2026-05-23_slice-3-payment-to-project.md` | IA nueva sesión |
| 3 | `supabase-schema` | Migración 037 (reemplaza 036) + 038 (cron expiry) + 039 (seeds bank settings) en `db/migrations/` | IA nueva sesión |
| 4 | `improve-codebase-architecture` | Mapa de refactor en `docs/architecture/slice-3-refactor-map.md` (componentes nuevos vs modificados vs eliminados, feature flag, cutover) | IA nueva sesión |
| 5 | Ejecución | Backend → UI admin (modal verify/reject, BankSettings, PaymentSettings) → UI cliente (PaymentProofUploader) → smoke tests → activar flag piloto | IA nueva sesión (múltiples turnos) |

Cada fase termina con verificación end-to-end. Smoke tests definidos en el plan aprobado (sección "Verificación de extremo a extremo").

---

## Componentes y archivos esperados (resumen del plan)

**Cliente (público):**
- `src/pages/PublicQuotation.tsx` — modificar para agregar sección "Subir comprobante" + ver datos bancarios
- `src/components/public/PaymentProofUploader.tsx` — nuevo

**Admin:**
- `src/pages/Pagos.tsx` — refactor a 3 tabs
- `src/components/payments/PaymentVerifyModal.tsx` — nuevo
- `src/components/payments/PaymentRejectModal.tsx` — nuevo
- `src/components/quotations/QuotationCancelModal.tsx` — nuevo
- `src/pages/BankSettings.tsx` — nuevo
- `src/components/settings/PaymentSettings.tsx` — nuevo (toggle flag + slider días)

**Schema/SQL:**
- `db/migrations/037_slice3_payment_flow.sql` — reemplaza 036
- `db/migrations/038_payment_expiry_cron.sql`
- `db/migrations/039_bank_settings_seed.sql`

**WhatsApp templates registry:**
- `supabase/functions/process-whatsapp-notifications/index.ts` — extender `TEMPLATE_REGISTRY` con 6 templates nuevos cuando estén aprobados en Meta

---

## Verificación end-to-end (definida en plan, target final)

Una vez deployado + flag activo:

1. Cliente sube comprobante → admin ve badge "1" en `/pagos` tab "Por verificar"
2. Admin verifica → proyecto creado + WA cliente + WA diseñador + cotización locked + opp converted
3. Admin rechaza → cliente recibe WA con motivo + link reintento + pago en tab "Rechazados"
4. Admin registra efectivo manual → payment verified directo → trigger conversión
5. Cron expira aceptadas >7d sin pago → notif admin con botón reactivar
6. Abono post-conversión → balance_due baja → al llegar 0 → evento `project_fully_paid` + WA cliente
7. Admin cancela aceptación con motivo → status `cancelled` + opp `lost`

---

## Estado al cierre de esta sesión

- ✅ Grill Fase 1 completa (13/13 decisiones cerradas)
- ✅ Plan aprobado por el usuario (`stateless-plotting-wombat.md`)
- ✅ Handoff escrito (este documento)
- ⏸️ Fases 2-5 movidas a sesión nueva con contexto limpio (decisión del usuario para no saturar ventana)
- ⏸️ Templates Meta esperando aprobación (bloqueador externo, independiente del trabajo de la IA)

**Próxima IA:** leer este handoff + leer el plan aprobado + arrancar Fase 2 (`to-prd`) inmediatamente.
