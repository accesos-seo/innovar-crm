# Handoff — Smoke Test E2E Motor Comercial
**Fecha:** 2026-06-09  
**Rama:** `ux-fixes`  
**Commits clave:** `e2de3a9` · `c4b9f16` · `598fd3f` · `8cd984a`

---

## Objetivo

Validar el flujo completo de 9 etapas del Motor Comercial de Innovar CRM:
Captura → Contacto → Visita → Medidas → Cotización → Aprobación → Pago → Proyecto → Producción

`wa_test_phone_override = 3183061286` (todos los WA van a Robert)  
`slice_3_enabled = true`

---

## Bugs encontrados y corregidos

### 🔴 BUG 1 (CRÍTICO) — `quotation_sent_v1` faltaba en TEMPLATE_REGISTRY
**Impacto:** Toda cotización v1 enviada al cliente generaba un WA que fallaba silenciosamente (status `failed` en queue, sin error visible en la UI).  
**Causa:** El template se agregó a Meta BM pero nunca se registró en el Edge Function.  
**Fix:** `bodyBuilder("quotation_sent_v1", 3)` agregado al TEMPLATE_REGISTRY.  
**Archivo:** `supabase/functions/process-whatsapp-notifications/index.ts`  
**Commit:** `c4b9f16` (parcial) + deploy

---

### 🔴 BUG 2 — `notify_lead_followup_flow` usaba template `bienvenidas_clientes`
**Impacto:** El WA de bienvenida a cada lead nuevo fallaba — 3 filas confirmadas en `notification_queue` con `status=failed`.  
**Causa:** La función PL/pgSQL usaba un nombre de template antiguo (`bienvenidas_clientes`) que no existe en el TEMPLATE_REGISTRY.  
**Fix:** Función reescrita para usar `welcome_lead_v1` con `jsonb_build_object('1', split_part(name,' ',1))`. NULL guard para `supabase_anon_key` antes de llamar a `smart-api`.  
**Archivos:** `db/migrations/042_fix_welcome_lead_and_quotation_valid_until.sql` (sección A)  
**Commit:** `598fd3f` · Aplicado en producción ✅

---

### 🟡 BUG 3 — `send_quotation_to_client` no asignaba `valid_until`
**Impacto:** Todas las cotizaciones enviadas tenían `valid_until = NULL`. El cron de expiración (`slice3-expire-accepted-quotations-daily`) nunca expiraba cotizaciones correctamente.  
**Fix:** `SET valid_until = CURRENT_DATE + v_validity_days` en el UPDATE de estado `sent`. Lee `quotation_validity_days` de `system_settings` (default 30 días).  
**Archivo:** `db/migrations/042_fix_welcome_lead_and_quotation_valid_until.sql` (sección B)  
**Commit:** `598fd3f` · Aplicado en producción ✅

---

### 🟡 BUG 4 — `appointment_booked` faltaba en TEMPLATE_REGISTRY
**Impacto:** Cada vez que un cliente agendaba una cita, el WA de confirmación fallaba ("Template no registrado").  
**Fix:** `bodyBuilder("appointment_booked", 4)` agregado al TEMPLATE_REGISTRY.  
**Commit:** `8cd984a` · Deploy ✅ · 1 entrada reseteada a `pending` ✅

---

### 🟡 BUG 5 — `task_assigned` faltaba en TEMPLATE_REGISTRY
**Impacto:** Notificaciones de asignación de tareas fallaban ("Template no registrado").  
**Fix:** `bodyBuilder("task_assigned", 4)` agregado al TEMPLATE_REGISTRY.  
**Commit:** `8cd984a` · Deploy ✅ · 1 entrada reseteada a `pending` ✅

---

## Estado al cierre del smoke test

### notification_queue — últimas 48h

| Template | Status | n | Acción |
|---|---|---|---|
| `welcome_lead_v1` | processing | 3 | ✅ En envío (resetadas de bienvenidas_clientes/failed) |
| `booking_link_v1` | processing | 1 | ✅ En envío |
| `booking_link_v1` | sent | 1 | ✅ Enviado |
| `appointment_booked` | processing | 1 | ✅ En envío (reseteada de failed) |
| `task_assigned` | processing | 1 | ✅ En envío (reseteada de failed) |
| `admin_quotation_expired_v1` | sent | 1 | ✅ Enviado |
| `bienvenidas_clientes` | sent | 9 | ⚠️ Histórico (antiguo nombre, ya corregido) |
| `visit_assigned_admin_v1` | failed | 1 | 🔴 Meta error #132001 — ver pendiente |

---

## Pendiente — solo 1 acción requerida de Robert

### ❌ `visit_assigned_admin_v1` — Meta error #132001
**Error:** `Template name does not exist in the translation`  
**Significado:** El template existe en el código y en el TEMPLATE_REGISTRY, pero Meta no lo encuentra en el Business Manager con ese nombre exacto o no está aprobado.  
**Acción requerida:**
1. Entrar a [Meta Business Manager](https://business.facebook.com/wa/manage/message-templates/) con la cuenta de Innovar Cocinas De Diseño
2. Buscar el template `visit_assigned_admin_v1`
3. Si no existe → crearlo con 4 parámetros: `{{1}}` técnico, `{{2}}` cliente, `{{3}}` fecha/hora, `{{4}}` dirección
4. Esperar aprobación Meta (24-48h)
5. Una vez aprobado, la queue lo procesará automáticamente en el próximo ciclo del cron

---

## Archivos modificados en esta sesión

```
supabase/functions/process-whatsapp-notifications/index.ts
  → quotation_sent_v1, appointment_booked, task_assigned agregados al TEMPLATE_REGISTRY

db/migrations/042_fix_welcome_lead_and_quotation_valid_until.sql  [NUEVO]
  → Sección A: fix notify_lead_followup_flow (welcome_lead_v1, NULL guard anon_key)
  → Sección B: fix send_quotation_to_client (valid_until = CURRENT_DATE + 30)
  → Sección D: reset 3 filas bienvenidas_clientes → welcome_lead_v1/pending

db/migrations/028_opportunity_trigger_email_existing_client.sql
  → Sincronizado con la misma corrección (fuente de referencia)
```

---

## Configuración activa en system_settings

| Clave | Valor | Estado |
|---|---|---|
| `wa_test_phone_override` | `3183061286` | 🟡 Activo — WA van a Robert |
| `slice_3_enabled` | `true` | ✅ Flujo de pagos activo |
| `supabase_anon_key` | `{"token": "<anon>"}` | ✅ Sembrada en esta sesión |
| `public_app_base_url` | `https://crm-innovar-app-2026.vercel.app` | ✅ |

---

## Próximos pasos

1. **Robert:** Crear/aprobar `visit_assigned_admin_v1` en Meta BM (ver arriba)
2. **Robert:** Cuando todo esté OK → cambiar `wa_test_phone_override` a `null` para envío real a clientes
3. **Opcional:** Limpiar datos de smoke test (cliente `smoke.test.innovar@test.com` si se creó)
4. **Push:** `git push origin ux-fixes` cuando se confirmen los fixes en producción
