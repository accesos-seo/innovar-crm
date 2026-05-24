# Handoff — Fase 4 · Slice 3 · Refactor map (cierre Fase 4 del ciclo grill-me)

**Fecha:** 2026-05-23 (madrugada-tarde, post Fase 4)
**Estado del slice:** Fase 1 (grill) ✅ · Fase 2 (PRD) ✅ · Fase 3 (SQL en disco) ✅ · **Fase 4 (refactor map) ✅** · Fase 5 (ejecución) ⏸️ pendiente
**Refactor map autoritativo:** [`docs/architecture/slice-3-refactor-map.md`](../architecture/slice-3-refactor-map.md)

**Predecesor** (LEER PRIMERO, no se sustituye): [`2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md`](2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md) — handoff con las 10 correcciones al PRD detectadas validando contra prod.

---

## TL;DR para la próxima sesión

Cierra Fase 4 del ciclo `/grill-me` para Slice 3 (Pago → Proyecto). Ahora hay:

1. **PRD formal** (10 secciones + 2 anexos) en `docs/prd/2026-05-23_slice-3-payment-to-project.md` — aplicar §3 del handoff predecesor sobre cualquier discrepancia.
2. **4 migraciones SQL** idempotentes en disco (037, 038, 039, ROLLBACK), **NO desplegadas**.
3. **Refactor map** completo en `docs/architecture/slice-3-refactor-map.md` — define 12 componentes nuevos + 8 modificados + 0 eliminados + insertion points del feature flag + plan de cutover en 6 PRs + mapping ES↔EN + verificación pre-Fase 5.

La próxima IA arranca **Fase 5: ejecución multi-turno** desde el sub-slice **S3.1** (aplicar migraciones a prod + smoke SQL).

---

## Hallazgos críticos descubiertos durante Fase 4 (validación contra repo + prod)

Confirmados con `Read`, `Grep` y `curl` a Management API. **Estos hallazgos prevalecen sobre el PRD escrito.**

### 1. 🔴 Bug latente activo: `payment_type` español en frontend vs inglés en CHECK prod

**Validación**:
- `curl pg_constraint` → `CHECK ((payment_type = ANY (ARRAY['advance'::text, 'installment'::text, 'final'::text, 'refund'::text])))`
- `src/schemas/payment.ts:16-21` declara `z.enum(["anticipo", "abono", "pago_final", "reembolso"])`

**Consecuencia**: cualquier INSERT en `payments` desde el `NewPaymentModal` actual debería fallar con PG 23514. Como no se reportan errores, lo más probable es que **nadie esté creando payments desde el modal admin últimamente** (los pagos en prod vienen vía triggers que sí usan inglés). Pero la primera vez que un admin lo use, romperá.

**Acción Fase 5**: PR-2 (S3.2.a) **migra los 8 consumers identificados** (lista en refactor map §10) a inglés con un mapa de labels español separado (`PAYMENT_TYPE_LABELS_ES`). Es un fix de bug que aprovecha el slice; no agrega scope nuevo.

### 2. ✅ `payment_method` es ENUM Postgres (no TEXT con CHECK)

**Validación**: `udt_name = payment_method` (USER-DEFINED type).
**Consecuencia**: los valores Zod actuales (`efectivo/transferencia/credito/cheque/nequi/daviplata/pse`) deberían coincidir con el enum (sino habría bug masivo en S2 también). Asumimos OK; verificar con `SELECT unnest(enum_range(NULL::payment_method))` durante smoke S3.1.

### 3. ✅ `verification_status` ya tiene CHECK desplegado

**Validación**: `CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))`.
**Consecuencia**: confirmado lo del handoff §3.1. Las migs 037 NO añaden este CHECK, sólo las columnas de audit (`rejection_reason`, `rejected_by`, `rejected_at`).

### 4. ✅ Realtime singleton OK — no hay channels duplicados

