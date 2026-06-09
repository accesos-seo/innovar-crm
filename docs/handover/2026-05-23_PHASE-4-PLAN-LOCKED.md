# Handoff — Innovar CRM · Fase 4 (Cotización y Aprobación del Proyecto) · Plan cerrado, listo para Slice 1

> **Fecha de cierre del ciclo de planeación**: 2026-05-23
> **Branch base sugerido**: `master` (asumiendo Fase 3 ya mergeada) o `ux-fixes` si Fase 3 todavía está abierta
> **Working dir canónico**: `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
> **Sesión origen**: `/grill-me` con prompt extenso sobre Fase 4 + ciclo automático `to-prd` → `supabase-schema` → `improve-codebase-architecture`
> **Fases 1-4 del ciclo de diseño: COMPLETADAS.** Fase 5 (ejecución de slices) arranca en sesiones futuras.

---

## 0. TL;DR — qué tiene que hacer la próxima sesión

1. **Leer** [`docs/prd/phase-4-quotation-approval.md`](../prd/phase-4-quotation-approval.md) (contrato funcional, 8 secciones + 2 anexos).
2. **Leer** [`docs/architecture/phase-4-refactor-map.md`](../architecture/phase-4-refactor-map.md) (qué archivos crear/modificar por slice, feature flag, cutover).
3. **Empezar por Slice 1** — migraciones [030](../../db/migrations/030_phase4_quotations_new_columns.sql), [031](../../db/migrations/031_phase4_bank_settings_seeds.sql), [032](../../db/migrations/032_phase4_designer_qa_seed.sql), [033](../../db/migrations/033_phase4_storage_buckets.sql).
4. **PRE-REQ Slice 1**: confirmar con Alvaro el número de WhatsApp real (placeholder en migración 032 es `+573134242949`).
5. **PRE-REQ Slice 1**: crear el usuario `diseno.test@innovar.local` en `auth.users` vía Management API ANTES de aplicar la migración 032 (instrucciones inline en el header de la migración).
6. **NO ejecutar nada hasta tener OK del usuario** sobre el slice puntual que va a aplicar.

Todo lo demás (decisiones D1-D14, justificaciones, alternativas descartadas) ya está cerrado en el PRD + grill. Si surgen dudas: el grill se transcribe en este handoff (§2).

---

## 1. Estado de los 3 documentos de planeación

| Documento | Path | Propósito |
|---|---|---|
| **PRD** | [`docs/prd/phase-4-quotation-approval.md`](../prd/phase-4-quotation-approval.md) | Contrato funcional: problem, solution, user stories, contracts, testing, anexo glosario para no-técnicos. |
| **Refactor map** | [`docs/architecture/phase-4-refactor-map.md`](../architecture/phase-4-refactor-map.md) | Qué archivos nuevos/modificados/eliminados por slice + cutover de 13 pasos + 7 riesgos. |
| **Migraciones SQL** | [`db/migrations/030..038`](../../db/migrations/) + [`ROLLBACK_phase_4.sql`](../../db/migrations/ROLLBACK_phase_4.sql) | 9 migraciones idempotentes, listas para aplicar vía Management API. |

Todas las decisiones convergen en estos 3 docs. **No re-grillar nada que ya esté ahí.** Cualquier ambigüedad — revisar primero PRD §4 (Implementation Decisions) + §6 (Out of Scope).

---

## 2. Decisiones lockeadas (las 14 del grill — referencia rápida)

| # | Decisión | Resumen |
|---|---|---|
| D1 | Aceptación | Todo-o-nada: cliente acepta o rechaza la cotización entera. Sin aprobación por ítem. |
| D2 | Aceptación vs pago | Aceptar = intención (manda WhatsApp con datos bancarios). Cliente real = cuando Alvaro verifica el pago. |
| D3.1 | Asignación diseñador | Alvaro elige manualmente desde un selector al verificar pago. |
| D3.2 | `design_deadline` | Vacío al crear el proyecto; el diseñador lo setea cuando arranca. |
| D3.3 | `clients.first_project_at` | Agregar la columna para reportar "clientes nuevos del mes". |
| D3.4 | Aviso al diseñador | In-app + WhatsApp. |
| D4 | URL vencida | Mensaje "venció" + botón "Solicitar nueva cotización" → WA al admin. |
| D5 | Botones URL pública | 3: Aceptar / Solicitar ajustes / Rechazar. Lista de motivos predefinidos en Rechazar. |
| D6 | Versionado | Mismo `quotation_number`, sube `version_number`. V2 copia editable de V1. Link viejo redirige al nuevo. Tabla diff visual. Template WA diferenciado. |
| D7 | URL pública | `/cotizacion/<token-largo>`. Token vive con la cotización. Track `viewed_at` + `view_count`. Sin metadata de IP/dispositivo. |
| D8 | Pago | `system_settings` bancarios editables sin deploy. Cliente sube comprobante en URL pública. Cualquier monto aceptado (flag `below_suggested` si <30%). Verificación manual por admin desde cola visual. |
| D9 | Recordatorios | MVP: 1 recordatorio 3d antes de vencer + aviso al admin al expirar. 3 templates WA totales. |
| D10 | Bloqueo cotización | Se bloquea al pasar a `sent`. Admin puede desbloquear con `change_reason` obligatorio + audit log. |
| D11 | Canal de envío | Solo WhatsApp. Email queda para futuro si métricas lo piden. |
| D12 | PDF | Se genera solo al `approved` (snapshot inmutable). Botón "Descargar PDF" en URL pública post-aprobación. Edge Function `generate-quotation-pdf` nueva. |
| D13 | IVA / Descuentos | Status quo del schema. Cero columnas nuevas. |
| D14 | Diseñador QA | Crear en Slice 1 con WhatsApp = número de Alvaro para validar flujo end-to-end. Reemplazar cuando se contrate diseñador real. |

---

## 3. Estado actual de producción (qué se reusa, qué se construye encima)

Lo que YA está en producción y se **REUSA INTOCADO**:

- Schema `quotations` con todas las columnas base (`version_number`, `public_token`, `valid_until`, `is_locked`, `subtotal`, `discount_type`, `transport_cost`, etc.).
- Schema `payments` con `verification_status`, `verified_by`, `verified_at`, `proof_url`, `below_suggested`, `quotation_id`.
- Schema `projects` con `approved_quotation_id`, `designer_id`, `quotation_pdf_url`, `advance_amount`, `total_amount`.
- Enum `quotation_status` con 7 valores: `draft → sent → client_approved → pending_payment_verification → approved → rejected → expired`.
- Enum `project_status` con 7 valores: `contacto → cotizacion_aprobada → en_diseno → aprobacion_final → en_produccion → listo_instalacion → entregado`.
- Trigger CRÍTICO **`convert_quotation_to_project`** (vive en producción, hace TODO el trabajo pesado al firmar `payments.verification_status='verified'`): crea project + bloquea quotation + mueve opp a `converted_to_project` + liga payment al project. Mi nueva RPC `verify_payment` LO REUSA — solo agrega designer assignment + `first_project_at` + WhatsApp.
- Trigger `create_project_from_approved_quotation` (idempotente con check `EXISTS` — no colisiona con el anterior).
- Trigger `mark_quotation_historical_on_new_version` (V2 marca V1 como histórica automáticamente).
- Trigger `recalculate_quotation_totals`, `prevent_changes_on_finalized_quotation_items`, `handle_payment_approval`, `notify_payment_received`, `check_and_update_project_status_on_payment`.
- RPC `create_quotation_version(p_quotation_id)` (reusable para crear V2).
- RPC `generate_next_quotation_number()` (reusable).
- Helpers `get_my_role()`, `enqueue_notification(...)`, `fn_wa_enqueue_for_profile(...)`, `fn_profile_wants_wa(...)`, `get_default_visitor()`, `get_bank_setting(...)` (este último lo crea Slice 1).
- Worker `process-whatsapp-notifications` v13 + cron 1 min.
- Tabla `audit_logs` (columnas camelCase: `userId`, `userName`, `tableName`, `recordId`, etc.).
- Tabla `notification_queue` con `dedup_key` ya soportado.
- Tabla `system_settings` con patrón `(key TEXT, value JSONB)`.

Lo que el Slice 1 AGREGA (sin tocar lo anterior):
- 7 columnas nuevas en `quotations` (note/reason/subtype/timestamps/tracking).
- `clients.first_project_at`.
- 7 filas en `system_settings` con keys bancarios vacíos (Alvaro las edita después).
- Profile diseñador QA en `profiles`.
- 2 buckets `payment-receipts` y `quotation-pdfs` con RLS.

---

## 4. Orden estricto de ejecución

### Slice 1 — Cimientos (DB-only, sin frontend)
**Goal**: dejar la DB y storage listos. Validar que el schema nuevo no rompe queries existentes.

**Migraciones**: 030 (columnas), 031 (bank settings + helper), 032 (diseñador QA), 033 (buckets + RLS).
**Frontend**: ninguno.
**PRE-REQ externo**:
- Confirmar número WhatsApp de Alvaro con el usuario.
- Crear `auth.users` row para `diseno.test@innovar.local` vía Management API (comando inline en header de migración 032).
**Verificación**: `SELECT * FROM quotations LIMIT 5` no rompe. `SELECT * FROM clients LIMIT 5` muestra `first_project_at` como NULL. `SELECT * FROM system_settings WHERE key LIKE 'bank_%'` devuelve 7 filas con `""`. Diseñador QA visible en `SELECT * FROM profiles WHERE role='diseno'`. Buckets visibles en Dashboard de Storage.
**Soak antes de S2**: 24h.

### Slice 2 — URL pública + acceptance/rejection + lock + sync opp
**Goal**: el cliente puede abrir el link, aceptar/rechazar/pedir ajustes. Sin pago todavía.

**Migraciones**: 034 (4 RPCs públicas), 035 (lock trigger + sync + notif accept/reject + unlock RPC + send RPC + audit).
**Frontend**: `PublicQuotation` page, layout público, `QuotationActionButtons`, `QuotationVersionsDiff`, `QuotationExpiredView`, `QuotationRedirectView`, `QuotationLockBadge`, `UnlockQuotationModal`, `SendQuotationButton`, `CreateNewVersionButton`, 8 hooks nuevos en `src/hooks/quotations/`, schema Zod `quotation-public.ts`, ruta `/cotizacion/:token` en `App.tsx`, modificaciones a `QuotationDetail.tsx` y `Quotations.tsx`, mappings en `NotificationBell.tsx`.
**Bloqueador externo**: Felipe aprueba 2 templates Meta: `quotation_sent_v1`, `quotation_v2_sent_v1`.
**Verificación E2E**: crear cotización QA → enviar → abrir URL en incógnito mobile → aceptar → ver que status pasa a `client_approved`, opportunity.status sync, admin recibe notif in-app. Rechazar con ajustes en otra cotización → admin recibe notif con feedback. Crear V2 → link viejo redirige.
**Soak antes de S3**: 48h.

### Slice 3 — Pago (upload + verificación + cola pendientes + bank settings UI)
**Goal**: cliente sube comprobante. Admin verifica desde cola visual. Proyecto se crea con diseñador asignado.

**Migraciones**: 036 (submit/verify RPCs + designer notif trigger).
**Frontend**: `QuotationPaymentSection` + `QuotationPaymentUpload` (en `public/`), `PendingPayments` page, `BankSettings` page, `PaymentVerificationModal`, `DesignerPicker`, `PaymentReceiptPreview`, `BankSettingsForm`, hooks `useSubmitPaymentProof`, `usePendingPayments`, `useVerifyPayment`, `useActiveDesigners`, `useBankSettings`, schema `bank-settings.ts`, rutas nuevas `/admin/pagos-pendientes` + `/admin/configuracion/bancarios`, tab nuevo en `Pagos.tsx`.
**Bloqueador externo**: Felipe aprueba 3 templates Meta: `payment_request_v1`, `payment_received_v1`, `project_assigned_designer_v1`.
**Verificación E2E**: continuar QA de S2 → cliente sube comprobante → admin lo ve en cola → verifica → proyecto creado con `designer_id=diseñador QA` → notif in-app al diseñador + WhatsApp al cliente.
**Soak antes de S4**: 48h.

### Slice 4 — Recordatorios + expiración automática (DB-only)
**Goal**: el sistema gestiona solo el ciclo de vida temporal.

**Migraciones**: 037 (expire scan + reminders 3d + 2 crons).
**Frontend**: ninguno.
**Bloqueador externo**: Felipe aprueba 2 templates: `quotation_reminder_3d_client_v1`, `payment_reminder_3d_client_v1`. Opcionalmente `quotation_reactivation_admin_v1` (este lo usa el RPC de Slice 2).
**Verificación**: insertar cotización con `valid_until = now() + INTERVAL '2 days 23 hours'` → correr cron manual → verificar WhatsApp encolado con `dedup_key`. Setear `valid_until = now() - INTERVAL '1 hour'` → correr scan → verificar `status='expired'` y notif al admin.

### Slice 5 — PDF inmutable post-aprobación
**Goal**: cliente con pago verificado puede descargar PDF del contrato.

**Migraciones**: 038 (PDF log table + trigger_pdf_generation RPC + trigger AFTER INSERT on projects).
**Frontend**: `QuotationApprovedView` con botón "Descargar PDF" + polling, cambios mínimos en `QuotationDetail.tsx`.
**Edge function nueva**: `generate-quotation-pdf` — DEBE estar desplegada ANTES de aplicar migración 038.
**Verificación**: completar QA hasta `approved` → verificar PDF generado en bucket `quotation-pdfs` → URL guardada en `projects.quotation_pdf_url` → botón funciona desde URL pública.

**Cierre de Fase 4** al terminar S5.

---

## 5. Cómo aplicar las migraciones

```bash
# Working dir
cd "C:/Users/ceoel/OneDrive/Escritorio/mi proyect/Agents-automations/Innovar-App-main"

