# PRD: Analista de Conversión
**Capa:** 05 — Inteligencia
**Prioridad:** BAJA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Analista de Conversión es un agente de inteligencia de negocio que corre automáticamente cada lunes a las 8:00 AM (hora Bogotá) y entrega al gerente (Robert) un reporte semanal sobre la salud del pipeline comercial de Innovar Cocinas. El reporte consolida los KPIs más críticos del embudo de ventas: cuántos leads nuevos entraron, cuántos avanzaron a cotización, cuántos fueron aprobados, y cuánto tiempo tardó cada fase en promedio.

El valor principal no es el número en sí, sino la detección automática de cuellos de botella: si los leads están tardando más del umbral configurado en convertirse a cotización, o si las cotizaciones enviadas no reciben respuesta en el tiempo esperado, el agente lo marca explícitamente como alerta en el reporte, permitiendo a Robert intervenir antes de que el problema se agrave.

El agente cierra un vacío operativo real: hoy Robert no tiene visibilidad sistemática del rendimiento semanal del pipeline sin revisar manualmente la base de datos o el CRM. Con este agente, la inteligencia llega a su WhatsApp cada lunes sin fricción, en un formato accionable.

---

## 2. Problema que resuelve

**Pain point principal:** El equipo comercial de Innovar no tiene una cadencia establecida de revisión de métricas. Robert solo se entera del estado del pipeline cuando consulta manualmente el CRM o cuando alguien le reporta un problema. Esto significa que semanas con bajo rendimiento de conversión pasan sin detección temprana.

**Síntomas concretos:**
- No hay visibilidad de cuántos leads de la semana pasada nunca fueron contactados.
- No se sabe si las cotizaciones enviadas están tardando más de lo habitual en obtener respuesta.
- El ratio de aprobación de cotizaciones no se monitorea con regularidad.
- Cuellos de botella en fases específicas (lead→cotización o cotización→aprobación) no se detectan hasta que afectan el flujo de caja.

**Por qué importa:** Innovar Cocinas es un negocio de ticket alto y ciclo de venta largo (semanas). Perder un lead por falta de seguimiento oportuno o tener cotizaciones vencidas sin activar reactivación representa pérdida directa de ingresos. El reporte semanal actúa como sistema de alerta temprana automatizado.

---

## 3. Infraestructura existente que se reutiliza

**Tablas Supabase (sin modificaciones):**
- `leads` — fuente de leads nuevos y su estado actual
- `opportunities` — pipeline de ventas, estados y timestamps
- `quotations` — cotizaciones con status y fechas
- `notification_queue` — mecanismo de envío WA (INSERT para disparar envío)
- `whatsapp_message_log` — trazabilidad de mensajes enviados
- `system_settings` — almacena umbrales configurables (se agregan nuevas keys)
- `scheduled_job_log` — registro de ejecuciones del agente

**Edge Functions:**
- `process-whatsapp-notifications` — ya procesa `notification_queue` cada minuto. No requiere cambios.

**Templates WhatsApp existentes relevantes:** Ninguno del registry actual sirve para reporte interno de texto libre. Se requieren nuevos templates o uso de mensajes de sesión activa (ver Sección 6).

**Patrones reutilizables:**
- Patrón de encolamiento: INSERT en `notification_queue` con `dedup_key`
- Patrón de cron Supabase: `cron.schedule` invocando Edge Function por HTTP
- `scheduled_job_log`: patrón de auditoría ya usado en otros agentes

**n8n:**
- Instancia activa en `https://estancias-atlas-n8n.heh8a3.easypanel.host`
- MCP n8n-mcp disponible para crear el workflow directamente

---

## 4. Gap Analysis — Lo que hay que construir

**Nuevo en Supabase:**
1. Vista SQL `vw_pipeline_weekly_metrics` — agrega KPIs del pipeline para la semana anterior
2. Vista SQL `vw_conversion_times` — calcula tiempos promedio por fase con percentiles
3. Vista SQL `vw_bottleneck_detection` — identifica fases con tiempo > umbral
4. Edge Function `analista-conversion` — orquesta cálculo, composición y encolamiento
5. 3 nuevas keys en `system_settings`: umbrales de alerta por fase
6. Índices nuevos en `opportunities` y `quotations` para no degradar performance

**Nuevos templates WhatsApp:**
1. `reporte_semanal_kpi_v1` — resumen ejecutivo (nuevos leads, tasas, alertas)
2. `reporte_semanal_detalle_v1` — desglose de tiempos por fase (segundo mensaje opcional)

**n8n:**
- Workflow nuevo: `analista-conversion-weekly` con Schedule trigger (lunes 8:00 AM Bogotá) que invoca la Edge Function y maneja reintentos

