# PRD: Monitor de Capacidad

**Capa:** 05 — Inteligencia
**Prioridad:** BAJA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Monitor de Capacidad es un agente que corre diariamente y cruza el número de proyectos activos en fabricación e instalación contra la capacidad máxima configurada del taller. Cuando la carga supera umbrales definidos (80% = amarillo, 100% = rojo), envía una alerta proactiva al gerente por WhatsApp con el detalle de la situación y una estimación de cuándo se libera capacidad.

El agente resuelve un problema operativo crítico: sin visibilidad de carga en tiempo real, el equipo comercial puede seguir aprobando proyectos aunque el taller esté saturado, generando incumplimientos de entrega y deterioro de la experiencia del cliente. Con este monitor, el gerente recibe la señal antes de que el problema sea visible.

Este agente es complementario al Coordinador de Producción (que gestiona transiciones de estado) — mientras el Coordinador actúa sobre eventos puntuales, el Monitor de Capacidad ofrece una vista agregada y proactiva del riesgo operativo.

---

## 2. Problema que resuelve

En Innovar Cocinas, el taller tiene una capacidad física real (cantidad de proyectos que puede ejecutar simultáneamente en fabricación e instalación). Hoy esa capacidad no está monitoreada de forma sistémica: el gerente solo descubre saturación cuando ya hay retrasos.

El pain point concreto:

- No existe un número definido de "capacidad máxima" accesible al sistema — está en la cabeza del gerente.
- El equipo comercial aprueba cotizaciones sin saber si el taller puede absorber el proyecto en el plazo prometido.
- La única señal de saturación son los retrasos ya ocurridos — el sistema es reactivo, no proactivo.
- El gerente no tiene un dashboard de carga operativa; tiene que consultar manualmente `projects` para estimar la situación.

El Monitor de Capacidad convierte este proceso manual y reactivo en un sistema automático y proactivo: el gerente solo recibe una alerta cuando hay riesgo real, y la alerta incluye todo lo que necesita para tomar decisiones (carga actual, proyectos en cola, fecha estimada de liberación).

---

## 3. Infraestructura existente que se reutiliza

**Tablas:**
- `projects` — fuente de verdad de proyectos activos; campos clave: `id`, `status`, `delivery_date`, `client_id`
- `clients` — para obtener nombres de clientes en la lista de proyectos activos
- `system_settings` — almacenará `workshop_max_capacity` y los umbrales configurables
- `notification_queue` — patrón de encolamiento WA existente; INSERT aquí → EF recoge y envía
- `scheduled_job_log` — registro de ejecuciones de cron para evitar alertas duplicadas en el mismo día
- `whatsapp_message_log` — trazabilidad de mensajes enviados

**Edge Functions:**
- `process-whatsapp-notifications` — ya procesa `notification_queue` cada minuto; no requiere modificación

**Patrones documentados:**
- Patrón cron Supabase (`cron.schedule` + `net.http_post`) — reutilizar exactamente
- Patrón `dedup_key` en `notification_queue` — evita alertas duplicadas el mismo día
- Patrón `scheduled_job_log` — registrar inicio/fin/estado de cada ejecución del cron

**Templates WhatsApp aprobados reutilizables:**
- Ninguno del TEMPLATE_REGISTRY actual aplica directamente — los dos templates de este agente son nuevos (ver Sección 6).

---

## 4. Gap Analysis — Lo que hay que construir

**Templates WhatsApp (nuevos, pendientes de aprobación Meta):**
- `alerta_capacidad_amarilla_v1` — alerta de riesgo moderado (carga entre 80% y 99%)
- `alerta_capacidad_roja_v1` — alerta de saturación crítica (carga >= 100%)

**En `system_settings` (filas a insertar si no existen):**
- `workshop_max_capacity` — número entero, capacidad máxima de proyectos simultáneos
- `capacity_alert_threshold_yellow` — porcentaje decimal (default: 0.80)
- `capacity_alert_threshold_red` — porcentaje decimal (default: 1.00)
- `capacity_monitor_recipient_phone` — teléfono del gerente (formato 57XXXXXXXXXX)
- `capacity_monitor_dry_run` — boolean string ("true"/"false"), default "true"

**Edge Function nueva:**
- `monitor-capacidad` — función HTTP invocada por pg_cron; ejecuta el cálculo, evalúa umbrales, encola alertas

