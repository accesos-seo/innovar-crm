# Prompt para retomar Fase 4 · Slice 2 en sesión nueva de Claude Code

> Copiar el bloque completo de abajo y pegarlo como primer mensaje a Claude. NO necesitás modificar nada — el prompt es autocontenido y le dice exactamente qué leer y qué hacer primero.

---

```
Soy Alvaro de Innovar (cocinas y muebles, Pereira). Estoy continuando un proyecto que ya tiene mucho trabajo hecho. Vos no tenés contexto previo — todo lo que necesitás está en archivos del repo, en mi memoria global, y en mi .env.

# 🎯 TU MISIÓN

Cerrar el último gap del Slice 2 de Fase 4 del CRM Innovar (cotización pública): hoy cuando el cliente acepta / pide ajustes / rechaza la propuesta desde la URL pública, al administrador (Álvaro Ríos) le llega solo una notificación in-app dentro del CRM, pero NO le llega WhatsApp. Vamos a cerrar ese gap: agregar el envío de WhatsApp al admin en los 3 escenarios.

# 📂 WORKING DIRECTORY (canónico)

`C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`

(El mirror en `OneDrive\Documentos\` está vacío — ignoralo.)

# 📚 ANTES DE TOCAR NADA, LEÉ EN ESTE ORDEN

1. **Handoff de esta sesión (DONDE ESTÁ TODO EL CONTEXTO RECIENTE):**
   `docs/handover/2026-05-23_PHASE-4-SLICE-2-QA-AND-SHARING.md`

   Especialmente:
   - §1 — análisis del gap de WhatsApp al admin (auditoría SQL real, qué se encola hoy vs qué falta)
   - §5 — tabla actualizada de templates Meta (los 3 nuevos que falta crear)
   - §6 — lo que falta para cerrar Slice 2 en prod

2. **Handoff Slice 2 original (backend + frontend base):**
   `docs/handover/2026-05-23_PHASE-4-SLICE-2.md`

3. **Plan global Fase 4 (referencia):**
   `docs/handover/2026-05-23_PHASE-4-PLAN-LOCKED.md`

4. **Migración 035 (donde están los triggers a modificar):**
   `db/migrations/035_phase4_lock_and_sync_triggers.sql` — buscá `fn_notify_quotation_acceptance` y `fn_notify_quotation_rejection`

5. **Memoria global crítica:**
   `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\feedback_supabase_enqueue_notification_wa_only.md`
   — explica que `enqueue_notification` es WhatsApp-only; para in-app hay que INSERT directo en `public.notifications`. Pattern reutilizable.

# 🔑 IDENTIDADES Y RECURSOS

- **Supabase project ID Innovar:** `xdzbjptozeqcbnaqhtye` (FUERA del scope MCP — usar Management API con PAT del `.env`)
- **Tokens en `.env` del repo:** `SUPABASE_ACCESS_TOKEN` (PAT) + `SUPABASE_SERVICE_KEY` (service_role)
- **Branch actual:** `ux-fixes`
- **Vercel deploy:** lo corre Alvaro manual, NO vos
- **Admin que recibe WA:** Alvaro Ríos, `user_id=09ca8b37-95b8-43dc-9b01-1100519d5ec5`, `whatsapp_phone=+573136802025`

# 🚧 LO QUE TENÉS QUE HACER

## Paso 1 — Confirmar el gap (5 min)

Confirmá con SQL contra prod que mi diagnóstico del handoff es correcto. Querés ver que:
- `fn_notify_quotation_acceptance` solo hace INSERT en `notifications` (in-app) + `enqueue_notification` para el cliente con `payment_request_v1`, pero NO `fn_wa_enqueue_for_profile` para el admin.
- Idem `fn_notify_quotation_rejection`.

Si confirmás esto, avanzá. Si encontrás algo distinto, pausá y avisame.

## Paso 2 — Escribir migración `035b_phase4_admin_wa_on_quotation_actions.sql`

Patrón a seguir:
- `CREATE OR REPLACE` de `fn_notify_quotation_acceptance` y `fn_notify_quotation_rejection`
- Agregar al final de cada función (después del INSERT in-app) un `PERFORM public.fn_wa_enqueue_for_profile(...)` con el template correspondiente
- Idempotente
- NO tocar las otras funciones de la 035

Templates a usar:
- Aceptar → `admin_quotation_accepted_v1` con vars: `admin_full_name`, `client_name`, `quotation_number`
- Ajustes → `admin_quotation_adjustments_v1` con vars: `admin_full_name`, `client_name`, `quotation_number`, `reason`
- Rechazar → `admin_quotation_rejected_v1` con vars: `admin_full_name`, `client_name`, `quotation_number`, `reason`

Mirá cómo lo hizo `request_quotation_reactivation` en migración 034 — ya usa `fn_wa_enqueue_for_profile` con `quotation_reactivation_admin_v1`. Replica ese mismo patrón.

## Paso 3 — Aplicar migración via Management API

Mismo patrón que en handoffs anteriores. Curl + PAT del `.env`. Responde `[]` → éxito.

Después marcá `035b` como ✅ en `db/migrations/README.md`.

## Paso 4 — Smoke E2E

Crear UNA cotización fake nueva con cliente `[SMOKE-S2.5-2026-MM-DD]` (NO reutilizar las viejas `[QA-SLICE2-*]` para evitar ruido).

Flujo:
1. INSERT client + quotation + items
2. UPDATE status='sent'
3. RPC `accept_public_quotation(token, 'smoke')`
4. Verificar `notification_queue` tiene UN row con:
   - `recipient_type='profile'`
   - `recipient_name='Alvaro Rios'`
   - `template_name='admin_quotation_accepted_v1'`
   - `status='pending'` (o `failed` si el worker corre antes y Meta no aprobó el template — ambos son OK para validar la lógica)

Repetir para `reject_public_quotation` con subtype `adjustments_requested` y `declined`. Confirmar que cada uno encola el template correspondiente.

Cleanup smoke al final (soft-delete patrón usual).

## Paso 5 — Actualizar documentación

- `db/migrations/README.md`: marcar 035b como ✅ Applied
- Memoria global `reference_innovar_whatsapp_templates.md`: agregar los 3 nuevos templates pendientes de aprobación de Meta
- Escribir nuevo handoff `docs/handover/2026-MM-DD_PHASE-4-SLICE-2-ADMIN-WA.md` documentando el cierre del gap
- Actualizar entry en MEMORY.md global de Innovar Fase 4 Slice 2

## Paso 6 — Comando git para Alvaro

Como siempre — preparalo en PowerShell con `git add` + `git commit -m` (no `git push`).

# 🎬 ARRANCÁ ASÍ

1. Leé el handoff principal (`docs/handover/2026-05-23_PHASE-4-SLICE-2-QA-AND-SHARING.md`) completo.
2. Hacé el SQL de confirmación del Paso 1.
3. Decime "confirmado, arranco con migración 035b" y avanzá.

NO me preguntes nada antes de arrancar si la info ya está en el handoff. Solo pausá si encontrás algo que contradice lo documentado.

# ⚙️ MODO DE TRABAJO (NO PREGUNTES ESTO, YA ESTÁ DECIDIDO)

- Hablame en **español plano, sin jergón técnico**. Traducí cada término técnico la primera vez.
- Aplicás los cambios de DB DIRECTAMENTE con Management API + PAT del `.env`. NO me pidas que los corra yo.
- Solo derivame: `git commit`, `git push`, `vercel --prod`, `npm run dev`.
- Antes de cada bash/curl con SQL: 1 frase de intención en español plano.
- Escribís archivos sin pedirme confirmación previa.
- Respuestas cortas, técnicas pero claras. No me hagas resúmenes de lo que ya está en el commit.

# 🚨 ESTADO DE QA AL CIERRE DE LA SESIÓN ANTERIOR

- 4 cotizaciones fake activas con prefijo `[QA-SLICE2-2026-05-23]` en producción (estados mixtos: 2 client_approved + 2 sent — una de las "sent" tiene `valid_until` pasado y renderiza como vencida).
- Cloudflare tunnel **puede estar todavía corriendo** (URL `https://belief-solving-sequences-paragraph.trycloudflare.com`). Verificá con `curl -I` esa URL. Si responde 200, sigue activo. Si no, ignorá.
- Preview server vite en port 4173 también puede estar corriendo. Ignorá si no necesitás QA visual.

Si querés hacer un cleanup de las cotizaciones viejas antes de empezar (recomendado), usá el SQL del §8 del handoff principal.

Arrancá.
```

---

## 📤 Cómo entregás esto

1. Abrí una sesión nueva de Claude Code (CLI o desktop).
2. Verificá que el working dir es `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`.
3. Copiá el bloque que está entre los ` ``` ` de arriba (todo el contenido entre las tres comillas).
4. Pegalo como primer mensaje a Claude.
5. Claude va a leer los handoffs automáticamente y arrancar con el Paso 1.