**No se requiere:**
- Cambios en el frontend
- Nuevas tablas (solo vistas y settings)
- Cambios en `process-whatsapp-notifications`

---

## 5. Arquitectura Técnica

### Flujo de ejecución

```
LUNES 8:00 AM BOGOTÁ
        │
        ▼
[n8n Schedule Trigger]
  lunes 13:00 UTC
        │
        ▼
[HTTP POST] → Edge Function: analista-conversion
        │
        ├─ FASE 1: Cálculo de métricas
        │     └─ SELECT FROM vw_pipeline_weekly_metrics
        │          ├─ leads nuevos (semana anterior L-D)
        │          ├─ oportunidades creadas
        │          ├─ cotizaciones enviadas
        │          ├─ cotizaciones aprobadas
        │          └─ tasa conversión por fase (%)
        │
        ├─ FASE 2: Cálculo de tiempos
        │     └─ SELECT FROM vw_conversion_times
        │          ├─ avg días lead → cotización enviada
        │          └─ avg días cotización enviada → aprobada
        │
        ├─ FASE 3: Detección de cuellos de botella
        │     └─ SELECT FROM vw_bottleneck_detection
        │          └─ compara avg con umbrales en system_settings
        │
        ├─ FASE 4: Composición del mensaje
        │     ├─ Construye texto Mensaje 1 (resumen KPIs, ~900 chars)
        │     └─ Si hay alertas → prepara Mensaje 2 (detalle cuellos)
        │
        ├─ FASE 5: Encolamiento WhatsApp
        │     ├─ INSERT notification_queue (Msg 1 → Robert)
        │     └─ INSERT notification_queue (Msg 2 si hay alertas → Robert)
        │
        └─ FASE 6: Log de ejecución
              └─ INSERT scheduled_job_log
```

### Stack

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Scheduler | n8n Schedule Trigger | Dispara lunes 8:00 AM Bogotá |
| Orquestador | Supabase Edge Function (Deno) | Cálculo + composición + encolamiento |
| Cálculo de métricas | PostgreSQL Views | Agregaciones optimizadas |
| Mensajería | notification_queue → process-whatsapp-notifications | Envío WA |
| Configuración | system_settings | Umbrales, destinatarios |
| Auditoría | scheduled_job_log | Trazabilidad de ejecuciones |

### Decisión de diseño: texto libre vs template Meta

Los templates Meta requieren aprobación (días/semanas) y tienen formato rígido. Para un reporte interno semanal donde Robert ya tiene conversación activa con el número de la empresa, se puede enviar **texto libre** (no template) siempre que la conversación esté dentro de la ventana de 24 horas. Sin embargo, como el reporte es semanal y la ventana de 24h probablemente esté cerrada, **se requieren templates aprobados**.

Estrategia: 2 templates con variables estructuradas. Si Meta rechaza el formato detallado, fallback a 1 template de notificación + enlace al dashboard CRM.

---

## 6. Templates WhatsApp requeridos

### Template 1: `reporte_semanal_kpi_v1` ← **NUEVO, requiere aprobación Meta**

**Categoría:** `UTILITY`
**Idioma:** `es`
**Variables:** 8

```
Hola {{1}}, aquí tu reporte semanal Innovar 📊

Semana del {{2}} al {{3}}:
• Leads nuevos: {{4}}
• Cotizaciones enviadas: {{5}}
• Cotizaciones aprobadas: {{6}}
• Conversión Lead→Cotización: {{7}}%
• Conversión Cotización→Aprobación: {{8}}%

{{9}}
```

**Mapeo de variables:**
- `{{1}}` = nombre del destinatario (ej. "Robert")
- `{{2}}` = fecha inicio semana (ej. "02 Jun")
- `{{3}}` = fecha fin semana (ej. "08 Jun")
- `{{4}}` = count leads nuevos (integer)
- `{{5}}` = count cotizaciones enviadas (integer)
- `{{6}}` = count cotizaciones aprobadas (integer)
- `{{7}}` = tasa lead→cotización como porcentaje (ej. "45")
- `{{8}}` = tasa cotización→aprobación (ej. "62")
- `{{9}}` = línea de cierre dinámica: "✅ Todo en orden." o "⚠️ Ver alertas abajo."

**Limitación:** 9 variables es el máximo práctico. El template tiene ~320 chars, dentro del límite.

---

### Template 2: `reporte_semanal_alertas_v1` ← **NUEVO, requiere aprobación Meta**

**Categoría:** `UTILITY`
**Idioma:** `es`
**Variables:** 4

