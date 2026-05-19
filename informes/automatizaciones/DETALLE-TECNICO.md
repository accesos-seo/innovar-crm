# Detalle Técnico de Automatizaciones — Innovar CRM

**Audiencia**: equipo técnico (devs, DBAs, soporte)
**Fecha**: 19 de mayo de 2026
**Fuente**: inspección directa de `information_schema.triggers`, `information_schema.routines` y `cron.job` en producción.

---

## 1. Triggers de base de datos (50 únicos)

Los triggers están agrupados por tabla. Cada uno se dispara automáticamente ante INSERT/UPDATE/DELETE sobre su tabla.

### 1.1 Tabla `clients` (7 triggers)

| Trigger | Evento | Momento | Función llamada | Descripción |
|---|---|---|---|---|
| `tr_on_new_lead_email` | INSERT | AFTER | `fn_trigger_welcome_email` | Envía email de bienvenida al nuevo lead |
| `trg_audit_clients` | INSERT, UPDATE | AFTER | `audit_trigger_fn` | Registra cambios en `audit_log` |
| `trg_client_lead_score` | INSERT, UPDATE | AFTER | `fn_trigger_lead_score` | Calcula score de calidad del lead |
| `trg_clients_updated_at` | UPDATE | BEFORE | `update_updated_at` | Mantiene timestamp `updated_at` |
| `trg_enqueue_whatsapp_new_lead` | INSERT | AFTER | `fn_enqueue_whatsapp_new_lead` | Encola mensaje WhatsApp avisando al equipo del nuevo lead |

### 1.2 Tabla `expenses` (5 triggers)

| Trigger | Evento | Momento | Función llamada |
|---|---|---|---|
| `trg_audit_expenses` | INSERT, UPDATE | AFTER | `audit_trigger_fn` |
| `trg_expenses_updated_at` | UPDATE | BEFORE | `update_updated_at` |
| `trg_notify_expense_pending` | INSERT | AFTER | `notify_expense_pending` |
| `trg_notify_expense_reviewed` | UPDATE | AFTER | `notify_expense_reviewed` |

### 1.3 Tabla `holidays` (1 trigger)

| Trigger | Evento | Función llamada | Descripción |
|---|---|---|---|
| `tr_block_slots_after_holiday_insert` | INSERT | `fn_block_slots_on_holiday` | Bloquea automáticamente los slots de agenda del día festivo |

### 1.4 Tabla `notification_queue` (1 trigger)

| Trigger | Evento | Función |
|---|---|---|
| `trg_notification_queue_updated_at` | UPDATE BEFORE | `set_notification_queue_updated_at` |

### 1.5 Tabla `payments` (5 triggers)

| Trigger | Evento | Función | Descripción |
|---|---|---|---|
| `trg_after_payment_insert` | INSERT AFTER | `check_and_update_project_status_on_payment` | Avanza el estado del proyecto si el pago cubre un hito |
| `trg_audit_payments` | INSERT, UPDATE | `audit_trigger_fn` | Auditoría |
| `trg_notify_payment_received` | INSERT AFTER | `notify_payment_received` | Notifica al cliente por WhatsApp |
| `trigger_handle_payment_approval` | INSERT AFTER | `handle_payment_approval` | Lógica de aprobación del pago |

### 1.6 Tabla `profiles` (3 triggers)

| Trigger | Evento | Función | Descripción |
|---|---|---|---|
| `set_updated_at` | UPDATE BEFORE | `update_updated_at` | Timestamp |
| `trg_prevent_non_admin_profile_role_change` | UPDATE BEFORE | `prevent_non_admin_profile_role_change` | **Seguridad**: bloquea cambios de rol por no-admins |
| `trg_profiles_updated_at` | UPDATE BEFORE | `update_updated_at` | Timestamp duplicado |

### 1.7 Tabla `projects` (8 triggers)

| Trigger | Evento | Función | Descripción |
|---|---|---|---|
| `trg_audit_projects` | INSERT, UPDATE | `audit_trigger_fn` | Auditoría |
| `trg_auto_post_delivery` | UPDATE AFTER | `fn_auto_post_delivery` | Acciones automáticas al marcar como entregado |
| `trg_create_project_starter_tasks` | INSERT AFTER | `create_project_starter_tasks` | Crea tareas iniciales estándar del proyecto |
| `trg_project_status_notification` | UPDATE AFTER | `notify_project_status_change` | Notifica cambios de estado |
| `trg_projects_updated_at` | UPDATE BEFORE | `update_updated_at` | Timestamp |
| `trg_wa_project_status_change` | UPDATE AFTER | `fn_wa_project_status_change` | Notifica por WhatsApp cambios de estado al cliente |
| `trigger_notify_production.` | UPDATE AFTER | _(nombre con punto al final — posible bug a corregir)_ | Notifica al equipo de producción |

