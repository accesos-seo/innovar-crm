# Informe de Capacidades del Sistema — Innovar CRM

**Para**: Cliente Innovar
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Innovar CRM es una plataforma completa para la gestión integral del negocio: desde que entra un lead hasta que se entrega el proyecto y se cierra contablemente. Este documento describe **todo lo que el sistema sabe hacer**, organizado por módulo, con el beneficio operativo de cada función.

---

## 1. Módulo: Gestión de Clientes y Leads

### Captación de leads
- **Registro de leads** con datos completos: nombre, contacto, dirección, servicios de interés, urgencia, ciudad.
- **Lead scoring automático**: el sistema calcula un puntaje de calidad del lead según sus datos. Se actualiza solo cada vez que el lead avanza (se cotiza, se contacta, etc.).
- **Asignación de comercial** responsable con fecha y hora.
- **Estado del lead** con seguimiento por embudo (PENDING, CONTACTED, QUALIFIED, CONVERTED).

### Captación pública
- **Formulario de captación** que permite ingresar leads desde fuentes externas (web, redes, eventos) sin necesidad de autenticación previa.

### Conversión a cliente
- **Transición automática** de lead a cliente cuando se aprueba la primera cotización.
- **Trazabilidad** del paso lead → cliente conservando el historial.

### Estado actual
- 11 clientes registrados en producción
- Sistema cubre métricas: total, nuevos por semana, cobertura WhatsApp, efectividad

---

## 2. Módulo: Cotizaciones

### Constructor de cotizaciones por categoría
El sistema permite cotizar **6 categorías de productos** con motores de cálculo dedicados:

| Categoría | Capacidades |
|---|---|
| **Cocinas** | Configurador con base + altos + isla, descuentos, repuestos, herrajes |
| **Closets** | 3 tipos (Estándar, Especial, Empotrado), cálculo por m² |
| **Mesones** | Granito, cuarzo, sinterizado — con isla, barra, lavaplatos integrado |
| **Centro de TV** | Ancho variable, alto brillo, LED, repisas, espacios para equipos |
| **Puertas Interiores** | Batiente/Corrediza, rangos 50-85cm y 85-110cm |
| **Acabados Especiales** | Perfilería aluminio, vidrio ahumado, bisagras automáticas, LED |

### Lógica de pricing centralizada
- **Catálogo de precios en base de datos** (`pricing_catalog`) con **60 entradas** activas.
- **Precios server-side**: el cliente nunca ve la fórmula, evita manipulación.
- **Fallback de seguridad**: si la conexión a precios falla, el sistema usa precios de respaldo hardcoded.
- **Actualización sin redespliegue**: el negocio puede cambiar precios desde el dashboard de Supabase sin necesidad de programadores.

### Operaciones sobre cotizaciones
- **Numeración automática** con secuencia única (anti-colisión).
- **Versionado**: si el cliente pide cambios, se crea una nueva versión conservando la original.
- **Lock post-aprobación**: cotizaciones aprobadas no se pueden modificar.
- **Recálculo automático** de totales al agregar/quitar items.
- **Generación automática de PDF** al cambiar de estado.
- **Descuentos**: tipo porcentaje o monto fijo, aplicables a nivel cotización.
- **Transporte**: configurable con valor por defecto $600.000.
- **Validez**: 30 días por defecto, configurable.
- **Alerta de vencimiento** automática por WhatsApp.

### Estado actual
- 9 cotizaciones registradas
- 60 entradas activas en catálogo de precios

---

## 3. Módulo: Proyectos

### Ciclo de vida del proyecto
El sistema gestiona los proyectos desde aprobación hasta entrega, con **estados predefinidos** y transiciones controladas:

```
contacto → cotizacion_aprobada → diseño → modelado → renders →
producción → instalación → entregado → garantía
```

### Capacidades clave
- **Creación automática** desde cotización aprobada.
- **Tareas iniciales generadas automáticamente** según tipo de trabajo.
- **Archivos 3D**: subida de modelos con versionado.
- **Despieces**: subida de archivos de fabricación.
- **Asignación de diseñador** con deadline.
- **Tracking público**: cada proyecto tiene un token único para que el cliente vea avance sin login.
- **Fechas calculadas**: estimada de instalación, agendada, entrega.
- **Aprobación cliente**: registro de aprobación con fecha y notas.
- **Notificaciones a producción** cuando el proyecto entra a esa fase.
- **Post-entrega**: acciones automáticas (encuesta de satisfacción, inicio de garantía).
- **Archivado** de proyectos completados para mantener listas operativas limpias.

### Estado actual
- 7 proyectos registrados

---

## 4. Módulo: Agenda y Tareas