**Cron job nuevo:**
- `monitor-capacidad-daily` — corre diariamente a las 8:00 AM hora Colombia (13:00 UTC)

**Sin necesidad de nuevas tablas** — todo se resuelve con `system_settings`, `notification_queue`, `scheduled_job_log` y `projects`.

---

## 5. Arquitectura Técnica

**Stack:**
- Trigger: `pg_cron` → `net.http_post` → Edge Function `monitor-capacidad`
- Cálculo: SQL dentro de la EF (query directo a `projects` y `system_settings`)
- Notificación: INSERT en `notification_queue` → `process-whatsapp-notifications` (ya existente, sin cambios)
- Deduplicación: `dedup_key` en `notification_queue` + consulta a `scheduled_job_log`

**Flujo secuencial:**

```
pg_cron (8:00 AM COL)
    │
    ▼
EF: monitor-capacidad
    │
    ├─ [1] Leer system_settings
    │       workshop_max_capacity
    │       capacity_alert_threshold_yellow  (default 0.80)
    │       capacity_alert_threshold_red     (default 1.00)
    │       capacity_monitor_recipient_phone
    │       capacity_monitor_dry_run
    │
    ├─ [2] Calcular carga activa
    │       SELECT COUNT(*) FROM projects
    │       WHERE status IN ('in_fabrication', 'installation')
    │
    ├─ [3] Evaluar umbral
    │       ratio = carga_activa / workshop_max_capacity
    │       ratio < yellow_threshold → EXIT (sin alerta, log OK)
    │       yellow_threshold <= ratio < red_threshold → alerta AMARILLA
    │       ratio >= red_threshold → alerta ROJA
    │
    ├─ [4] Verificar dedup (¿ya se alertó hoy?)
    │       Consultar scheduled_job_log: job_name = 'monitor-capacidad-daily'
    │       + mismo nivel de alerta + started_at::date = today
    │       Si ya existe registro con mismo nivel → EXIT (sin duplicado)
    │
    ├─ [5] Calcular fecha estimada de liberación
    │       SELECT AVG(delivery_date) FROM projects
    │       WHERE status IN ('in_fabrication', 'installation')
    │       AND delivery_date IS NOT NULL
    │
    ├─ [6] Obtener lista de proyectos activos (para el mensaje)
    │       SELECT p.id, c.name, p.delivery_date
    │       FROM projects p JOIN clients c ON p.client_id = c.id
    │       WHERE p.status IN ('in_fabrication', 'installation')
    │       ORDER BY p.delivery_date ASC
    │       LIMIT 5
    │
    ├─ [7] Encolar alerta en notification_queue
    │       (solo si DRY_RUN = false)
    │       template: alerta_capacidad_amarilla_v1 | alerta_capacidad_roja_v1
    │       dedup_key: monitor-capacidad:{nivel}:{fecha_hoy}
    │
    └─ [8] Registrar en scheduled_job_log
            job_name, started_at, finished_at, rows_processed, status
```

**Data flow:**

```
projects (status filter)
    │
    ▼
monitor-capacidad EF
    │
    ├── system_settings (leer config)
    │
    ├── scheduled_job_log (leer dedup + escribir resultado)
    │
    └── notification_queue (escribir alerta si aplica)
                │
                ▼
    process-whatsapp-notifications EF (existente)
                │
                ▼
        Meta WhatsApp API → Teléfono gerente
```

---

## 6. Templates WhatsApp requeridos

### Template 1: `alerta_capacidad_amarilla_v1`

**Estado:** NUEVO — pendiente creación y aprobación Meta
**Categoría Meta:** UTILITY
**Idioma:** es (español)
**Variables:** 4

| Variable | Contenido |
|---|---|
| `{{1}}` | carga_activa (número entero, ej: "8") |
| `{{2}}` | workshop_max_capacity (número entero, ej: "10") |
| `{{3}}` | porcentaje_ocupacion (ej: "80%") |
| `{{4}}` | fecha_estimada_liberacion (ej: "15 jun 2026") |

**Texto propuesto para Meta:**

```
⚠️ Alerta de capacidad — Taller al {{3}}

Hola, tienes {{1}} de {{2}} proyectos activos en fabricación/instalación.

Fecha estimada de liberación: {{4}}.

Revisa la cola de producción para tomar decisiones de agenda.
```

