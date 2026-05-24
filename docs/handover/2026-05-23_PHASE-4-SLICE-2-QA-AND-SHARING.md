# Handoff — Innovar CRM · Fase 4 · Slice 2 · QA + URL pública + Mejora UI premium + Sharing

> **Fecha**: 2026-05-23 (noche) · **Branch**: `ux-fixes` (rebase del Slice 2 inicial) · **Working dir canónico**: `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
> **Handoff Slice 2 original (backend + frontend base)**: [`2026-05-23_PHASE-4-SLICE-2.md`](2026-05-23_PHASE-4-SLICE-2.md)
> **Plan global Fase 4**: [`2026-05-23_PHASE-4-PLAN-LOCKED.md`](2026-05-23_PHASE-4-PLAN-LOCKED.md)
> **Estado de sesión**: cortada por presión de contexto (~507k tokens). Continúa en sesión nueva con el prompt al final de este doc.

---

## 0. TL;DR — qué quedó hecho en esta sesión adicional

Slice 2 ya estaba implementado (backend + frontend funcional) en el handoff anterior. Esta sesión cubrió:

1. **QA Capa 1** ejecutada con 4 cotizaciones smoke (`COT-2026-0010..0013`).
2. **Rediseño visual dark premium** completo de la pantalla pública (logo, total destacadísimo, modales premium, footer corporativo).
3. **Logo real** integrado (`/innovar-logo-black.png`) — sin dependencia de bucket externo roto.
4. **Footer corporativo completo** con dirección, contacto, redes sociales (FB, IG, WhatsApp). TikTok pendiente.
5. **Botón "Compartir"** con Web Share API + fallback portapapeles.
6. **URL pública vía Cloudflare Tunnel** para QA real desde celular: `https://belief-solving-sequences-paragraph.trycloudflare.com` (temporal, mientras esté corriendo `cloudflared`).
7. **Meta tags OG + favicon genéricos** — share preview en WhatsApp/iMessage NO revela el nombre del cliente.
8. **URL corta `/c/:code`** con código base62 de 6 chars — replicó el patrón de `/v/:code` de booking.
9. **Vite `preview.allowedHosts`** configurado en `vite.config.ts` para permitir `.trycloudflare.com`.

**Cero rompimientos**. Backend ya validado en handoff anterior. Esta sesión solo agrega capa visual + sharing.

---

## 1. Lo que el usuario quiere verificar primero al retomar

> **"¿Le llega WhatsApp a Álvaro (admin) cuando el cliente acepta / pide ajustes / rechaza la propuesta?"**

### Respuesta corta: **NO**.

Hoy los triggers de la migración `035_phase4_lock_and_sync_triggers.sql` solo encolan **notificación in-app** al admin (insert directo en `public.notifications`), no WhatsApp.

**Auditado con SQL contra producción** (2026-05-23 23:17 UTC):

| Acción del cliente | In-app al admin (CRM bell) | WhatsApp al admin |
|---|---|---|
| **Aceptar propuesta** | ✅ Sí — title "Cliente aceptó cotización" | ❌ **NO se encola** |
| **Solicitar ajustes** | ✅ Sí — title "Cliente pidió ajustes" + reason | ❌ **NO se encola** |
| **Rechazar propuesta** | ✅ Sí — title "Cliente rechazó cotización" + motivo | ❌ **NO se encola** |
| **Solicitar reactivación** (cotización vencida) | ✅ Sí | ✅ Sí (template `quotation_reactivation_admin_v1`, ya implementado en migración 034) |

Solo el flujo de **reactivación** dispara WA al admin. Los 3 flujos principales (aceptar/ajustes/rechazar) no.

### Lo que falta para cerrar el gap

**3 templates Meta nuevos UTILITY/ES** (los tiene que aprobar Felipe):

| Template Meta | Variables | Wording sugerido |
|---|---|---|
| `admin_quotation_accepted_v1` | {{1}}=admin_nombre, {{2}}=cliente, {{3}}=quotation_number | "{{1}}, {{2}} aceptó la cotización N° {{3}}. Ya podés ver el pago entrante." |
| `admin_quotation_adjustments_v1` | {{1}}=admin_nombre, {{2}}=cliente, {{3}}=quotation_number, {{4}}=reason | "{{1}}, {{2}} pidió ajustes en la cotización N° {{3}}. Motivo: «{{4}}»" |
| `admin_quotation_rejected_v1` | {{1}}=admin_nombre, {{2}}=cliente, {{3}}=quotation_number, {{4}}=reason | "{{1}}, {{2}} rechazó la cotización N° {{3}}. Motivo: «{{4}}»" |