### Sistema de agenda inteligente
- **Slots de disponibilidad** por miembro del staff con horarios configurables.
- **Booking automático**: al asignar una tarea, se reserva el horario del responsable.
- **Liberación automática**: si la tarea se elimina o cambia, el slot se libera.
- **Bloqueo de festivos**: al agregar un festivo al sistema, **todos los slots de ese día quedan no-disponibles** automáticamente.
- **Cálculo de disponibilidad** vía función SQL: `get_available_slots`.

### Sistema de tareas (Kanban)
- **Múltiples tipos**: operativa, comercial, administrativa, etc.
- **Estados controlados**: pendiente, en_progreso, bloqueada, completada.
- **Priorización numérica** (0 al 5).
- **Reordenamiento drag-and-drop** dentro del kanban (función `reorder_kanban`).
- **Asignación con notificación WhatsApp** al responsable.
- **Tags** y categorías personalizables.
- **Estimación de horas** vs horas reales para análisis de productividad.
- **Comentarios** en cada tarea con notificación a involucrados.
- **Archivos adjuntos** por tarea.
- **Vencimiento** con escalamiento automático si pasan los días.

### Integración con Google Calendar
- **Sincronización automática** de tareas con Google Calendar de cada usuario.
- Crear/modificar/eliminar una tarea → actualiza el calendar externo.

### Estado actual
- 5 sincronizaciones pendientes con Google Calendar
- 18 eventos WhatsApp procesados

---

## 5. Módulo: Finanzas

### Pagos
- **Registro de pagos** por proyecto con múltiples métodos de pago.
- **Avance automático** del proyecto cuando el pago cubre un hito.
- **Notificación WhatsApp** al cliente confirmando recepción.
- **Comprobante adjuntable** (receipt_url) para soporte documental.
- **Aprobación** con lock posterior.

### Gastos
- **Registro de gastos por proyecto** con categorías predefinidas.
- **Flujo de aprobación**: pendiente → aprobado/rechazado.
- **Notificación al supervisor** al crearse el gasto.
- **Notificación al solicitante** cuando se aprueba o rechaza.
- **Comprobante adjuntable**.

### Cierres contables
- **Cierre por proyecto**: ingresos totales, gastos totales, utilidad neta, margen porcentual.
- **3 estados de cierre**: draft, closed, reviewed.
- **Función `create_accounting_closure`** que cierra automáticamente sumando todo lo asociado al proyecto.

### Reportes financieros
- **Resumen financiero** consolidado por período (función `get_financial_summary`).
- **Saldo por proyecto** (función `get_project_balance`).
- **Reporte semanal automático** (función `generate_weekly_report`).
- **Recordatorios de pago** programables a clientes con saldo pendiente.

---

## 6. Módulo: Comunicaciones (WhatsApp)

### Procesamiento centralizado
- **Cola de notificaciones** (`notification_queue`) procesada **cada minuto** por cron job automático.
- **Envío vía Meta WhatsApp Business API** (oficial).
- **Templates de mensaje** parametrizables con idioma español por defecto.
- **Reintentos automáticos** en caso de fallo.

### Eventos que disparan WhatsApp automático
- Llegada de nuevo lead (notifica al comercial)
- Confirmación de cita reservada (al cliente)
- Cambio de estado de proyecto (al cliente)
- Cotización por vencer (al cliente)
- Pago recibido (al cliente)
- Asignación de tarea (al responsable)
- Bloqueo de tarea (al responsable y supervisor)
- Comentario en tarea (a involucrados)
- Encuesta de satisfacción post-entrega (al cliente)

### Confirmaciones de entrega
- **Webhook receiver** que recibe eventos del proveedor: entregado, leído, fallido.
- **Historial completo** de cada mensaje y su trayectoria (sent → delivered → read).
- **18 eventos procesados** actualmente.

### Estado actual
- 6 mensajes en cola
- Sistema corriendo en producción

---

## 7. Módulo: Materiales y Catálogo

### Catálogo de materiales
- **Inventario de materiales** con foto, descripción, precio, unidad, stock.
- **Categorización**: cocinas, closets, puertas, herrajes, accesorios, otros.
- **Estado activo/inactivo** para descontinuar sin eliminar.
- **Orden de presentación** configurable.

### Catálogo de precios (pricing_catalog)
- **Precios unitarios por categoría** con código único.
- **Historial**: campo `previousValue` mantiene el precio anterior cuando se actualiza.
- **Última actualización** registrada por fila.
- **Vivo en producción**: 60 entradas activas.

---

## 8. Módulo: Configuración y Administración

### Gestión de usuarios
- **Perfiles** con avatar, rol, preferencias de notificación.
- **Activación/desactivación** sin perder historial.
- **Auto-creación** del perfil al registrar usuario en auth.