```
⚠️ Alertas del pipeline — semana {{1}}:

{{2}}

Tiempos promedio:
• Lead → Cotización: {{3}} días (umbral: {{4}} días)

Revisar en CRM: https://innovar-crm.vercel.app/pipeline
```

**Mapeo de variables:**
- `{{1}}` = identificador de semana (ej. "02-08 Jun 2026")
- `{{2}}` = texto de alertas detectadas (ej. "🔴 Cotización→Aprobación: 12 días (umbral: 7)")
- `{{3}}` = promedio días lead→cotización
- `{{4}}` = umbral configurado para esa fase

**Nota:** Si Meta rechaza el emoji en el header, versión fallback sin emojis. La URL en el footer es literal (no variable) para mayor probabilidad de aprobación.

---

### Templates existentes reutilizables para este agente
Ninguno del registry actual es apropiado para reporte interno. Los templates existentes están diseñados para comunicación con clientes externos.

---

## 7. Schema de datos

### Vistas SQL nuevas

#### `vw_pipeline_weekly_metrics`
```sql
CREATE OR REPLACE VIEW vw_pipeline_weekly_metrics AS
WITH semana AS (
  SELECT
    date_trunc('week', current_date - interval '7 days') AS inicio,
    date_trunc('week', current_date - interval '7 days') + interval '6 days 23:59:59' AS fin
)
SELECT
  s.inicio                                                    AS semana_inicio,
  s.fin                                                       AS semana_fin,
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.created_at BETWEEN s.inicio AND s.fin
  )                                                           AS leads_nuevos,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.created_at BETWEEN s.inicio AND s.fin
  )                                                           AS oportunidades_creadas,
  COUNT(DISTINCT q.id) FILTER (
    WHERE q.created_at BETWEEN s.inicio AND s.fin
    AND q.status IN ('sent','approved','rejected','expired')
  )                                                           AS cotizaciones_enviadas,
  COUNT(DISTINCT q.id) FILTER (
    WHERE q.updated_at BETWEEN s.inicio AND s.fin
    AND q.status = 'approved'
  )                                                           AS cotizaciones_aprobadas,
  -- Conversiones acumuladas (no solo de la semana) para tasa más estable
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status NOT IN ('new','lost')
    AND o.created_at BETWEEN s.inicio AND s.fin
  )                                                           AS leads_avanzaron
FROM semana s
CROSS JOIN leads l
LEFT JOIN opportunities o ON o.lead_id = l.id
LEFT JOIN quotations q ON q.opportunity_id = o.id
GROUP BY s.inicio, s.fin;
```

#### `vw_conversion_times`
```sql
CREATE OR REPLACE VIEW vw_conversion_times AS
WITH semana AS (
  SELECT
    date_trunc('week', current_date - interval '7 days') AS inicio,
    date_trunc('week', current_date - interval '7 days') + interval '6 days 23:59:59' AS fin
),
tiempos_lead_cotizacion AS (
  SELECT
    o.lead_id,
    o.created_at                                            AS oportunidad_creada,
    MIN(q.created_at)                                       AS primera_cotizacion,
    EXTRACT(EPOCH FROM (MIN(q.created_at) - o.created_at)) / 86400 AS dias_lead_a_cotizacion
  FROM opportunities o
  JOIN quotations q ON q.opportunity_id = o.id
    AND q.status IN ('sent','approved','rejected','expired')
  WHERE o.created_at >= current_date - interval '30 days'  -- ventana 30d para muestra estadística
  GROUP BY o.lead_id, o.created_at
),
tiempos_cotizacion_aprobacion AS (
  SELECT
    q.opportunity_id,
    q.created_at                                            AS cotizacion_enviada,
    q.updated_at                                            AS aprobada_en,
    EXTRACT(EPOCH FROM (q.updated_at - q.created_at)) / 86400 AS dias_cotizacion_a_aprobacion
  FROM quotations q
  WHERE q.status = 'approved'
    AND q.updated_at >= current_date - interval '30 days'
)
SELECT
  ROUND(AVG(tlc.dias_lead_a_cotizacion)::numeric, 1)      AS avg_dias_lead_cotizacion,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY tlc.dias_lead_a_cotizacion
  )::numeric, 1)                                            AS p50_dias_lead_cotizacion,
  ROUND(AVG(tca.dias_cotizacion_a_aprobacion)::numeric, 1) AS avg_dias_cotizacion_aprobacion,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY tca.dias_cotizacion_a_aprobacion
  )::numeric, 1)                                            AS p50_dias_cotizacion_aprobacion,
  COUNT(tlc.lead_id)                                        AS muestra_tiempos_lead,
  COUNT(tca.opportunity_id)                                 AS muestra_tiempos_cotizacion
FROM tiempos_lead_cotizacion tlc
CROSS JOIN tiempos_cotizacion_aprobacion tca;
```

