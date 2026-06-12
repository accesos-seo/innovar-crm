# Informe de Configuración Administrativa — Innovar CRM

**Para**: Cliente Innovar / Administrador del sistema
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Este documento es la **referencia completa de todo lo que se puede configurar y personalizar** en Innovar CRM desde la sección de Configuración. Cubre el panel administrativo, los catálogos editables, los estados predefinidos del negocio, los parámetros operativos y los buckets de almacenamiento.

Es el manual de referencia del administrador del sistema.

---

## 1. Panel de Configuración del sistema

El menú "Configuración" del sistema incluye las siguientes secciones:

### 1.1 Usuarios (`/settings/users`)
- **Acceso**: solo Administradores y Super Administradores
- **Permite**: crear, editar, activar/desactivar usuarios; asignar y modificar roles
- **Roles disponibles**: admin, comercial, diseño, producción
- **Estado actual**: 2 usuarios activos en el sistema
- **Protección**: el sistema impide que un usuario se cambie a sí mismo a un rol superior

### 1.2 Auditoría del Sistema (`/settings/audit`)
- **Acceso**: solo Administradores y Super Administradores
- **Permite**: consultar bitácora completa de cambios (162 eventos registrados)
- **Filtros disponibles**: por usuario, tabla, fecha, tipo de acción
- **Datos registrados por evento**: usuario, fecha/hora, tabla afectada, registro, valores antes y después

### 1.3 Notificaciones WhatsApp (`/settings/whatsapp`)
- **Acceso**: todos los roles autenticados
- **Permite**: ver historial de mensajes enviados, su estado, eventos de delivery
- **Procesar manualmente**: forzar el procesamiento de la cola de mensajes pendientes
- **Estado actual**: 6 mensajes en cola activa, 18 eventos de confirmación procesados

### 1.4 Materiales e Insumos (`/settings/materials`)
- **Acceso**: todos los roles autenticados (edición restringida a Admin)
- **Permite**: catálogo de materiales con foto, descripción, precio, unidad, stock
- **Categorías disponibles**: cocinas, closets, puertas, herrajes, accesorios, otros
- **Estado activo/inactivo**: permite descontinuar materiales sin eliminarlos
- **Orden de presentación**: configurable (campo `sortOrder`)
- **Estado actual**: **0 materiales cargados (pendiente carga inicial del inventario)**

### 1.5 Tarifas y Precios (`/settings/pricing`)
- **Acceso**: todos los roles autenticados (edición restringida a Admin)
- **Permite**: editar precios unitarios del catálogo activo
- **Historial automático**: cada cambio guarda el precio anterior en `previousValue` y la fecha en `lastUpdated`
- **Estado actual**: **60 entradas activas** distribuidas en 6 categorías

### 1.6 Días Festivos (`/settings/holidays`)
- **Acceso**: todos los roles autenticados (edición restringida a Admin)
- **Permite**: registrar festivos por fecha, nombre y año
- **Efecto automático**: al agregar un festivo, **todos los slots de agenda de ese día quedan bloqueados** sin intervención manual
- **Estado actual**: **18 festivos configurados**

### 1.7 Parámetros (`/settings/parameters`)
- Sección para parámetros operativos generales del negocio (tasas, plazos, configuraciones globales)

### 1.8 Notificaciones (`/settings/notifications`)
- Configuración de preferencias de notificación por usuario
- Cada perfil tiene `notification_preferences` JSONB con flags como `nuevos_proyectos: true`, `alertas_inventario: true`

### 1.9 Mantenimiento (`/settings/maintenance`)
- **Acceso**: solo Administradores y Super Administradores
- **Permite**: ejecutar tareas de mantenimiento del sistema, limpiezas programadas, reprocesos

### 1.10 Diccionario del Sistema (`/admin/dictionary`)
- **Acceso**: solo Administradores y Super Administradores
- **Permite**: documentar internamente los componentes del sistema (edge functions, triggers, cron jobs, buckets)
- **Categorías**: BUCKET, EDGE_FUNCTION, DB_TRIGGER, CRON_JOB
- **Estado actual**: 20 entradas documentadas