**Validación**: `Grep supabase\.channel\(` → único match en `useRealtimeNotifications.ts` (`'notifications-updates'`).
**Estrategia Fase 5**: badge live de "Por verificar" en `Pagos.tsx` **reusa este channel**. Cuando llega INSERT en `notifications` con `notification_type='payment_proof_uploaded'`, invalidamos `['payments']`. Cero código nuevo de realtime. Evita el anti-patrón documentado.

### 5. ✅ Convención repo: archivos viven en carpetas distintas a lo que dijo el PRD

- Componentes de pagos en **`src/components/finanzas/`** (no `payments/`).
- Páginas settings en **`src/pages/settings/`** (no `pages/` raíz).
- Rutas settings en **`/settings/<slug>`** (no `/admin/configuracion/*`).
- Hooks por dominio en **`src/hooks/finanzas/`**, **`src/hooks/quotations/`**, **`src/hooks/settings/`** (carpeta nueva para `useSystemSettings` + `useFeatureFlag`).
- No existe `src/components/settings/` — forms van inline en cada Page.

**Acción**: el refactor map ya respeta la convención real. La próxima IA debe ignorar los paths del PRD donde difieran.

### 6. ✅ Sidebar.tsx NO se toca

El sidebar tiene grupos hijos para Finanzas/Agenda/etc., pero NO un grupo "Settings/Configuración". El acceso a settings es vía landing `/settings` (`SettingsPage.tsx` con grid de QuickAccessGrid). El refactor agrega una **sección nueva en `SettingsPage.tsx`** llamada "Operaciones Financieras" con 2 cards (Datos Bancarios, Configuración de Pagos). PRD había pedido modificar el sidebar — innecesario.

### 7. ✅ `vite.config.ts` ya tiene `preview.allowedHosts` con `.trycloudflare.com`

Para QA público de S3.3 (cliente uploader) basta con `npm run build` + `vite preview --host` + cloudflared tunnel. Ya configurado.

---

## Consolidaciones aplicando deletion test (Ousterhout)

El PRD listó ~38 archivos nuevos/modificados. El refactor map consolida a **24 archivos físicos** sin perder cobertura:

| Consolidación | Por qué |
|---|---|
| `usePayments` extendido con filtro `verification_status` en vez de 3 hooks separados (`usePendingPayments`, `useVerifiedPayments`, `useRejectedPayments`) | Hook actual acepta 5 filtros; sumar uno es 1 línea. 3 hooks separados son shallow pass-through. |
| `PaymentVerifyModal` unifica verify + reject en un modal con 2 acciones internas | Comparten 80% del JSX (preview, datos, lookup). Separar = duplicación. |
| `BankSettingsForm` + `PaymentSettingsForm` inline en sus páginas en vez de componentes | Sin reuso esperado; las pages son simples (5-7 inputs). |
| `QuotationRevisionButton` inline en `QuotationDetail.tsx` en vez de componente | 1 button + 1 mutation, sin state propio complejo. |
| Schemas extienden `payment.ts` y `quotation.ts` existentes en vez de crear `payment-proof.ts` + `quotation-cancel.ts` | Convención repo: 1 schema por entidad. |
| Realtime para badge reusa channel singleton + invalida `usePayments` | Evita crear nuevo channel; aprovecha infra. |

Detalle por consolidación: refactor map §0 TL;DR y §13 Deltas vs PRD.

---

## Plan de cutover Fase 5 (6 PRs)

| PR | Sub-slice | Riesgo si mergea con flag OFF | Quién |
|---|---|---|---|
| **PR-1** | S3.1 Backend: aplicar migs 037+038+039 + smoke SQL flujos A-G | 0 | Agente con Management API |
| **PR-2** | S3.2.a Hooks + schemas + **migración payment_type ES→EN** (arregla bug latente) | 0 | Agente |
| **PR-3** | S3.2.b UI admin (BankSettings, PaymentSettings, modales, Pagos 3-tabs, QuotationDetail botones) | Bajo (flag OFF → fallbacks) | Agente |
| **PR-4** | S3.3 UI cliente (uploader, PublicQuotation extendido) | Bajo (flag OFF → cards legacy) | Agente |
| **PR-5** | S3.4 Edge function `TEMPLATE_REGISTRY` + 5 builders nuevos + redeploy | 0 (templates Meta aún no aprobados, rows quedan `failed`) | Agente |
| **PR-6** | S3.5 Smoke E2E flujos A-G con flag ON sobre cotización seed `[SMOKE-S3-2026-XX-XX]` | 0 con cleanup | Agente + Álvaro confirma visualmente |
| **PR-7** | S3.6 Piloto: Álvaro toggla flag para 1-2 clientes reales, observa 48h | Variable; flag OFF en 1 click | Álvaro |

