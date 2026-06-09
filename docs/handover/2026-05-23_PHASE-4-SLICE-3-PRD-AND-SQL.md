# Handoff — Fase 4 · Slice 3 (Pago → Proyecto) · PRD + 4 migraciones SQL listas

**Fecha:** 2026-05-23 (madrugada, post-PRD + post-SQL design)
**Estado del slice:** Fase 1 (grill) ✅ · Fase 2 (PRD) ✅ · Fase 3 (schema SQL) ✅ · Fase 4 (refactor map) ⏸️ pendiente · Fase 5 (ejecución) ⏸️ pendiente

**Predecesor (NO sustituye, contexto del grill):** [`2026-05-23_PHASE-4-SLICE-3-DESIGN.md`](2026-05-23_PHASE-4-SLICE-3-DESIGN.md) — handoff post-grill con las 13 decisiones cerradas.

**Este handoff documenta:** lo escrito en Fases 2-3 + 10 correcciones críticas detectadas validando contra prod + qué falta + decisiones de implementación que el PRD original no anticipó.

---

## TL;DR para la próxima sesión

Slice 3 tiene PRD formal + 4 migraciones SQL idempotentes listas para revisar y aplicar. **Nada se aplicó a producción todavía** — los archivos están escritos pero `BEGIN/COMMIT` en disco, sin tocar la base.

El **diseño técnico es definitivo** (validado contra el schema vivo de `xdzbjptozeqcbnaqhtye` con Management API). El PRD original tiene **10 imprecisiones** detectadas durante la validación SQL — están corregidas en los archivos `037-039.sql` pero el archivo PRD `2026-05-23_slice-3-payment-to-project.md` **no se actualizó in-place** (las correcciones quedan documentadas acá; ver §3).

**Siguiente sesión arranca con Fase 4** (`/improve-codebase-architecture` para refactor map), después Fase 5 (ejecución backend → UI admin → UI cliente → smoke E2E → flag piloto).

---

## Estado de archivos al cierre

### Documentos de diseño

| Path | Estado | Notas |
|---|---|---|
| `docs/handover/2026-05-23_PHASE-4-SLICE-3-DESIGN.md` | ✅ Inalterado | Handoff post-grill con 13 decisiones — sigue siendo autoritativo en decisiones de producto. |
| `C:\Users\ceoel\.claude\plans\stateless-plotting-wombat.md` | ✅ Inalterado | Plan aprobado del grill. |
| `docs/prd/2026-05-23_slice-3-payment-to-project.md` | ✅ Escrito | PRD formal de 10 secciones + 2 anexos. **Tiene 10 imprecisiones** corregidas en SQL pero no en el doc — ver §3 acá. |

### Migraciones SQL (en disco, NO desplegadas)

| Path | Líneas | Idempotente | Aplicada en prod |
|---|---|---|---|
| `db/migrations/037_slice3_payment_flow.sql` | ~700 | ✅ Sí (IF NOT EXISTS, ON CONFLICT, DROP IF EXISTS) | ❌ No |
| `db/migrations/038_slice3_expiry_cron.sql` | ~130 | ✅ Sí (cron.unschedule antes de schedule) | ❌ No |
| `db/migrations/039_slice3_settings_seeds.sql` | ~30 | ✅ Sí (ON CONFLICT DO NOTHING) | ❌ No |
| `db/migrations/ROLLBACK_slice_3.sql` | ~210 | ✅ Sí (DROP IF EXISTS, restaura S2 versions) | ❌ No |

### Migración 036 (legacy)

| Path | Acción |
|---|---|
| `db/migrations/036_*.sql` (si existe) | **No fue desplegada en prod** (validado: las funciones que declara no existen). Recomendado: renombrar a `036_REPLACED_BY_037.sql.archived` o eliminar antes de aplicar 037. |

---

## Decisiones cerradas (autoritativas — copia del handoff predecesor)

Las 13 decisiones del grill 2026-05-23 son input de PRD/SQL. **NO renegociar**. Resumen:

| # | Resolución corta |
|---|---|
| D1 | Cliente sube comprobante + admin manual coexisten |
| D2 | Primer pago verificado convierte; `balance_due` rastrea saldo; warning si <30% no bloquea |
| D3 | V2 reemplaza V1 (`superseded`); link viejo invalidado; WA con link nuevo |
| D4 | Cron diario expira `client_approved` o `pending_payment_verification` > N días (default 7, configurable) |
| D5 | Diseñador asignado en modal verify con escape "asignar después" |
| D6 | 1 cuenta bancaria + Nequi + Daviplata en `system_settings` |
| D7 | Rechazo con motivo + WA cliente con razón + link reintento |
| D8 | Cualquier admin verifica; audit obligatorio |
| D9 | Solo admin cancela aceptación con motivo (estado `cancelled`); opp → `lost` o `cancelled_after_approval` |
| D10 | `/pagos` con 3 tabs (Por verificar / Verificados / Rechazados) |
| D11 | Abonos por mismo link `/c/<code>` hasta `is_fully_paid` |
| D12 | WA admin mínimo (2 templates); resto in-app; cliente sí recibe WA en cada evento |
| D13 | Feature flag `slice_3_enabled` (default false); apagable sin redeploy |

Detalle completo: [`2026-05-23_PHASE-4-SLICE-3-DESIGN.md §Decisiones cerradas`](2026-05-23_PHASE-4-SLICE-3-DESIGN.md).

---

## §3 — Las 10 correcciones del PRD detectadas durante validación SQL

Estas 10 imprecisiones aparecieron al validar el schema real de producción con Management API antes de escribir los `*.sql`. **Las migraciones reflejan el estado correcto**; el PRD escrito quedó con la versión preliminar. Cuando la próxima IA lea el PRD, debe priorizar lo que dicen estos hallazgos sobre el texto del PRD.

### 1. `payments.verification_status` YA tiene CHECK con `rejected` desplegado

PRD decía "falta el valor `rejected`". **Falso**: en prod el CHECK es `CHECK (verification_status IN ('pending','verified','rejected'))`. La mig 037 solo agrega las columnas de audit (`rejection_reason`, `rejected_by`, `rejected_at`) — NO toca el CHECK.

### 2. `payments.payment_type` ya tiene CHECK con valores en INGLÉS

PRD listó `{anticipo, abono, pago_final, reembolso}` (español). **Real en prod**: `CHECK (payment_type IN ('advance','installment','final','refund'))`. Las RPCs SQL usan los inglés reales. **Mapping ES→EN va al frontend**:

| Frontend (UI) | DB (payment_type) |
|---|---|
| Anticipo | `advance` |
| Abono | `installment` |
| Pago final | `final` |
| Reembolso | `refund` |

Cualquier Zod schema en `src/schemas/payment-proof.ts` que use estos valores debe declararlos en inglés y la UI los traduce con un mapa.

### 3. Bucket Storage `payment-receipts` YA existe

PRD lo listó como "Nuevo" o "Verificar existencia". **Real**: creado durante Slice 2 (timestamp `2026-05-23T17:40:05Z`), privado, 5MB max, MIME whitelist `[image/jpeg, image/png, image/webp, application/pdf]`. **La mig 037 NO lo crea**; solo **extiende la policy `payment_receipts_anon_insert`** para incluir estado `approved` (necesario para D11 abonos sobre proyecto ya creado, no solo `client_approved`/`pending_payment_verification`).

### 4. Trigger `trg_payment_convert_to_project` (función `convert_quotation_to_project`) YA existe

PRD propuso crear un trigger nuevo `trg_payment_verified_convert_to_project`. **Real**: ya existe con función equivalente. La mig 037 hace `CREATE OR REPLACE` de la función existente agregando:
- seteo de `balance_due` y `is_fully_paid`/`fully_paid_at` al crear el proyecto
- notif in-app extendida al admin (la asignación de diseñador queda en `verify_payment` RPC, NO en este trigger)

### 5. `fn_wa_payment_received` (trigger en payments) YA encola el template aprobado