**Nota:** 149 caracteres en el cuerpo, dentro del límite. Tono informativo, sin alarmar. El gerente ya sabe interpretarlo.

---

### Template 2: `alerta_capacidad_roja_v1`

**Estado:** NUEVO — pendiente creación y aprobación Meta
**Categoría Meta:** UTILITY
**Idioma:** es (español)
**Variables:** 4

| Variable | Contenido |
|---|---|
| `{{1}}` | carga_activa (número entero, ej: "11") |
| `{{2}}` | workshop_max_capacity (número entero, ej: "10") |
| `{{3}}` | porcentaje_ocupacion (ej: "110%") |
| `{{4}}` | fecha_estimada_liberacion (ej: "20 jun 2026") |

**Texto propuesto para Meta:**

```
🔴 TALLER SATURADO — {{3}} de capacidad

Tienes {{1}} proyectos activos vs capacidad máxima de {{2}}.

Próxima liberación estimada: {{4}}.

No agendar nuevas entregas hasta revisar producción.
```

**Nota:** 148 caracteres. Tono de urgencia moderada. La recomendación final es accionable y concreta.

---

**Dedup key pattern para ambos templates:**

```
monitor-capacidad:{nivel}:{YYYY-MM-DD}
```

Ejemplos:
- `monitor-capacidad:amarillo:2026-06-09`
- `monitor-capacidad:rojo:2026-06-09`

Esto garantiza que si el cron corre y ya se envió alerta del mismo nivel hoy, no se duplica el mensaje.

---

## 7. Schema de datos

### Filas nuevas en `system_settings`

```sql
-- Ejecutar una sola vez (idempotente con ON CONFLICT)
INSERT INTO system_settings (key, value) VALUES
  ('workshop_max_capacity',            '10'),
  ('capacity_alert_threshold_yellow',  '0.80'),
  ('capacity_alert_threshold_red',     '1.00'),
  ('capacity_monitor_recipient_phone', '573XXXXXXXXX'),  -- reemplazar con teléfono real del gerente
  ('capacity_monitor_dry_run',         'true')
ON CONFLICT (key) DO NOTHING;
```

**Tipos efectivos (value es TEXT en system_settings):**
- `workshop_max_capacity` → parsear como INTEGER en la EF
- `capacity_alert_threshold_yellow` / `_red` → parsear como FLOAT
- `capacity_monitor_recipient_phone` → string directo
- `capacity_monitor_dry_run` → comparar como `value = 'true'`

### Tabla `scheduled_job_log` (ya existe — no requiere cambios)

Campos utilizados por este agente:
- `job_name` TEXT — valor fijo: `'monitor-capacidad-daily'`
- `started_at` TIMESTAMPTZ
- `finished_at` TIMESTAMPTZ
- `rows_processed` INTEGER — número de proyectos activos encontrados
- `status` TEXT — `'ok_verde'` | `'ok_amarillo'` | `'ok_rojo'` | `'error'`

La columna `status` puede tener valores nuevos vs los existentes — verificar si hay CHECK CONSTRAINT y ampliar si fuera necesario. Si la tabla acepta texto libre, no requiere migración.

### Tabla `notification_queue` (ya existe — campos relevantes)

```
recipient_phone     TEXT    -- valor de capacity_monitor_recipient_phone
template_name       TEXT    -- 'alerta_capacidad_amarilla_v1' | 'alerta_capacidad_roja_v1'
template_language   TEXT    -- 'es'
template_parameters JSONB   -- ver estructura abajo
dedup_key           TEXT    -- 'monitor-capacidad:{nivel}:{fecha}'
status              TEXT    -- 'pending' al insertar
```

**Estructura `template_parameters` para ambos templates:**

```json
{
  "1": "8",
  "2": "10",
  "3": "80%",
  "4": "15 jun 2026"
}
```

### Índice recomendado (si no existe)

```sql
-- Para acelerar la consulta de dedup diario en scheduled_job_log
CREATE INDEX IF NOT EXISTS idx_scheduled_job_log_name_date
ON scheduled_job_log (job_name, (started_at::date));
```

---

## 8. Implementación paso a paso

### Slice 1: Configuración y datos base

**Qué incluye:**
- Insertar filas de configuración en `system_settings`
- Verificar que `scheduled_job_log` acepta los nuevos valores de `status`
- Crear el índice de dedup en `scheduled_job_log`
- Confirmar que `notification_queue` tiene columna `dedup_key` (agregar si no existe)

