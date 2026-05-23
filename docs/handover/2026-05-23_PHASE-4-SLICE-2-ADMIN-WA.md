# Handoff — Innovar CRM · Fase 4 · Slice 2.5 · WhatsApp al admin en accept/adjustments/rejected

> **Fecha**: 2026-05-23 (noche tardía) · **Branch**: `ux-fixes` · **Working dir**: `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
> **Predecesores**: [`2026-05-23_PHASE-4-SLICE-2.md`](2026-05-23_PHASE-4-SLICE-2.md) (backend + frontend base), [`2026-05-23_PHASE-4-SLICE-2-QA-AND-SHARING.md`](2026-05-23_PHASE-4-SLICE-2-QA-AND-SHARING.md) (QA + rediseño + análisis del gap)
> **Estado**: gap cerrado a nivel SQL. Falta solo aprobación Meta de 3 templates nuevos para que los WA realmente salgan.

---

## 0. TL;DR

Antes de esta sesión: cuando el cliente apretaba **Aceptar / Pedir ajustes / Rechazar** en la cotización pública, al admin (Álvaro) le llegaba solo notificación **in-app** (campana del CRM). **NO** le llegaba WhatsApp.

Después de esta sesión:
- Migración `035b` aplicada en prod (re-CREATE idempotente de los 2 triggers de notificación).
- Cada acción del cliente encola **1 row** en `notification_queue` con destinatario `Alvaro Rios` y template correcto.
- Smoke E2E con 3 cotizaciones fake (`SMOKE-S25-A-001 / J-002 / R-003`) verificó los 3 escenarios — los rows quedan en `status='pending'` listos para enviarse cuando el worker corra y Meta tenga los templates aprobados.
- Cleanup smoke OK (0 quotations smoke activas, 0 rows residuales en queue).

**Único bloqueador externo**: Felipe debe crear/aprobar los 3 templates nuevos en Meta Business Manager.

---

## 1. Cambios aplicados

### Migración nueva

| Archivo | Estado |
|---|---|
| [`db/migrations/035b_phase4_admin_wa_on_quotation_actions.sql`](../../db/migrations/035b_phase4_admin_wa_on_quotation_actions.sql) | ✅ **Applied 2026-05-23 23:40 UTC** |

Contenido: `CREATE OR REPLACE` de las 2 funciones:

1. **`fn_notify_quotation_acceptance`** — agrega al final, después del INSERT in-app al admin:
   ```sql
   PERFORM public.fn_wa_enqueue_for_profile(
     v_admin.id,
     'quotation_accepted',
     'wa_quotation_accepted',
     'quotation', NEW.id,
     'admin_quotation_accepted_v1',
     jsonb_build_array(v_admin.full_name, v_client.name, NEW.quotation_number),
     jsonb_build_object('quotation_id', NEW.id)
   );
   ```

2. **`fn_notify_quotation_rejection`** — agrega al final (con switch interno según `client_rejection_subtype`):
   - `'adjustments_requested'` → template `admin_quotation_adjustments_v1`, pref_key `wa_quotation_adjustments`, event_type `quotation_adjustments_requested`
   - `'declined'`              → template `admin_quotation_rejected_v1`,    pref_key `wa_quotation_rejected`,    event_type `quotation_rejected`
   - 4 vars: `[admin_full_name, client_name, quotation_number, rejection_reason]`

Idempotente, replica el patrón ya probado de `request_quotation_reactivation` (migración 034) con `quotation_reactivation_admin_v1`.

### Documentación tocada

| Archivo | Cambio |
|---|---|
| [`db/migrations/README.md`](../../db/migrations/README.md) | Agregadas filas para `035a` y `035b` con estado ✅ Applied |
| `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\reference_innovar_whatsapp_templates.md` | Nueva sección "Slice 2.5" con los 3 templates pendientes Meta + wording exacto + pref_keys + nota sobre default TRUE de `fn_profile_wants_wa` |
| `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` | Entrada actualizada de Fase 4 Slice 2 con cierre del gap |

---

## 2. Verificación E2E ejecutada (smoke)

### Setup
- Cliente fake: `[SMOKE-S2.5-2026-05-23] Cliente Smoke Admin WA` (whatsapp_phone `+579999999000`)
- 3 cotizaciones con prefijo `SMOKE-S25-{A|J|R}-00X`, items dummy, `status='sent'` con `valid_until` futuro.

### Ejecución (1 transacción SQL atómica via Management API)
```sql
PERFORM public.accept_public_quotation(token_A, 'Smoke acceptance');
PERFORM public.reject_public_quotation(token_J, 'adjustments_requested', 'Smoke pidiendo ajustes en tonos');
PERFORM public.reject_public_quotation(token_R, 'declined', 'Smoke decisión final no continuar');
```

### Resultado de `notification_queue` (filtrado `recipient_type='profile'`)

| `quotation_number` | `rejection_subtype` | `recipient_name` | `template_name` | `status` | `template_parameters` |
|---|---|---|---|---|---|
| SMOKE-S25-A-001 | NULL | Alvaro Rios | `admin_quotation_accepted_v1` | `pending` | `[Alvaro, cliente, SMOKE-S25-A-001]` |
| SMOKE-S25-J-002 | `adjustments_requested` | Alvaro Rios | `admin_quotation_adjustments_v1` | `pending` | `[Alvaro, cliente, SMOKE-S25-J-002, "Smoke pidiendo ajustes en tonos"]` |
| SMOKE-S25-R-003 | `declined` | Alvaro Rios | `admin_quotation_rejected_v1` | `pending` | `[Alvaro, cliente, SMOKE-S25-R-003, "Smoke decisión final no continuar"]` |

3 rows, exactamente el shape esperado. ✅

### Cleanup
Soft-delete clients/quotations + hard-delete notifications + notification_queue. Confirmado:
- 0 quotations smoke activas
- 0 rows smoke en notification_queue

---

## 3. Datos confirmados de Alvaro Rios (admin destinatario)

```
id            : 09ca8b37-95b8-43dc-9b01-1100519d5ec5
full_name     : Alvaro Rios
role          : admin
is_active     : true
whatsapp_phone: +579879141748
notification_preferences -> 'whatsapp': NULL  (default TRUE para todas)
```

> ⚠️ **Discrepancia con handoff anterior**: El handoff principal documentaba `whatsapp_phone='+573136802025'` pero en producción está `'+579879141748'`. Verificar con Alvaro cuál es el número correcto antes de que Meta apruebe templates y empiecen a salir mensajes reales.

---

## 4. Templates Meta nuevos a aprobar (los 3 del Slice 2.5)

Felipe arranca estos 3 en paralelo (24-48h):

| Template | Idioma | Categoría | Vars | Body sugerido |
|---|---|---|---|---|
| `admin_quotation_accepted_v1` | es | UTILITY | {{1}}=admin, {{2}}=cliente, {{3}}=cot_number | "{{1}}, {{2}} aceptó la cotización N° {{3}}. Ya podés ver el pago entrante." |
| `admin_quotation_adjustments_v1` | es | UTILITY | {{1}}=admin, {{2}}=cliente, {{3}}=cot_number, {{4}}=motivo | "{{1}}, {{2}} pidió ajustes en la cotización N° {{3}}. Motivo: «{{4}}»" |
| `admin_quotation_rejected_v1` | es | UTILITY | {{1}}=admin, {{2}}=cliente, {{3}}=cot_number, {{4}}=motivo | "{{1}}, {{2}} rechazó la cotización N° {{3}}. Motivo: «{{4}}»" |

**Footer** sugerido: `— Innovar Cocinas Integrales`.

---

## 5. Edge function `process-whatsapp-notifications` — pendiente extender registro

La función vive en [`supabase/functions/process-whatsapp-notifications/index.ts`](../../supabase/functions/process-whatsapp-notifications/index.ts) (v13 actual, Fase 3). Tiene un `TEMPLATE_REGISTRY` hardcoded — hoy NO incluye los 3 nuevos. Cuando Meta apruebe los templates hay que:

1. Agregar 3 entries al `TEMPLATE_REGISTRY` con el mapping `template_parameters JSON → array Meta`.
2. Re-deploy: `supabase functions deploy process-whatsapp-notifications --project-ref xdzbjptozeqcbnaqhtye`.
3. Reset de los `failed` acumulados a `pending` para que el worker los reintente:
   ```sql
   UPDATE public.notification_queue
     SET status='pending', failed_at=NULL, error_message=NULL, attempt_count=0
     WHERE template_name IN ('admin_quotation_accepted_v1','admin_quotation_adjustments_v1','admin_quotation_rejected_v1')
       AND status='failed';
   ```

Esta extensión no es bloqueante para esta sesión — los rows quedan encolados igual; el worker los marcará `failed` ahora pero el reset es trivial cuando llegue el momento.

---

## 6. Estado consolidado del Slice 2 al cierre

| Sub-bloque | Estado |
|---|---|
| Backend RPCs públicas (034) | ✅ Applied + smoke E2E previo OK |
| Lock + sync + triggers (035) | ✅ Applied |
| URL corta `/c/:code` (035a) | ✅ Applied |
| WA al admin en accept/adjustments/rejected (035b) | ✅ Applied + smoke E2E OK · ⏳ Meta templates |
| Frontend rediseño dark premium | ✅ Done (sesión anterior) |
| QA Capa 1 con 4 cotizaciones reales | ✅ Done (sesión anterior) |
| Templates Meta `quotation_sent_v1` / `quotation_v2_sent_v1` | ⏳ Pendiente Felipe |
| Templates Meta `admin_quotation_*_v1` (×3) | ⏳ Pendiente Felipe (Slice 2.5) |
| TikTok URL para footer | ⏳ Pendiente Alvaro |
| Feature flag `VITE_FF_PHASE_4_QUOTATION_PUBLIC=true` en Vercel prod | ⏳ Activar cuando S2 base + S2.5 estén aprobados Meta |

---

## 7. Lo que falta para Slice 2 100% activable en prod

1. **Felipe** aprueba los 5 templates Meta pendientes (`quotation_sent_v1`, `quotation_v2_sent_v1`, `admin_quotation_accepted_v1`, `admin_quotation_adjustments_v1`, `admin_quotation_rejected_v1`).
2. **Alvaro** confirma TikTok URL (opcional, cosmético).
3. **Agente** (próxima sesión): extender `TEMPLATE_REGISTRY` de la Edge Function + re-deploy + reset `failed → pending` en queue.
4. **Activación del FF** `VITE_FF_PHASE_4_QUOTATION_PUBLIC=true` en Vercel prod env vars + soak 48h con cliente piloto avisado.

Cuando esos 4 pasos cierren → arrancar **Slice 3** (pago + cola admin de verificación + BankSettings).

---

## 8. Comando git para Alvaro (PowerShell, copy-paste)

> Race condition con OneDrive — agente NO corre commits. Vos lo corrés en tu PowerShell. No incluye `git push`.

```powershell
cd "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"