PRD listó `payment_received_v1` como template nuevo a aprobar. **Real**: el template `payment_received` (sin sufijo) ya está aprobado en Meta con 5 vars (`{{1}}=nombre, {{2}}=monto, {{3}}=proyecto, {{4}}=método, {{5}}=saldo`). El trigger existente `fn_wa_payment_received` ya lo encola al cliente cuando el pago se inserta. **La mig 037 NO lo toca**. Esto baja el conteo de templates Slice 3 nuevos de 6 a **5**.

### 6. `fn_sync_opportunity_from_quotation` (S2) NO mapeaba `cancelled` ni `superseded`

PRD asumió que el sync existente cubriría los nuevos estados. **Falso**: el CASE de S2 no contemplaba `cancelled` (devolvía NULL → opp quedaba en último estado). La mig 037 hace `CREATE OR REPLACE` agregando:
- `cancelled` → `lost` (si NO hay proyecto creado) o `cancelled_after_approval` (si SÍ hay proyecto)
- `superseded` → deliberadamente NO sincroniza (V2 toma el relevo con su propia opp.status)
- al mapear a `lost`/`cancelled_after_approval`, también copia `quotations.cancellation_reason` → `opportunities.lost_reason` y setea `lost_at = now()` si era NULL

### 7. `opportunities.status` es TEXT con CHECK, NO enum

PRD listó "enum `opportunity_status`". **Real**: es `text NOT NULL default 'new'` con CHECK que incluye 12 valores: `{new, contacted, visit_scheduled, visit_completed, quoted, sent_to_client, client_approved, pending_payment_verification, approved, converted_to_project, lost, cancelled_after_approval}`. El valor `cancelled_after_approval` ya existe ✅ — perfecto para Q9 cuando hay proyecto ya creado.

### 8. `audit_logs` existe con camelCase (no snake_case)

PRD asumió "verificar si existe `audit_logs`". **Real**: existe con columnas en camelCase: `id, "userId", "userName", action, "tableName", "recordId", "changesSummary", "ipAddress", "userAgent", "timestamp"`. Toda RPC en mig 037 que inserta audit usa los nombres entre comillas dobles. Inconsistente con el resto del schema (que es snake_case) pero es deuda histórica fuera de scope.

### 9. RPCs públicas reciben `p_token` (long token), no `short_code`

PRD a veces decía `submit_quotation_payment_proof(p_short_code, ...)`. **Convención S2 (verificada)**: RPCs públicas reciben `p_token TEXT` (el long `public_token` de 32 chars). El frontend de `/c/<short_code>` resuelve primero con `resolve_quotation_short_code(p_code)` para obtener el `public_token`, después llama la RPC. La mig 037 sigue el patrón: `submit_quotation_payment_proof(p_token, ...)`.

### 10. `handle_payment_approval` + `check_and_update_project_status_on_payment` están DUPLICADAS en prod

Ambos triggers activos hacen casi lo mismo (mueven proyecto a `en_produccion` cuando se cubre el anticipo). **Deuda pre-existente, fuera de scope Slice 3**. No tocar; la mig 037 los deja como están. Documentar para fase futura de cleanup.

---

## §4 — Lo que ya hace cada migración (resumen ejecutivo)

### 037_slice3_payment_flow.sql

**Bloque 1 (transacción 1):** ALTER TYPE `quotation_status` ADD VALUE `cancelled` + `superseded`.

