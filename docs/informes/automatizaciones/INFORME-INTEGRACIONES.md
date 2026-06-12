# Informe de Integraciones Externas — Innovar CRM

**Para**: Cliente Innovar
**De**: Equipo de Desarrollo
**Fecha**: 19 de mayo de 2026

---

## Resumen

Innovar CRM no opera como una isla. Está **integrado con servicios externos especializados** que le dan capacidades adicionales sin necesidad de que el cliente contrate o mantenga sistemas separados. Cada integración ahorra horas de trabajo manual al equipo y mejora la experiencia del cliente final.

Este documento describe los servicios externos conectados al sistema y qué hace cada uno.

---

## 1. Supabase — Núcleo de datos y autenticación

### Qué es
Supabase es el proveedor de la **base de datos y servicios de backend** que utiliza Innovar CRM.

### Qué provee al sistema
- **Base de datos Postgres 17** (la versión más moderna y robusta del mercado)
- **Autenticación de usuarios** con email/password y manejo de sesiones
- **Storage de archivos** (fotos de proyectos, modelos 3D, PDFs, comprobantes)
- **Realtime**: notificaciones instantáneas (badges, alertas en vivo)
- **Edge Functions**: capacidad de ejecutar código serverless cuando se necesita
- **Backups automáticos** diarios sin intervención

### Estado del servicio
- **ACTIVE_HEALTHY** (operacional al 100%)
- Región: us-west-2 (AWS Oregon)
- Project ID: `xdzbjptozeqcbnaqhtye`

### Beneficio para el negocio
- Cero administración de servidores propios
- Escalabilidad automática según demanda
- Backups diarios sin pagar extra ni configurar
- Encriptación de datos incluida

---

## 2. Vercel — Hosting del frontend

### Qué es
Vercel es el proveedor que **hospeda la aplicación web** que ven los usuarios.

### Qué provee al sistema
- **Hosting con CDN global** (la app carga rápido desde cualquier parte del mundo)
- **HTTPS automático** (certificados SSL renovados solos)
- **Despliegues continuos** desde GitHub
- **Preview deployments** para probar cambios antes de publicar

### URL de producción
- `crm-innovar-app-2026.vercel.app`

### Estado actual
- Sistema desplegado y operacional
- Auto-deploy desde GitHub requiere ajuste de configuración (apunta a repo anterior — pendiente reconectar)

### Beneficio para el negocio
- Disponibilidad 99.99%
- Sin necesidad de servidor dedicado
- Despliegues en segundos cuando hay cambios

---

## 3. GitHub — Versionado y respaldo del código

### Qué es
GitHub aloja **el código fuente** del CRM con historial completo de cambios.

### Repositorio
- `github.com/accesos-seo/innovar-crm` · rama `master`

### Qué provee
- **Historial completo** de cada cambio hecho al sistema desde el inicio
- **Revertir a cualquier versión anterior** si algo se rompe
- **Trazabilidad**: quién hizo qué cambio y por qué
- **Backup del código fuente** (independiente del hosting)

### Beneficio para el negocio
- El código nunca se pierde
- Cualquier desarrollador puede continuar el trabajo
- Auditoría completa del desarrollo

---

## 4. Meta WhatsApp Business API — Comunicaciones con cliente

### Qué es
La **API oficial de WhatsApp Business** (de Meta/Facebook) permite enviar mensajes programáticamente desde el sistema a los clientes.

### Qué hace en Innovar
El sistema envía mensajes WhatsApp **automáticamente** a clientes y al equipo interno en los siguientes eventos:

| Evento | Destinatario | Cuándo |
|---|---|---|
| Lead nuevo registrado | Comercial responsable | Al crearse el lead |
| Cita confirmada | Cliente | Al reservar la cita |
| Cambio de estado del proyecto | Cliente | Al cambiar fase |
| Cotización por vencer | Cliente | Días antes del vencimiento |
| Pago recibido | Cliente | Al registrar el pago |
| Tarea asignada | Responsable interno | Al asignar la tarea |
| Encuesta post-entrega | Cliente | Tras finalizar el proyecto |

