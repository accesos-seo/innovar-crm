# Informes del Sistema Innovar CRM — Entrega al Cliente

**Sistema**: Innovar CRM (Diseño y fabricación de cocinas, closets, mesones, puertas interiores, centros de TV, acabados especiales)
**Base de datos**: Supabase Postgres 17 (proyecto `xdzbjptozeqcbnaqhtye`)
**Fecha de los informes**: 19 de mayo de 2026
**Estado del sistema**: ACTIVE_HEALTHY · En producción · Auditando 162 eventos acumulados

---

## Estructura de los informes

Esta carpeta contiene **11 informes consolidados** del sistema Innovar CRM, agrupados según su audiencia y propósito.

### Informes para Gerencia / Cliente (visión ejecutiva)

| # | Documento | Enfoque |
|---|---|---|
| 1 | [INFORME-CLIENTE.md](INFORME-CLIENTE.md) | **Automatizaciones** — qué hace el sistema solo, agrupado por proceso del negocio |
| 2 | [INFORME-SEGURIDAD.md](INFORME-SEGURIDAD.md) | **Seguridad y protección de datos** — capas activas que protegen la información |
| 3 | [INFORME-CAPACIDADES.md](INFORME-CAPACIDADES.md) | **Capacidades del sistema** — todo lo que Innovar CRM puede hacer, módulo por módulo |
| 4 | [INFORME-INTEGRACIONES.md](INFORME-INTEGRACIONES.md) | **Integraciones externas** — servicios conectados (WhatsApp, Google Calendar, etc.) |
| 5 | [INFORME-ROLES-Y-PERMISOS.md](INFORME-ROLES-Y-PERMISOS.md) | **Roles y permisos** — quién puede hacer qué |
| 6 | [INFORME-ESTADO-OPERATIVO.md](INFORME-ESTADO-OPERATIVO.md) | **Estado operativo en cifras** — datos vivos del sistema al 19/05/2026 |
| 7 | [INFORME-ROADMAP-Y-PENDIENTES.md](INFORME-ROADMAP-Y-PENDIENTES.md) | **Roadmap y pendientes** — qué falta y qué viene |

### Informes para Administrador / Operación

| # | Documento | Enfoque |
|---|---|---|
| 8 | [INFORME-CONFIGURACION-ADMINISTRATIVA.md](INFORME-CONFIGURACION-ADMINISTRATIVA.md) | **Configuración administrativa** — todo lo configurable + categorías + parámetros |
| 9 | [INFORME-MANUAL-USO.md](INFORME-MANUAL-USO.md) | **Manual de uso rápido** — cómo hacer cada cosa en el sistema, paso a paso |
| 10 | [INFORME-FLUJOS-DE-NEGOCIO.md](INFORME-FLUJOS-DE-NEGOCIO.md) | **Flujos de negocio** — diagramas de los procesos completos |

### Informes para Equipo Técnico

| # | Documento | Enfoque |
|---|---|---|
| 11 | [INFORME-MODELO-DE-DATOS.md](INFORME-MODELO-DE-DATOS.md) | **Modelo de datos** — tablas, campos, relaciones, constraints |
| — | [DETALLE-TECNICO.md](DETALLE-TECNICO.md) | **Detalle técnico** — inventario de 50 triggers + 51 funciones + cron jobs |
| — | [INVENTARIO.csv](INVENTARIO.csv) | **Inventario plano** — tabla CSV exportable a Excel |

---

## Cifras clave del sistema

| Métrica | Cantidad | Detalle |
|---|---:|---|
| **Triggers de base de datos** | 50 | Reglas automáticas activas vigilando datos |
| **Funciones SQL** | 51 | Lógica de negocio reusable en la base de datos |
| **Cron jobs activos** | 1+ | Procesador WhatsApp ejecuta cada minuto |
| **Edge Functions** | 1+ confirmadas | process-whatsapp-notifications, otras inferidas |
| **Tablas en producción** | 40+ | Base de datos completa con relaciones |
| **Tablas auditadas automáticamente** | 7 | 162 eventos registrados en bitácora |
| **Tablas con RLS activo** | 8 | Row Level Security activa |
| **Roles diferenciados** | 4 | Admin, Comercial, Diseño, Producción |
| **Integraciones externas** | 6+ | Supabase, Vercel, GitHub, Meta, Google, pg_cron |
| **Categorías de productos cotizables** | 6 | Cocinas, Closets, Mesones, TV, Puertas, Acabados |
| **Precios activos en catálogo** | 60 | Vivos y consumidos por motores de pricing |
| **Festivos configurados** | 18 | Bloquean slots de agenda automáticamente |
| **Estados predefinidos del negocio** | 15+ | Para 9 entidades diferentes |

---

## Datos en producción al 19/05/2026

