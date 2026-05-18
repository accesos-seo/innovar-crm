# 🗄️ Modelo de Datos — Innovar CRM

> Referencia completa de las **18 tablas** de Supabase. Léelo cuando trabajes con datos.
>
> **Proyecto Supabase**: `xdzbjptozeqcbnaqhtye`
> **Schema completo**: [`../supabase_schema.sql`](../supabase_schema.sql)

---

## 🗺️ Mapa de relaciones

```
        auth.users (Supabase)
              │
              ▼
         profiles ◄──────────────────────────────────┐
              │                                       │
              │ created_by / designer_id / etc.      │
              ▼                                       │
          clients ◄────── projects ──────► quotations │
              │              │                │       │
              │              │                ▼       │
              │              │         quotation_items│
              │              ▼                        │
              │           payments ──────────────────┤
              │           expenses ──────────────────┤
              │           accounting_closures ───────┤
              │           tasks ◄── task_comments    │
              │              │ ◄── task_attachments  │
              └──► notifications ◄──────────────────┘

   Catálogos (sin relaciones FK):
        materials, pricing_catalog, holidays, system_dictionary

   Integración WhatsApp:
        notification_queue ──► meta_whatsapp_status_events
```

---

## 📋 Índice de tablas

| Categoría | Tablas |
|---|---|
| **Identidad** | [`profiles`](#profiles) |
| **Negocio** | [`clients`](#clients), [`projects`](#projects), [`quotations`](#quotations), [`quotation_items`](#quotation_items) |
| **Finanzas** | [`payments`](#payments), [`expenses`](#expenses), [`accounting_closures`](#accounting_closures) |
| **Operación** | [`tasks`](#tasks), [`task_comments`](#task_comments), [`task_attachments`](#task_attachments) |
| **Catálogos** | [`materials`](#materials), [`pricing_catalog`](#pricing_catalog), [`holidays`](#holidays), [`system_dictionary`](#system_dictionary) |
| **Notificaciones** | [`notifications`](#notifications), [`notification_queue`](#notification_queue), [`meta_whatsapp_status_events`](#meta_whatsapp_status_events) |

---

## 🔐 `profiles`

**Propósito**: extiende `auth.users` con info de negocio (nombre, rol, foto). Se crea automáticamente al registrarse un usuario en Supabase Auth.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | Mismo ID que `auth.users.id` |
| `full_name` | TEXT | Nombre del usuario |
| `email` | TEXT | Espejo de `auth.users.email` |
| `avatar_url` | TEXT | URL de foto de perfil |
| `role` | TEXT | `super_admin` / `admin` / `comercial` / `disenador` / `jefe_taller` / `operario` |
| `phone` | TEXT | Opcional |
| `is_active` | BOOLEAN | Soft-disable. Default `true` |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto |

**RLS**:
- SELECT: cualquier autenticado puede ver perfiles
- INSERT: solo puede crear el suyo (`id = auth.uid()`)
- UPDATE: el dueño o un admin
- DELETE: solo admin

**Trigger especial**: `on_auth_user_created` en `auth.users` crea un perfil automáticamente al registrarse.

> ⚠️ **Bug histórico**: el trigger (`handle_new_user`) asigna `role: 'admin'` por defecto a usuarios nuevos. Esto es un riesgo de escalada de privilegios. El frontend (`authStore.ts`) ya se corrigió en Fase 1 para asignar `'comercial'`. **Pendiente**: migración SQL para corregir el trigger.

---

## 👥 `clients`

**Propósito**: directorio único de clientes. **También sirve como leads** (solicitudes que aún no son clientes formales) — `useLeads` y `useClients` consultan la misma tabla.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | Nombre completo |
| `email` | TEXT | Opcional |
| `whatsapp_phone` | TEXT | Canal principal de contacto |
| `address` | TEXT | Dirección física |
| `notes` | TEXT | Texto libre |
| `data_origin` | TEXT | `'manual'` / `'system'` / `'whatsapp'` |
| `created_by` | UUID FK→profiles | Quién lo creó |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

**RLS**: acceso completo para autenticados.

> 💡 **Decisión histórica**: leads y clientes son la misma entidad. Un "lead" es solo un cliente sin proyectos asociados. Pendiente para Fase 2 evaluar si separar en tablas distintas.

---

## 📦 `projects`

**Propósito**: el corazón del negocio. Cada proyecto representa un encargo: cocina, closet, puerta, centro de TV.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `tracking_token` | TEXT UNIQUE | Token público para que el cliente vea su proyecto sin login |
| `client_id` | UUID FK→clients | El dueño |
| `approved_quotation_id` | UUID FK→quotations | Cotización que originó el proyecto |
| `designer_id` | UUID FK→profiles | Diseñador asignado |
| `created_by` | UUID FK→profiles | Quien creó el proyecto |
| `accounting_closure_id` | UUID | Si ya se cerró contablemente |
| `name` | TEXT NOT NULL | Nombre interno |
| `work_type` | TEXT NOT NULL | `cocina` / `closet` / `puertas` / `centro_tv` |
| `status` | TEXT | Ver tabla de estados abajo |
| `total_amount` | NUMERIC(14,2) | Valor total del contrato |
| `advance_amount` | NUMERIC(14,2) | Anticipo recibido |
| `client_approved_at` | TIMESTAMPTZ | Fecha de aprobación del cliente |
| `client_approval_notes` | TEXT | Comentarios del cliente al aprobar |
| `design_deadline` | DATE | Fecha límite de diseño |
| `design_delivered_at` | TIMESTAMPTZ | Cuándo se entregó el diseño |
| `initial_measurements` | JSONB | Mediciones iniciales (`{ancho_pared_a, ancho_pared_b, altura, ...}`) |
| `design_3d_files` | JSONB | Array de archivos 3D: `[{url, nombre, version, subido_en, subido_por}]` |
| `despiece_files` | JSONB | Array de archivos de despiece (corte CNC, optimización) |
| `modelado_approved_at` | TIMESTAMPTZ | Aprobación del modelado |
| `renders_approved_at` | TIMESTAMPTZ | Aprobación de renders |
| `modelado_revision_number` | INTEGER | Contador de revisiones de modelado |
| `render_revision_number` | INTEGER | Contador de revisiones de renders |
| `estimated_install_date` | DATE | Fecha estimada de instalación |
| `scheduled_install_date` | DATE | Fecha confirmada de instalación |
| `install_duration_days` | INTEGER | Días estimados de instalación |
| `delivered_at` | TIMESTAMPTZ | Fecha de entrega final |
| `quotation_pdf_url` | TEXT | URL del PDF de la cotización aprobada |
| `is_archived` | BOOLEAN | Default `false`. Archivados no aparecen en listados |
| `skip_design_process` | BOOLEAN | Si el proyecto salta el flujo de diseño |
| `data_origin` | TEXT | `'manual'` / `'system'` |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | |

### Estados del proyecto (`status`)

```
contacto → medicion_tomada → cotizacion_enviada → cotizacion_aprobada
        → en_diseno → modelado_listo → renders_listos → aprobacion_cliente
        → en_produccion → instalacion_programada → instalando → entregado → garantia
```

**RLS**: acceso completo para autenticados (las restricciones por rol se hacen en el frontend, pendiente revisar para Fase 2).

---

## 📋 `quotations`

**Propósito**: cotizaciones que se envían al cliente. Una cotización puede convertirse en proyecto al ser aprobada.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `quotation_number` | TEXT UNIQUE | `COT-2026-0042` — generado por RPC atómico (ver Fase 1) |
| `client_id` | UUID FK→clients | El cliente al que se le cotiza |
| `project_id` | UUID FK→projects | Opcional — proyecto resultante si fue aprobada |
| `status` | TEXT | `draft` / `sent` / `viewed` / `negotiation` / `approved` / `rejected` / `expired` / `replaced` |
| `total_amount` | NUMERIC(14,2) | Total final |
| `subtotal` | NUMERIC(14,2) | Antes de descuentos y transporte |
| `discount_type` | TEXT | `'percent'` / `'fixed'` / `'none'` |
| `discount_value` | NUMERIC(14,2) | Valor del descuento |
| `transport_cost` | NUMERIC(14,2) | Costo de transporte |
| `notes` | TEXT | Notas internas |
| `is_locked` | BOOLEAN | Si está aprobada, no se puede editar |
| `version_number` | INTEGER | Para versionado de revisiones |
| `parent_quotation_id` | UUID FK→quotations | Si es una revisión, apunta a la anterior |
| `is_historical_copy` | BOOLEAN | Copia inmutable para auditoría |
| `valid_until` | DATE | Vencimiento de la oferta |
| `created_by` | UUID FK→profiles | Quien la creó |
| `created_at` / `updated_at` / `deleted_at` | | |

> 🔑 **`quotation_number`** se genera vía la función Postgres `generate_next_quotation_number()` (ver `db/migrations/001_*.sql`). **Nunca generes este número en cliente.**

---

## 🛒 `quotation_items`

**Propósito**: líneas (ítems) de cada cotización.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `quotation_id` | UUID FK→quotations | CASCADE DELETE |
| `description` | TEXT NOT NULL | Nombre del ítem |
| `quantity` | NUMERIC(10,2) | Cantidad |
| `unit_price` | NUMERIC(14,2) | Precio unitario |
| `calculated_total` | NUMERIC(14,2) | `quantity × unit_price - descuentos` |
| `product_category` | TEXT | Categoría (cocina_base, mesones, herrajes, etc.) |
| `base_catalog_id` | UUID | Referencia al `pricing_catalog.id` original |
| `configuration` | JSONB | Configuración del ítem (medidas, color, etc.) |
| `created_at` / `updated_at` | | |

---

## 💰 `payments`

**Propósito**: pagos recibidos del cliente.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID FK→projects | Proyecto al que se aplica |
| `client_id` | UUID FK→clients NOT NULL | Quién pagó |
| `amount` | NUMERIC(14,2) NOT NULL | Monto |
| `payment_method` | TEXT NOT NULL | `efectivo` / `transferencia` / `credito` / `cheque` / `nequi` / `daviplata` / `pse` |
| `payment_type` | TEXT NOT NULL | `anticipo` / `abono` / `pago_final` / `reembolso` |
| `received_at` | TIMESTAMPTZ NOT NULL | Fecha del pago |
| `receipt_url` | TEXT | URL del comprobante (storage bucket `task-attachments`) |
| `registered_by` | UUID FK→profiles | Quien lo registró |
| `notes` | TEXT | |
| `created_at` | | |

---

## 🧾 `expenses`

**Propósito**: gastos asociados a proyectos o generales.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID FK→projects | Si aplica a un proyecto |
| `client_id` | UUID FK→clients | Si aplica a un cliente |
| `category` | TEXT NOT NULL | `materiales` / `operativo` / `nomina` / `transporte` / `herramientas` / `servicios_publicos` / `arriendo` / `subcontrato` / `otro` |
| `amount` | NUMERIC(14,2) NOT NULL | |
| `expense_date` | DATE NOT NULL | |
| `receipt_url` | TEXT | |
| `description` | TEXT NOT NULL | |
| `registered_by` | UUID FK→profiles | |
| `approved_by` | UUID FK→profiles | Si se aprobó, quien lo hizo |
| `approval_status` | TEXT | `pendiente` / `aprobado` / `rechazado` |
| `notes` | TEXT | |
| `created_at` / `updated_at` | | |

---

## 📊 `accounting_closures`

**Propósito**: cierre contable de un proyecto al finalizar. Calcula utilidad y margen.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID FK→projects NOT NULL | |
| `closed_by` | UUID FK→profiles | |
| `closure_date` | DATE NOT NULL | |
| `total_income` | NUMERIC(14,2) | Suma de `payments` del proyecto |
| `total_expenses` | NUMERIC(14,2) | Suma de `expenses` del proyecto |
| `net_profit` | NUMERIC(14,2) | `total_income - total_expenses` |
| `profit_margin` | NUMERIC(5,2) | Porcentaje |
| `notes` | TEXT | |
| `status` | TEXT | `draft` / `closed` / `reviewed` |
| `created_at` / `updated_at` | | |

> 💡 Cuando se cierra contablemente un proyecto, su `accounting_closure_id` apunta aquí. La función RPC `get_financial_summary()` agrega todos los cierres.

---

## ✅ `tasks`

**Propósito**: tareas internas y citas de agenda. **Una sola tabla** sirve para ambos casos:
- Si `appointment_type IS NULL` → es una tarea normal (Kanban)
- Si `appointment_type IS NOT NULL` → es una cita de agenda

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID FK→projects | |
| `client_id` | UUID FK→clients | |
| `assigned_to` | UUID FK→profiles | A quién |
| `created_by` | UUID FK→profiles | Quien creó |
| `title` | TEXT NOT NULL | |
| `description` | TEXT | |
| `status` | TEXT | `pendiente` / `en_progreso` / `en_revision` / `bloqueado` / `completado` / `cancelado` |
| `priority` | INTEGER | `0`=normal, `1`=alta, `2`=urgente |
| `due_date` | DATE | |
| `time_slot` | TEXT | Para citas: `'09:00'`, `'14:30'`, etc. |
| `appointment_type` | TEXT | `visita_tecnica` / `cita_diseno` / `null` (si es tarea) |
| `task_category` | TEXT | `cita` / `operativa` / `diseno` / `produccion` / `administrativa` / `seguimiento` |
| `kanban_order` | INTEGER | Posición dentro de una columna Kanban |
| `tags` | TEXT[] | Tags arbitrarios |
| `estimated_hours` / `actual_hours` | NUMERIC(5,2) | |
| `completed_at` | TIMESTAMPTZ | |
| `created_at` / `updated_at` | | |

---

## 💬 `task_comments`

**Propósito**: comentarios en una tarea.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `task_id` | UUID FK→tasks | CASCADE DELETE |
| `author_id` | UUID FK→profiles | |
| `content` | TEXT NOT NULL | |
| `created_at` / `updated_at` | | |

---

## 📎 `task_attachments`

**Propósito**: archivos adjuntos a una tarea (también almacenan recibos de payments/expenses por convención).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `task_id` | UUID FK→tasks | CASCADE DELETE |
| `uploaded_by` | UUID FK→profiles | |
| `file_name` | TEXT NOT NULL | |
| `file_url` | TEXT NOT NULL | URL al storage bucket `task-attachments` |
| `file_size` | INTEGER | En bytes |
| `mime_type` | TEXT | |
| `created_at` | | |

> 🪣 **Storage**: el bucket `task-attachments` también guarda comprobantes de pagos y gastos bajo `receipts/payments/*` y `receipts/expenses/*`.

---

## 📚 `materials` (Catálogo)

**Propósito**: catálogo de herrajes, accesorios y materiales para usar en cotizaciones.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `category` | TEXT NOT NULL | `cocinas` / `closets` / `puertas` / `herrajes` / `accesorios` / `otros` |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `"photoUrl"` | TEXT | ⚠️ camelCase entre comillas |
| `price` | NUMERIC(14,2) | |
| `unit` | TEXT | `unidad` / `par` / `metro` / `ml` / `lámina` |
| `active` | BOOLEAN | Si aparece en el cotizador |
| `"sortOrder"` | INTEGER | Orden en el catálogo |
| `brand` | TEXT | Marca |
| `stock` | INTEGER | Inventario actual |
| `created_at` / `updated_at` | | |

> ⚠️ Columnas en **camelCase** (`photoUrl`, `sortOrder`) requieren comillas dobles en SQL. Es una inconsistencia con el resto del schema (snake_case). Mantener por compatibilidad — revisar para Fase 2.

---

## 💲 `pricing_catalog` (Tarifario)

**Propósito**: precios base para construir cotizaciones automáticamente.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `category` | TEXT NOT NULL | `cocina_base` / `mesones` / `muebles_especiales` / `extras` / `puertas_tapas` / `herrajes` / `closets` / `puertas_producto` / `centros_tv` / `otros` / `acabados_especiales` |
| `code` | TEXT | Código corto: `CB-001`, `MS-001` |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `value` | NUMERIC(14,2) | Precio |
| `unit` | TEXT | `ml` (metro lineal), `pieza`, etc. |
| `"previousValue"` | NUMERIC(14,2) | Histórico anterior para mostrar cambio |
| `"lastUpdated"` | DATE | Última actualización del precio |
| `created_at` / `updated_at` | | |

---

## 📅 `holidays`

**Propósito**: días festivos en Colombia para cálculos de plazos (no se cuentan como días hábiles).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `date` | DATE NOT NULL | |
| `name` | TEXT NOT NULL | "Día del Trabajo", "Lunes de Pascua", etc. |
| `year` | INTEGER NOT NULL | Redundante con `date` pero útil para queries |
| `created_at` | | |

---

## 📖 `system_dictionary`

**Propósito**: documenta los componentes del sistema (buckets, edge functions, triggers, crons) para que el equipo sepa qué existe y qué hace cada uno.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `category` | TEXT NOT NULL | `BUCKET` / `EDGE_FUNCTION` / `DB_TRIGGER` / `CRON_JOB` |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `trigger_event` | TEXT | Evento que dispara (si aplica) |
| `status` | TEXT | `active` / `inactive` |
| `created_at` / `updated_at` | | |

---

## 🔔 `notifications`

**Propósito**: notificaciones in-app para un usuario específico.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK→profiles NOT NULL | Destinatario |
| `title` | TEXT NOT NULL | |
| `body` | TEXT | |
| `is_read` | BOOLEAN | Default `false` |
| `related_table` | TEXT | Ej: `'projects'` |
| `related_id` | UUID | El ID en esa tabla |
| `notification_type` | TEXT NOT NULL | `booking_new` / `booking_reminder` / `booking_completed` / `booking_cancelled` / `project_status` / `system` |
| `priority` | INTEGER | 0=normal, 1=alta, 2=urgente |
| `action_url` | TEXT | URL a la que llevar al hacer click |
| `created_at` | | |

**RLS estricta**: cada usuario **solo ve sus propias notificaciones** (`user_id = auth.uid()`).

---

## 📨 `notification_queue`

**Propósito**: cola de mensajes de WhatsApp por enviar (vía Meta Cloud API).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `event_type` | TEXT NOT NULL | Tipo de evento (ej: `booking_confirmation`) |
| `recipient_name` | TEXT | |
| `recipient_phone` | TEXT NOT NULL | E.164 |
| `template_name` | TEXT | Nombre de plantilla aprobada en Meta |
| `template_language` | TEXT | `'es'` |
| `template_parameters` | JSONB | Variables de la plantilla |
| `status` | TEXT | `pending` / `processing` / `sent` / `failed` |
| `delivery_status` | TEXT | Espejo del status de Meta |
| `provider_message_id` | TEXT | ID asignado por Meta |
| `error_message` / `failed_reason` | TEXT | Si falló |
| `attempt_count` | INTEGER | Reintentos |
| `processing_at` / `sent_at` / `failed_at` / `delivered_at` / `read_at` | TIMESTAMPTZ | Timeline |
| `last_delivery_status_at` | TIMESTAMPTZ | |
| `created_at` / `updated_at` | | |

---

## 📡 `meta_whatsapp_status_events`

**Propósito**: eventos de webhook que Meta envía sobre los mensajes (entregado, leído, fallido).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `provider_message_id` | TEXT NOT NULL | El ID del mensaje que evento describe |
| `recipient_id` | TEXT | |
| `status` | TEXT | `sent` / `delivered` / `read` / `failed` |
| `status_timestamp` | TIMESTAMPTZ | |
| `raw_payload` | JSONB | El JSON completo del webhook |
| `errors` | JSONB | Si hubo errores |
| `conversation` | JSONB | Info de conversación (Meta) |
| `pricing` | JSONB | Costo del mensaje según Meta |
| `created_at` | | |

---

## 🔧 Funciones RPC en Postgres

| Función | Descripción |
|---|---|
| `get_my_role()` | Retorna el rol del usuario autenticado. Usada en políticas RLS. |
| `update_updated_at_column()` | Trigger function para actualizar `updated_at` automáticamente. |
| `handle_new_user()` | Trigger function que crea un `profile` al registrarse un usuario. ⚠️ Asigna rol `'admin'` por defecto — bug pendiente. |
| `generate_next_quotation_number()` | Genera el siguiente `COT-{year}-{seq}` de forma atómica. Aplicada en Fase 1. |
| `get_financial_summary(p_date_from, p_date_to)` | Agrega ingresos, gastos y utilidad neta en un rango. |

---

## ⚠️ Inconsistencias conocidas

1. **camelCase en columnas**: `materials.photoUrl`, `materials.sortOrder`, `pricing_catalog.previousValue`, `pricing_catalog.lastUpdated`. Requiere comillas en SQL. Inconsistente con el resto. Pendiente Fase 2.
2. **`role: 'admin'` por defecto** en el trigger `handle_new_user`. Riesgo de privilegios. Pendiente migración de fix.
3. **RLS permisiva** en la mayoría de tablas: `USING (true)`. No diferencia roles. Pendiente Fase 2 reforzar políticas por rol.
4. **`clients` sirve para leads y clientes**: un lead es un cliente sin proyectos. Decisión pendiente para Fase 2 sobre separación.
5. **`tasks` sirve para tareas y citas**: distinción por `appointment_type IS NULL`. Funciona pero confunde.

---

## 🆕 Cómo agregar una tabla nueva

1. **Diseña el SQL** en un archivo `db/migrations/00X_create_<tabla>.sql`
2. **Documéntala aquí** con el mismo formato
3. **Aplica la migración** en Supabase SQL Editor
4. **Habilita RLS** y define políticas
5. **Regenera los tipos**: `npx supabase gen types typescript --project-id xdzbjptozeqcbnaqhtye > src/types/database.types.ts`
6. **Crea el hook** siguiendo el patrón de [`CONVENTIONS.md`](./CONVENTIONS.md#2-cómo-escribir-un-hook-de-datos)
7. **Si aplica**, crea schema Zod en `src/schemas/`