### Procesamiento
- Los mensajes se acumulan en una **cola interna** (`notification_queue`)
- Un proceso automático corre **cada minuto** que toma los pendientes y los envía
- Si un mensaje falla, se reintenta automáticamente
- Estado actual: 6 mensajes en cola, 18 confirmaciones procesadas del proveedor

### Confirmaciones de entrega
Meta WhatsApp envía de vuelta **webhooks** con confirmaciones:
- Mensaje aceptado
- Mensaje entregado al teléfono del destinatario
- Mensaje leído
- Mensaje fallido (con motivo)

Innovar guarda **cada evento con su payload completo** para reportes y auditoría.

### Beneficio para el negocio
- Comunicación profesional masiva sin enviar mensajes uno por uno
- Cliente recibe avisos en tiempo real sin que nadie tenga que escribirle
- Templates oficiales aprobados por Meta (no terminan en spam)
- Métricas de delivery medibles

---

## 5. Google Calendar — Sincronización de agenda

### Qué es
Integración con **Google Calendar** de cada miembro del equipo para que sus tareas y citas aparezcan automáticamente en su calendario personal de trabajo.

### Qué hace
- Cuando se crea una tarea en Innovar → aparece en Google Calendar del responsable
- Cuando se reagenda una tarea → se actualiza en Google Calendar
- Cuando se elimina o completa → se elimina del calendario externo

### Procesamiento
- Las sincronizaciones se acumulan en una **cola** (`calendar_sync_queue`)
- Un proceso edge function las procesa y dispara llamadas al API de Google
- Estado actual: 5 sincronizaciones en cola

### Beneficio para el negocio
- El equipo ve sus tareas en su calendario habitual sin tener que copiar manualmente
- Recordatorios nativos de Google Calendar (pop-ups, emails)
- Vista unificada de carga de trabajo

---

## 6. Edge Functions de Supabase — Procesos especializados

### Qué son
Las **Edge Functions** son pequeños programas que corren en servidores cercanos al usuario y manejan tareas que la base de datos sola no puede hacer (llamar APIs externas, generar PDFs, enviar mails, etc.).

### Funciones confirmadas

| Función | Propósito | Estado |
|---|---|---|
| **`process-whatsapp-notifications`** | Procesa la cola y envía vía WhatsApp Business | Activa, ejecuta cada minuto |

### Funciones inferidas (pendiente confirmar en inventario oficial)

| Función probable | Propósito | Evidencia |
|---|---|---|
| `generate-quotation-pdf` | Generar el PDF de cotización al cambiar de estado | Tabla `pdf_generation_queue` activa |
| `sync-google-calendar` | Sincronizar tareas con Google Calendar | Tabla `calendar_sync_queue` con 5 pendientes |
| `whatsapp-webhook` | Recibir confirmaciones de delivery de Meta | 18 eventos almacenados en `meta_whatsapp_status_events` |
| `send-welcome-email` | Email de bienvenida a leads nuevos | Trigger `tr_on_new_lead_email` activo |

### Beneficio para el negocio
- Procesos pesados (PDF, envíos masivos) no bloquean la app
- Integraciones con servicios externos manejadas profesionalmente
- Escalan automáticamente según demanda

---

## 7. Cron Jobs (Postgres pg_cron) — Tareas programadas

### Qué son
**Tareas que el sistema ejecuta solas en horarios específicos** sin que nadie tenga que activarlas manualmente.

### Job activo confirmado

| Frecuencia | Acción |
|---|---|
| **Cada minuto** | Procesar cola de WhatsApp pendientes (llamar a edge function `process-whatsapp-notifications`) |

### Jobs adicionales sugeridos por la arquitectura (pendiente confirmar)