**SQL necesario:**

```sql
-- 1a. Configuración del agente
INSERT INTO system_settings (key, value) VALUES
  ('workshop_max_capacity',            '10'),
  ('capacity_alert_threshold_yellow',  '0.80'),
  ('capacity_alert_threshold_red',     '1.00'),
  ('capacity_monitor_recipient_phone', '573XXXXXXXXX'),
  ('capacity_monitor_dry_run',         'true')
ON CONFLICT (key) DO NOTHING;

-- 1b. Índice para dedup en scheduled_job_log
CREATE INDEX IF NOT EXISTS idx_scheduled_job_log_name_date
ON scheduled_job_log (job_name, (started_at::date));

-- 1c. Columna dedup_key en notification_queue (si no existe)
ALTER TABLE notification_queue
ADD COLUMN IF NOT EXISTS dedup_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_queue_dedup_key
ON notification_queue (dedup_key)
WHERE dedup_key IS NOT NULL AND status != 'failed';

-- 1d. Verificación rápida (ejecutar y revisar output)
SELECT key, value FROM system_settings
WHERE key LIKE 'capacity_%' OR key = 'workshop_max_capacity';

SELECT COUNT(*) as proyectos_activos
FROM projects
WHERE status IN ('in_fabrication', 'installation');
```

**Criterio de aceptación del Slice 1:**
- Las 5 filas de `system_settings` existen con los valores correctos
- `SELECT COUNT(*) FROM projects WHERE status IN ('in_fabrication','installation')` retorna un número (puede ser 0)
- El índice `idx_scheduled_job_log_name_date` existe
- La columna `dedup_key` existe en `notification_queue`

---

### Slice 2: Edge Function `monitor-capacidad`

**Qué incluye:**
- Crear la EF en `supabase/functions/monitor-capacidad/index.ts`
- La función implementa el flujo completo (leer config → calcular → evaluar → dedup → encolar → loguear)
- DRY_RUN activo por defecto (solo loguea, no encola)