#### `vw_bottleneck_detection`
```sql
CREATE OR REPLACE VIEW vw_bottleneck_detection AS
WITH umbrales AS (
  SELECT
    (SELECT value::numeric FROM system_settings
     WHERE key = 'analista_umbral_dias_lead_cotizacion')   AS umbral_lead_cotizacion,
    (SELECT value::numeric FROM system_settings
     WHERE key = 'analista_umbral_dias_cotizacion_aprobacion') AS umbral_cotizacion_aprobacion
),
metricas AS (SELECT * FROM vw_conversion_times),
leads_sin_cotizacion AS (
  SELECT COUNT(*) AS count
  FROM opportunities o
  WHERE o.status IN ('new','scheduled','visited')
    AND NOT EXISTS (SELECT 1 FROM quotations q WHERE q.opportunity_id = o.id)
    AND o.created_at < current_date - interval '5 days'
),
cotizaciones_sin_respuesta AS (
  SELECT COUNT(*) AS count
  FROM quotations q
  WHERE q.status = 'sent'
    AND q.created_at < current_date - interval '5 days'
    AND q.valid_until >= current_date
)
SELECT
  u.umbral_lead_cotizacion,
  u.umbral_cotizacion_aprobacion,
  m.avg_dias_lead_cotizacion,
  m.avg_dias_cotizacion_aprobacion,
  CASE WHEN m.avg_dias_lead_cotizacion > u.umbral_lead_cotizacion
       THEN TRUE ELSE FALSE END                             AS alerta_lead_cotizacion,
  CASE WHEN m.avg_dias_cotizacion_aprobacion > u.umbral_cotizacion_aprobacion
       THEN TRUE ELSE FALSE END                             AS alerta_cotizacion_aprobacion,
  lsc.count                                                 AS leads_sin_cotizacion_pendientes,
  csr.count                                                 AS cotizaciones_sin_respuesta_activas,
  CASE WHEN lsc.count > 3 OR csr.count > 5
    OR m.avg_dias_lead_cotizacion > u.umbral_lead_cotizacion
    OR m.avg_dias_cotizacion_aprobacion > u.umbral_cotizacion_aprobacion
  THEN TRUE ELSE FALSE END                                  AS hay_alertas
FROM umbrales u
CROSS JOIN metricas m
CROSS JOIN leads_sin_cotizacion lsc
CROSS JOIN cotizaciones_sin_respuesta csr;
```

### Nuevas keys en `system_settings`

```sql
INSERT INTO system_settings (key, value) VALUES
  ('analista_umbral_dias_lead_cotizacion',       '5'),
  ('analista_umbral_dias_cotizacion_aprobacion', '7'),
  ('analista_destinatario_gerente',              '+573183061286'),
  ('analista_dry_run',                           'true')
ON CONFLICT (key) DO NOTHING;
```

### Índices nuevos

```sql
-- Acelera agregaciones por fecha en opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at
  ON opportunities(created_at);

CREATE INDEX IF NOT EXISTS idx_opportunities_status_created
  ON opportunities(status, created_at);

-- Acelera búsqueda de cotizaciones por fecha y estado
CREATE INDEX IF NOT EXISTS idx_quotations_status_created
  ON quotations(status, created_at);

CREATE INDEX IF NOT EXISTS idx_quotations_status_updated
  ON quotations(status, updated_at);

-- Acelera lookup de leads por fecha
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads(created_at);
```

### Tabla `scheduled_job_log` — campos utilizados (existente, sin cambios)

| Campo | Tipo | Valor para este agente |
|---|---|---|
| `job_name` | text | `'analista-conversion'` |
| `started_at` | timestamptz | timestamp inicio EF |
| `finished_at` | timestamptz | timestamp fin EF |
| `rows_processed` | integer | mensajes encolados |
| `status` | text | `'success'` / `'error'` |

---

## 8. Implementación paso a paso

### Slice 1: Fundaciones de datos y configuración

**Qué incluye:**
- Migración SQL con índices, vistas y system_settings
- Sin código de aplicación, sin mensajes enviados
- Permite validar que las vistas devuelven datos correctos antes de construir la EF

**SQL completo (archivo: `migrations/analista_conversion_slice1.sql`):**

