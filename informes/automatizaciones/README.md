# Informe de Automatizaciones — Innovar CRM

**Sistema**: Innovar CRM (Diseño y fabricación de cocinas, closets, mesones, puertas)
**Base de datos**: Supabase Postgres (proyecto `xdzbjptozeqcbnaqhtye`)
**Fecha del informe**: 19 de mayo de 2026
**Estado del sistema**: ACTIVE_HEALTHY · Postgres 17

---

## Cifras clave

| Tipo de automatización | Cantidad | Estado |
|---|---:|---|
| Triggers de base de datos | **50** | Activos |
| Funciones SQL (lógica de negocio) | **51** | Activas |
| Cron jobs (tareas programadas) | **1+** | Activo cada minuto |
| Edge Functions (servicios externos) | **1+** | Confirmadas (pendiente inventario completo) |
| Colas de procesamiento | **4** | notification_queue, pdf_generation_queue, calendar_sync_queue, scheduled_job_log |

## Volumen procesado actualmente

- **162 eventos** registrados en bitácora de auditoría
- **18 eventos** de WhatsApp recibidos del proveedor (Meta)
- **6 notificaciones** en cola para envío
- **5 sincronizaciones** de calendario pendientes

---

## Documentos en esta carpeta

| Archivo | Propósito | Audiencia |
|---|---|---|
| [INFORME-CLIENTE.md](INFORME-CLIENTE.md) | Resumen ejecutivo de qué hace automáticamente el sistema, agrupado por área del negocio | Cliente / Gerencia |
| [DETALLE-TECNICO.md](DETALLE-TECNICO.md) | Inventario completo de cada trigger, función, cron job y edge function | Equipo técnico |
| [INVENTARIO.csv](INVENTARIO.csv) | Tabla plana exportable a Excel con todas las automatizaciones | Auditoría / Excel |

---

## Glosario rápido

- **Trigger**: regla automática que se ejecuta en la base de datos cuando algo cambia (insertar, modificar o borrar un registro).
- **Función SQL**: pieza de código reusable que vive dentro de la base de datos.
- **Cron job**: tarea automática que se ejecuta en un horario específico (cada minuto, cada hora, cada día, etc.).
- **Edge Function**: servicio que corre fuera de la base de datos para integrar con servicios externos (WhatsApp, PDF, Google Calendar, etc.).
- **Cola (queue)**: lista de tareas pendientes que se procesan en orden cuando un servicio está disponible.

---

*Informe generado a partir de la inspección directa del esquema de Supabase del proyecto. Cifras verificadas el 19 de mayo de 2026.*