### 1.8 Tabla `quotation_items` (9 triggers)

| Trigger | Evento | Función | Descripción |
|---|---|---|---|
| `trg_audit_quotation_items` | INSERT, UPDATE | `audit_trigger_fn` | Auditoría |
| `trg_prevent_changes_on_finalized_quotation_items` | INSERT, UPDATE, DELETE BEFORE | `prevent_changes_on_finalized_quotation_items` | **Lock anti-manipulación** de cotizaciones aprobadas |
| `trg_quotation_items_updated_at` | UPDATE BEFORE | `update_updated_at` | Timestamp |
| `trg_recalculate_quotation_totals` | INSERT, UPDATE, DELETE AFTER | `handle_quotation_item_totals_change` → `recalculate_quotation_totals` | Recalcula subtotal y total de la cotización |

### 1.9 Tabla `quotations` (9 triggers)

| Trigger | Evento | Función | Descripción |
|---|---|---|---|
| `trg_audit_quotations` | INSERT, UPDATE | `audit_trigger_fn` | Auditoría |
| `trg_create_project_from_approved_quotation` | UPDATE AFTER | `create_project_from_approved_quotation` | Crea proyecto al aprobar la cotización |
| `trg_pdf_on_quotation_status` | UPDATE AFTER | `fn_queue_pdf_generation` | Encola generación de PDF |
| `trg_quotation_lead_score` | INSERT, UPDATE | `fn_trigger_lead_score_on_quotation` | Re-calcula score del lead asociado |
| `trg_quotations_updated_at` | UPDATE BEFORE | `update_updated_at` | Timestamp |
| `trg_wa_quotation_expiry` | INSERT, UPDATE AFTER | `fn_wa_quotation_expiry_alert` | Alerta WhatsApp por vencimiento próximo |

### 1.10 Tabla `task_comments` (1 trigger)

| Trigger | Evento | Función |
|---|---|---|
| `trg_notify_task_comment` | INSERT AFTER | `notify_task_comment` |

### 1.11 Tabla `tasks` (16 triggers — la más automatizada)

| Trigger | Evento | Función | Descripción |
|---|---|---|---|
| `trg_audit_tasks` | INSERT, UPDATE | `audit_trigger_fn` | Auditoría |
| `trg_book_task_availability` | INSERT, UPDATE, DELETE AFTER | `sync_task_availability_booking` | Reserva/libera slot de agenda del responsable |
| `trg_calendar_sync_insert` | INSERT AFTER | `fn_queue_calendar_sync` | Encola sync con Google Calendar |
| `trg_calendar_sync_update` | UPDATE AFTER | `fn_queue_calendar_sync` | Idem |
| `trg_calendar_sync_delete` | DELETE AFTER | `fn_queue_calendar_sync` | Idem |
| `trg_notify_booking_created` | INSERT AFTER | `notify_booking_created` | Notifica creación de reserva |
| `trg_notify_booking_status` | UPDATE AFTER | `notify_booking_status_change` | Notifica cambio de estado de reserva |
| `trg_notify_task_assigned` | INSERT, UPDATE AFTER | `notify_task_assigned` | WhatsApp al asignar tarea |
| `trg_notify_task_blocked` | UPDATE AFTER | `notify_task_blocked` | Notifica al bloquearse |
| `trg_notify_task_completed` | UPDATE AFTER | `notify_task_completed` | Notifica al completarse |
| `trg_tasks_updated_at` | UPDATE BEFORE | `update_updated_at` | Timestamp |
| `trg_wa_appointment_booked` | INSERT AFTER | `fn_wa_appointment_booked` | WhatsApp al cliente confirmando cita |

### 1.12 Tablas `warranties` y `warranty_claims` (2 triggers)

| Trigger | Evento | Función |
|---|---|---|
| `trg_warranties_updated_at` | UPDATE BEFORE | `update_updated_at` |
| `trg_warranty_claims_updated_at` | UPDATE BEFORE | `update_updated_at` |

---

