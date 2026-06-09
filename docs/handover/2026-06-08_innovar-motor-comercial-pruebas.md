# Handoff — Innovar CRM: Plan de pruebas Motor Comercial paso a paso
**Fecha:** 2026-06-08  
**Rama activa:** `ux-fixes`  
**Proyecto:** `D:\Agents-automations\04-Innovar`  
**Supabase:** `xdzbjptozeqcbnaqhtye`  
**App local:** `localhost:3000` (Vite dev server)  
**Motor Comercial:** `localhost:3000/motor-comercial`

---

## 1. Contexto

Innovar Cocinas Integrales es un CRM para una empresa de cocinas y muebles a medida. El **Motor Comercial** es el pipeline central del sistema: 9 fases automáticas desde que llega un lead hasta la entrega de producción. Cada fase tiene automatizaciones conectadas (WhatsApp, asignaciones, recordatorios). El objetivo de esta sesión es **analizar el flujo completo, identificar qué automatización corresponde a qué fase, y construir un plan de pruebas paso a paso** que Robert pueda ejecutar de forma controlada.

---

## 2. Estado actual

### WhatsApp — TODO LISTO ✅

| Plantilla | Vars | Uso | Estado Meta |
|---|---|---|---|
| `welcome_lead_v1` | 1 | Bienvenida al lead nuevo | ✅ Aprobada 2026-06-08 |
| `booking_link_v1` | 3 | Link de agendamiento de visita | ✅ Aprobada 2026-06-08 |
| `visit_assigned_admin_v1` | 4 | Visita asignada al técnico | En registro |
| `visit_reminder_24h_internal_v1` | 5 | Recordatorio 24h al equipo | ✅ Aprobada 2026-06-08 |
| `visit_reminder_2h_client_v1` | 2 | Recordatorio 2h al cliente | ✅ Aprobada 2026-06-08 |
| `visit_reminder_2h_internal_v1` | 4 | Recordatorio 2h al equipo | ✅ Aprobada 2026-06-08 |
| `quotation_sent_v1` | 3 | Cotización enviada al cliente | ✅ Aprobada |
| `quotation_v2_sent_v1` | 3 | Cotización revisada enviada | ✅ Aprobada |
| `admin_quotation_accepted_v1` | 3 | Admin: cliente aceptó | ✅ Aprobada |
| `admin_quotation_adjustments_v1` | 4 | Admin: cliente pide ajustes | ✅ Aprobada |
| `admin_quotation_rejected_v1` | 4 | Admin: cliente rechazó | ✅ Aprobada |
| `admin_quotation_expired_v1` | 4 | Admin: cotización vencida | ✅ Aprobada |
| `payment_request_v1` | 5 | Datos bancarios al aceptar | ✅ Aprobada 2026-06-08 |
| `quotation_reactivation_admin_v1` | 3 | Admin: cliente solicita reactivación | ✅ Aprobada 2026-06-08 |
| `payment_proof_rejected_v1` | 4 | Comprobante rechazado | ✅ Aprobada |
| `project_assigned_designer_v1` | 3 | Diseñador asignado al proyecto | ✅ Aprobada |
| `project_fully_paid_v1` | 2 | Proyecto 100% pagado | ✅ Aprobada |

**Edge Function:** `process-whatsapp-notifications` — desplegada 2026-06-08 con todos los templates.  
**Commit más reciente:** `4b976c9` (rama `ux-fixes`)

### Modo prueba activo 🔒

```
system_settings.wa_test_phone_override = '3183061286'
```

**CRÍTICO:** Todos los WhatsApp se envían ÚNICAMENTE al número de Robert (+573183061286), sin importar qué cliente o destinatario esté registrado en el sistema. Esta restricción vive en la base de datos y puede desactivarse eliminando ese setting cuando se pase a producción real. **No enviar a ningún número de cliente real mientras esta fase sea de pruebas.**

### Slice 3 desactivado 🔴