**Plan B/rollback**: flag OFF desde UI o `UPDATE system_settings SET value='false'::jsonb WHERE key='slice_3_enabled'`. Si rollback de schema: aplicar `db/migrations/ROLLBACK_slice_3.sql` (preserva data en filas existentes).

---

## Bloqueador externo (sin solución desde código)

**9 templates Meta pendientes de aprobación de Felipe** (5 nuevos S3 + 4 heredados S2). Detalle en handoff predecesor §5. Mientras no se aprueben: rows en `notification_queue` quedan `failed` con `template_not_found`. Cuando aprueben:

```sql
UPDATE notification_queue SET status='pending'
WHERE template_name='<aprobado>' AND status='failed';
```

El worker `process-whatsapp-notifications` los retoma en su próximo cron.

---

## Estado de archivos al cierre

### Documentos de diseño (sin cambios respecto al handoff predecesor + nuevo refactor map)

| Path | Estado |
|---|---|
| `docs/prd/2026-05-23_slice-3-payment-to-project.md` | ✅ Escrito (con 10 imprecisiones documentadas en handoff predecesor §3) |
| `docs/handover/2026-05-23_PHASE-4-SLICE-3-DESIGN.md` | ✅ Inalterado (referencia grill) |
| `docs/handover/2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md` | ✅ Inalterado (autoritativo para correcciones del PRD) |
| `docs/architecture/slice-3-refactor-map.md` | ✅ **NUEVO** (este handoff lo respalda) |
| `docs/handover/2026-05-23_PHASE-4-SLICE-3-REFACTOR-MAP.md` | ✅ **Este archivo** |

### Migraciones SQL (sin cambios)

Todas en disco, **NO desplegadas**. Idempotentes. Listas para S3.1.

### Código fuente

**Cero cambios en código en esta Fase 4**. Todo el trabajo fue diseño + validación contra prod. La próxima sesión arranca con cambios de código en S3.1 (SQL) y S3.2.a (hooks/schemas).

---

## Prompt listo para la siguiente sesión (Fase 5 — S3.1)

Copiar/pegar a la próxima IA con cero contexto. Es self-contained:

````
Voy a continuar el rediseño Lead→Project de Innovar CRM, **Fase 5 del Slice 3** (Pago → Proyecto). Las Fases 1-4 están cerradas: grill (13 decisiones), PRD formal, 4 migraciones SQL en disco, refactor map en `docs/architecture/slice-3-refactor-map.md`. Tu trabajo es la **ejecución multi-turno**, arrancando con el sub-slice **S3.1 (backend)**.

ANTES DE TOCAR NADA, leé en este orden estricto:

1. **Refactor map autoritativo (LEER PRIMERO)**:
   `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main\docs\architecture\slice-3-refactor-map.md`
   
   Las consolidaciones que aplica (deletion test) prevalecen sobre el PRD. Lee §0 TL;DR, §6 invalidaciones, §8 feature flag, §9 plan de cutover, §10 mapping ES↔EN, §11 verificación pre-Fase 5, §12 riesgos, §13 deltas vs PRD.

2. **Handoff de cierre Fase 4** (contexto cronológico):
   `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main\docs\handover\2026-05-23_PHASE-4-SLICE-3-REFACTOR-MAP.md`

3. **Handoff de cierre Fase 3** (PRD + SQL con 10 correcciones críticas):
   `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main\docs\handover\2026-05-23_PHASE-4-SLICE-3-PRD-AND-SQL.md`