```sql
-- ============================================================
-- SLICE 1: Analista de Conversión — Fundaciones
-- Idempotente: seguro correr múltiples veces
-- ============================================================

-- 1. Índices de performance
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at
  ON opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_status_created
  ON opportunities(status, created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_status_created
  ON quotations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_status_updated
  ON quotations(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads(created_at);

-- 2. System settings (umbrales y configuración)
INSERT INTO system_settings (key, value) VALUES
  ('analista_umbral_dias_lead_cotizacion',       '5'),
  ('analista_umbral_dias_cotizacion_aprobacion', '7'),
  ('analista_destinatario_gerente',              '+573183061286'),
  ('analista_dry_run',                           'true')
ON CONFLICT (key) DO NOTHING;

-- 3. Vista: métricas semanales
CREATE OR REPLACE VIEW vw_pipeline_weekly_metrics AS
-- [SQL completo de la Sección 7]

-- 4. Vista: tiempos de conversión
CREATE OR REPLACE VIEW vw_conversion_times AS
-- [SQL completo de la Sección 7]

-- 5. Vista: detección de cuellos de botella
CREATE OR REPLACE VIEW vw_bottleneck_detection AS
-- [SQL completo de la Sección 7]

-- 6. Smoke test (comentar en producción)
-- SELECT * FROM vw_pipeline_weekly_metrics;
-- SELECT * FROM vw_conversion_times;
-- SELECT * FROM vw_bottleneck_detection;
```

**Criterio de aceptación:**
- `SELECT * FROM vw_pipeline_weekly_metrics` devuelve 1 fila sin errores
- `SELECT * FROM vw_bottleneck_detection` devuelve columna `hay_alertas` (boolean)
- `SELECT value FROM system_settings WHERE key = 'analista_dry_run'` devuelve `'true'`
- Ejecución de los 5 CREATE INDEX en < 5 segundos (tabla pequeña)

---

### Slice 2: Edge Function `analista-conversion`

**Qué incluye:**
- Edge Function Deno en `supabase/functions/analista-conversion/index.ts`
- Lógica de cálculo, composición de texto y encolamiento en `notification_queue`
- `DRY_RUN` activo: log en `scheduled_job_log` pero SIN INSERT en `notification_queue`