---

## 2. Categorías de productos cotizables (6 categorías)

El sistema cuenta con motores de cálculo dedicados para 6 categorías de productos:

| Código interno | Producto | Subcategorías / opciones | Entradas en catálogo |
|---|---|---|---:|
| `cocina` | Cocinas integrales | Bases, altos, islas, descuentos | Multiples |
| `closet` | Closets a medida | Estándar (0.60m), Especial (0.45m), Empotrado Premium | 3 |
| `tv_center` | Centro de TV | Acabado alto brillo, LED, repisas, espacios para equipos | 7 |
| `especiales` | Acabados Especiales | Puertas en perfilería aluminio con vidrio ahumado | 4 |
| `puerta` (singular) | Puertas Interiores | Batiente / Corrediza, rangos 50-85cm y 85-110cm | 5 |
| `mesones` | Mesones | Granito, cuarzo, sinterizado — con barra, isla, lavaplatos | 4 |
| `puertas` (plural, legacy) | Puertas repuestos de cocina | (categoría histórica mantenida por compatibilidad) | compartido |

**Total entradas en catálogo de precios**: 60.

---

## 3. Estados predefinidos del negocio (categorías "tipo")

El sistema usa estados controlados para cada entidad importante. Estos estados están **predefinidos en el código** y no se pueden modificar por configuración (cambiarlos requiere ajuste de programación):

### 3.1 Estados de Cliente / Lead

| Estado | Significado |
|---|---|
| `PENDING` | Lead recién ingresado, sin contactar |
| `CONTACTED` | El comercial ya tomó primer contacto |
| `QUALIFIED` | Lead calificado, listo para cotizar |
| `CONVERTED` | Convertido en cliente con proyecto activo |

### 3.2 Estados de Cotización

| Estado | Significado |
|---|---|
| `draft` | Borrador en edición |
| `sent` | Enviada al cliente |
| `approved` | Aprobada — dispara creación de proyecto |
| `rejected` | Rechazada por el cliente |
| `expired` | Vencida (>30 días sin aprobación) |

### 3.3 Estados de Proyecto

| Estado | Significado |
|---|---|
| `contacto` | Proyecto recién iniciado |
| `cotizacion_aprobada` | Cotización fue aprobada — proyecto creado automáticamente |
| `diseño` | Fase de diseño 3D en curso |
| `modelado` | Modelado aprobado |
| `renders` | Renders aprobados por cliente |
| `produccion` | En fabricación |
| `instalacion` | En instalación |
| `entregado` | Entrega completada al cliente |
| `garantia` | En período de garantía post-entrega |

### 3.4 Tipos de Trabajo (work_type)

Determina el flujo del proyecto. Tipos disponibles según el catálogo de productos cotizables: cocina, closet, mesones, tv_center, puertas interiores, acabados especiales.

### 3.5 Estados de Tarea

| Estado | Significado |
|---|---|
| `pendiente` | Tarea creada, sin iniciar |
| `en_progreso` | Tarea siendo ejecutada |
| `bloqueada` | Tarea bloqueada (falta info, aprobación, etc.) — dispara notificación |
| `completada` | Tarea finalizada |

### 3.6 Categorías de Tarea

| Categoría | Uso |
|---|---|
| `operativa` | Tareas del día a día del negocio |
| (otras categorías definidas según el enum `task_category`) | |

### 3.7 Métodos de Pago

Tipos disponibles según el enum `payment_method`: efectivo, transferencia, tarjeta, cheque, otro.

### 3.8 Categorías de Gasto

Definidas según el enum `expense_category` en base de datos.

### 3.9 Estados de Aprobación de Gasto

| Estado | Significado |
|---|---|
| `pendiente` | Esperando aprobación del supervisor |
| `aprobado` | Aprobado — notificación automática al solicitante |
| `rechazado` | Rechazado — notificación automática con motivo |