**Migración a crear** (sugerencia: `035b_phase4_admin_wa_on_quotation_actions.sql`):
- `CREATE OR REPLACE` de las 2 funciones existentes: `fn_notify_quotation_acceptance` y `fn_notify_quotation_rejection`.
- Agregar al final de cada función un `PERFORM public.fn_wa_enqueue_for_profile(...)` con el template correspondiente, igual al patrón usado en `request_quotation_reactivation`.
- Idempotente (CREATE OR REPLACE).
- Mientras Meta no apruebe los templates, los rows en `notification_queue` quedan `failed` (consistente con el resto del flujo).

### Acción concreta que recomendamos al retomar

1. Crear los 3 templates en Meta Business Manager (Felipe puede arrancar en paralelo — 24-48h de aprobación).
2. Escribir migración `035b` con los `CREATE OR REPLACE` de los 2 triggers.
3. Aplicar via Management API.
4. Smoke E2E nuevo: crear cotización fake → enviar → aceptar via RPC → verificar en `notification_queue` que aparece un row para Álvaro con template `admin_quotation_accepted_v1` (queda `failed` hasta que Meta apruebe — eso es OK).

---

## 2. URL pública QA (Cloudflare Tunnel) — sigue corriendo

**Estado en el momento del handoff**: el túnel está activo, sirviendo el preview de `localhost:4173`.

```
URL base:    https://belief-solving-sequences-paragraph.trycloudflare.com
Process ID:  background bash id b91dfyqyz (cloudflared)
Preview:     vite preview --port 4173 (servido desde dist/ con FF=true)
```

### Cuando retomes, primero decidí si querés mantener o cerrar

**Opción A — Cerrar todo** (recomendado si pasaron horas sin actividad):
```bash
# Cerrar túnel
TaskStop b91dfyqyz   # via TaskStop tool en Claude

# Cerrar preview
# (Claude lo hace con mcp__Claude_Preview__preview_stop)

# Cleanup cotizaciones QA fake (Alvaro ya hizo las pruebas que necesitaba)
PAT=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r"')
# Soft-delete clientes + quotations + hard-delete notifs + WA queue
node -e "..." > /tmp/cleanup.json
curl -sS -X POST "..." --data-binary "@/tmp/cleanup.json"
```

**Opción B — Mantener**: si la URL sigue funcionando (`curl -I https://belief-solving-sequences-paragraph.trycloudflare.com/c/EVMja9` devuelve 200), continuar usando los mismos 4 links.

### Los 4 links cortos activos (mientras el túnel viva)

| Cotización | Estado | URL corta |
|---|---|---|
| COT-2026-0010 (cocina) | `client_approved` | `https://belief-solving-sequences-paragraph.trycloudflare.com/c/5Bm7cv` |
| COT-2026-0011 (closet) | `client_approved` | `https://belief-solving-sequences-paragraph.trycloudflare.com/c/rZbhyT` |
| COT-2026-0012 (puertas) | `sent` | `https://belief-solving-sequences-paragraph.trycloudflare.com/c/EVMja9` |
| COT-2026-0013 (TV) | `sent` con `valid_until` pasado → renderiza como **vencida** | `https://belief-solving-sequences-paragraph.trycloudflare.com/c/u5rHjf` |

Cliente fake compartido: `[QA-SLICE2-2026-05-23] Cliente de Prueba Alvaro` con `whatsapp_phone='+579999999999'` (no real).

---

## 3. Archivos modificados/creados en esta sesión

### Backend (SQL)

| Archivo | Propósito |
|---|---|
| [`db/migrations/035a_phase4_quotation_short_code.sql`](../../db/migrations/035a_phase4_quotation_short_code.sql) | Aplicada ✅ · Column `quotations.short_code` UNIQUE 6-char + trigger BEFORE INSERT + RPC `resolve_quotation_short_code(p_code)` + re-CREATE de `get_public_quotation` para incluir `short_code` + re-CREATE de `send_quotation_to_client` para que el WA al cliente use `/c/<short_code>` en vez de `/cotizacion/<token>` |

### Frontend nuevo