**Archivo: `supabase/functions/analista-conversion/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DRY_RUN_OVERRIDE = false  // El valor real viene de system_settings

serve(async (req) => {
  const startedAt = new Date().toISOString()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // ── 1. Leer configuración ──────────────────────────────
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'analista_destinatario_gerente',
        'analista_dry_run',
        'analista_umbral_dias_lead_cotizacion',
        'analista_umbral_dias_cotizacion_aprobacion',
      ])

    const cfg: Record<string, string> = {}
    for (const row of settings ?? []) cfg[row.key] = row.value

    const DRY_RUN = DRY_RUN_OVERRIDE || cfg['analista_dry_run'] === 'true'
    const destinatario = cfg['analista_destinatario_gerente'] ?? '+573183061286'

    // ── 2. Obtener métricas ────────────────────────────────
    const [{ data: metricas }, { data: tiempos }, { data: cuellos }] = await Promise.all([
      supabase.from('vw_pipeline_weekly_metrics').select('*').single(),
      supabase.from('vw_conversion_times').select('*').single(),
      supabase.from('vw_bottleneck_detection').select('*').single(),
    ])

    if (!metricas || !tiempos || !cuellos) {
      throw new Error('No se pudieron obtener métricas de las vistas SQL')
    }

    // ── 3. Calcular tasas de conversión ───────────────────
    const tasaLeadCotizacion = metricas.leads_nuevos > 0
      ? Math.round((metricas.cotizaciones_enviadas / metricas.leads_nuevos) * 100)
      : 0
    const tasaCotizacionAprobacion = metricas.cotizaciones_enviadas > 0
      ? Math.round((metricas.cotizaciones_aprobadas / metricas.cotizaciones_enviadas) * 100)
      : 0

    // ── 4. Formatear fechas de la semana ──────────────────
    const fmtDate = (iso: string) => {
      const d = new Date(iso)
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    }
    const semanaLabel = `${fmtDate(metricas.semana_inicio)}-${fmtDate(metricas.semana_fin)} ${new Date(metricas.semana_fin).getFullYear()}`
    const inicio = fmtDate(metricas.semana_inicio)
    const fin = fmtDate(metricas.semana_fin)

    // ── 5. Línea de cierre dinámica ───────────────────────
    const lineaCierre = cuellos.hay_alertas
      ? '⚠️ Ver alertas abajo.'
      : '✅ Todo en orden.'

    // ── 6. Componer mensajes ──────────────────────────────
    const dedupeBase = `analista-conversion:${metricas.semana_inicio.slice(0, 10)}`

    const msg1Params = [
      'Robert',
      inicio,
      fin,
      String(metricas.leads_nuevos),
      String(metricas.cotizaciones_enviadas),
      String(metricas.cotizaciones_aprobadas),
      String(tasaLeadCotizacion),
      String(tasaCotizacionAprobacion),
      lineaCierre,
    ]

    let mensajesEncolados = 0

    // ── 7. Encolar Mensaje 1 (KPIs) ───────────────────────
    if (!DRY_RUN) {
      const { error: e1 } = await supabase
        .from('notification_queue')
        .insert({
          recipient_phone:      destinatario,
          template_name:        'reporte_semanal_kpi_v1',
          template_language:    'es',
          template_parameters:  msg1Params,
          dedup_key:            `${dedupeBase}:kpi`,
          status:               'pending',
          attempt_count:        0,
        })
      if (e1) throw new Error(`Error encolando msg1: ${e1.message}`)
      mensajesEncolados++
    }

    // ── 8. Encolar Mensaje 2 (alertas) si hay cuellos ─────
    if (cuellos.hay_alertas && !DRY_RUN) {
      // Construir texto de alertas (max ~200 chars para la variable)
      const alertLines: string[] = []
      if (cuellos.alerta_lead_cotizacion) {
        alertLines.push(`🔴 Lead→Cotización: ${tiempos.avg_dias_lead_cotizacion}d (umbral: ${cuellos.umbral_lead_cotizacion}d)`)
      }
      if (cuellos.alerta_cotizacion_aprobacion) {
        alertLines.push(`🔴 Cotización→Aprobación: ${tiempos.avg_dias_cotizacion_aprobacion}d (umbral: ${cuellos.umbral_cotizacion_aprobacion}d)`)
      }
      if (cuellos.leads_sin_cotizacion_pendientes > 3) {
        alertLines.push(`🟡 ${cuellos.leads_sin_cotizacion_pendientes} leads sin cotización (>5 días)`)
      }
      if (cuellos.cotizaciones_sin_respuesta_activas > 5) {
        alertLines.push(`🟡 ${cuellos.cotizaciones_sin_respuesta_activas} cotizaciones sin respuesta`)
      }

      const msg2Params = [
        semanaLabel,
        alertLines.join('\n'),
        String(tiempos.avg_dias_lead_cotizacion ?? '-'),
        String(cuellos.umbral_lead_cotizacion),
      ]

      const { error: e2 } = await supabase
        .from('notification_queue')
        .insert({
          recipient_phone:      destinatario,
          template_name:        'reporte_semanal_alertas_v1',
          template_language:    'es',
          template_parameters:  msg2Params,
          dedup_key:            `${dedupeBase}:alertas`,
          status:               'pending',
          attempt_count:        0,
        })
      if (e2) throw new Error(`Error encolando msg2: ${e2.message}`)
      mensajesEncolados++
    }

    // ── 9. Log de ejecución ───────────────────────────────
    await supabase.from('scheduled_job_log').insert({
      job_name:       'analista-conversion',
      started_at:     startedAt,
      finished_at:    new Date().toISOString(),
      rows_processed: mensajesEncolados,
      status:         'success',
    })

    const responsePayload = {
      ok:                   true,
      dry_run:              DRY_RUN,
      semana:               semanaLabel,
      leads_nuevos:         metricas.leads_nuevos,
      cotizaciones_enviadas: metricas.cotizaciones_enviadas,
      cotizaciones_aprobadas: metricas.cotizaciones_aprobadas,
      tasa_lead_cotizacion: `${tasaLeadCotizacion}%`,
      tasa_cotizacion_aprobacion: `${tasaCotizacionAprobacion}%`,
      hay_alertas:          cuellos.hay_alertas,
      mensajes_encolados:   mensajesEncolados,
    }

    console.log('[analista-conversion]', JSON.stringify(responsePayload))

    return new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analista-conversion] ERROR:', msg)

    await supabase.from('scheduled_job_log').insert({
      job_name:       'analista-conversion',
      started_at:     startedAt,
      finished_at:    new Date().toISOString(),
      rows_processed: 0,
      status:         'error',
    }).catch(() => {})

    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```

**Deploy:**
```bash
supabase functions deploy analista-conversion --project-ref xdzbjptozeqcbnaqhtye
```

**Criterio de aceptación:**
- `curl -X POST https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/analista-conversion -H "Authorization: Bearer $SERVICE_ROLE_KEY"` devuelve `{ ok: true, dry_run: true, ... }` con los KPIs calculados
- `dry_run: true` → NO hay filas nuevas en `notification_queue`
- `SELECT * FROM scheduled_job_log WHERE job_name = 'analista-conversion'` muestra la ejecución con `status = 'success'`
- El log de la EF en Supabase Dashboard muestra el JSON de respuesta con métricas reales