4. **PRD formal** (referencia detallada — aplicar correcciones del handoff de cierre Fase 3 §3 sobre cualquier discrepancia):
   `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main\docs\prd\2026-05-23_slice-3-payment-to-project.md`

5. **Las 4 migraciones SQL en disco** (contrato real del backend):
   - `db/migrations/037_slice3_payment_flow.sql` (~700 líneas)
   - `db/migrations/038_slice3_expiry_cron.sql` (cron 14:30 UTC)
   - `db/migrations/039_slice3_settings_seeds.sql`
   - `db/migrations/ROLLBACK_slice_3.sql`

6. **MEMORY.md global** + memory files críticos:
   `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md`
   
   Buscá la entrada 🟢 "Innovar — Fase 4 · Slice 3 · Refactor map listo 2026-05-23". Leé los memory files: `feedback_innovar_db_language_convention`, `feedback_supabase_no_sdk_in_onauth_callback`, `feedback_supabase_enqueue_notification_wa_only`, `reference_innovar_management_api`, `reference_innovar_whatsapp_templates`, `feedback_default_autonomy_mode`, `feedback_agent_commits_locally`.

7. **CLAUDE.md del proyecto**:
   `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main\CLAUDE.md`

---

UNA VEZ LEÍDOS LOS 7 DOCUMENTOS, arrancá **S3.1**:

1. **Aplicar migs 037 + 038 + 039 a prod** con Management API + PAT del `.env`. Las migs son idempotentes (`IF NOT EXISTS`, `DROP IF EXISTS`, `ON CONFLICT`). Antes de aplicar: confirmar que la migración 036 (no desplegada) NO existe en producción con un query rápido a `pg_proc`. Si existiera (verificar), DROP de sus artefactos antes de 037 — pero el handoff de cierre Fase 3 dice que NO está desplegada.

2. **Smoke SQL flujos A-G del PRD §6.1** sobre cotización seed `[SMOKE-S3-2026-XX-XX]`:
   - Flag temporal ON en `system_settings.slice_3_enabled` para el smoke.
   - Crear cotización fake en `client_approved`.
   - Llamar `submit_quotation_payment_proof` → verificar payment `pending` + status `pending_payment_verification`.
   - Llamar `verify_payment` con designer asignado → verificar project creado, balance_due correcto, opportunity convertida, quotation `approved` + `is_locked`, WAs encolados en `notification_queue`.
   - Repetir para `reject_payment`, `cancel_quotation_acceptance`, `create_quotation_revision`, `register_manual_payment`, `reactivate_expired_quotation`.
   - Smoke cron: `UPDATE quotations SET client_approved_at = now() - INTERVAL '8 days' WHERE ...` → `SELECT expire_accepted_quotations_scan()` → verificar `status='expired'` + WA encolado.
   - Verificar también que el enum `payment_method` tiene los valores que el Zod actual espera: `SELECT unnest(enum_range(NULL::payment_method))`.
   - Cleanup completo: `DELETE FROM ... WHERE notes LIKE '[SMOKE-S3-%]'` en payments, projects, quotations, notification_queue.
   - Flag OFF de nuevo: `UPDATE system_settings SET value='false'::jsonb WHERE key='slice_3_enabled'`.

3. **Commit local** de los archivos tocados (las 4 migrations + cualquier doc actualizado). Sin push. Mensaje: `feat(slice-3): apply payment flow migrations 037-039 to prod + smoke E2E backend`.

4. **Reportá**: ¿pasó cada flujo del smoke? ¿algún error PG? ¿algún row residual? Si todo OK, cerrá S3.1 y prepará el handoff a S3.2.a (Hooks + schemas + migración payment_type ES→EN — esta es la que arregla el bug latente de S2, ver refactor map §1 hallazgo 1).

**NO arranques S3.2 en la misma sesión**. Cada sub-slice es un PR independiente — termina S3.1 con commit local + reporte + handoff y dejá S3.2 para sesión siguiente.

---

Reglas operativas no negociables (del CLAUDE.md global del usuario):

