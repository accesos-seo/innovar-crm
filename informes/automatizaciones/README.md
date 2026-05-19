# Informes del Sistema Innovar CRM — Entrega al Cliente

**Sistema**: Innovar CRM (Diseño y fabricación de cocinas, closets, mesones, puertas)
**Base de datos**: Supabase Postgres (proyecto `xdzbjptozeqcbnaqhtye`)
**Fecha de los informes**: 19 de mayo de 2026
**Estado del sistema**: ACTIVE_HEALTHY · Postgres 17

---

## Carpeta de informes para entrega al cliente

Esta carpeta contiene los informes consolidados del estado actual del sistema Innovar CRM. Cada documento aborda un eje distinto del trabajo realizado.

| # | Documento | Eje | Audiencia | Páginas estimadas |
|---|---|---|---|---:|
| 1 | [INFORME-CLIENTE.md](INFORME-CLIENTE.md) | **Automatizaciones del sistema** — qué hace el sistema solo, agrupado por proceso del negocio | Gerencia / Cliente | 5 |
| 2 | [INFORME-SEGURIDAD.md](INFORME-SEGURIDAD.md) | **Seguridad y protección de datos** — capas activas que protegen la información | Gerencia / Cliente | 5 |
| 3 | [INFORME-CAPACIDADES.md](INFORME-CAPACIDADES.md) | **Capacidades del sistema** — todo lo que puede hacer Innovar CRM por módulo | Gerencia / Cliente | 6 |
| 4 | [INFORME-INTEGRACIONES.md](INFORME-INTEGRACIONES.md) | **Integraciones externas** — servicios conectados (WhatsApp, Calendar, etc.) | Gerencia / Cliente | 4 |
| 5 | [INFORME-ROLES-Y-PERMISOS.md](INFORME-ROLES-Y-PERMISOS.md) | **Roles y permisos** — quién puede hacer qué en el sistema, matriz completa | Gerencia / Cliente | 5 |
| 6 | [INFORME-ESTADO-OPERATIVO.md](INFORME-ESTADO-OPERATIVO.md) | **Estado operativo en cifras** — datos vivos del sistema al 19/05/2026 | Gerencia / Cliente | 4 |
| — | [DETALLE-TECNICO.md](DETALLE-TECNICO.md) | Anexo técnico detallado de automatizaciones (50 triggers + 51 funciones) | Equipo técnico | 8 |
| — | [INVENTARIO.csv](INVENTARIO.csv) | Inventario plano exportable a Excel con todas las automatizaciones | Auditoría / Excel | — |

---

## Cifras clave del sistema

| Métrica | Cantidad | Detalle |
|---|---:|---|
| Triggers de base de datos | **50** | Reglas automáticas que vigilan cada cambio |
| Funciones SQL | **51** | Lógica de negocio reusable en la base de datos |
| Cron jobs activos | **1+** | Procesador de WhatsApp cada minuto |
| Edge Functions | **1+** | Process-whatsapp-notifications confirmada, otras inferidas |
| Tablas en producción | **40+** | Base de datos completa con relaciones |
| Tablas auditadas | **7** | Audit log con 162 eventos registrados |
| Tablas con RLS activo | **8** | Protección a nivel base de datos |
| Roles diferenciados | **4** | Admin, Comercial, Diseño, Producción |
| Integraciones externas | **6+** | Supabase, Vercel, GitHub, Meta, Google, pg_cron |
| Categorías de productos cotizables | **6** | Cocinas, Closets, Mesones, TV, Puertas, Acabados |
| Entradas en catálogo de precios | **60** | Precios vivos en base de datos |

---

## Datos en producción al 19/05/2026

| Tabla | Registros | Estado |
|---|---:|---|
| Clientes | 11 | Activos |
| Proyectos | 7 | Distribuidos en distintas fases |
| Cotizaciones | 9 | Con versionado activo |
| Materiales en catálogo | 0 | Pendiente cargar inventario inicial |
| Festivos configurados | 18 | Bloquean slots de agenda automáticamente |
| Precios en catálogo | 60 | En uso |
| Eventos auditados | 162 | Bitácora detallada |
| Eventos WhatsApp recibidos | 18 | Del proveedor Meta |
| Mensajes en cola WhatsApp | 6 | Procesándose cada minuto |
| Sincronizaciones Calendar | 5 | Pendientes de sync |

---

## Guía rápida — qué informe leer primero según el interés del cliente

- ¿Quiere saber **qué hace el sistema solo**? → leer `INFORME-CLIENTE.md` (automatizaciones)
- ¿Quiere saber **cómo se protegen sus datos**? → leer `INFORME-SEGURIDAD.md`
- ¿Quiere saber **todo lo que el sistema puede hacer**? → leer `INFORME-CAPACIDADES.md`
- ¿Quiere saber **con qué servicios externos está conectado**? → leer `INFORME-INTEGRACIONES.md`
- ¿Quiere entender **quién puede hacer qué**? → leer `INFORME-ROLES-Y-PERMISOS.md`
- ¿Quiere ver el **estado actual con cifras reales**? → leer `INFORME-ESTADO-OPERATIVO.md`
- ¿Tiene equipo técnico que quiere detalle? → `DETALLE-TECNICO.md` + `INVENTARIO.csv`

---

## Glosario rápido

- **Trigger**: regla automática que se ejecuta en la base de datos cuando algo cambia.
- **Función SQL**: pieza de código reusable dentro de la base de datos.
- **Cron job**: tarea automática que se ejecuta en un horario específico.
- **Edge Function**: servicio que corre fuera de la base de datos para integraciones externas.
- **RLS (Row Level Security)**: protección a nivel base de datos que valida quién puede ver qué.
- **Cola (queue)**: lista de tareas pendientes procesadas asincrónicamente.
- **JWT**: token de autenticación firmado criptográficamente.
- **Webhook**: notificación que un servicio externo envía al sistema cuando ocurre algo.

---

*Informes generados a partir de la inspección directa del sistema en producción el 19 de mayo de 2026.*