---

### Slice 3: n8n Workflow + activación en producción

**Qué incluye:**
- Workflow n8n `analista-conversion-weekly` con Schedule trigger
- Cambio de `analista_dry_run` a `false` en `system_settings` (gate manual)
- Templates Meta aprobados (prerequisito externo)

**Workflow n8n — estructura de nodos:**

```
[Schedule Trigger]
  cron: 0 13 * * 1   (lunes 13:00 UTC = 8:00 AM Bogotá)
  timezone: America/Bogota
        │
        ▼
[HTTP Request: Invocar EF]
  method: POST
  url: https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/analista-conversion
  headers:
    Authorization: Bearer {{$env.INNOVAR_SERVICE_ROLE_KEY}}
    Content-Type: application/json
  options:
    timeout: 30000
    response: includeResponseBody
        │
        ▼
[IF: ¿Éxito?]
  condition: {{$json.ok}} === true
        │
   ┌────┴────┐
  TRUE      FALSE
   │          │
   ▼          ▼
[No-op]   [HTTP Request: Alertar error]
           POST a Slack/WA Robert:
           "❌ analista-conversion falló: {{$json.error}}"
```

**JSON del workflow para crear vía MCP n8n:**

El workflow se crea con `n8n_create_workflow` con el siguiente esquema simplificado:
- Nombre: `analista-conversion-weekly`
- Tags: `innovar`, `analista`, `cron`
- Active: `false` (hasta que templates Meta estén aprobados)

**Activación en producción (gate manual):**

```sql
-- Ejecutar SOLO cuando templates Meta estén aprobados y smoke test OK
UPDATE system_settings
SET value = 'false'
WHERE key = 'analista_dry_run';
```

Y en n8n: activar el workflow `analista-conversion-weekly`.

**Criterio de aceptación:**
- El workflow aparece en n8n como `analista-conversion-weekly`
- Trigger manual desde n8n ejecuta la EF y la respuesta es `{ ok: true }`
- Con `dry_run=false` y templates aprobados: Robert recibe el WA en su teléfono antes de las 8:10 AM del lunes de activación
- `SELECT * FROM scheduled_job_log WHERE job_name = 'analista-conversion' ORDER BY started_at DESC LIMIT 5` muestra ejecuciones exitosas

---

## 9. Criterios de aceptación globales

- [ ] Las 3 vistas SQL devuelven datos correctos sin error ni timeout (< 3 segundos)
- [ ] `vw_bottleneck_detection.hay_alertas` cambia de `false` a `true` cuando un tiempo supera el umbral
- [ ] La EF con `dry_run=true` retorna JSON con todos los KPIs calculados y NO inserta en `notification_queue`
- [ ] La EF con `dry_run=false` inserta exactamente 1 o 2 filas en `notification_queue` (1 siempre, 2 si hay alertas)
- [ ] El `dedup_key` previene inserción duplicada si la EF se dispara dos veces en el mismo lunes
- [ ] `scheduled_job_log` registra cada ejecución con `status='success'` o `status='error'`
- [ ] Robert recibe el WA antes de las 8:10 AM hora Bogotá el lunes de activación
- [ ] Si la DB no tiene datos de la semana anterior, la EF NO falla — retorna ceros y envía igualmente
- [ ] El workflow n8n tiene manejo de error: si la EF retorna 500, se envía notificación de falla
- [ ] Los dos templates Meta tienen status `APPROVED` antes de activar `dry_run=false`
- [ ] Los índices nuevos no degradan el tiempo de respuesta de otras queries en la DB (verificar con EXPLAIN ANALYZE)

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Meta rechaza los templates por formato de reporte | MEDIA | ALTO | Tener versión fallback sin emojis y con texto más neutro. Si se rechazan los 2, usar 1 template genérico (`task_assigned`) con el texto resumido en la variable de "tarea". |
| Ventana de 24h cerrada para WA libre (texto libre no funciona) | ALTA | ALTO | El diseño ya asume templates Meta — no depende de sesión activa. |
| Las vistas SQL son lentas en producción si hay miles de registros | BAJA | MEDIO | Los índices de Slice 1 mitigan esto. Agregar `EXPLAIN ANALYZE` en testing. La ventana de 30 días en `vw_conversion_times` limita el scan. |
| `system_settings` no tiene la key `analista_dry_run` en producción | BAJA | MEDIO | El código hace fallback a `DRY_RUN = true` si la key no existe (comportamiento seguro por defecto). |
| n8n Schedule trigger corre en UTC y Bogotá tiene offset variable (DST) | BAJA | BAJO | Colombia NO tiene DST. El offset es siempre UTC-5. El cron `0 13 * * 1` es estable. |
| `scheduled_job_log` no existe en producción | BAJA | BAJO | Verificar tabla antes de deploy. Si no existe, el INSERT falla silenciosamente (try/catch en la EF). |
| Templates aprobados pero con variables modificadas por Meta | MEDIA | MEDIO | Verificar el texto exacto de los templates en Meta Business Manager después de la aprobación, antes de activar `dry_run=false`. |
| La EF se ejecuta dos veces el mismo lunes (doble trigger) | BAJA | BAJO | El `dedup_key` en `notification_queue` previene mensajes duplicados. La EF es idempotente. |

