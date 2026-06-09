# Índice de PRDs — Agentes Innovar CRM
**Fecha de creación:** 2026-06-09
**Total de agentes:** 10

---

## Prioridad ALTA — Construir primero

| Agente | Capa | Archivo | Tecnología clave |
|--------|------|---------|-----------------|
| Calificador de Leads IA | 01 — Adquisición | [PRD](PRD-calificador-leads-ia.md) | n8n + OpenRouter + WhatsApp |
| Detector de Abandono | 01 — Adquisición | [PRD](PRD-detector-abandono.md) | pg_cron + WhatsApp |
| Vigía de Pagos | 02 — Conversión | [PRD](PRD-vigia-pagos.md) | pg_cron + WhatsApp |

## Prioridad MEDIA

| Agente | Capa | Archivo | Tecnología clave |
|--------|------|---------|-----------------|
| Orquestador de Agenda | 02 — Conversión | [PRD](PRD-orquestador-agenda.md) | EF + pg_cron + WhatsApp |
| Notificador de Proyecto | 03 — Entrega | [PRD](PRD-notificador-proyecto.md) | Trigger + WhatsApp |
| Coordinador de Producción | 03 — Entrega | [PRD](PRD-coordinador-produccion.md) | EF + WhatsApp |

## Prioridad BAJA

| Agente | Capa | Archivo | Tecnología clave |
|--------|------|---------|-----------------|
| Asistente de Postventa | 04 — Retención | [PRD](PRD-asistente-postventa.md) | Trigger + WhatsApp |
| Reactivador de Clientes | 04 — Retención | [PRD](PRD-reactivador-clientes.md) | pg_cron + WhatsApp |
| Analista de Conversión | 05 — Inteligencia | [PRD](PRD-analista-conversion.md) | pg_cron + n8n + WhatsApp |
| Monitor de Capacidad | 05 — Inteligencia | [PRD](PRD-monitor-capacidad.md) | pg_cron + WhatsApp |

---

## Templates WhatsApp — Inventario Global

### Aprobados (pueden usarse ahora)
`welcome_lead_v1` · `booking_link_v1` · `appointment_booked` · `task_assigned` · `visit_assigned_admin_v1` · `visit_reminder_24h_internal_v1` · `visit_reminder_2h_client_v1` · `visit_reminder_2h_internal_v1` · `visit_summary_client_v1` · `quotation_sent_v1` · `quotation_v2_sent_v1` · `payment_request_v1` · `quotation_reactivation_admin_v1` · `payment_proof_rejected_v1` · `project_assigned_designer_v1` · `project_fully_paid_v1` · `admin_quotation_expired_v1` · `fabricacion_iniciada_v1` · `instalacion_programada_v1` · `proyecto_completado_v1` · `recordatorio_instalacion_v1`

### Nuevos a crear y someter a Meta
Ver cada PRD individual para el texto propuesto.

---

## Orden de implementación sugerido

```
Semana 1: Detector de Abandono (más simple, sin bloqueo externo)
Semana 1: Vigía de Pagos (reutiliza templates existentes)
Semana 2: [Mientras Meta aprueba templates] Notificador de Proyecto
Semana 2: Coordinador de Producción
Semana 3: Calificador de Leads IA (depende de template Meta aprobado)
Semana 4+: Capas 4 y 5 (Retención e Inteligencia)
```