- **Idioma**: identificadores DB en INGLÉS, UI/labels en español. Bug histórico documentado por payment_type Spanish→English (lo arregla S3.2.a).
- **Validar schema real con Management API** antes de tocar — `db/supabase_schema.sql` y `database.types.ts` están desactualizados. Para Innovar (`xdzbjptozeqcbnaqhtye`) usar PAT del `.env` local + curl, NUNCA `Invoke-RestMethod` (cuelga en PS 5.1).
- **MCP Supabase nativo NO tiene scope a Innovar** — solo `Light_House` y `Swarm Agentes MD`. Para Innovar siempre Management API.
- **NUNCA `npm run dev`** con watcher en este path (OneDrive sync rompe HMR). Usar `npm run build` + `npm run preview` (puerto 4173).
- **NUNCA llames SDK Supabase desde `onAuthStateChange`** — causa deadlock silencioso.
- **NUNCA uses helper `enqueue_notification` para notif in-app** — INSERTá directo en `public.notifications`. El helper es WhatsApp-only.
- **Channels Realtime con nombres únicos** (`crypto.randomUUID()`) o reusar el del Layout. Hardcoded = singleton crash. **El refactor map dice cómo reusar el channel existente para el badge.**
- Tablas internas: `ENABLE RLS` **+** `REVOKE ALL FROM anon, authenticated`.
- **Commits locales los hace el AGENTE** (vos) via PowerShell. **NUNCA `git push`** salvo pedido explícito. **NUNCA `vercel --prod`** — eso lo corre el usuario.
- **SQL en Innovar** lo aplicás vos con Management API + PAT del `.env`. NUNCA pedirle al usuario que corra SQL en el dashboard.
- **Templates Meta nuevos**: dejá los rows en `notification_queue` aunque Felipe no los haya aprobado. Cuando aprueben: `UPDATE notification_queue SET status='pending' WHERE template_name=<aprobado> AND status='failed'`.
- **NO renegociar las 13 decisiones del grill ni las consolidaciones del refactor map**. Si encontrás ambigüedad, preguntá al usuario.

URLs útiles:
- Proyecto Supabase Innovar (sin acceso MCP): https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye
- Vercel proyecto activo: https://crm-innovar-app-2026.vercel.app
- Repo: https://github.com/accesos-seo/innovar-crm (branch `master`)

Arrancá ya con la lectura. Cuando termines de leer los 7 docs, decime "Listo, arranco S3.1" para que vea el handoff propagado correctamente, y seguís.
````

---

## Estado al cierre de esta sesión

- ✅ Fase 4 completa (refactor map escrito con deletion test aplicado)
- ✅ Bug latente `payment_type` ES→EN documentado y planificado para arreglo en PR-2 (S3.2.a)
- ✅ Consolidación 38 → 24 archivos con justificación por consolidación
- ✅ Plan de cutover de 6 PRs con riesgo evaluado por uno
- ✅ Mapping ES↔EN completo con los 8 consumers a migrar identificados
- ✅ Estrategia de Realtime reusando channel singleton documentada
- ⏸️ Fase 5 (S3.1) movida a sesión nueva con contexto limpio
- ⏸️ Templates Meta esperando aprobación (bloqueador externo, independiente del trabajo de la IA)

**Próxima IA**: copiá el prompt de arriba a una sesión nueva. Arrancá con la lectura de los 7 docs, después S3.1.

---

## Confianza de los artefactos

- **Refactor map**: alta. Cada decisión respaldada por (a) lectura real del archivo, (b) inventario del repo en vivo, o (c) query SQL contra prod.
- **Hallazgo del bug `payment_type`**: confirmado con `curl` directo a `pg_constraint` + `Grep` de consumers. Reproducible.
- **Plan de cutover**: alta. Cada PR fue evaluado por el riesgo de mergear con flag OFF.
- **Estimaciones de tamaño de diff (líneas)**: medio. Son ballparks de aprox. Los archivos reales pueden variar 20-30%.
- **Lista de hooks a invalidar**: alta. Validada contra los triggers SQL en las migs 037.