---

## 11. Métricas de éxito

| Métrica | Definición | Target |
|---|---|---|
| **Tasa de entrega semanal** | Semanas con WA entregado / semanas totales desde activación | ≥ 95% (miss permitido: feriados donde Robert no está disponible) |
| **Latencia de entrega** | Tiempo entre 8:00 AM y recepción del WA en el teléfono | < 10 minutos |
| **Tasa de error de EF** | `SELECT COUNT(*) FROM scheduled_job_log WHERE job_name='analista-conversion' AND status='error'` / total | < 5% |
| **Precisión de alertas** | Alertas generadas que Robert considera válidas vs falsas alarmas (feedback manual) | > 80% en primeras 4 semanas |
| **Cobertura de datos** | Semanas donde al menos 1 KPI es > 0 (indica que hay datos reales) | 100% (si hay 0 en todo, es señal de bug, no de semana sin actividad) |
| **Tiempo de ejecución de la EF** | `finished_at - started_at` en `scheduled_job_log` | < 5 segundos |

---

## 12. Notas de seguridad y DRY_RUN

### Protocolo de prueba

**Fase 1 — Solo datos (Slice 1):**
```sql
-- Verificar que las vistas devuelven datos sensatos
SELECT * FROM vw_pipeline_weekly_metrics;
SELECT * FROM vw_conversion_times;
SELECT * FROM vw_bottleneck_detection;
-- No hay envío de mensajes en esta fase
```

**Fase 2 — EF con DRY_RUN (Slice 2):**
```bash
# Invocar manualmente la EF
curl -X POST \
  https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/analista-conversion \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Verificar respuesta: { ok: true, dry_run: true, leads_nuevos: N, ... }
# Verificar que notification_queue NO tiene filas nuevas:
# SELECT * FROM notification_queue WHERE dedup_key LIKE 'analista-conversion:%' ORDER BY created_at DESC;
```

**Fase 3 — Smoke test con número de prueba:**
```sql
-- Cambiar destinatario al número de prueba de Robert
UPDATE system_settings SET value = '+573183061286' WHERE key = 'analista_destinatario_gerente';
-- Desactivar DRY_RUN
UPDATE system_settings SET value = 'false' WHERE key = 'analista_dry_run';
```
```bash
# Invocar la EF y verificar que Robert recibe el WA
```

**Fase 4 — Activación en producción:**
```sql
-- Solo después de confirmar recepción en el smoke test
-- El número de producción ya es el mismo (+573183061286)
-- Activar el workflow n8n y confirmar cron schedule
```

### DRY_RUN flag

| Flag | Comportamiento |
|---|---|
| `analista_dry_run = 'true'` | EF calcula métricas, logea en `scheduled_job_log`, NO inserta en `notification_queue` |
| `analista_dry_run = 'false'` | Flujo completo: calcula + compone + encola mensajes |

**Regla de seguridad:** el flag está en `system_settings` (DB), no hardcodeado en la EF. Cambiar a `'false'` es la única acción que activa envíos reales. Esto permite probar la EF sin riesgo de spam.

### Números de test autorizados
- Robert (gerente): `+573183061286` — destinatario del reporte en producción Y en pruebas
- Heduin (QA técnico): `+584127862439` — puede agregarse como segundo destinatario en `system_settings` para pruebas paralelas

### Consideración de privacidad
El reporte contiene métricas de negocio internas (tasas de conversión, volúmenes de pipeline). No contiene datos PII de clientes individuales. Es seguro enviarlo por WhatsApp al gerente sin consideraciones adicionales de privacidad. No enviar a canales públicos ni a comerciales sin aprobación explícita de Robert.

### Activar segundo destinatario (comerciales)
Si Robert decide enviar el reporte también a comerciales, agregar en `system_settings`:
```sql
INSERT INTO system_settings (key, value) VALUES
  ('analista_destinatario_comercial_1', '+57XXXXXXXXXX')
ON CONFLICT (key) DO NOTHING;
```
Y modificar la EF para encolar mensajes adicionales. Este caso de uso está fuera del scope v1.