```
system_settings.slice_3_enabled = 'false'
```

El flujo de cotización → aprobación → pago → proyecto está intencionalmente DESACTIVADO. Los pasos 6-9 del Motor Comercial no disparan automáticamente. Para probarlos, Robert debe dar aprobación explícita y activar el flag. **No activar sin su instrucción directa.**

---

## 3. El Motor Comercial — 9 fases y sus automatizaciones

```
localhost:3000/motor-comercial
```

| Fase | Nombre | WA que dispara | Trigger |
|---|---|---|---|
| 1 | Captura | `welcome_lead_v1` → al cliente | INSERT en `clients` (trigger DB) |
| 2 | Contacto | (asignación round-robin, sin WA propio) | Override: `override_comercial_id` = Álvaro |
| 3 | Visita | `booking_link_v1` → al cliente / `visit_assigned_admin_v1` → al técnico | Acción manual del comercial |
| 3→ | Recordatorios | `visit_reminder_24h_internal_v1` + `visit_reminder_2h_client_v1` + `visit_reminder_2h_internal_v1` | Cron DB (`visit-reminders-24h-internal` 9am COT, `visit-reminders-2h` c/30min) |
| 4 | Medidas | (sin WA automatizado en estado actual) | Manual |
| 5 | Cotización | `quotation_sent_v1` → cliente | RPC `send_quotation` (Slice 3 desactivado) |
| 6 | Aprobación | `admin_quotation_accepted/adjustments/rejected_v1` | Acción cliente en URL pública `/cotizacion/:token` |
| 6→ | Pago | `payment_request_v1` → cliente (datos bancarios) | Trigger al aceptar cotización |
| 7 | Pago | `payment_proof_rejected_v1` si se rechaza / `project_fully_paid_v1` si OK | Admin verifica comprobante |
| 8 | Proyecto | `project_assigned_designer_v1` → diseñador | Verificación de pago completo |
| 9 | Producción | (sin WA automatizado en estado actual) | Manual |

---

## 4. Lo que la IA debe hacer en esta sesión

**OBJETIVO:** Acompañar a Robert en las pruebas del flujo completo, fase por fase, asegurando que cada automatización funciona antes de pasar a la siguiente.

### Instrucciones para la IA

1. **Leer primero** el código de las siguientes áreas antes de proponer cualquier prueba:
   - `src/hooks/useOpportunities.ts` — cómo se crea un lead y se dispara `welcome_lead_v1`
   - `supabase/functions/process-whatsapp-notifications/index.ts` — engine de envío WA
   - `db/migrations/026_visit_whatsapp_triggers.sql` — lógica de recordatorios de visita
   - `db/migrations/034_phase4_public_quotation_rpcs.sql` — RPC de cotización
   - `db/migrations/035_phase4_lock_and_sync_triggers.sql` — trigger `payment_request_v1`

2. **Proponer un plan de pruebas** con estos criterios:
   - Una prueba por fase, en orden (1 → 5 primero, luego 6-9 cuando Robert lo autorice)
   - Para cada prueba: qué acción hace Robert en la UI, qué mensaje WhatsApp debe llegar, cómo verificar que el registro en DB quedó correcto
   - Si una prueba requiere SQL de soporte (forzar un cron, crear un registro de prueba), preparar el SQL listo para pegar — sin ejecutarlo hasta que Robert lo apruebe
   - Identificar si hay algo roto o incompleto antes de que Robert empiece a probar

3. **No ejecutar nada** sin que Robert lo confirme explícitamente. El rol es de guía y verificador, no de ejecutor autónomo.

4. **Verificar después de cada prueba** consultando la `notification_queue` para confirmar que el mensaje llegó con status `sent`. Comando de ejemplo:
   ```sql
   SELECT template_name, status, recipient_name, sent_at, error_message
   FROM public.notification_queue
   ORDER BY created_at DESC LIMIT 10;
   ```
   Ejecutar vía Management API (ver referencia abajo).