### 3.10 Etapas de Foto del Proyecto (stage)

Tipos definidos en el enum `project_stage` para clasificar fotos por fase del proyecto.

### 3.11 Estados de Garantía

| Estado | Significado |
|---|---|
| `active` | Garantía vigente |
| `expired` | Vencida por tiempo |
| `claimed` | Hay reclamo activo |
| `voided` | Anulada |

### 3.12 Severidad de Reclamo

| Nivel | Uso |
|---|---|
| `low` | Cosmético, no urgente |
| `medium` | Funcional, atender en plazo |
| `high` | Importante, atender pronto |
| `critical` | Crítico, atención inmediata |

### 3.13 Estados de Reclamo

| Estado | Significado |
|---|---|
| `open` | Recién reportado |
| `in_progress` | Siendo atendido |
| `resolved` | Resuelto con notas de resolución |
| `rejected` | Rechazado |

### 3.14 Estados de Encuesta de Satisfacción

| Estado | Significado |
|---|---|
| `pending` | Pendiente de enviar |
| `sent` | Enviada al cliente |
| `responded` | Cliente respondió |
| `expired` | No respondió en el plazo |

### 3.15 Estados de Cierre Contable

| Estado | Significado |
|---|---|
| `draft` | Borrador en revisión |
| `closed` | Cerrado oficialmente |
| `reviewed` | Revisado y validado por gerencia |

---

## 4. Roles del sistema (4 roles predefinidos)

| Rol | Etiqueta interna | Acceso |
|---|---|---|
| Administrador | `admin` | Control total |
| Comercial | `comercial` | Leads, clientes, cotizaciones, pagos |
| Diseño | `diseno` | Proyectos asignados, archivos 3D |
| Producción | `produccion` | Lectura de proyectos + actualizar estado de producción |

Detalle completo en `INFORME-ROLES-Y-PERMISOS.md`.

---

## 5. Estados de cola y procesamiento asíncrono

### 5.1 Cola de Notificaciones WhatsApp (`notification_queue`)

| Estado | Significado |
|---|---|
| `pending` | Mensaje encolado, esperando procesamiento |
| `processing` | Siendo enviado en este momento |
| `sent` | Enviado al proveedor (Meta) exitosamente |
| `failed` | Fallo en el envío — se reintenta |
| `skipped` | Saltado por alguna razón (sin teléfono, etc.) |

### 5.2 Estado de Entrega (delivery_status)

| Estado | Significado |
|---|---|
| `accepted` | Meta aceptó el mensaje |
| `sent` | Salió del proveedor |
| `delivered` | Llegó al teléfono del destinatario |
| `read` | El destinatario lo leyó |
| `failed` | Falló la entrega |

### 5.3 Cola de PDFs (`pdf_generation_queue`)

| Estado | Significado |
|---|---|
| `pending` | PDF solicitado, esperando generación |
| `processing` | Generándose |
| `done` | Listo, URL disponible |
| `failed` | Falló la generación |

### 5.4 Cola de Sincronización Calendar (`calendar_sync_queue`)

| Acción | Significado |
|---|---|
| `create` | Crear evento en Google Calendar |
| `update` | Modificar evento existente |
| `delete` | Eliminar evento |

| Estado | Significado |
|---|---|
| `pending` | Esperando sync |
| `synced` | Sincronizado exitosamente |
| `failed` | Falló la sincronización |
| `skipped` | Saltado |

### 5.5 Log de Cron Jobs (`scheduled_job_log`)

| Estado | Significado |
|---|---|
| `running` | Job en ejecución |
| `success` | Terminó OK |
| `error` | Terminó con error |

---

## 6. Tipos de descuento en cotización

| Tipo | Aplicación |
|---|---|
| `percent` | Descuento porcentual sobre subtotal |
| `fixed` | Descuento de monto fijo |
| `none` | Sin descuento |