**Bloque 2 (transacción 2):**
- Columnas nuevas: `quotations` (5: cancellation_*, superseded_*), `payments` (4: rejection_*, payment_source), `projects` (4: balance_due, is_fully_paid, fully_paid_at, cancellation_reason).
- CHECK constraint: `payments.payment_source IN ('client_upload', 'admin_manual')`.
- Storage policy update: `payment_receipts_anon_insert` extendida a `approved`.
- Helper `get_feature_flag(p_key)` → BOOLEAN. Lee `system_settings`, default false.
- Helper `recalc_project_balance_due(p_project_id)` → recalcula `balance_due`, marca `is_fully_paid`+`fully_paid_at` en el primer cruce a ≤0, encola WA `project_fully_paid_v1` una sola vez con dedup_key.
- Trigger `trg_payment_recalc_balance` (AFTER INSERT/UPDATE/DELETE ON payments).
- Trigger `trg_quotation_invalidate_short_code` (AFTER UPDATE OF status) → SET `short_code = NULL` en transiciones cancelled/superseded/expired/rejected.
- CREATE OR REPLACE `fn_sync_opportunity_from_quotation` con mapping nuevo.
- CREATE OR REPLACE `convert_quotation_to_project` extendido con balance_due/notif admin.
- Index único parcial `notification_queue_dedup_key_uniq` (si no existe).
- 7 RPCs:
  - `submit_quotation_payment_proof(p_token, p_amount, p_method, p_proof_url, p_notes)` — pública (anon, authenticated). Valida flag + short_code activo + estado + amount + method. Crea payment `pending` con `payment_source='client_upload'`. Si quotation era `client_approved`, mueve a `pending_payment_verification`. Encola notif in-app al admin creador del opp.
  - `verify_payment(p_payment_id, p_designer_id, p_payment_type)` — admin/super_admin. Marca payment `verified` (dispara trigger conversión). Asigna `designer_id` al proyecto si vino. Encola WA `project_assigned_designer_v1` + notif in-app al diseñador. Audit log.
  - `reject_payment(p_payment_id, p_reason)` — admin. Marca payment `rejected` con razón. Vuelve quotation a `client_approved`. Encola WA `payment_proof_rejected_v1` al cliente con razón + link corto. Audit log.
  - `register_manual_payment(p_quotation_id, p_amount, p_method, p_payment_type, p_designer_id, p_notes)` — admin. Inserta payment `verified` directo (no pasa por pending), `payment_source='admin_manual'`. Dispara mismo trigger. Si vino designer, llama internamente a `verify_payment` para completar asignación + WA al diseñador.
  - `cancel_quotation_acceptance(p_quotation_id, p_reason)` — admin. Solo desde `client_approved`/`pending_payment_verification`. Marca `cancelled`. Trigger sync mueve opp a `lost`/`cancelled_after_approval`. Trigger invalidate setea `short_code=NULL`. Audit.
  - `create_quotation_revision(p_quotation_id)` — admin. Copia quotation + items a V2 (`draft`, version_number+1, parent_quotation_id, nuevo short_code). Marca V1 `superseded` + `is_locked=true` + `superseded_by_quotation_id=V2.id`. Retorna `{new_quotation_id, new_short_code}`.
  - `reactivate_expired_quotation(p_quotation_id)` — admin. Solo desde `expired`. Re-emite short_code (o reusa el último), vuelve a `client_approved`, reinicia `client_approved_at = now()`, extiende `valid_until = now() + 30d`. Audit.

### 038_slice3_expiry_cron.sql

- Función `expire_accepted_quotations_scan()` — respeta feature flag (sale temprano si OFF). Lee `payment_window_days` (default 7). Itera quotations en `client_approved`/`pending_payment_verification` con `client_approved_at < now() - N days`, las marca `expired`, encola notif in-app a todos los admins + WA `admin_quotation_expired_v1` al primer admin activo (dedup_key por día evita doble envío).
- Cron job `slice3-expire-accepted-quotations-daily` a `30 14 * * *` UTC (= 09:30 Colombia). Idempotente (unschedule por jobname antes de schedule).

### 039_slice3_settings_seeds.sql

- INSERT idempotente: `payment_window_days = 7` y `slice_3_enabled = false` en `system_settings`.

### ROLLBACK_slice_3.sql

- Unschedule cron, DROP triggers nuevos, DROP funciones nuevas, CREATE OR REPLACE restaurando `fn_sync_opportunity_from_quotation` y `convert_quotation_to_project` a versión S2 pre-037, DROP constraint `payments_payment_source_check`, DROP columnas nuevas (data loss aceptado), DROP index dedup_key, DELETE seeds.
- **NO toca enum** (PG no soporta `ALTER TYPE ... DROP VALUE`). Valores `cancelled`/`superseded` quedan vivos en el enum aunque ninguna fila los use (benigno).
- **NO restaura policy storage original** automáticamente (deja la versión extendida). El comentario en el archivo tiene el SQL exacto para revertir manualmente si necesario.

