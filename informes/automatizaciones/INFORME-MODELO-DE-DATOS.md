# Modelo de Datos — Innovar CRM

**Para**: Equipo técnico del cliente / Auditoría
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Este documento describe **la estructura de datos del sistema Innovar CRM**: las tablas que existen, qué guarda cada una, cómo se relacionan entre sí y qué reglas de integridad están aplicadas.

Es la referencia para auditoría técnica, integración con otros sistemas, o entender qué información está disponible para reportes.

---

## 1. Mapa de tablas por dominio

### 1.1 Dominio Comercial
- `clients` — clientes y leads
- `quotations` — cotizaciones
- `quotation_items` — líneas de cada cotización

### 1.2 Dominio Operativo / Proyectos
- `projects` — proyectos en ejecución
- `project_photos` — fotos por etapa del proyecto
- `tasks` — tareas operativas
- `task_comments` — comentarios en tareas
- `task_attachments` — archivos adjuntos

### 1.3 Dominio Financiero
- `payments` — pagos recibidos
- `expenses` — gastos del proyecto
- `accounting_closures` — cierres contables por proyecto

### 1.4 Dominio de Agenda
- `availability_slots` — slots de disponibilidad por staff
- `holidays` — días festivos
- `calendar_sync_queue` — cola de sincronización con Google Calendar

### 1.5 Dominio de Configuración
- `profiles` — perfiles de usuarios (extiende auth.users)
- `materials` — catálogo de materiales/insumos
- `pricing_catalog` — catálogo de precios
- `system_dictionary` — inventario interno del sistema
- `bucket_dictionary` — diccionario de buckets de storage

### 1.6 Dominio de Comunicaciones
- `notification_queue` — cola de notificaciones (WhatsApp principal)
- `notifications` — notificaciones in-app
- `meta_whatsapp_status_events` — webhooks recibidos del proveedor Meta
- `whatsapp_message_log` — log histórico de mensajes

### 1.7 Dominio Post-Venta
- `warranties` — garantías de proyectos entregados
- `warranty_claims` — reclamos sobre garantías
- `satisfaction_surveys` — encuestas de satisfacción

### 1.8 Dominio de Sistema / Auditoría
- `audit_log` — bitácora detallada de cambios
- `audit_logs` — bitácora simplificada (legacy / paralela)
- `scheduled_job_log` — log de cron jobs
- `automation_project_docs` — documentación del proyecto de automatización
- `pdf_generation_queue` — cola de PDFs por generar

---

## 2. Diagrama conceptual de relaciones principales

```
                          [auth.users]
                                ↓
                          [profiles]
                          /         \
                         /           \
              [clients]                [projects.designer_id]
                  ↓                          ↑
              [quotations]                   ↑
              /      \                       ↑
[quotation_items]   [pdf_generation_queue]   ↑
                                             ↑
              [quotations.id]→[projects.approved_quotation_id]
                                  ↓
                            [projects]
                            /    |    \
                           /     |     \
                    [payments] [expenses] [tasks]
                              ↓        ↓     ↓
                  [accounting_closures]  [project_photos]
                                            ↓
                                      [task_comments]
                                      [task_attachments]
                                            ↓
                                   [calendar_sync_queue]
                                            ↓
                                   [availability_slots]
                                            ↑
                                       [holidays]
                                       
                            [projects] (al entregar)
                                ↓
                          ┌──────┴──────┐
                          ↓              ↓
                    [warranties] [satisfaction_surveys]
                          ↓
                  [warranty_claims]

                            
                       [notification_queue]
                              ↓ (cron job)
                       [Edge: WhatsApp]
                              ↓
                  [meta_whatsapp_status_events]
                  
                                
                       [TODO]
                         ↓ (triggers de auditoría)
                       [audit_log]
```

---

## 3. Detalle por tabla (las principales)