# Helper inline (usa el SUPABASE_ACCESS_TOKEN del .env)
PAT=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r"')
URL="https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query"

# Aplicar una migración
node -e "process.stdout.write(JSON.stringify({query: require('fs').readFileSync(process.argv[1],'utf8')}))" \
  db/migrations/030_phase4_quotations_new_columns.sql > /tmp/q.json
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  --data-binary "@/tmp/q.json"
```

Tras cada migración exitosa: editar `db/migrations/README.md` y cambiar `⏳ Pending` por `✅ Applied YYYY-MM-DD`.

### Crear `auth.users` para diseñador QA (antes de migración 032)

```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/auth/v1/admin/users" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "d1591a8e-2026-4f4d-9d11-1100519d5ccc",
    "email": "diseno.test@innovar.local",
    "password": "InnovarTest2026!DisenoQA",
    "email_confirm": true
  }'
```

---

## 6. Templates Meta — qué crear y aprobar

9 templates UTILITY/ES nuevos. Cada uno se crea en Meta Business Manager → WhatsApp Manager → Message Templates. Distribución por Slice:

| Slice | Templates a aprobar |
|---|---|
| S2 | `quotation_sent_v1`, `quotation_v2_sent_v1` |
| S3 | `payment_request_v1`, `payment_received_v1`, `project_assigned_designer_v1` |
| S4 | `quotation_reminder_3d_client_v1`, `payment_reminder_3d_client_v1`, `quotation_reactivation_admin_v1` |
| S5 | (ninguno nuevo) |

Wording sugerido completo en PRD §4.4. Mientras no estén aprobados, los rows en `notification_queue` quedan `failed`. Cero rotura del flujo: cuando se aprueben, los nuevos mensajes fluyen automáticamente.

**Aprobación se solicita en paralelo desde el inicio de Fase 4** — tarda 24-48h por template.

---

## 7. Comandos útiles que la próxima sesión va a usar

**Verificar estado prod del schema nuevo**:
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  --data-binary '{"query":"SELECT column_name FROM information_schema.columns WHERE table_schema=\"public\" AND table_name=\"quotations\" AND column_name IN (\"viewed_at\",\"view_count\",\"client_acceptance_note\");"}'
```