## 2. Funciones SQL (51 funciones)

Agrupadas por propósito.

### 2.1 Funciones de auditoría
- `audit_trigger_fn` — núcleo del sistema de auditoría (alimenta `audit_log`)

### 2.2 Funciones de notificación (handlers de triggers)
- `notify_booking_created`
- `notify_booking_status_change`
- `notify_expense_pending`
- `notify_expense_reviewed`
- `notify_payment_received`
- `notify_project_status_change`
- `notify_task_assigned`
- `notify_task_blocked`
- `notify_task_comment`
- `notify_task_completed`
- `enqueue_notification` — utility que encola un mensaje en `notification_queue`
- `send_whatsapp_notification` — envía vía edge function

### 2.3 Funciones de WhatsApp específicas
- `fn_enqueue_whatsapp_new_lead`
- `fn_wa_appointment_booked`
- `fn_wa_project_status_change`
- `fn_wa_quotation_expiry_alert`
- `normalize_whatsapp_phone` — utility para formato E.164

### 2.4 Funciones de lead scoring
- `calculate_lead_score` — calcula score numérico del lead
- `fn_trigger_lead_score` — handler en trigger de clients
- `fn_trigger_lead_score_on_quotation` — handler en trigger de quotations

### 2.5 Funciones de cotización
- `generate_next_quotation_number` — numeración atómica anti-colisión (RPC desde frontend)
- `recalculate_quotation_totals` — recalcula totales tras cambios en items
- `handle_quotation_item_totals_change` — trigger handler
- `create_quotation_version` — versionado de cotizaciones
- `prevent_changes_on_finalized_quotation_items` — bloqueo post-aprobación
- `fn_queue_pdf_generation` — encola PDF en `pdf_generation_queue`

### 2.6 Funciones de proyecto
- `create_project_from_approved_quotation` — conversión cotización → proyecto
- `create_project_starter_tasks` — tareas iniciales del proyecto
- `fn_auto_post_delivery` — acciones tras entrega
- `check_and_update_project_status_on_payment` — avance por pago

### 2.7 Funciones de pago
- `handle_payment_approval`

### 2.8 Funciones de agenda y calendario
- `book_appointment` — reservar cita (RPC desde frontend)
- `get_available_slots` — consultar disponibilidad (RPC desde frontend)
- `sync_task_availability_booking` — handler de reserva en triggers
- `fn_block_slots_on_holiday` — bloquea slots al agregar festivo
- `fn_queue_calendar_sync` — encola sync Google Calendar

### 2.9 Funciones de auth y seguridad
- `get_my_role` — utility usado en RLS policies
- `handle_new_user` — crea profile al registrar usuario en `auth.users`
- `prevent_non_admin_profile_role_change` — bloqueo anti-escalada

### 2.10 Funciones financieras / contabilidad
- `create_accounting_closure` — cierre contable de proyecto
- `get_financial_summary` — resumen financiero (RPC)
- `get_project_balance` — saldo por proyecto (RPC)
- `generate_weekly_report` — reporte semanal

### 2.11 Funciones de jobs / mantenimiento (probablemente cron)
- `escalate_overdue_and_blocked_tasks`
- `run_daily_task_escalation`
- `run_payment_reminders`
- `run_archive_inactive_projects`
- `generate_weekly_report`

### 2.12 Funciones utility
- `update_updated_at` — timestamp helper
- `set_notification_queue_updated_at` — timestamp específico
- `reorder_kanban` — reordenar tarjetas kanban (RPC)
- `fn_trigger_welcome_email` — handler del trigger de bienvenida

---

## 3. Cron Jobs (Postgres `pg_cron`)

### 3.1 Job activo confirmado

| Jobid | Cadencia | Acción | Estado |
|---|---|---|---|
| **2** | `* * * * *` (cada minuto) | POST a edge function `process-whatsapp-notifications` con `{dry_run: false, limit: 25}` | activo |

```sql
SELECT net.http_post(
  url := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/process-whatsapp-notifications',
  headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <anon-key>'),
  body := jsonb_build_object('dry_run', false, 'limit', 25)
);
```

### 3.2 Funciones que sugieren cron jobs no inventariados

Las siguientes funciones SQL tienen prefijo `run_*` lo cual sugiere que están diseñadas para ser ejecutadas en cron, pero la query a `cron.job` solo retornó 1 job. Conviene verificar si están programadas en Supabase Studio (Scheduled Functions) en lugar de `pg_cron`:

- `run_daily_task_escalation` — esperable cadencia diaria
- `run_payment_reminders` — esperable cadencia diaria
- `run_archive_inactive_projects` — esperable cadencia semanal/mensual
- `generate_weekly_report` — esperable cadencia semanal

**Acción recomendada**: revisar Supabase Studio → Database → Cron Jobs y Edge Functions → Scheduled.

---

## 4. Edge Functions

### 4.1 Confirmada por cron job
- **`process-whatsapp-notifications`** — endpoint POST que consume `notification_queue`, envía vía Meta WhatsApp API, actualiza estado en la cola.

### 4.2 Inferidas por queues y triggers (pendiente confirmar en Dashboard)

| Edge Function (probable) | Evidencia |
|---|---|
| `generate-quotation-pdf` | La tabla `pdf_generation_queue` con estados `pending/processing/done/failed` indica que algo consume esa cola y produce un PDF |
| `sync-google-calendar` | La tabla `calendar_sync_queue` con acciones `create/update/delete` y `google_event_id` indica un sincronizador |
| `whatsapp-webhook` | La tabla `meta_whatsapp_status_events` recibe eventos del proveedor — debe haber un endpoint público que reciba estos webhooks (18 eventos almacenados) |
| `send-welcome-email` | El trigger `tr_on_new_lead_email` apunta a `fn_trigger_welcome_email`; probablemente esa función invoca una edge function para SMTP |

**Acción pendiente**: completar inventario revisando https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/functions

---

## 5. Colas de procesamiento (4 tablas)

| Tabla | Estado actual | Procesador | Estados posibles |
|---|---:|---|---|
| `notification_queue` | 6 pendientes | Cron job 2 / `process-whatsapp-notifications` (cada minuto) | pending, processing, sent, failed, skipped |
| `pdf_generation_queue` | 0 | Edge function inferida `generate-quotation-pdf` | pending, processing, done, failed |
| `calendar_sync_queue` | 5 pendientes | Edge function inferida `sync-google-calendar` | pending, synced, failed, skipped |
| `scheduled_job_log` | 0 logs históricos | Logs de cron jobs `run_*` | running, success, error |

---

## 6. Tablas de auditoría (2 sistemas paralelos)

| Tabla | Registros | Propósito |
|---|---:|---|
| `audit_log` | 162 | Bitácora detallada con `old_data`/`new_data` JSONB (alimentado por `audit_trigger_fn`) |
| `audit_logs` | 3 | Bitácora simplificada con `changesSummary` (parece más reciente, posible duplicado o legacy) |

**Acción recomendada**: revisar si `audit_logs` está siendo escrito por código separado o si es una migración no terminada de uno hacia el otro. Consolidar a una sola tabla.

---

## 7. Webhooks entrantes (1 sistema)

- **`meta_whatsapp_status_events`** — 18 eventos almacenados. Recibe callbacks del API de Meta WhatsApp con cambios de estado de los mensajes (delivered, read, failed). Almacena el payload crudo en `raw_payload` JSONB.

---

## 8. Hallazgos técnicos / mejoras sugeridas

### 8.1 Detalles a revisar
- **Trigger `trigger_notify_production.`** tiene un punto al final del nombre — posible bug de tipeo en el CREATE TRIGGER.
- **Duplicado de timestamp** en `profiles`: existen `set_updated_at` y `trg_profiles_updated_at` que hacen lo mismo. Conviene consolidar a uno.
- **Dos tablas de auditoría** (`audit_log` y `audit_logs`) — clarificar cuál es la oficial.

### 8.2 Inventario incompleto
- La tabla `system_dictionary` (20 filas según conteo previo) debería ser el inventario oficial pero no contiene las 50 reglas activas. Pendiente sincronizar.

### 8.3 Documentación a generar (próximos pasos)
- Lista oficial de Edge Functions (completar desde Dashboard)
- Diagramas de flujo de los principales procesos automáticos
- Métricas: cuántos eventos al día procesa cada cola

---

## 9. Referencias

- Schema completo: `db/supabase_schema.sql` (en repo, **desactualizado** — regenerar con `supabase db dump`)
- Proyecto Supabase: https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye
- Edge Functions: https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/functions
- Cron Jobs: https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/database/cron-jobs

---

*Informe técnico generado el 19 de mayo de 2026 a partir de inspección directa de `information_schema` y `cron.job` en producción.*