### 3.1 `clients` (11 registros)
Almacena tanto leads como clientes (la diferencia es el estado).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text NOT NULL | Nombre completo |
| `whatsapp_phone` | text | Formato E.164 esperado |
| `email` | text | Opcional |
| `address` | text | Dirección |
| `city` | text | Ciudad |
| `services` | text | Servicios de interés (texto libre) |
| `status` | varchar | PENDING / CONTACTED / QUALIFIED / CONVERTED |
| `urgency` | varchar | Nivel de urgencia |
| `assigned_to` | uuid | FK → profiles |
| `assigned_at` | timestamptz | Cuándo se asignó |
| `converted_to_id` | uuid | FK → al cliente convertido (si aplica) |
| `lead_score` | smallint | 0-100, calculado automáticamente |
| `lead_score_details` | jsonb | Desglose del score |
| `lead_scored_at` | timestamptz | Última actualización del score |
| `created_at` | timestamptz | Auditoría |
| `updated_at` | timestamptz | Auditoría |
| `deleted_at` | timestamptz | Soft delete |

### 3.2 `quotations` (9 registros)
Cotizaciones con versionado y lock post-aprobación.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid NOT NULL | FK → clients |
| `quotation_number` | text UNIQUE | COT-YYYY-NNNN |
| `total_amount` | numeric | Monto total |
| `subtotal` | numeric | Antes de descuento y transporte |
| `discount_type` | text | percent / fixed / none |
| `discount_value` | numeric | Valor del descuento |
| `transport_cost` | numeric DEFAULT 600000 | Costo de transporte |
| `status` | enum quotation_status | draft / sent / approved / rejected / expired |
| `is_locked` | bool | True tras aprobación |
| `notes` | text | Notas internas |
| `version_number` | int | Versión secuencial |
| `parent_quotation_id` | uuid | FK → quotation original (si es versión) |
| `is_historical_copy` | bool | True si es versión histórica |
| `valid_until` | timestamptz | Default now() + 30 days |
| `deleted_at` | timestamptz | Soft delete |

### 3.3 `quotation_items`
Líneas de detalle de la cotización.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `quotation_id` | uuid NOT NULL | FK → quotations |
| `description` | text NOT NULL | Descripción del ítem |
| `quantity` | numeric | Cantidad |
| `unit_price` | numeric | Precio unitario |
| `product_category` | text | cocina/closet/etc. |
| `configuration` | jsonb | Config detallada del producto |

### 3.4 `projects` (7 registros)
Proyectos en ejecución desde aprobación hasta entrega.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid NOT NULL | FK → clients |
| `approved_quotation_id` | uuid | FK → quotations |
| `name` | text | Nombre del proyecto |
| `work_type` | enum work_type | cocina/closet/mesones/etc. |
| `status` | enum project_status | contacto → garantía |
| `designer_id` | uuid | FK → profiles (diseñador asignado) |
| `created_by` | uuid | FK → profiles |
| `tracking_token` | uuid UNIQUE | Para acceso público al estado |
| `total_amount` | numeric | Monto del proyecto |
| `advance_amount` | numeric | Anticipo |
| `client_approved_at` | timestamptz | Cuándo aprobó el cliente |
| `design_deadline` | timestamptz | Plazo de diseño |
| `design_delivered_at` | timestamptz | Entrega del diseño |
| `initial_measurements` | jsonb | Mediciones iniciales |
| `design_3d_files` | jsonb | Array de archivos 3D con versiones |
| `despiece_files` | jsonb | Archivos de fabricación |
| `estimated_install_date` | timestamptz | Fecha estimada |
| `scheduled_install_date` | timestamptz | Fecha agendada |
| `delivered_at` | timestamptz | Entrega real |
| `modelado_approved_at` | timestamptz | Aprobación de modelado |
| `renders_approved_at` | timestamptz | Aprobación de renders |
| `render_revision_number` | int | Contador de revisiones |
| `quotation_pdf_url` | text | URL del PDF |
| `is_archived` | bool | True si archivado |
| `data_origin` | text | system / manual |
| `accounting_closure_id` | uuid | FK → cierre contable |
| `deleted_at` | timestamptz | Soft delete |