---

## §5 — Templates Meta WhatsApp pendientes (bloqueador externo, fuera de código)

Felipe debe aprobar 5 nuevos templates S3 en Meta Business Manager. Suma a los 4 heredados de S2 que ya están pendientes → **9 templates total bloqueando WA**.

| # | Template | Audiencia | Vars | Origen | Estado Meta |
|---|---|---|---|---|---|
| 1 | `payment_request_v1` | Cliente | nombre, banco, cuenta, titular, monto sugerido | mig 035b (S2) | ❌ Pendiente |
| 2 | `admin_quotation_accepted_v1` | Admin | admin_nombre, cliente, quotation_number | mig 035b (S2) | ❌ Pendiente |
| 3 | `admin_quotation_adjustments_v1` | Admin | admin_nombre, cliente, quotation_number, reason | mig 035b (S2) | ❌ Pendiente |
| 4 | `admin_quotation_rejected_v1` | Admin | admin_nombre, cliente, quotation_number, reason | mig 035b (S2) | ❌ Pendiente |
| 5 | `payment_proof_rejected_v1` | Cliente | nombre, quotation_number, motivo, link corto | **mig 037 (S3) — nuevo** | ❌ Pendiente |
| 6 | `project_assigned_designer_v1` | Diseñador | designer_nombre, cliente_nombre, link_proyecto | **mig 037 (S3) — nuevo** | ❌ Pendiente |
| 7 | `project_fully_paid_v1` | Cliente | nombre, proyecto | **mig 037 (S3) — nuevo** | ❌ Pendiente |
| 8 | `quotation_v2_sent_v1` | Cliente | nombre, quotation_number, link corto | **mig 037 (S3) — nuevo** (dispara desde admin click "Enviar" sobre la V2) | ❌ Pendiente |
| 9 | `admin_quotation_expired_v1` | Admin | admin_nombre, cliente, quotation_number, días sin pago | **mig 038 (S3) — nuevo** | ❌ Pendiente |

**Optimización ya aprovechada**: `payment_received` (sin sufijo `_v1`, 5 vars: nombre/monto/proyecto/método/saldo) **ya está aprobado en Meta** y se usa tal cual desde el trigger existente `fn_wa_payment_received`. Por eso son 9 y no 10.

**Mientras los 9 no estén aprobados**: los rows en `notification_queue` quedan `status='failed'` con `template not found`. Cuando Felipe apruebe uno, basta:

```sql
UPDATE notification_queue SET status='pending'
WHERE template_name = '<aprobado>' AND status = 'failed';
```

El worker `process-whatsapp-notifications` los retoma en su próximo cron.

**Adicionalmente**: el worker tiene `TEMPLATE_REGISTRY` hardcoded con 7 templates hoy (los de booking + visita). **Falta extenderlo con 5 builders nuevos S3** + redeploy con `supabase functions deploy process-whatsapp-notifications`. Esto es Sub-Slice 3.4 de la Fase 5.

---

## §6 — Próximos pasos (Fases 4-5)

| Fase | Skill | Entregable | Quién | Notas |
|---|---|---|---|---|
| 4 | `/improve-codebase-architecture` | `docs/architecture/slice-3-refactor-map.md` | Próxima IA | Mapear componentes nuevos (12 archivos) vs modificados (4 archivos: Pagos.tsx, PublicQuotation.tsx, App.tsx, sidebar) vs eliminados (ninguno), feature flag insertion points, plan de cutover. |
| 5 | Ejecución multi-turno | Backend → UI admin → UI cliente → edge fn registry → smoke E2E → flag piloto | Próxima(s) IA(s) | 6 sub-slices definidos en PRD §5.8. Cada uno termina con commit local (agente) + verificación. Push y `vercel --prod` los hace Álvaro. |