---

## 5. Próximos pasos concretos (orden recomendado)

- [ ] **Analizar** los archivos listados en §4 punto 1 para mapear el flujo actual
- [ ] **Detectar** si hay gaps: fases sin automatización que deberían tenerla, o triggers que podrían fallar
- [ ] **Presentar** plan de pruebas completo a Robert para su aprobación
- [ ] **Fase 1 — Captura:** Robert crea un lead de prueba → verificar `welcome_lead_v1` llega a +573183061286
- [ ] **Fase 3 — Visita:** Robert agenda una visita → verificar `booking_link_v1` + recordatorios
- [ ] **Fase 4 — Medidas:** verificar qué registra el sistema (sin WA actualmente)
- [ ] **Fase 5 — Cotización:** requiere activar `slice_3_enabled` → pedir aprobación explícita de Robert primero
- [ ] **Fases 6-9:** ídem, requieren `slice_3_enabled = TRUE` + aprobación Robert

---

## 6. Referencias clave

### Código
- `D:\Agents-automations\04-Innovar\src\hooks\useOpportunities.ts` — hook principal de leads
- `D:\Agents-automations\04-Innovar\supabase\functions\process-whatsapp-notifications\index.ts` — EF WA
- `D:\Agents-automations\04-Innovar\db\migrations\026_visit_whatsapp_triggers.sql` — triggers de visita
- `D:\Agents-automations\04-Innovar\db\migrations\034_phase4_public_quotation_rpcs.sql` — RPC cotización
- `D:\Agents-automations\04-Innovar\db\migrations\035_phase4_lock_and_sync_triggers.sql` — trigger payment_request

### Supabase — queries via Management API
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
  -H "Authorization: Bearer [SUPABASE_ACCESS_TOKEN del .env]" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT ... "}'
```
Token en: `D:\Agents-automations\04-Innovar\.env` → clave `SUPABASE_ACCESS_TOKEN`

### Settings críticos en system_settings
```sql
-- Ver todos los settings
SELECT key, value FROM public.system_settings ORDER BY key;

-- Modo prueba (activo)
-- wa_test_phone_override = '3183061286'  → todos los WA van al número de Robert

-- Slice 3 (inactivo)
-- slice_3_enabled = 'false'  → flujo cotización/pago desactivado

-- Para activar Slice 3 cuando Robert lo apruebe:
-- UPDATE public.system_settings SET value = 'true' WHERE key = 'slice_3_enabled';
```

### Forzar crons manualmente (para probar recordatorios sin esperar)
```sql
-- Recordatorio 24h interno (forzar)
SELECT public.enqueue_visit_reminders_24h_internal();

-- Recordatorio 2h dual cliente+equipo (forzar)
SELECT public.enqueue_visit_reminders_2h();
```

### Número de prueba
- **Robert (único destino válido):** `+573183061286`
- NO enviar a ningún otro número mientras `wa_test_phone_override` esté activo

### App
- Local: `localhost:3000` (Vite, no usar `npm run dev` en OneDrive — usar `vite preview` sobre build)
- Motor Comercial: `localhost:3000/motor-comercial`

### Git
- Rama: `ux-fixes` en `D:\Agents-automations\04-Innovar`
- Remote: `accesos-seo/innovar-crm`
- Último commit: `4b976c9` — modo prueba WA

---

## 7. Restricciones importantes

1. **No activar `slice_3_enabled`** sin instrucción explícita de Robert
2. **No eliminar `wa_test_phone_override`** — todos los mensajes deben seguir yendo solo al número de Robert
3. **No hacer git push** sin que Robert lo solicite
4. **No deployar a Vercel** — hay un problema de conexión (Vercel apunta a `Rvirona/CRM-INNOVAR-APP:main`, no al repo correcto)
5. **No enviar WhatsApp a clientes reales** — todos los datos en la DB son de prueba
6. Cualquier SQL que modifique datos de producción → presentar primero a Robert para aprobación