| Entidad | Registros | Estado |
|---|---:|---|
| Clientes y leads | 11 | Activos |
| Cotizaciones | 9 | Con versionado |
| Proyectos | 7 | Distribuidos en fases |
| Pagos | n/d | Pendiente reporte |
| Gastos | n/d | Pendiente reporte |
| Materiales en catálogo | 0 | **Pendiente carga inicial** |
| Festivos | 18 | Operativos |
| Entradas en pricing catalog | 60 | En uso |
| Usuarios activos | 2 | En sistema |
| Mensajes WhatsApp en cola | 6 | Procesándose cada minuto |
| Eventos WhatsApp del proveedor | 18 | Confirmaciones almacenadas |
| Sincronizaciones Calendar pendientes | 5 | En cola |
| Eventos en bitácora de auditoría | 162 | Sistema activo |

---

## Guía rápida — ¿Qué leer según mi rol?

### Soy el dueño / gerente — quiero entender qué tengo
1. Empieza por **INFORME-CAPACIDADES.md** (qué puede hacer el sistema)
2. Sigue con **INFORME-CLIENTE.md** (qué hace solo)
3. Después **INFORME-SEGURIDAD.md** (cómo se protegen los datos)
4. Cierra con **INFORME-ESTADO-OPERATIVO.md** (cifras reales)

### Soy el administrador — voy a operarlo día a día
1. Empieza por **INFORME-MANUAL-USO.md** (cómo se usa)
2. Sigue con **INFORME-CONFIGURACION-ADMINISTRATIVA.md** (qué se puede configurar)
3. Consulta **INFORME-ROLES-Y-PERMISOS.md** cuando gestiones usuarios

### Soy el comercial — voy a usar el sistema
1. Lee **INFORME-MANUAL-USO.md** secciones 2 (Leads), 3 (Cotizaciones) y 4 (Proyectos)
2. Consulta **INFORME-FLUJOS-DE-NEGOCIO.md** para entender qué automatizaciones se disparan con tus acciones

### Soy del equipo técnico del cliente
1. Empieza por **INFORME-MODELO-DE-DATOS.md** (entiende el modelo)
2. Sigue con **DETALLE-TECNICO.md** (inventario completo)
3. Consulta **INFORME-INTEGRACIONES.md** para servicios externos
4. Revisa **INFORME-ROADMAP-Y-PENDIENTES.md** para próximos pasos
5. Exporta **INVENTARIO.csv** a Excel si necesitas filtrar/buscar

### Soy auditor / contraloría
1. **INFORME-SEGURIDAD.md** (capas de protección)
2. **INFORME-ROLES-Y-PERMISOS.md** (matriz de accesos)
3. **DETALLE-TECNICO.md** (triggers y funciones)
4. **INVENTARIO.csv** (inventario plano para revisión)

---

## Glosario rápido

| Término | Significado |
|---|---|
| **Trigger** | Regla automática que se ejecuta en la base de datos cuando algo cambia. |
| **Función SQL** | Pieza de código reusable dentro de la base de datos. |
| **Cron job** | Tarea automática que se ejecuta en un horario específico. |
| **Edge Function** | Servicio que corre fuera de la base de datos para integraciones externas (WhatsApp, PDF, Calendar). |
| **RLS** | Row Level Security — protección a nivel base de datos que valida quién puede ver qué fila. |
| **Cola** | Lista de tareas pendientes procesadas asincrónicamente. |
| **JWT** | Token de autenticación firmado criptográficamente. |
| **Webhook** | Notificación que un servicio externo envía al sistema cuando ocurre algo. |
| **Bitácora / Auditoría** | Registro automático de quién cambió qué. |
| **NPS** | Net Promoter Score — indicador de satisfacción del cliente. |
| **Lead score** | Puntaje de calidad del lead (0-100) calculado automáticamente. |
| **Soft delete** | Borrado lógico — el registro queda marcado como eliminado pero no se borra físicamente. |
| **Kanban** | Vista de tareas en columnas por estado. |
| **Versionado** | Sistema que conserva versiones históricas de cotizaciones cuando hay cambios. |

---

## Resumen del trabajo realizado el 19/05/2026

Durante la sesión del 19 de mayo de 2026 se realizó:

### Trabajo técnico
- **5 migraciones SQL** aplicadas en producción (precios server-side para 5 módulos)
- **23 filas nuevas** insertadas en el catálogo de precios
- **5 motores de cálculo** nuevos en el servidor
- **3 fixes de estabilidad** del cliente Supabase (recovery automático de sesión rota)
- **Reactivación de Row Level Security** en 7 tablas críticas

### Documentación generada
- **11 informes** completos para entrega al cliente (esta carpeta)
- **2 handovers técnicos** para continuidad entre sesiones
- **Memoria persistente** del proyecto actualizada con hallazgos

### Commits subidos a GitHub
Múltiples commits documentados con mensajes claros y trazabilidad completa.

---

*Colección de informes generada el 19 de mayo de 2026 a partir de la inspección directa del sistema en producción. Todas las cifras son verificables ejecutando las consultas SQL referenciadas en cada documento.*
