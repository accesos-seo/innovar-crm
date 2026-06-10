# Handoff — Innovar CRM: PRDs Tier 1

**Fecha:** 2026-06-10  
**Proyecto:** Innovar CRM — módulos de valor para el cliente  
**Repo canónico:** `D:\Agents-automations\04-Innovar`  
**Branch:** `master` (commit `774a5ab`)

---

## 1. Contexto

Innovar es una empresa de cocinas y muebles integrales en Pereira. El CRM cubre bien el ciclo comercial (leads → cotizador → proyectos → finanzas), pero no tiene módulos de cara al cliente final ni para el equipo de producción. En esta sesión se analizó la app completa (frontend + backend validado contra prod) y se redactaron tres PRDs autocontenidos para los módulos de mayor valor — Tier 1 — listos para que otra IA los implemente.

---

## 2. Estado actual

| Tarea | Estado |
|---|---|
| Análisis completo del frontend (rutas, módulos, flags) | ✅ |
| Análisis completo del backend (tablas, EFs, enums validados contra prod) | ✅ |
| PRD Portal del Cliente "Mi Proyecto" (`053`) | ✅ `PRD-portal-cliente.md` |
| PRD Módulo de Producción / Taller (`054`) | ✅ `PRD-produccion-taller.md` |
| PRD Postventa y Garantías (`055`) | ✅ `PRD-postventa-garantias.md` |
| Commit local de los 3 PRDs | ✅ commit `774a5ab` en master |
| Push al remoto | 🔴 pendiente (requiere autorización) |
| Implementación de los módulos | 🔴 no iniciada |
| Registro de templates Meta (`tracking_link_v1`, `encuesta_satisfaccion_v1`, `garantia_reclamo_admin_v1`) | 🔴 proceso externo, bloqueante solo para envíos WA |

---

## 3. Próximos pasos (orden recomendado)

### 3a. Push del commit de PRDs (opcional, primer paso)
```powershell
git -C "D:\Agents-automations\04-Innovar" push
```

### 3b. Implementar PRD Portal del Cliente (migración 053 + EF + UI)
Abrir una nueva ventana de Claude Code en `D:\Agents-automations\04-Innovar` y decirle:

> "Implementá el PRD-portal-cliente.md al 100%."

El PRD incluye:
- Migración `053_client_portal.sql` (backfill de `tracking_token`, bucket `project-photos`, trigger de envío, RPC seed)
- Edge Function `public-project-tracking` (nueva, `verify_jwt=false`)
- Página pública `src/pages/PublicProjectTracking.tsx` — ruta `/proyecto/:token`
- Bloque interno en `ProjectDetail` (copiar link + subir fotos a `project_photos`)
- Feature flag `VITE_FF_CLIENT_PORTAL`

### 3c. Implementar PRD Módulo de Producción (migración 054 + UI)
> "Implementá el PRD-produccion-taller.md al 100%."

El PRD incluye:
- Migración `054_production_module.sql` (tabla `project_status_history`, trigger de log, bucket `project-files`, seeds en `system_settings`)
- Página `/produccion` con Kanban de planta (5 columnas de `project_status`)
- Panel "Ficha de taller" (Sheet con pestañas: Resumen, Archivos, Checklist, Historial, Imprimir)
- Acceso para rol `produccion` (hoy sin rutas)
- Feature flag `VITE_FF_PRODUCTION_MODULE`

### 3d. Implementar PRD Postventa y Garantías (migración 055 + EF + UI)
> "Implementá el PRD-postventa-garantias.md al 100%."

El PRD incluye:
- Migración `055_postventa_module.sql` (columnas nuevas en tablas dormidas, RPCs públicas, trigger auto-crea garantía/encuesta al entregar, bucket `claim-photos`)
- EF `postventa-engine` (cron diario — nace con `postventa_dry_run='true'`)
- Página interna `/postventa` (tabs: Garantías / Reclamos / Encuestas)
- Página pública `/encuesta/:token` — `src/pages/PublicSurvey.tsx`
- Feature flag `VITE_FF_POSTVENTA`

---

## 4. Skills útiles para continuar

- `/deploy-check` — antes de hacer push o Vercel deploy
- `/qa-autofix` — al terminar cada módulo
- `/diagnose` — si algo falla durante la implementación

---

## 5. Referencias clave

| Item | Valor |
|---|---|
| **Repo canónico** | `D:\Agents-automations\04-Innovar` |
| **Branch activo** | `master` |
| **Último commit** | `774a5ab` — PRDs Tier 1 |
| **Supabase project_ref** | `xdzbjptozeqcbnaqhtye` (público, no secreto) |
| **Token Supabase** | `.env → SUPABASE_ACCESS_TOKEN` |
| **Deploy (Vercel)** | `https://crm-innovar-app-2026.vercel.app` |
| **Enum `project_status` real (prod)** | `contacto, cotizacion_aprobada, en_diseno, aprobacion_final, en_produccion, listo_instalacion, entregado, completado` ⚠️ el repo lista valores distintos — siempre validar prod |
| **Última migración en prod** | `052_auth_password_reset_google.sql` |
| **n8n** | `https://estancias-atlas-n8n.heh8a3.easypanel.host/` |
| **PRDs** | `PRD-portal-cliente.md`, `PRD-produccion-taller.md`, `PRD-postventa-garantias.md` (raíz del repo) |
| **Convención mensajería** | `system_settings.wa_test_phone_override` activo durante QA; nunca probar contra clientes reales |
| **DRY_RUN postventa** | `postventa_dry_run='true'` en `system_settings` hasta aprobación explícita |