**Archivo:** `supabase/functions/monitor-capacidad/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (_req) => {
  const startedAt = new Date()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const jobName = 'monitor-capacidad-daily'
  let jobStatus = 'ok_verde'
  let rowsProcessed = 0

  try {
    // [1] Leer configuración
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'workshop_max_capacity',
        'capacity_alert_threshold_yellow',
        'capacity_alert_threshold_red',
        'capacity_monitor_recipient_phone',
        'capacity_monitor_dry_run',
      ])

    const config: Record<string, string> = {}
    for (const row of settings ?? []) config[row.key] = row.value

    const maxCapacity = parseInt(config['workshop_max_capacity'] ?? '10', 10)
    const thresholdYellow = parseFloat(config['capacity_alert_threshold_yellow'] ?? '0.80')
    const thresholdRed = parseFloat(config['capacity_alert_threshold_red'] ?? '1.00')
    const recipientPhone = config['capacity_monitor_recipient_phone'] ?? ''
    const dryRun = (config['capacity_monitor_dry_run'] ?? 'true') === 'true'

    // [2] Calcular carga activa
    const { count: activeCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .in('status', ['in_fabrication', 'installation'])

    rowsProcessed = activeCount ?? 0
    const ratio = rowsProcessed / maxCapacity
    const pct = Math.round(ratio * 100)

    // [3] Evaluar umbral
    let alertLevel: 'verde' | 'amarillo' | 'rojo' = 'verde'
    if (ratio >= thresholdRed) alertLevel = 'rojo'
    else if (ratio >= thresholdYellow) alertLevel = 'amarillo'

    if (alertLevel === 'verde') {
      // Sin alerta — registrar y salir
      jobStatus = 'ok_verde'
      await logJob(supabase, jobName, startedAt, jobStatus, rowsProcessed)
      return new Response(JSON.stringify({ status: 'verde', ratio: pct }), { status: 200 })
    }

    // [4] Verificar dedup — ¿ya se alertó hoy con este nivel?
    const today = new Date().toISOString().slice(0, 10)
    const dedupKey = `monitor-capacidad:${alertLevel}:${today}`

    const { data: existing } = await supabase
      .from('notification_queue')
      .select('id')
      .eq('dedup_key', dedupKey)
      .limit(1)

    if (existing && existing.length > 0) {
      jobStatus = `ok_${alertLevel}_dedup`
      await logJob(supabase, jobName, startedAt, jobStatus, rowsProcessed)
      return new Response(JSON.stringify({ status: 'dedup', level: alertLevel }), { status: 200 })
    }

    // [5] Calcular fecha estimada de liberación
    const { data: activeProjects } = await supabase
      .from('projects')
      .select('id, delivery_date, clients(name)')
      .in('status', ['in_fabrication', 'installation'])
      .order('delivery_date', { ascending: true })

    let fechaLiberacion = 'No disponible'
    if (activeProjects && activeProjects.length > 0) {
      const validDates = activeProjects
        .map((p) => p.delivery_date)
        .filter(Boolean)
        .map((d) => new Date(d).getTime())

      if (validDates.length > 0) {
        const avgTimestamp = validDates.reduce((a, b) => a + b, 0) / validDates.length
        const avgDate = new Date(avgTimestamp)
        fechaLiberacion = avgDate.toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      }
    }

    // [6] Encolar alerta (o solo loguear en DRY_RUN)
    const templateName =
      alertLevel === 'rojo' ? 'alerta_capacidad_roja_v1' : 'alerta_capacidad_amarilla_v1'

    const templateParameters = {
      '1': String(rowsProcessed),
      '2': String(maxCapacity),
      '3': `${pct}%`,
      '4': fechaLiberacion,
    }

    if (!dryRun && recipientPhone) {
      await supabase.from('notification_queue').insert({
        recipient_phone: recipientPhone,
        template_name: templateName,
        template_language: 'es',
        template_parameters: templateParameters,
        dedup_key: dedupKey,
        status: 'pending',
        attempt_count: 0,
      })
    } else {
      console.log('[DRY_RUN] No se encoló:', { templateName, templateParameters, dedupKey })
    }

    jobStatus = `ok_${alertLevel}`
    await logJob(supabase, jobName, startedAt, jobStatus, rowsProcessed)

    return new Response(
      JSON.stringify({ status: alertLevel, ratio: pct, dryRun, dedupKey }),
      { status: 200 }
    )
  } catch (err) {
    console.error('[monitor-capacidad] Error:', err)
    await logJob(supabase, jobName, startedAt, 'error', rowsProcessed)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

async function logJob(
  supabase: ReturnType<typeof createClient>,
  jobName: string,
  startedAt: Date,
  status: string,
  rowsProcessed: number
) {
  await supabase.from('scheduled_job_log').insert({
    job_name: jobName,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    rows_processed: rowsProcessed,
    status,
  })
}
```

**Comando de deploy:**

```bash
supabase functions deploy monitor-capacidad --project-ref xdzbjptozeqcbnaqhtye
```

**Criterio de aceptación del Slice 2:**
- La EF deploya sin errores de compilación TypeScript
- Invocar manualmente con `curl` retorna `{"status":"verde"}` o `{"status":"amarillo","dryRun":true}` según carga real
- Se crea una fila en `scheduled_job_log` con `job_name = 'monitor-capacidad-daily'` en cada invocación
- En DRY_RUN, NO se inserta nada en `notification_queue`

---

### Slice 3: Cron job + activación en producción

**Qué incluye:**
- Registrar el cron job en pg_cron (8:00 AM Colombia = 13:00 UTC)
- Cambiar `capacity_monitor_dry_run` a `'false'` en `system_settings` una vez aprobados los templates
- Verificar que los templates Meta están aprobados antes de activar
- Test de smoke en producción

**SQL para registrar el cron:**

```sql
-- Registrar el cron (idempotente: primero unschedule si ya existe)
SELECT cron.unschedule('monitor-capacidad-daily');

SELECT cron.schedule(
  'monitor-capacidad-daily',
  '0 13 * * *',   -- 13:00 UTC = 08:00 AM Colombia (UTC-5)
  $$
  SELECT net.http_post(
    url    := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/monitor-capacidad',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body   := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verificar que quedó registrado
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'monitor-capacidad-daily';
```

**Activación en producción (ejecutar solo cuando templates Meta aprobados):**