git add db/migrations/035b_phase4_admin_wa_on_quotation_actions.sql db/migrations/README.md docs/handover/2026-05-23_PHASE-4-SLICE-2-ADMIN-WA.md

git commit -m "feat(phase-4-s2.5): WA al admin en accept/adjustments/rejected" -m "Cierra el gap detectado en QA del Slice 2: hoy cuando el cliente aceptaba o rechazaba la cotizacion publica al admin (Alvaro) solo le llegaba notif in-app. Esta migracion agrega WA al admin replicando el patron de request_quotation_reactivation (mig 034)." -m "Migracion 035b (idempotente, CREATE OR REPLACE) re-define fn_notify_quotation_acceptance + fn_notify_quotation_rejection agregando PERFORM public.fn_wa_enqueue_for_profile(...) al final de cada una. Aplicada en prod 2026-05-23 23:40 UTC via Management API." -m "Smoke E2E (3 cotizaciones [SMOKE-S2.5-2026-05-23], cleanup post-smoke OK) verifico que las 3 acciones del cliente encolan el template correcto con destinatario Alvaro Rios y status pending." -m "Bloqueador externo: 3 templates Meta nuevos (admin_quotation_accepted_v1, admin_quotation_adjustments_v1, admin_quotation_rejected_v1) — mientras Felipe no los apruebe, el worker marca cada row como failed. Cuando se aprueben: extender TEMPLATE_REGISTRY de process-whatsapp-notifications + reset failed->pending. Detalle: docs/handover/2026-05-23_PHASE-4-SLICE-2-ADMIN-WA.md" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 9. Notas finales

- **Discrepancia whatsapp_phone Alvaro**: handoff anterior decía `+573136802025`, prod tiene `+579879141748`. Decidir cuál es real antes de envío real.
- **Templates Meta**: TODOS los slugs son `..._v1` para no chocar con futuras versiones si el wording cambia (patrón ya usado en S3).
- **Migración 035b NO toca** las otras funciones de 035 (`send_quotation_to_client`, `fn_lock_quotation_on_sent`, `fn_sync_opportunity_from_quotation`, `fn_log_quotation_status_change`, `unlock_quotation`). Esas siguen exactamente como estaban.
- **Pref_keys nuevas** (`wa_quotation_accepted`, `wa_quotation_adjustments`, `wa_quotation_rejected`): nadie las tiene seteadas; default TRUE.