**Orden de ejecución Fase 5** (sub-slices definidos en PRD §5.8):
- **S3.1** — Aplicar 037+038+039 a prod con Management API + smoke SQL de las 7 RPCs + cron.
- **S3.2** — UI admin (BankSettings, PaymentSettings, refactor `Pagos.tsx` a 3 tabs, modales verify/reject/manual/cancel/revision, DesignerPicker, hooks, schemas Zod).
- **S3.3** — UI cliente (modificar `PublicQuotation.tsx` con sección "Realizar pago" gated por flag + estado, `PaymentProofUploader`).
- **S3.4** — Extender `TEMPLATE_REGISTRY` en `process-whatsapp-notifications/index.ts` + redeploy edge function.
- **S3.5** — Smoke E2E completo con flag ON sobre cotización `[SMOKE-S3-2026-XX-XX]`, cubrir flujos A-G del PRD §6.1.
- **S3.6** — Activación piloto (Álvaro prende flag para 1-2 clientes reales).

---

## §7 — Reglas operativas no negociables (para la nueva IA)

Leer **antes** de tocar código:

- **Memoria global**: `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` + memory files linkeados.
- **CLAUDE.md del proyecto**: `Innovar-App-main/CLAUDE.md` — convenciones errors via `mapSupabaseError`, Zod en mutations, retry:0, design tokens dark premium, idioma DB en inglés / UI en español.

**Reglas críticas**:

1. **Idioma DB en INGLÉS, UI en español.** Convención no negociable.
2. **Validar schema vs prod antes de tocar** — `db/supabase_schema.sql` y `src/types/database.types.ts` están desactualizados. Usar Management API:
   ```bash
   TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d'=' -f2)
   curl -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"query":"SELECT ..."}'
   ```
   Patrón detallado en `reference_innovar_management_api.md` (memory file). Usar Node.js `JSON.stringify` para escapar SQL multilínea; NO usar `Invoke-RestMethod` (cuelga en PS 5.1).
3. **NUNCA `npm run dev` con watcher en OneDrive** — usar `npm run build` + `npm run preview` (puerto 4173). Si necesitás preview público: `vite preview --host` + cloudflared tunnel con `preview.allowedHosts` en `vite.config`.
4. **NUNCA SDK Supabase dentro de `onAuthStateChange` callback** — causa deadlock silencioso. Anti-patrón documentado en MEMORY.md (`feedback_supabase_no_sdk_in_onauth_callback.md`).
5. **Notif in-app**: `INSERT` directo en `public.notifications`. NO usar `enqueue_notification` (helper WhatsApp-only que exige template NOT NULL).
6. **Tablas internas sin exposición al cliente**: `ENABLE RLS` + `REVOKE ALL FROM anon, authenticated` (RLS sola NO bloquea TRUNCATE).
7. **Channels Realtime**: usar nombres con `crypto.randomUUID()` o reusar el del Layout (`useRealtimeNotifications`). NO crear channels con nombre hardcoded — colapsan singletons.
8. **`git add`/`git commit` los hace el AGENTE** localmente. `git push` y `vercel --prod` los hace ÁLVARO. NUNCA `--no-verify`. NUNCA tocar git config.
9. **Aplicar SQL a prod**: el agente lo hace directo con Management API + PAT del `.env`. NO pedir al usuario que corra el SQL en el dashboard (feedback explícito 2026-05-23).
10. **MCP Supabase nativo NO tiene scope a Innovar** (`xdzbjptozeqcbnaqhtye`). Solo a `Light_House` y `Swarm Agentes MD`. Para Innovar: Management API.
11. **CHECK status real para opportunities**: ver §3.7 acá. Si trigger asume valores que no existen → migración falla en prod.

---

## §8 — Estado de prod al cierre (snapshot 2026-05-23)

Validado con Management API en esta sesión:

**Triggers activos en `quotations`** (13):
`trg_assign_quotation_short_code`, `trg_audit_quotations`, `trg_create_project_from_approved_quotation`, `trg_lock_quotation_on_sent`, `trg_log_quotation_status_change`, `trg_notify_quotation_acceptance`, `trg_notify_quotation_rejection`, `trg_pdf_on_quotation_status`, `trg_quot_mark_historical`, `trg_quotation_lead_score`, `trg_quotations_updated_at`, `trg_sync_opportunity_from_quotation`, `trg_wa_quotation_expiry`.