### 3.5 `tasks`
Tareas operativas con kanban y agenda.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → projects |
| `client_id` | uuid | FK → clients (si aplica) |
| `assigned_to` | uuid | FK → profiles |
| `created_by` | uuid | FK → profiles |
| `title` | text NOT NULL | Título de la tarea |
| `description` | text | Detalle |
| `status` | enum task_status | pendiente/en_progreso/bloqueada/completada |
| `priority` | smallint | 0-5 |
| `task_category` | enum task_category | operativa, etc. |
| `due_date` | date | Fecha de vencimiento |
| `appointment_type` | text | Tipo de cita (si es booking) |
| `time_slot` | time | Hora del día |
| `kanban_order` | int | Orden en el kanban |
| `completed_at` | timestamptz | Cuándo se completó |
| `tags` | text[] | Etiquetas |
| `estimated_hours` | numeric | Horas estimadas |
| `actual_hours` | numeric | Horas reales |

### 3.6 `payments`
Pagos recibidos de clientes.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → projects |
| `client_id` | uuid | FK → clients |
| `amount` | numeric NOT NULL | Monto |
| `payment_method` | enum payment_method | efectivo/transferencia/etc. |
| `payment_type` | text | anticipo/saldo/etc. |
| `received_at` | timestamptz | Cuándo se recibió |
| `notes` | text | Notas |
| `registered_by` | uuid | FK → profiles |
| `receipt_url` | text | Comprobante adjunto |

### 3.7 `expenses`
Gastos del proyecto con flujo de aprobación.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → projects |
| `client_id` | uuid | FK → clients |
| `category` | enum expense_category | Tipo de gasto |
| `amount` | numeric NOT NULL | Monto |
| `expense_date` | date | Fecha del gasto |
| `receipt_url` | text | Comprobante |
| `description` | text | Detalle |
| `approval_status` | text | pendiente/aprobado/rechazado |
| `registered_by` | uuid | FK → profiles (solicitante) |
| `approved_by` | uuid | FK → profiles (aprobador) |
| `notes` | text | Notas |

### 3.8 `notification_queue` (6 registros)
Cola central de notificaciones (WhatsApp principalmente).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `event_type` | text | Tipo de evento que disparó |
| `event_reference_id` | text | ID del evento origen |
| `entity_type` | text | Entidad afectada (project/client/etc.) |
| `entity_reference_id` | text | ID de la entidad |
| `recipient_type` | text | client/staff |
| `recipient_reference_id` | text | ID del destinatario |
| `recipient_name` | text | Nombre |
| `recipient_phone` | text NOT NULL | Teléfono destino |
| `channel` | text DEFAULT 'whatsapp' | Canal |
| `provider` | text DEFAULT 'meta_whatsapp' | Proveedor |
| `template_name` | text NOT NULL | Plantilla |
| `template_language` | text DEFAULT 'es' | Idioma |
| `template_parameters` | jsonb | Parámetros |
| `payload` | jsonb | Payload completo |
| `status` | text | pending/processing/sent/failed/skipped |
| `delivery_status` | text | accepted/sent/delivered/read/failed |
| `provider_message_id` | text | ID del mensaje en Meta |
| `provider_response` | jsonb | Respuesta del proveedor |
| `webhook_payload` | jsonb | Payload del webhook |
| `error_message` | text | Mensaje de error |
| `attempt_count` | int | Reintentos |
| `created_at` | timestamptz | |
| `processing_at` | timestamptz | |
| `sent_at` | timestamptz | |
| `failed_at` | timestamptz | |
| `delivered_at` | timestamptz | |
| `read_at` | timestamptz | |

### 3.9 `audit_log` (162 registros)
Bitácora detallada de cambios.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → profiles |
| `action` | text NOT NULL | INSERT/UPDATE/DELETE |
| `table_name` | text NOT NULL | Tabla afectada |
| `record_id` | uuid NOT NULL | ID del registro |
| `old_data` | jsonb | Datos antes del cambio |
| `new_data` | jsonb | Datos después del cambio |
| `created_at` | timestamptz | Cuándo ocurrió |

### 3.10 `pricing_catalog` (60 registros)
Catálogo central de precios consumido por los motores server-side.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `code` | text UNIQUE NOT NULL | Código único (ej. TV_BASE_PRICE) |
| `name` | text NOT NULL | Nombre humano |
| `category` | text NOT NULL | tv_center/closet/mesones/etc. |
| `description` | text | Descripción del precio |
| `value` | numeric | Precio actual |
| `unit` | text | unidad / ml / m2 / proyecto |
| `previousValue` | numeric | Precio anterior (histórico) |
| `lastUpdated` | date | Última actualización |