**Crear cotización QA E2E**:
```sql
-- Asume que hay una opportunity con visit completada
WITH opp AS (
  SELECT id, client_id FROM opportunities WHERE status='visit_completed' LIMIT 1
),
new_quot AS (
  INSERT INTO quotations (client_id, opportunity_id, status, total_amount, transport_cost)
  SELECT client_id, id, 'draft'::quotation_status, 5000000, 600000 FROM opp
  RETURNING id, public_token
)
SELECT * FROM new_quot;

-- Después: SELECT public.send_quotation_to_client('<quotation_id>');
```

**Smoke S2 — aceptar desde RPC pública**:
```sql
SELECT public.accept_public_quotation('<public_token>', 'Probando aceptación QA');
```

**Verificar UI sin deploy** (vite preview):
```bash
npm run build
# Luego usar mcp__Claude_Preview__preview_start con name="innovar-preview-phase4"
```

---

## 8. Restricciones operativas (no las olvides)

- **OneDrive + path con espacios** (`mi proyect`) rompe `npm run dev`. Usar siempre `npm run build` + `vite preview` para verificación visual local.
- **No correr `vercel --prod` ni `git push` en background** — el usuario los corre manualmente en su PowerShell.
- **SQL/secrets/cron en Supabase Innovar los aplica el agente** vía Management API (PAT en `.env`). Solo derivar al usuario cuando se necesita un secreto que no está en `.env` (ej. tokens de Meta).
- **Antes de teorizar bugs**: pedir reproducción en incógnito / Clear Site Data. Lección JWT stale del 2026-05-19.
- **Antes de tocar schemas**: validar contra producción vía Management API. `db/supabase_schema.sql` y `database.types.ts` están desactualizados.
- **Idioma DB↔Frontend**: DB en inglés, UI en español. Sin excepción.
- **Nunca llamar SDK desde `onAuthStateChange`** — deadlock confirmado 2026-05-22.
- **`supabase.channel('<nombre-fijo>')` es singleton global** — solo un suscriptor; usar `crypto.randomUUID()` si necesitas múltiples.
- **CHECK existente en `quotations.discount_type`**: valores válidos son `'percent','fixed','none'` (NO `'percentage'`).
- **CHECK existente en `quotations.quotation_type`**: valores válidos son `'initial','addendum'`.
- **Tabla `audit_logs` usa camelCase**: SIEMPRE entrecomillar los nombres (`"userId"`, `"tableName"`, `"recordId"`, `"changesSummary"`, `"timestamp"`).