| Archivo | Propósito |
|---|---|
| [`src/components/quotations/public/InnovarMark.tsx`](../../src/components/quotations/public/InnovarMark.tsx) | Componente logo Innovar reutilizable (variantes `hero` + `inline`), usa `/innovar-logo-black.png` con fallback tipográfico |
| [`src/components/quotations/public/PublicLayout.tsx`](../../src/components/quotations/public/PublicLayout.tsx) | Wrapper dark premium con top accent menta + header con logo + footer corporativo (dirección Cerritos, FB, IG, WhatsApp; TikTok pendiente) |
| [`src/components/quotations/public/ShareQuotationButton.tsx`](../../src/components/quotations/public/ShareQuotationButton.tsx) | Botón "Compartir" con Web Share API + fallback portapapeles, recibe `shortCode` y construye URL `/c/<short_code>`, copy genérico sin nombre del cliente |
| [`src/pages/PublicQuotationByCode.tsx`](../../src/pages/PublicQuotationByCode.tsx) | Ruta `/c/:code` — llama RPC `resolve_quotation_short_code` y redirige a `/cotizacion/<token>` |
| [`public/innovar-logo-black.png`](../../public/innovar-logo-black.png) | Logo Innovar real (3.8KB) descargado del bucket `Imagenes` de Innovar — fondo negro + isotipo N verde menta + texto "INNOVAR COCINAS DE DISEÑO" |

### Frontend modificado

| Archivo | Cambio |
|---|---|
| [`index.html`](../../index.html) | Meta tags OG genéricos (sin nombre cliente), favicon local, theme-color dark, title genérico |
| [`vite.config.ts`](../../vite.config.ts) | Agregado `preview.allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']` |
| [`src/App.tsx`](../../src/App.tsx) | Registrada ruta `/c/:code` (lazy, sin Layout) |
| [`src/components/quotations/public/QuotationPublicView.tsx`](../../src/components/quotations/public/QuotationPublicView.tsx) | Rediseño dark premium completo + integración de `ShareQuotationButton` con `shortCode` |
| [`src/components/quotations/public/QuotationActionButtons.tsx`](../../src/components/quotations/public/QuotationActionButtons.tsx) | Modales **rehechos**: `PremiumModalShell` con header + body + footer separados, ancho `max-w-2xl`, padding generoso, fix del Select que mostraba `price` (raw value) en vez del label legible — ahora dropdown custom que muestra "El precio supera mi presupuesto" |
| [`src/components/quotations/public/QuotationExpiredView.tsx`](../../src/components/quotations/public/QuotationExpiredView.tsx) | Rediseño dark + accent naranja |
| [`src/components/quotations/public/QuotationRedirectView.tsx`](../../src/components/quotations/public/QuotationRedirectView.tsx) | Rediseño dark + countdown auto-redirect |
| [`src/components/quotations/public/QuotationRejectedView.tsx`](../../src/components/quotations/public/QuotationRejectedView.tsx) | Rediseño dark consistente |
| [`src/pages/PublicQuotation.tsx`](../../src/pages/PublicQuotation.tsx) | `StatusCard` premium para los 3 estados (client_approved / pending_payment_verification / approved) + ErrorCard dark |
| [`src/hooks/quotations/usePublicQuotation.ts`](../../src/hooks/quotations/usePublicQuotation.ts) | Type `PublicQuotationData` agregó campo `short_code: string \| null` |

### Archivos eliminados

- `public/innovar-logo-web.png` — versión horizontal del sitio externo, tenía fondo claro que rompía el look dark
- `public/innovar-logo-white.jpg` — JPG sin transparencia

### Memorias globales nuevas

| Archivo | Propósito |
|---|---|
| `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\feedback_supabase_enqueue_notification_wa_only.md` | Documenta el bug encontrado en smoke E2E del Slice 2 backend: la helper `enqueue_notification` exige `template_name NOT NULL` porque escribe en `notification_queue` (outbox WA). Para in-app hay que INSERTar directo en `public.notifications`. Patrón reutilizable. |

---

## 4. Estado de migraciones (al 23-05-2026 noche)

