# Handoff — 10 Agentes Autónomos Innovar CRM (Capas 01–05)
**Fecha:** 2026-06-09 | **Commit:** `c24198b` | **Proyecto:** `xdzbjptozeqcbnaqhtye`

---

## Estado global: DESPLEGADO ✅ (con 1 excepción)

Todos los agentes de Capas 01–05 están en producción con `DRY_RUN=true`. La única excepción es el **Agente 10 (Calificador de Leads IA)** que requiere aprobación Meta antes de activar.

---

## Agentes desplegados

| # | Agente | EF | Cron | DRY_RUN key | Estado |
|---|--------|----|------|-------------|--------|
| 01 | Orquestador de Agenda | `schedule-visit-reminder` | `5 14 * * *` | `vigia_reminder_dry_run` | ✅ Prod |
| 02 | Vigía de Pagos | `vigia-pagos` | manual / n8n | `vigia_dry_run` | ✅ Prod |
| 03 | Notificador de Proyectos | trigger SQL | automático | `notificador_dry_run` | ✅ Prod |
| 04 | Coordinador de Producción | `coordinador-produccion` | trigger SQL | — | ✅ Prod |
| 05 | Asistente Postventa | trigger SQL | automático | `postventa_dry_run` | ✅ Prod |
| 06 | Reactivador de Clientes | `reactivate-clients` | `0 14 1 * *` | `reactivador_clientes_dry_run` | ✅ Prod |
| 07 | Analista de Conversión | `analista-conversion` | `0 14 * * 1` | `analista_dry_run` | ✅ Prod |
| 08 | Monitor de Capacidad | `monitor-capacidad` | `0 13 * * *` | `capacity_monitor_dry_run` | ✅ Prod |
| 09 | (reservado) | — | — | — | — |
| 10 | Calificador de Leads IA | `calificador-leads-ia` + `lead-qualification-detector` | `*/30 * * * 1-5` | `QUALIFIER_DRY_RUN` | ⛔ Bloqueado |

---

## Infraestructura aplicada

### Migraciones aplicadas a prod

| Migración | Contenido |
|-----------|-----------|
| `20260609000002_vigia_pagos.sql` | `v_quotations_pending_payment`, `vigia_stage`, cron vigia |
| `20260609000004_orquestador_agenda.sql` | `reminder_24h_sent_at`, `confirmation_sent_at`, cron agenda |
| `20260609000005_notificador_proyecto.sql` | `project_phase_log`, trigger `fn_notify_project_phase_change` |
| `20260609000006_coordinador_produccion.sql` | `delivery_date`, `get_project_ficha_tecnica()`, trigger `notify_fabrication_started` |
| `20260609000007_asistente_postventa.sql` | `scheduled_for` en `notification_queue`, `project_postventa_log`, trigger `fn_trigger_postventa` |
| `20260609000008_reactivador_clientes.sql` | `client_reactivation_log`, cron mensual |
| `20260609000009_analista_conversion.sql` | 3 vistas: `vw_pipeline_weekly_metrics`, `vw_conversion_times`, `vw_bottleneck_detection` |
| `20260609000010_monitor_capacidad.sql` | `capacity_*` settings, índices, cron diario |

### Migración en repo pero NO aplicada

| Migración | Por qué no aplicada |
|-----------|---------------------|
| `20260609000003_calificador_leads_ia.sql` | Requiere aprobación Meta del template `lead_qualification_start_v1` |

### system_settings inyectados

```
supabase_functions_base_url = "https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1"
vigia_dry_run = "true"
notificador_dry_run = "true"
postventa_dry_run = "true"
reactivador_clientes_dry_run = "true"
analista_dry_run = "true"
capacity_monitor_dry_run = "true"
capacity_yellow_threshold = 4
capacity_red_threshold = 7
default_fabrication_days = 25
nps_form_url = "https://innovar-crm.vercel.app/nps"
warranty_terms_short = "12 meses en estructura y herrajes"
```

### TEMPLATE_REGISTRY actualizado (process-whatsapp-notifications)

13 templates nuevos registrados:
`payment_followup_d7_v1`, `payment_escalation_d14_v1`, `proyecto_en_diseno_v1`,
`ficha_taller_v1`, `nps_solicitud_v1`, `garantia_info_v1`, `referido_solicitud_v1`,
`reactivacion_remodelacion_v1`, `reactivacion_referido_v1`, `reporte_semanal_kpi_v1`,
`reporte_semanal_alertas_v1`, `alerta_capacidad_amarilla_v1`, `alerta_capacidad_roja_v1`

---

## Para activar cada agente en producción

### Método: UPDATE via Management API o dashboard Supabase

```sql
-- Ejemplo: activar vigía de pagos
UPDATE public.system_settings
SET value = '"false"'::jsonb
WHERE key = 'vigia_dry_run';

-- Activar analista de conversión
UPDATE public.system_settings
SET value = '"false"'::jsonb
WHERE key = 'analista_dry_run';
```

### Datos requeridos antes de activar (por agente)

| Agente | Dato faltante |
|--------|--------------|
| Vigía de Pagos | `vigia_admin_phone` (número WhatsApp del admin) |
| Orquestador Agenda | — |
| Coordinador Producción | `workshop_whatsapp` (número del taller) |
| Asistente Postventa | `support_contact_phone` |
| Reactivador Clientes | — |
| Analista Conversión | `analista_admin_phone`, `analista_admin_name` |
| Monitor Capacidad | `capacity_monitor_admin_phone`, `capacity_monitor_admin_name` |

---

## Agente 10 — Calificador de Leads IA (bloqueado)

**Bloqueante:** Meta debe aprobar el template `lead_qualification_start_v1`.

**Cuando se apruebe:**
1. Aplicar migración `20260609000003_calificador_leads_ia.sql` a prod
2. `supabase functions deploy lead-qualification-detector --project-ref xdzbjptozeqcbnaqhtye`
3. `supabase functions deploy calificador-leads-ia --project-ref xdzbjptozeqcbnaqhtye`
4. También desplegar: `lead-qualification-webhook` y `lead-qualification-finalizer`
5. Configurar en Supabase Vault: `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `OPENROUTER_API_KEY`
6. Actualizar `QUALIFIER_DRY_RUN` a `"false"` en Vault

---

## Arquitectura de crons (UTC)

| Cron | UTC | Colombia | Frecuencia |
|------|-----|----------|------------|
| `orquestador-agenda-daily` | `5 14 * * *` | 9:05 AM L-D | Diario |
| `monitor-capacidad-daily` | `0 13 * * *` | 8:00 AM | Diario |
| `analista-conversion-weekly` | `0 14 * * 1` | 9:00 AM | Lunes |
| `reactivar-clientes-mensual` | `0 14 1 * *` | 9:00 AM | Día 1 mes |

---

## Clave técnica: JSONB en system_settings

Todos los valores deben insertarse como JSONB:
- Strings: `'"valor"'::jsonb`  
- Booleans: `'"true"'::jsonb` o `'"false"'::jsonb`
- Numbers: `'4'::jsonb`

En PL/pgSQL, leer boolean con: `(value #>> '{}') = 'true'`
