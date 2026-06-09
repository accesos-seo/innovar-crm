# Handoff — Innovar CRM · Cierre Fase 9 · Pendiente Meta
**Fecha:** 2026-06-09  
**Rama activa:** `ux-fixes` (2 commits nuevos desde handoff anterior)  
**Proyecto Supabase:** `xdzbjptozeqcbnaqhtye`

---

## Estado al cerrar sesión

### ✅ Completado en esta sesión

| Paso | Detalle |
|---|---|
| Fix trigger `bienvenidas_clientes` | `fn_enqueue_whatsapp_new_lead` corregida → usa `welcome_lead_v1` + `template_parameters` (en prod) |
| Reset cola atascada | Ya estaba sana, 0 acciones necesarias |
| Migración 047 | `trg_notify_fabricacion_started` + `fn_notify_fabricacion_started` → en prod ✅ |
| Migración 048 | `trg_notify_instalacion_programada` + `fn_notify_instalacion_programada` → en prod ✅ |
| Migración 049 | `trg_cierre_automatico_proyecto` (BEFORE trigger) → en prod ✅ |
| Migración 050 | `ALTER TYPE project_status ADD VALUE 'completado'` → en prod ✅ (era bug: el enum no tenía ese valor) |
| Fix `template_params` → `template_parameters` | En los 3 archivos SQL (047/048/049) + commit `b1d125e` |
| n8n `CjbwjGdRKyIzWJWq` | "Recordatorio Día de Instalación" — `DRY_RUN=false`, `template_parameters` correcto, **ACTIVO** · L-S 7:30am Bogotá |
| Prueba E2E pipeline | `welcome_lead_v1` insertada manualmente → llegó como `sent` en < 60s ✅ |
| Prueba triggers 047/048/049 | Disparados contra proyecto de prueba `758a999a`, 3 entradas en cola confirmadas ✅ |
| Tarea "Solicitar reseña" | Creada por trigger 049 con `due_date + 7 días` ✅ |

### ⏳ Pendiente — 3 bloqueantes

#### 1. Robert crea `visit_assigned_admin_v1` en Meta BM (5 min)

Meta Business Manager → WhatsApp → Message Templates → Create:

```
Nombre: visit_assigned_admin_v1
Categoría: Utility
Idioma: Spanish

Cuerpo:
Visita asignada:

👤 Cliente: {{1}}
📅 Fecha: {{2}}
⏰ Hora: {{3}}
📍 Dirección: {{4}}

Por favor confirmar asistencia.
```

#### 2. Meta aprueba las 4 templates de Fase 9 (24–48h, automático)

| Template | Disparador |
|---|---|
| `fabricacion_iniciada_v1` | Trigger 047 — `fabrication_started_at` NULL→NOT NULL |
| `instalacion_programada_v1` | Trigger 048 — `scheduled_install_date` NULL→NOT NULL |
| `proyecto_completado_v1` | Trigger 049 — `delivered_at` NOT NULL + `is_fully_paid=true` |
| `recordatorio_instalacion_v1` | n8n `CjbwjGdRKyIzWJWq` 7:30am L-S |

Cuando Meta las apruebe, los mensajes fluirán automáticamente a los clientes. No hay código que tocar.

#### 3. Robert confirma que los mensajes de Fase 9 llegaron a su teléfono

Esto desbloquea las 2 últimas acciones que hace el agente:

---

## Próxima sesión — exactamente 2 acciones

**Cuando Robert confirme mensajes recibidos:**

```
Paso 8: Limpiar wa_test_phone_override
UPDATE public.system_settings SET value = NULL WHERE key = 'wa_test_phone_override';
```

```
Paso 9: Merge + push
cd D:\Agents-automations\04-Innovar
git checkout main
git merge ux-fixes --no-ff -m "feat(fase9): triggers fabricacion/instalacion/cierre + enum completado"
git push origin main
git checkout ux-fixes
```

**Cuando `visit_assigned_admin_v1` sea aprobada por Meta:**

Agregar al TEMPLATE_REGISTRY en `supabase/functions/process-whatsapp-notifications/index.ts`:

```typescript
visit_assigned_admin_v1: bodyBuilder("visit_assigned_admin_v1", 4),
```

(Ya existe en línea 103 — verificar que siga igual, luego `supabase functions deploy process-whatsapp-notifications`)

---

## Contexto técnico crítico

- **`wa_test_phone_override` = `3183061286` (Robert) — ACTIVO** hasta confirmar Fase 9
- **Rama `ux-fixes`**: 2 commits pendientes de merge a main (`2519f8e`, `b1d125e`)
- **Auto-deploy Vercel**: se activa al hacer push a `main`
- **Supabase Innovar**: fuera de scope del MCP → usar Management API con `SUPABASE_ACCESS_TOKEN` del `.env`
- **Patrón Management API**: `POST api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query`
- **Cola notificaciones**: las 3 entradas de Fase 9 del proyecto de prueba están en `pending` y fallarán hasta que Meta apruebe → normal, no borrar

---

## Archivos modificados en rama `ux-fixes`

```
db/migrations/047_notificador_fabricacion.sql          (template_params fix)
db/migrations/048_notificador_instalacion_programada.sql (template_params fix)
db/migrations/049_cierre_automatico_proyecto.sql        (template_params fix)
db/migrations/050_add_completado_to_project_status.sql  (nuevo — bug fix enum)
```