| Migración | Estado | Notas |
|---|---|---|
| `030_phase4_quotations_new_columns.sql` | ✅ Applied 2026-05-23 | Slice 1 |
| `031_phase4_bank_settings_seeds.sql` | ✅ Applied 2026-05-23 | Slice 1 |
| `032_phase4_designer_qa_seed.sql` | ✅ Applied 2026-05-23 | Slice 1 |
| `033_phase4_storage_buckets.sql` | ✅ Applied 2026-05-23 | Slice 1 |
| `034_phase4_public_quotation_rpcs.sql` | ✅ Applied 2026-05-23 (+ fix in-place) | Slice 2 — 4 RPCs públicas |
| `035_phase4_lock_and_sync_triggers.sql` | ✅ Applied 2026-05-23 (+ fix in-place) | Slice 2 — triggers + send + unlock |
| **`035a_phase4_quotation_short_code.sql`** | **✅ Applied 2026-05-23 noche** | **URL corta `/c/:code`** |
| `036_phase4_payment_flow.sql` | ⏳ Pending | Slice 3 |
| `037_phase4_quotation_expiry_and_reminders.sql` | ⏳ Pending | Slice 4 |
| `038_phase4_pdf_generation_hook.sql` | ⏳ Pending | Slice 5 |
| **`035b_phase4_admin_wa_on_quotation_actions.sql`** | **❌ NO escrita todavía** | **A crear en próxima sesión** — agrega WA al admin en accept/adjustments/rejected |

---

## 5. Templates Meta — estado actualizado

Total = **12 templates** ahora (los 9 originales del PRD + 3 nuevos para WA al admin).

| Slice | Template | Estado actual | Notas |
|---|---|---|---|
| S2 | `quotation_sent_v1` | ⏳ Pendiente Felipe | Bloqueador para activar FF en prod |
| S2 | `quotation_v2_sent_v1` | ⏳ Pendiente Felipe | Bloqueador para activar FF en prod |
| **S2.5** | **`admin_quotation_accepted_v1`** | **❌ Pendiente — NUEVO** | Para WA al admin cuando cliente acepta |
| **S2.5** | **`admin_quotation_adjustments_v1`** | **❌ Pendiente — NUEVO** | Para WA al admin cuando cliente pide ajustes |
| **S2.5** | **`admin_quotation_rejected_v1`** | **❌ Pendiente — NUEVO** | Para WA al admin cuando cliente rechaza |
| S3 | `payment_request_v1` | ⏳ Pendiente Felipe | Cliente recibe datos bancarios |
| S3 | `payment_received_v1` | ⏳ Pendiente Felipe | Cliente con pago confirmado |
| S3 | `project_assigned_designer_v1` | ⏳ Pendiente Felipe | Diseñador asignado |
| S4 | `quotation_reminder_3d_client_v1` | ⏳ Pendiente Felipe | Recordatorio 3d antes de vencer |
| S4 | `payment_reminder_3d_client_v1` | ⏳ Pendiente Felipe | Recordatorio pago pendiente |
| S4 | `quotation_reactivation_admin_v1` | ⏳ Pendiente Felipe | YA implementado en código (RPC `request_quotation_reactivation`) |

Wording sugerido completo de los 3 nuevos: ver §1 de este handoff.

---

## 6. Lo que falta para cerrar Slice 2 en producción

### Bloqueadores externos
1. **Meta aprueba** `quotation_sent_v1` + `quotation_v2_sent_v1` (S2 base).
2. **Meta aprueba** los 3 nuevos `admin_quotation_*_v1` (Slice 2.5 que documentamos arriba).
3. **TikTok URL** — Alvaro la confirma para agregar al footer (campo `tiktok: null` en `PublicLayout.tsx`).

### Acciones del agente (próxima sesión)
1. **Escribir migración `035b`** con `CREATE OR REPLACE` de `fn_notify_quotation_acceptance` y `fn_notify_quotation_rejection` agregando los `PERFORM public.fn_wa_enqueue_for_profile(...)` correspondientes.
2. **Aplicar migración** vía Management API.
3. **Smoke E2E nuevo** validando que al aceptar/rechazar/pedir ajustes se encola row en `notification_queue` con destinatario admin y template correcto.

### Acciones del usuario
1. **Git commit + push** de todos los cambios de esta sesión. Comando en §7.
2. **TikTok URL** confirmada (opcional para Slice 2).
3. **Solicitar los 3 templates nuevos** a Felipe.
4. **Verificación visual final** del rediseño (ya hizo una primera ronda — confirmó que está espectacular).

### Activación del feature flag en prod
1. Vez que estén aprobados los 2 templates base (S2), encender `VITE_FF_PHASE_4_QUOTATION_PUBLIC=true` en Vercel prod env vars.
2. Soak 48h con UNA cotización real (cliente piloto avisado de que es prueba).
3. Si OK → arrancar Slice 3 (pago + cola admin + BankSettings).

