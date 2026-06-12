# Handoff — Innovar CRM: PRDs Tier 1 (CERRADOS)

**Fecha:** 2026-06-10  
**Proyecto:** Innovar CRM — módulos de valor para el cliente  
**Repo canónico:** `D:\Agents-automations\04-Innovar`  
**Branch:** `master` — commits hasta `5f719df`

---

## 1. Resumen de estado

Los 3 PRDs Tier 1 están implementados al 100% en código y DB.

| # | PRD | Migración | DB prod | Commit | Push | Vercel |
|---|---|---|---|---|---|---|
| 1 | Portal del Cliente "Mi Proyecto" | 053 | ✅ | `7ff4795` | ✅ | ✅ `VITE_FF_CLIENT_PORTAL=true` |
| 2 | Producción / Taller | 054 + 054b | ✅ | `bae6362` | ✅ | ✅ `VITE_FF_PRODUCTION_MODULE=true` |
| 3 | Postventa y Garantías | 055 | ✅ | `19f7429` + `5f719df` | 🔴 push pendiente | 🔴 `VITE_FF_POSTVENTA` pendiente |

---

## 2. Pendientes para cerrar PRD #3 al 100%

### 2a. Push y Vercel (USUARIO — el agente no hace push ni deployea)
```powershell
git -C "D:\Agents-automations\04-Innovar" push
```
Luego en Vercel → Settings → Environment Variables → agregar `VITE_FF_POSTVENTA=true` → Redeploy.

### 2b. Templates Meta (proceso externo — bloquean solo envíos WA)

| Template | Tipo | Texto |
|---|---|---|
| `tracking_link_v1` | UTILITY es | `"Hola {{1}} 👋 Tu proyecto con Innovar ya está en marcha. Sigue su avance aquí: {{2}}"` |
| `encuesta_satisfaccion_v1` | UTILITY es | `"Hola {{1}} 👋 ¡Gracias por confiar en Innovar! Respóndenos en 1 minuto: {{2}}"` |
| `garantia_reclamo_admin_v1` | UTILITY es | `"⚠️ Nuevo reclamo de garantía {{1}} — Proyecto: {{2}}. Severidad: {{3}}. Revisa el CRM."` |

### 2c. Activar postventa (cuando lo apruebe Robert)
```sql
-- Quitar DRY_RUN (activa envíos WA de encuestas y reclamos)
UPDATE public.system_settings SET value = to_jsonb('false'::text) WHERE key = 'postventa_dry_run';

-- Configurar teléfono de alertas de reclamos alta/crítica
UPDATE public.system_settings SET value = to_jsonb('+57XXXXXXXXXX'::text) WHERE key = 'postventa_alert_phone';

-- Activar envío automático del portal al entregar (requiere template tracking_link_v1 aprobada)
UPDATE public.system_settings SET value = to_jsonb('true'::text) WHERE key = 'portal_link_autosend';

-- Opcional: link de reseña Google después de ≥4★
UPDATE public.system_settings SET value = to_jsonb('https://g.page/r/...'::text) WHERE key = 'google_review_url';
```

---

## 3. Arquitectura implementada

### PRD #1 — Portal del Cliente

- `/proyecto/:token` — página pública mobile-first (timeline, galería fotos por etapa, pagos, botón WA)
- EF `public-project-tracking` (`verify_jwt=false` — ⚠️ cada deploy lo resetea; corregir con PATCH Management API)
- Card `ClientPortalCard` en `ProjectDetail` — upload fotos + botón "Enviar link por WA"
- Bucket `project-photos` (privado, signed URLs 1h)
- Trigger `trg_send_tracking_link` + RPC `send_tracking_link` (respeta `portal_link_autosend`)

### PRD #2 — Producción / Taller