---

## 7. Buckets de Almacenamiento (Supabase Storage)

El sistema usa los siguientes buckets para archivos:

| Bucket | Contenido | Acceso |
|---|---|---|
| `avatars` | Fotos de perfil de usuarios | Público |
| `project-3d-files` | Modelos 3D, renders, archivos CAD del proyecto | Privado por proyecto |
| `project-photos` | Fotos por etapa del proyecto | Privado por proyecto |
| `despieces` | Archivos de fabricación / despieces | Privado |
| `payment-receipts` | Comprobantes de pagos | Privado |
| `expense-receipts` | Comprobantes de gastos | Privado |
| `quotation-pdfs` | PDFs de cotizaciones generadas | URL firmada |

El sistema mantiene una tabla `bucket_dictionary` documentando cada bucket con su descripción y nivel de acceso.

---

## 8. Parámetros operativos globales

Estos parámetros están **codificados en el sistema** (algunos editables vía Configuración, otros requieren ajuste técnico):

### 8.1 Cotizaciones
- **Validez por defecto**: 30 días (`valid_until = now() + 30 days`)
- **Transporte por defecto**: $600.000 COP
- **Estado inicial**: `draft`
- **Numeración**: `COT-YYYY-NNNN` con secuencia anti-colisión

### 8.2 Garantías
- **Duración por defecto**: 12 meses post-entrega
- **Estado inicial**: `active`
- **Activación automática**: al marcar proyecto como entregado

### 8.3 Notificaciones WhatsApp
- **Lote por procesamiento**: 25 mensajes por minuto
- **Idioma por defecto**: español (`es`)
- **Canal**: WhatsApp (Meta Business API)
- **Reintentos**: hasta marcar como `failed` definitivo
- **Procesamiento**: cron job cada minuto

### 8.4 Sesiones y seguridad
- **Vencimiento JWT**: 1 hora
- **Refresh automático**: activo
- **Recovery automático**: 3 timeouts en ventana de 30s dispara signOut limpio

### 8.5 Timeouts de red
- **Fetch interno**: 8 segundos
- **Wrapper externo**: 10 segundos
- **Reintentos React Query**: 2 con backoff exponencial (3-10s)

### 8.6 Lead scoring
- **Score por defecto**: 0
- **Rango**: 0-100 (`smallint`)
- **Recalculo automático**: al crear/modificar cliente o cotización asociada

### 8.7 Encuestas de satisfacción
- **Calificaciones**: rango 1-5 en 4 dimensiones (overall, quality, punctuality, service)
- **Pregunta de recomendación**: booleana (would_recommend)
- **Estado inicial**: `pending`

---

## 9. Plantillas de mensaje WhatsApp

El sistema usa **plantillas oficiales aprobadas por Meta** para cada tipo de evento. Las plantillas se referencian en `notification_queue.template_name` y se parametrizan vía `template_parameters` (JSONB).

### Eventos con plantilla configurada (inferidos por triggers activos)

| Evento | Destinatario típico |
|---|---|
| Nuevo lead | Comercial |
| Cotización por vencer | Cliente |
| Pago recibido | Cliente |
| Cita confirmada | Cliente |
| Cambio de estado del proyecto | Cliente |
| Tarea asignada | Responsable interno |
| Encuesta post-entrega | Cliente |

**Nota administrativa**: las plantillas oficiales se configuran y aprueban directamente en el panel de Meta Business Manager. Los nombres exactos viven en `notification_queue.template_name`.

---

## 10. Categorías documentadas en `system_dictionary`

El sistema mantiene un **inventario interno** de sus propios componentes:

| Categoría | Qué inventaria |
|---|---|
| `BUCKET` | Buckets de Supabase Storage configurados |
| `EDGE_FUNCTION` | Edge functions desplegadas |
| `DB_TRIGGER` | Triggers de base de datos |
| `CRON_JOB` | Cron jobs activos |