---

## 9. Riesgos conocidos al ejecutar

1. **Trigger `convert_quotation_to_project`** (que reusamos) usa `array_to_string(v_opp.services, ', ')` para llenar `projects.work_type`. Ese campo es ENUM `work_type` (probablemente con valores como `'cocina','baño','closet','otro'`). Si los services del opportunity no matchean exactamente, va a romper. Verificar en QA pre-Slice 3.
2. **El UUID del diseñador QA** está hardcoded en migración 032 (`d1591a8e-2026-4f4d-9d11-1100519d5ccc`). Si por algún motivo ya está usado en `auth.users`, falla. Cambiar UUID en ese caso.
3. **El número de Alvaro está como placeholder `+573134242949`** en la migración 032. CONFIRMAR antes de aplicar.
4. **`handle_payment_approval` existente** intenta mover proyectos a `'en_produccion'` cuando el total pagado >= advance. Esto está bien para pagos posteriores al primer abono, pero podría disparar prematuramente si el primer pago = total. Verificar en QA S3.
5. **`check_and_update_project_status_on_payment`** hace lo mismo que `handle_payment_approval`. Hay redundancia que puede causar logs duplicados. Out of scope corregir en Fase 4, pero monitorear.
6. **Edge Function `generate-quotation-pdf` (Slice 5)** no existe todavía. Si se aplica migración 038 antes de desplegar la Edge Function, el trigger fallará silenciosamente y `pdf_generation_log` se llenará de rows con `status='failed'`. Aplicar 038 SOLO después de deploy de la función.
7. **El bucket `payment-receipts` permite INSERT anónimo** — RLS valida el path corresponde a cotización válida. Riesgo bajo, pero monitorear si aparecen archivos huérfanos.
8. **Comparación de versiones en `QuotationVersionsDiff`** usa heurística por descripción. Si Alvaro renombra un item entre V1 y V2 sin tocar precio, aparece como "eliminado + agregado". Aceptable para MVP.

---

## 10. Memoria personal del usuario (próxima sesión)

Para alinearse con preferencias documentadas:

- Usuario **aplica acciones él mismo** SOLO cuando son git/deploy en OneDrive — agente entrega comandos copy-pasteables solo en esos casos.
- Agente **aplica DB directamente** vía Management API + PAT del `.env`.
- Agente **escribe archivos directamente** sin pedir confirmación previa.
- **Lenguaje plano en español** durante grills y conversaciones. Traducir cada término técnico la primera vez (regla nueva agregada a `/grill-me` el 2026-05-23).
- Tone: respuestas cortas, técnicas, español.
- Antes de cada bash con SQL/curl: 1 frase de intención.
- Al cerrar slice: commit + handoff en `docs/handover/` + entry en MEMORY.md.

---

## 11. Entry point recomendado para la próxima sesión

```
/retomar
# o
"Continuemos con Fase 4 — arranquemos Slice 1"
```

Ambos disparan la lectura automática de este documento vía la entry en MEMORY.md.

Si la próxima sesión arranca con `/retomar`, ese skill leerá este handoff y dirá "OK, ¿confirmás el número de WhatsApp de Alvaro para el diseñador QA + arranco con migración 030?". El usuario solo necesita responder.