```sql
UPDATE system_settings
SET value = 'false'
WHERE key = 'capacity_monitor_dry_run';

-- Confirmar teléfono del gerente antes de activar
UPDATE system_settings
SET value = '573XXXXXXXXX'    -- reemplazar con número real
WHERE key = 'capacity_monitor_recipient_phone';
```

**Test de smoke post-activación:**

```sql
-- 1. Verificar estado actual de carga
SELECT
  COUNT(*) AS carga_activa,
  (SELECT value::int FROM system_settings WHERE key = 'workshop_max_capacity') AS max_capacity,
  ROUND(COUNT(*) * 100.0 /
    (SELECT value::int FROM system_settings WHERE key = 'workshop_max_capacity'), 1) AS pct_ocupacion
FROM projects
WHERE status IN ('in_fabrication', 'installation');

-- 2. Revisar últimas ejecuciones del cron
SELECT job_name, started_at, status, rows_processed
FROM scheduled_job_log
WHERE job_name = 'monitor-capacidad-daily'
ORDER BY started_at DESC
LIMIT 5;

-- 3. Revisar cola de notificaciones generadas
SELECT id, template_name, template_parameters, dedup_key, status, created_at
FROM notification_queue
WHERE dedup_key LIKE 'monitor-capacidad:%'
ORDER BY created_at DESC
LIMIT 5;
```

**Criterio de aceptación del Slice 3:**
- `SELECT * FROM cron.job WHERE jobname = 'monitor-capacidad-daily'` retorna una fila con `active = true`
- Al día siguiente de activar, existe una fila en `scheduled_job_log` con `started_at` entre 13:00 y 13:05 UTC
- Si la carga supera el umbral, existe una fila en `notification_queue` con el `dedup_key` del día
- El gerente confirma haber recibido el WA (o no, si carga está en verde — eso también es correcto)

---

## 9. Criterios de aceptación globales

- [ ] Las 5 filas de configuración existen en `system_settings` con valores coherentes
- [ ] `workshop_max_capacity` refleja la capacidad real del taller de Innovar Cocinas
- [ ] La EF `monitor-capacidad` deploya sin errores y retorna HTTP 200 en invocación manual
- [ ] En DRY_RUN=true, cero inserciones en `notification_queue` (loguea en consola)
- [ ] En DRY_RUN=false con carga en verde, cero inserciones en `notification_queue`
- [ ] En DRY_RUN=false con carga en amarillo/rojo, una sola inserción en `notification_queue` por día (dedup activo)
- [ ] Si el cron corre dos veces en el mismo día (ej: re-run manual), la segunda ejecución detecta el dedup y NO encola
- [ ] Los templates `alerta_capacidad_amarilla_v1` y `alerta_capacidad_roja_v1` están aprobados en Meta antes de activar producción
- [ ] El gerente recibe el WA en su teléfono en prueba antes de activar producción
- [ ] `scheduled_job_log` tiene registro de cada ejecución con `status` correcto
- [ ] Cambiar `workshop_max_capacity` en `system_settings` cambia el comportamiento sin redeploy

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Templates `alerta_capacidad_*` rechazados por Meta | Media | Someter en categoría UTILITY con texto exactamente propuesto; evitar emojis en el cuerpo si Meta lo rechaza; tener versión sin emojis lista |
| `system_settings` no tiene fila `workshop_max_capacity` → división por cero | Baja | La EF usa `?? '10'` como default y parsea con `parseInt`; agregar guard explícito: `if (maxCapacity === 0) return early` |
| El gerente cambia de teléfono y `capacity_monitor_recipient_phone` queda desactualizado | Media | Documentar en `system_settings` que este campo es editable desde el dashboard; no hardcodear en código |
| Proyectos con `delivery_date = NULL` sesgan el promedio de liberación | Media | La EF ya filtra `.filter(Boolean)` antes de promediar; si todos tienen NULL, muestra "No disponible" |
| Saturación de alertas si el taller está crónicamente saturado | Media | El `dedup_key` garantiza máximo 1 alerta por nivel por día; si el gerente quiere silenciar, puede subir el umbral en `system_settings` |
| CHECK CONSTRAINT en `scheduled_job_log.status` rechaza valores nuevos | Baja | Verificar con `\d scheduled_job_log` antes del Slice 2; ampliar constraint si existe |
| `net.http_post` no disponible en el plan de Supabase | Baja | Verificar con `SELECT * FROM pg_extension WHERE extname = 'pg_net'`; si no existe, usar n8n Schedule como trigger alternativo |