**Estado actual**: 20 entradas registradas.

---

## 11. Categorías de auditoría

La auditoría registra los siguientes tipos de acción sobre las tablas auditadas:

| Acción | Significado |
|---|---|
| `INSERT` | Creación de un nuevo registro |
| `UPDATE` | Modificación de un registro existente |
| `DELETE` | Eliminación |

**Tablas auditadas automáticamente**:
- clients
- expenses
- payments
- projects
- quotations
- quotation_items
- tasks

**Total eventos registrados**: 162 hasta el corte.

---

## 12. Tablas configurables vs tablas operativas

| Tipo | Tablas | Editables desde Configuración |
|---|---|:---:|
| **Catálogos editables** | `materials`, `pricing_catalog`, `holidays` | ✓ |
| **Configuración administrativa** | `profiles`, `system_dictionary`, `bucket_dictionary` | ✓ |
| **Datos operativos** | `clients`, `quotations`, `projects`, `payments`, `expenses`, `tasks` | ✗ (se editan desde sus módulos) |
| **Sistema (auto-generadas)** | `audit_log`, `notification_queue`, `meta_whatsapp_status_events`, queues | ✗ (solo lectura) |

---

## 13. Resumen de elementos configurables

| Elemento | Cantidad actual | Quién puede editar |
|---|---:|---|
| Usuarios | 2 | Admin |
| Roles | 4 (predefinidos) | Codificado |
| Festivos | 18 | Admin |
| Materiales | 0 | Admin |
| Precios | 60 | Admin |
| Plantillas WhatsApp | (configuradas en Meta) | Admin |
| Buckets de storage | 7 | Admin (vía Supabase) |
| Entradas en diccionario interno | 20 | Admin |
| Estados predefinidos por entidad | 15+ tipos | Codificado |
| Categorías de productos | 6 | Codificado |
| Parámetros operativos | 20+ | Mixto (algunos editables, otros codificados) |

---

## 14. Lista de pendientes administrativos

Tareas pendientes detectadas durante esta sesión que requieren atención del administrador:

| Tarea | Prioridad | Esfuerzo |
|---|:---:|---|
| Cargar el catálogo inicial de materiales (`materials` está vacío) | Alta | Carga manual o importación CSV |
| Confirmar lista de Edge Functions vigentes en el Dashboard de Supabase | Media | Revisión visual |
| Completar entradas en `system_dictionary` con los nombres oficiales del negocio | Media | Documentación |
| Verificar que las plantillas WhatsApp estén aprobadas por Meta | Media | Revisión en Meta Business Manager |
| Resolver duplicidad entre `audit_log` y `audit_logs` | Baja | Decisión técnica |
| Reconectar Vercel al repositorio correcto (`accesos-seo/innovar-crm`) | Baja | Configuración Vercel |
| Configurar variables de entorno del server Express (`supabaseUrl` faltante) | Baja | Configuración técnica |

---

## Conclusión

Innovar CRM tiene **10 secciones de configuración**, **60 precios cargados**, **18 festivos activos**, **6 categorías de productos cotizables**, **4 roles diferenciados** y **15+ tipos de estado** del negocio cuidadosamente codificados. El sistema está diseñado para que el administrador pueda **ajustar el negocio sin necesidad de programadores** en lo que respecta a precios, materiales, festivos y usuarios.

Las áreas que pueden personalizarse sin intervención técnica:
- Catálogo de precios
- Catálogo de materiales
- Festivos
- Usuarios y sus roles
- Plantillas WhatsApp (vía Meta Business Manager)

Las áreas que requieren ajuste técnico para cambios:
- Estados predefinidos del negocio
- Categorías de productos (agregar una nueva requiere motor de cálculo nuevo)
- Parámetros del sistema (timeouts, plazos, validez de cotizaciones)
- Plantillas de email

---

*Informe de configuración administrativa generado el 19 de mayo de 2026 a partir de la inspección del schema completo y el código de la aplicación.*