- `/produccion` — Kanban 5 fases con `@hello-pangea/dnd`, confirmación obligatoria antes de mover (dispara WA a clientes), métricas capacidad/estancados/instalaciones próximas
- `/produccion/ficha/:id` — página imprimible sin montos (va al banco de trabajo)
- Sheet "Ficha" con 4 pestañas: Resumen, Archivos 3D/Despiece, Checklist de producción, Historial de estados
- Bucket `project-files` (privado, 50 MB, pdf/cad/img)
- RPC `move_project_status` — reglas por rol, guarda nota en `project_status_history`
- Rol `produccion`: sidebar reducido (Producción / Tareas / Mi perfil), redirect post-login a `/produccion`
- **CRÍTICO:** el Kanban NO usa `useUpdateProject` — el Zod de `schemas/project.ts` tiene el enum `project_status` viejo. Todo pasa por la RPC. Igual para `types/database.ts` (desactualizado). El módulo define sus propios tipos en `useProductionBoard.ts`.
- Hotfix 054b: `notify_fabrication_started` tenía 2 bugs preexistentes (22P02 JSONB cast + 42883 body TEXT) que impedían TODA transición a `en_produccion`.

### PRD #3 — Postventa y Garantías

- `/postventa` — 3 tabs: Garantías (con anulación), Reclamos (crear con fotos + cambiar estado), Encuestas (enviar/reenviar WA)
- `/encuesta/:token` — formulario público mobile-first (4 ratings + recomendación + comentarios + CTA Google review si ≥4★)
- EF `postventa-engine` — cron `pg_cron` 13:00 UTC (8am Bogotá), `verify_jwt=false`, **DRY_RUN activo** (`postventa_dry_run='true'`)
- Bucket `claim-photos` (privado, 10 MB, imágenes)
- Vista `v_postventa_metrics` — métricas del dashboard (security_invoker)
- Triggers idempotentes de entrega: reemplazan a `trg_auto_post_delivery` (sin idempotencia) y `trg_wa_satisfaction_survey` (dominio hardcodeado equivocado + id como token). `trg_project_delivered` (NPS/referidos) se preservó.
- RPCs anon: `get_public_survey` / `submit_public_survey`. RPC staff: `send_survey_now` (respeta DRY_RUN).

---

## 4. Alertas operativas (críticas)

| Situación | Acción |
|---|---|
| `supabase functions deploy public-project-tracking` | Corregir `verify_jwt=false`: `PATCH https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/functions/public-project-tracking` → `{"verify_jwt": false}` |
| `supabase functions deploy postventa-engine` | Mismo PATCH para `postventa-engine` |
| Borrar tasks en prod (QA) | Usar `SET session_replication_role='replica'` — `fn_queue_calendar_sync` revienta con FK |
| `tsc --noEmit` muestra ~25 errores | Son preexistentes — `npm run build` (vite) pasa limpio; no exigir tsc en cero |

---

## 5. URLs de producción

| Módulo | URL (Vercel) |
|---|---|
| App | `https://crm-innovar-app-2026.vercel.app` |
| Portal cliente | `https://crm-innovar-app-2026.vercel.app/proyecto/:token` |
| Encuesta | `https://crm-innovar-app-2026.vercel.app/encuesta/:token` (activa tras push + VITE_FF_POSTVENTA) |
| Producción | `https://crm-innovar-app-2026.vercel.app/produccion` |

---

## 6. Referencias clave

| Item | Valor |
|---|---|
| **Supabase project_ref** | `xdzbjptozeqcbnaqhtye` |
| **Token Supabase** | `.env → SUPABASE_ACCESS_TOKEN` |
| **Enum `project_status` real (prod)** | `contacto, cotizacion_aprobada, en_diseno, aprobacion_final, en_produccion, listo_instalacion, entregado, completado` |
| **Última migración** | `055_postventa_module.sql` |
| **Memoria** | `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\project_innovar_tier1_prds.md` |
| **PRDs** | `PRD-portal-cliente.md`, `PRD-produccion-taller.md`, `PRD-postventa-garantias.md` (raíz del repo) |