### 3.11 `profiles` (2 registros)
Perfiles de usuarios extendiendo auth.users.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK (= auth.users.id) |
| `email` | text NOT NULL | Email |
| `full_name` | text NOT NULL | Nombre completo |
| `role` | enum user_role | admin/comercial/diseno/produccion |
| `is_active` | bool DEFAULT true | Activo |
| `avatar_url` | text | URL de avatar |
| `notification_preferences` | jsonb | Preferencias |

---

## 4. Tipos enumerados (USER-DEFINED enums)

Estos tipos están definidos a nivel base de datos. Cambiar sus valores requiere migración SQL.

### `user_role`
- `admin`
- `comercial`
- `diseno`
- `produccion`

### `project_status`
- `contacto`, `cotizacion_aprobada`, `diseño`, `modelado`, `renders`, `produccion`, `instalacion`, `entregado`, `garantia`

### `quotation_status`
- `draft`, `sent`, `approved`, `rejected`, `expired`

### `task_status`
- `pendiente`, `en_progreso`, `bloqueada`, `completada`

### `task_category`
- `operativa`, otros definidos en enum

### `work_type`
- Tipos de proyecto cotizable (cocina, closet, etc.)

### `payment_method`
- Métodos de pago

### `expense_category`
- Categorías de gasto

### `project_stage`
- Etapas de foto del proyecto (modelado, renders, instalación, etc.)

---

## 5. Llaves foráneas críticas

Relaciones que mantienen la integridad referencial del sistema.

| Tabla | FK | Apunta a | Comportamiento |
|---|---|---|---|
| `clients.assigned_to` | uuid | `profiles.id` | Comercial asignado |
| `quotations.client_id` | uuid | `clients.id` | NOT NULL |
| `quotation_items.quotation_id` | uuid | `quotations.id` | NOT NULL |
| `projects.client_id` | uuid | `clients.id` | NOT NULL |
| `projects.approved_quotation_id` | uuid | `quotations.id` | Vincula proyecto a cotización |
| `projects.designer_id` | uuid | `profiles.id` | Vía constraint `projects_designer_id_fkey` |
| `projects.accounting_closure_id` | uuid | `accounting_closures.id` | Cierre asociado |
| `payments.project_id` | uuid | `projects.id` | |
| `payments.client_id` | uuid | `clients.id` | |
| `expenses.project_id` | uuid | `projects.id` | |
| `expenses.approved_by` | uuid | `profiles.id` | |
| `tasks.project_id` | uuid | `projects.id` | |
| `tasks.assigned_to` | uuid | `profiles.id` | |
| `accounting_closures.project_id` | uuid | `projects.id` | NOT NULL |
| `warranties.project_id` | uuid | `projects.id` | NOT NULL |
| `warranty_claims.warranty_id` | uuid | `warranties.id` | NOT NULL |
| `audit_log.user_id` | uuid | `profiles.id` | Quién hizo el cambio |
| `profiles.id` | uuid | `auth.users.id` | Extensión del sistema auth |

---

## 6. Constraints de integridad (CHECK)

### Severidad de reclamos
- `warranty_claims.severity`: solo acepta `low`, `medium`, `high`, `critical`

### Calificaciones de encuesta
- `satisfaction_surveys.rating_*`: rango 1-5 con CHECK
- 4 dimensiones: overall, quality, punctuality, service

### Estados de jobs
- `scheduled_job_log.status`: running/success/error
- `pdf_generation_queue.status`: pending/processing/done/failed
- `calendar_sync_queue.status`: pending/synced/failed/skipped
- `calendar_sync_queue.action`: create/update/delete
- `notification_queue.status`: pending/processing/sent/failed/skipped
- `notification_queue.delivery_status`: accepted/sent/delivered/read/failed
- `whatsapp_message_log.status`: queued/sent/failed
- `warranties.status`: active/expired/claimed/voided
- `warranty_claims.status`: open/in_progress/resolved/rejected
- `satisfaction_surveys.status`: pending/sent/responded/expired