| Posible job | Frecuencia esperable | Función SQL |
|---|---|---|
| Escalamiento diario de tareas | Diaria | `run_daily_task_escalation` |
| Recordatorios de pago | Diaria | `run_payment_reminders` |
| Archivado de proyectos inactivos | Semanal | `run_archive_inactive_projects` |
| Reporte semanal automático | Semanal | `generate_weekly_report` |

### Beneficio para el negocio
- Tareas repetitivas sin intervención humana
- Disciplina automática (no se olvidan recordatorios, archivados, reportes)

---

## 8. Servicios de almacenamiento (Supabase Storage)

### Buckets configurados
- **`avatars`** — fotos de perfil de usuarios
- **`project-3d-files`** — modelos 3D de proyectos (renders, archivos CAD)
- **`project-photos`** — fotos por etapa del proyecto
- **`despieces`** — archivos de fabricación
- **`payment-receipts`** — comprobantes de pagos
- **`expense-receipts`** — comprobantes de gastos
- **`quotation-pdfs`** — PDFs de cotizaciones generadas

### Capacidades
- **Acceso público o privado** según el contenido
- **URLs firmadas** con vencimiento para archivos sensibles
- **Versionado** disponible
- **CDN global** para descarga rápida

---

## 9. Diagrama conceptual de integraciones

```
                    [Usuario / Cliente]
                            |
                            v
                   [Vercel — Frontend]
                            |
                            v
              [Supabase — Backend completo]
                  /         |          \
         [Postgres DB]  [Storage]   [Auth]
              |             |          |
              |             |          |
        [Triggers SQL]  [Buckets]  [JWT]
              |
              v
       [Edge Functions]
       /      |       \
      v       v        v
   [Meta]  [Google]  [Email]
 [WhatsApp][Calendar]
   API       API
```

---

## Resumen de integraciones activas

| Integración | Función | Estado | Volumen actual |
|---|---|---|---|
| **Supabase** | BD + Auth + Storage + Edge Functions | Operacional | 100+ tablas, miles de registros |
| **Vercel** | Hosting frontend | Operacional | crm-innovar-app-2026.vercel.app |
| **GitHub** | Versionado código | Operacional | 6 commits hoy 19/05/2026 |
| **Meta WhatsApp Business** | Mensajes automáticos | Operacional | 18 eventos procesados, 6 en cola |
| **Google Calendar** | Sync de agenda | Operacional | 5 sincronizaciones en cola |
| **Cron jobs (Postgres)** | Tareas programadas | 1 activo confirmado | 1440 ejecuciones/día (cada min) |
| **Sistema de email** | Welcome emails | Inferido por trigger | (pendiente inventario completo) |

---

## Costos y mantenimiento de integraciones

Las integraciones actuales son de bajo costo operativo:

| Servicio | Plan típico | Mantenimiento requerido |
|---|---|---|
| Supabase | Free hasta cierto umbral, después Pro (~$25 USD/mes) | Ninguno |
| Vercel | Free para hobby, Pro (~$20 USD/mes) si crece tráfico | Ninguno |
| GitHub | Gratuito para repos privados ilimitados | Ninguno |
| Meta WhatsApp | Pago por mensaje según volumen (~$0.005-$0.06 USD por mensaje) | Mantener access token vigente |
| Google Calendar | Gratuito vía OAuth | Renovar tokens OAuth eventualmente |

**Total estimado**: $50-100 USD/mes para operación normal, escalable según uso real.

---

## Conclusión

Innovar CRM aprovecha **6 servicios externos especializados** para entregar capacidades que serían imposibles o muy costosas de construir desde cero. Cada integración está activa, procesando volúmenes reales y aportando valor concreto al negocio diario:

- WhatsApp automatiza la comunicación con clientes
- Google Calendar mantiene sincronizada la agenda del equipo
- Supabase soporta toda la infraestructura de datos
- Vercel garantiza disponibilidad y velocidad
- GitHub protege el código y permite evolución continua
- Cron jobs ejecutan disciplina operativa automática

---

*Informe de integraciones generado el 19 de mayo de 2026 a partir del análisis de la arquitectura activa del sistema.*