---

## 7. Git commit para Alvaro (PowerShell, copy-paste)

> Race condition con OneDrive — el agente NO corre commits. Vos lo corrés en tu PowerShell.

```powershell
cd "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"

git add db/migrations/035a_phase4_quotation_short_code.sql index.html vite.config.ts public/innovar-logo-black.png src/App.tsx src/pages/PublicQuotationByCode.tsx src/hooks/quotations/usePublicQuotation.ts src/components/quotations/public/ docs/handover/2026-05-23_PHASE-4-SLICE-2-QA-AND-SHARING.md

git commit -m "feat(phase-4-s2-qa): rediseno dark premium + logo real + URL corta /c/:code + sharing + meta OG" -m "Rediseno visual completo de la pantalla publica (PublicLayout, QuotationPublicView, ActionButtons con modales premium, ExpiredView, RedirectView, RejectedView): paleta dark de marca (#131313 + verde menta #44ddc1), tipografia Plus Jakarta Sans black, total destacadisimo, top accents menta, footer corporativo con direccion Cerritos, telefono, email, redes sociales." -m "Logo real Innovar (/innovar-logo-black.png 3.8KB) descargado del bucket Imagenes del propio proyecto Supabase Innovar — sin dependencias externas. Favicon ya no apunta al bucket externo roto. Meta tags OG genericos para que el preview en WhatsApp/iMessage cuando un cliente reenvia el link NO exponga su nombre ni el numero de cotizacion." -m "URL corta /c/:code via migracion 035a (column short_code TEXT UNIQUE de 6 chars base62 + trigger BEFORE INSERT + backfill + RPC resolve_quotation_short_code + re-CREATE get_public_quotation para devolver short_code + re-CREATE send_quotation_to_client para que el WA al cliente use /c/<short_code>). Frontend: PublicQuotationByCode page + ruta /c/:code + ShareQuotationButton usa short URL." -m "Modales rehechos: PremiumModalShell con header + body + footer separados, ancho max-w-2xl, padding generoso. Fix del Select de Rechazar que mostraba el value crudo ('price') en lugar del label ('El precio supera mi presupuesto') — ahora dropdown custom con full control. vite.config.ts: preview.allowedHosts para permitir cloudflared tunnels (.trycloudflare.com)." -m "PENDIENTE en proxima sesion: migracion 035b con CREATE OR REPLACE de fn_notify_quotation_acceptance/rejection para encolar WA al admin (hoy solo se encola in-app). Requiere 3 templates Meta nuevos (admin_quotation_accepted_v1, admin_quotation_adjustments_v1, admin_quotation_rejected_v1). Handoff: docs/handover/2026-05-23_PHASE-4-SLICE-2-QA-AND-SHARING.md" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 8. Cleanup del QA fake (cuando ya no necesites las cotizaciones smoke)

```sql
-- Soft-delete clientes + quotations
UPDATE public.quotations SET deleted_at = now() WHERE client_id IN (SELECT id FROM public.clients WHERE name LIKE '[QA-SLICE2-%');
UPDATE public.clients SET deleted_at = now() WHERE name LIKE '[QA-SLICE2-%' AND deleted_at IS NULL;
-- Hard-delete in-app notifs + WA queue del QA (no son histórico real)
DELETE FROM public.notifications WHERE related_table='quotations' AND related_id IN (SELECT id FROM public.quotations WHERE client_id IN (SELECT id FROM public.clients WHERE name LIKE '[QA-SLICE2-%'));
DELETE FROM public.notification_queue WHERE recipient_reference_id IN (SELECT id::text FROM public.clients WHERE name LIKE '[QA-SLICE2-%') OR event_reference_id IN (SELECT id::text FROM public.quotations WHERE client_id IN (SELECT id FROM public.clients WHERE name LIKE '[QA-SLICE2-%'));
```

---

## 9. Entry point recomendado para la próxima sesión

El usuario va a copiar el prompt que está en `docs/handover/PROMPT-RESUME-PHASE-4-SLICE-2.md` (separado) en una sesión nueva de Claude Code.

Ese prompt instruye al próximo agente a:
1. Leer este handoff completo
2. Verificar si el tunnel de Cloudflare sigue activo (sino cerrar todo y arrancar limpio)
3. Crear migración `035b` para WA al admin
4. Aplicar
5. Smoke E2E nuevo
6. Documentar templates Meta nuevos en el handoff de Innovar de WhatsApp