### Otros
- `accounting_closures.status`: draft/closed/reviewed
- `expenses.approval_status`: pendiente/aprobado/rechazado
- `quotations.discount_type`: percent/fixed/none
- `system_dictionary.category`: BUCKET/EDGE_FUNCTION/DB_TRIGGER/CRON_JOB

---

## 7. Soft deletes

Las siguientes tablas usan `deleted_at` (timestamptz NULL) para borrado lógico:

- `clients`
- `quotations`
- `projects`

Esto permite recuperar registros eliminados accidentalmente y mantiene la integridad histórica de auditoría.

---

## 8. Campos automáticos comunes

Casi todas las tablas tienen:

- `id` (uuid PK con default `gen_random_uuid()`)
- `created_at` (timestamptz NOT NULL DEFAULT now())
- `updated_at` (timestamptz NOT NULL DEFAULT now(), actualizado por triggers `set_updated_at`)

Esto garantiza que **toda fila pueda ser ordenada cronológicamente** y rastreada.

---

## 9. Volumen actual de datos

| Tabla | Registros | Volumen |
|---|---:|---|
| `audit_log` | 162 | Alto (creciendo) |
| `pricing_catalog` | 60 | Estable |
| `system_dictionary` | 20 | Bajo |
| `meta_whatsapp_status_events` | 18 | Bajo (creciendo) |
| `holidays` | 18 | Estable |
| `clients` | 11 | Bajo |
| `quotations` | 9 | Bajo |
| `projects` | 7 | Bajo |
| `notification_queue` | 6 | Variable (procesado cada min) |
| `calendar_sync_queue` | 5 | Variable |
| `audit_logs` | 3 | Bajo (legacy/duplicado) |
| `profiles` | 2 | Estable |
| `materials` | 0 | **Pendiente cargar** |
| `pdf_generation_queue` | 0 | Variable |
| `scheduled_job_log` | 0 | Variable |

---

## 10. Capacidades transversales del modelo

### 10.1 Histórico completo
- Todas las tablas críticas tienen `created_at`, `updated_at`
- Soft deletes preservan datos eliminados
- Auditoría con `old_data` y `new_data` permite reconstruir cualquier estado pasado

### 10.2 Trazabilidad de archivos
- URLs persistentes en Supabase Storage
- Buckets segmentados por tipo de contenido
- JSONB para arrays de archivos con metadata

### 10.3 Configurabilidad
- Enums controlados a nivel base de datos (no se aceptan valores fuera de la lista)
- CHECKs como segunda línea de defensa
- Defaults sensatos (timestamps, status iniciales, transport_cost, valid_until)

### 10.4 Integraciones externas
- `provider_message_id` en notification_queue para tracking en Meta
- `google_event_id` en calendar_sync_queue para tracking en Google
- `tracking_token` en projects para acceso público sin auth

---

## 11. Recomendaciones para evolución del modelo

| Tema | Recomendación |
|---|---|
| Duplicado de auditoría | Consolidar `audit_log` y `audit_logs` en una sola tabla |
| Campo `data_origin` en projects | Verificar si la columna existe en producción (riesgo de bug `data_origin` documentado) |
| Sincronizar schema local | Regenerar `db/supabase_schema.sql` desde producción para reflejar 100% el modelo actual |
| Índices | Verificar índices sobre campos de filtro frecuente (status, fechas, FK) para performance |
| Particionamiento | Si `audit_log` crece mucho, considerar particionar por mes |
| Tabla `materials` vacía | Cargar inventario inicial de materiales |

---

## Conclusión

Innovar CRM tiene un modelo de datos **bien estructurado y normalizado**, con relaciones claras entre dominios, integridad referencial enforced por la base de datos, y mecanismos de auditoría y soft delete que protegen la información histórica.

El modelo está diseñado para **escalar con el negocio** sin necesidad de re-arquitectura, y soporta tanto las operaciones diarias como reportes complejos y exportaciones a sistemas externos (contabilidad, BI, etc.).

---

*Documento de modelo de datos generado el 19 de mayo de 2026 a partir del schema completo de producción.*