---

## 11. Métricas de éxito

| Métrica | Target | Cómo medir |
|---|---|---|
| Tasa de ejecución del cron | 100% de días laborables | `SELECT COUNT(*) FROM scheduled_job_log WHERE job_name = 'monitor-capacidad-daily' AND started_at > NOW() - INTERVAL '30 days'` debe ser ≈ 22 (30 días corridos) |
| Tasa de falsos positivos | 0% | Verificar manualmente que cuando WA dice "80%" la cuenta real de `projects` confirma esa carga |
| Tiempo hasta alerta | < 5 minutos desde que cron dispara | `finished_at - started_at` en `scheduled_job_log` < 30 segundos; WA llega < 5 min tras eso |
| Alertas duplicadas en un día | 0 | Consultar `notification_queue WHERE dedup_key LIKE 'monitor-capacidad:%' AND created_at::date = today` debe retornar máximo 1 fila por nivel |
| Cobertura de delivery_date | > 80% de proyectos activos tienen fecha | `SELECT COUNT(*) FILTER (WHERE delivery_date IS NOT NULL) * 100.0 / COUNT(*) FROM projects WHERE status IN ('in_fabrication','installation')` |
| Adopción gerencial | El gerente reporta que la alerta es útil en las primeras 2 semanas | Feedback cualitativo en reunión de revisión |

---

## 12. Notas de seguridad y DRY_RUN

### Protocolo de prueba obligatorio

**Fase 1 — DRY_RUN (obligatorio antes de cualquier envío real):**

```sql
-- Confirmar que DRY_RUN está activo
SELECT value FROM system_settings WHERE key = 'capacity_monitor_dry_run';
-- Debe retornar: 'true'
```

Invocar la EF manualmente y verificar output en los logs de Supabase:
```bash
curl -X POST \
  https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/monitor-capacidad \
  -H "Authorization: Bearer {SERVICE_ROLE_KEY}"
```

Revisar logs en Supabase Dashboard → Edge Functions → monitor-capacidad → Logs.
Confirmar que aparece `[DRY_RUN] No se encoló:` si la carga supera el umbral.

**Fase 2 — Test con número real (antes de activar producción):**

```sql
-- Apuntar a número de prueba (Robert o Heduin)
UPDATE system_settings SET value = '573183061286' WHERE key = 'capacity_monitor_recipient_phone';

-- Activar envío real
UPDATE system_settings SET value = 'false' WHERE key = 'capacity_monitor_dry_run';

-- Si la carga actual NO supera el umbral, bajar temporalmente el umbral para forzar una alerta
UPDATE system_settings SET value = '0.01' WHERE key = 'capacity_alert_threshold_yellow';
```

Invocar manualmente, confirmar recepción del WA en el número de prueba. Luego restaurar:

```sql
UPDATE system_settings SET value = '0.80' WHERE key = 'capacity_alert_threshold_yellow';
UPDATE system_settings SET value = '573XXXXXXXXX' WHERE key = 'capacity_monitor_recipient_phone'; -- gerente real
```

**Fase 3 — Activación en producción:**

Solo proceder cuando:
1. Templates Meta `alerta_capacidad_amarilla_v1` y `alerta_capacidad_roja_v1` tienen estado APPROVED en Meta Business Manager
2. Test con número de prueba fue exitoso (WA recibido, contenido correcto)
3. `workshop_max_capacity` tiene el valor real del taller (no el default de 10)
4. Teléfono del gerente configurado en `capacity_monitor_recipient_phone`

### Números de test autorizados

- Robert (dueño del sistema): `+57 318 306 1286` → en Supabase: `573183061286`
- Heduin (equipo interno): `+58 412-786-2439` → en Supabase: `584127862439`

**Nunca enviar alertas de prueba a clientes reales.**

### Seguridad de la EF

- La EF usa `SUPABASE_SERVICE_ROLE_KEY` (env var inyectada automáticamente por Supabase) — no exponer en código
- El cron invoca la EF con `Authorization: Bearer {service_role_key}` — no requiere JWT de usuario
- Agregar `verify_jwt = false` en el `config.toml` de la función si el cron no puede proveer un JWT válido:

```toml
# supabase/functions/monitor-capacidad/config.toml
[functions.monitor-capacidad]
verify_jwt = false
```