**Triggers activos en `payments`** (6):
`trg_after_payment_insert` (deuda: duplicado), `trg_audit_payments`, `trg_notify_payment_received`, `trg_payment_convert_to_project`, `trg_wa_payment_received`, `trigger_handle_payment_approval` (deuda: duplicado).

**Cron jobs activos** (relevantes):
- `wa-quotation-expiry-3d-daily` a `0 14 * * *` UTC (S2).
- Otros del proyecto (out of scope).

**Funciones públicas de S2 (preservar)**:
- `accept_public_quotation(p_token, p_note)`, `reject_public_quotation(p_token, p_subtype, p_reason)`, `request_quotation_reactivation`, `resolve_quotation_short_code(p_code)`, `generate_unique_quotation_short_code()`, `assign_quotation_short_code()`, `enqueue_notification(...)`, `fn_wa_enqueue_for_profile(...)`, `get_bank_setting(key)`, `get_suggested_advance_pct()`, `get_my_role()`.

**`system_settings` filas existentes** (17): `bank_account_number`, `bank_account_type`, `bank_holder_id`, `bank_holder_name`, `bank_name`, `daviplata_phone`, `default_visitor_id`, `dormancy_auto_lost_days`, `dormancy_warning_days`, `nequi_phone`, `public_app_base_url`, `qa_designer_id`, `quotation_validity_days`, `refund_policy`, `suggested_min_advance_pct = {"pct":30}`, `visit_slot_duration_minutes`, `visit_slot_times`. Las 7 bancarias están **vacías** — Álvaro debe rellenarlas en S3.2 vía nueva pantalla `/admin/configuracion/bancarios`.

---

## §9 — Discrepancia conocida con MEMORY.md anterior

Una de las entradas históricas de Slice 2 menciona el template `payment_received_v1` como nuevo a aprobar. **Está obsoleto**: `payment_received` (sin sufijo) ya está aprobado en Meta y el trigger `fn_wa_payment_received` ya lo usa. La entrada de MEMORY que se agrega como parte de este handoff lo aclara.

---

## §10 — Para la nueva IA: orden de lectura

1. **Este handoff** (estás acá).
2. **PRD formal**: `docs/prd/2026-05-23_slice-3-payment-to-project.md` — 10 secciones + 2 anexos. **Aplicar las 10 correcciones de §3 acá sobre cualquier discrepancia.**
3. **Plan grill** (referencia): `C:\Users\ceoel\.claude\plans\stateless-plotting-wombat.md`.
4. **Handoff predecesor** (referencia): `docs/handover/2026-05-23_PHASE-4-SLICE-3-DESIGN.md`.
5. **4 migraciones SQL en disco**:
   - `db/migrations/037_slice3_payment_flow.sql`
   - `db/migrations/038_slice3_expiry_cron.sql`
   - `db/migrations/039_slice3_settings_seeds.sql`
   - `db/migrations/ROLLBACK_slice_3.sql`
6. **MEMORY.md global**: `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` (entradas clave: `feedback_innovar_db_language_convention`, `feedback_supabase_no_sdk_in_onauth_callback`, `feedback_supabase_enqueue_notification_wa_only`, `reference_innovar_management_api`, `reference_innovar_whatsapp_templates`, `feedback_default_autonomy_mode`, `feedback_agent_commits_locally`).
7. **CLAUDE.md del proyecto**: `Innovar-App-main/CLAUDE.md` — convenciones del repo.

---

## §11 — Confianza de los archivos

- **Migraciones SQL**: alta. Cada constraint/columna/función validada contra prod. Idempotentes. Smoke esperado limpio.
- **PRD**: media. Las 10 correcciones de §3 deben aplicarse mentalmente al leerlo.
- **Templates Meta**: bloqueante externo. Sin acción del agente — Felipe aprueba.

---

**Próxima IA**: leé este handoff completo, después el PRD aplicando las correcciones de §3, después las 4 migraciones SQL para entender el contrato real, y arrancá **Fase 4** con `/improve-codebase-architecture` para el refactor map. Cuando termines el refactor map, paso natural es Fase 5 (S3.1: aplicar migraciones a prod + smoke SQL).