### Gestión de festivos
- **Calendario de festivos** configurable.
- **Bloqueo automático** de slots de agenda en días festivos.
- **18 festivos** ya registrados.

### Diccionario del sistema
- **Inventario interno** de buckets de almacenamiento, edge functions, triggers y cron jobs (`system_dictionary`).
- **20 entradas** documentando componentes del sistema.

### Auditoría
- **Bitácora completa** de cambios (`audit_log` con 162 eventos).
- Consultable desde el panel de configuración.

### Diccionario de buckets de almacenamiento
- Registro de qué se guarda en cada bucket de Supabase Storage con su nivel de acceso.

---

## 9. Módulo: Garantías y Post-venta

### Garantías
- **Registro automático** de garantía al entregar proyecto.
- **Duración configurable** (12 meses por defecto).
- **Estados**: active, expired, claimed, voided.

### Reclamos de garantía
- **Apertura de reclamos** con severidad: low, medium, high, critical.
- **Estados de seguimiento**: open → in_progress → resolved/rejected.
- **Asignación** a responsable con notas de resolución.

### Encuestas de satisfacción
- **Envío automático** post-entrega del proyecto.
- **4 dimensiones de calificación**: overall, quality, punctuality, service (1-5).
- **NPS implícito**: pregunta de recomendación.
- **Estados**: pending → sent → responded / expired.

---

## 10. Módulo: Reportes y Dashboard

### Dashboard principal
- **Métricas en tiempo real**: total clientes, nuevos por semana, proyectos activos, efectividad de cierre.
- **Conectado a datos reales** de Supabase (no datos simulados).

### Reportes disponibles
- **Resumen financiero por período** (mensual/personalizado).
- **Balance por proyecto** (ingresos vs gastos).
- **Reporte semanal automático** con KPIs operativos.
- **Auditoría detallada** filtrable por usuario, tabla, fecha.
- **Estadísticas WhatsApp** (mensajes enviados, entregados, leídos, fallidos).

---

## 11. Capacidades técnicas transversales

### Búsqueda y filtros
- **Búsqueda full-text** sobre clientes (nombre, email, teléfono).
- **Filtros combinables** en todas las listas (estado, fecha, urgencia, ciudad).
- **Paginación server-side** para listas grandes.

### Carga de archivos
- **Buckets de almacenamiento** seguros en Supabase Storage.
- **Tipos soportados**: imágenes (project_photos), PDFs, archivos 3D, comprobantes, avatars.
- **URL públicas y privadas** según el contenido.

### Modo offline / resiliencia
- **Retry automático** de queries fallidas con backoff exponencial.
- **Recovery automático** de sesiones rotas (implementado 19/05/2026).
- **Cache inteligente** con React Query (datos frescos 5 minutos por defecto).

### PDFs
- **Generación de PDF** server-side para cotizaciones.
- **Cola asíncrona** para no bloquear la app durante la generación.
- **Templates personalizables** por categoría de producto.

### Notificaciones en la app
- **Centro de notificaciones** por usuario con badges de no-leídos.
- **Notificaciones en tiempo real** mediante suscripciones a la base de datos.

---

## Resumen — Lo que puede hacer Innovar CRM

| Área | Capacidades activas |
|---|---|
| **Gestión comercial** | Leads, scoring, asignación, conversión a cliente, embudo |
| **Cotización** | 6 categorías, versionado, lock, PDFs automáticos, descuentos |
| **Gestión de proyectos** | Ciclo completo desde aprobación hasta garantía, archivos 3D, tracking público |
| **Agenda** | Slots automáticos, bloqueo de festivos, sync Google Calendar, citas con notificación |
| **Tareas** | Kanban, asignación, comentarios, archivos, escalamiento, sync calendario |
| **Finanzas** | Pagos, gastos, aprobaciones, cierres contables, reportes, recordatorios |
| **WhatsApp** | 9+ eventos automáticos, cola con reintentos, webhook de delivery |
| **Materiales** | Catálogo con stock, categorías, precios editables |
| **Configuración** | Usuarios, roles, festivos, auditoría, diccionario del sistema |
| **Post-venta** | Garantías, reclamos, encuestas de satisfacción, NPS |
| **Reportes** | Dashboard, financieros, semanales, auditoría |

---

## Conclusión

Innovar CRM cubre **todo el ciclo de negocio** de una empresa de diseño y fabricación de mobiliario a medida — desde la entrada del lead hasta la post-venta y garantías. La gran mayoría de las operaciones internas están automatizadas, lo que significa que el equipo dedica tiempo a la atención del cliente y no a tareas administrativas repetitivas.

---

*Informe de capacidades generado el 19 de mayo de 2026 a partir del análisis funcional completo del sistema.*
