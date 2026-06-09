# PRD: Reactivador de Clientes
**Capa:** 04 — Retención
**Prioridad:** BAJA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Reactivador de Clientes es un agente autónomo de retención que opera mensualmente sobre la base de proyectos entregados de Innovar Cocinas. Su función principal es detectar, exactamente 9 meses después de la entrega de cada proyecto, a los clientes que completaron su proceso y enviarles un mensaje personalizado vía WhatsApp con una propuesta de re-engagement: remodelación o actualización de su cocina, o bien una solicitud de referido hacia personas de su entorno.

El agente resuelve un problema de capital para el negocio: los clientes satisfechos son el canal de adquisición más económico y efectivo, pero sin una automatización activa, ese potencial se pierde por simple inacción. A los 9 meses de la entrega, el cliente ya usa y disfruta su cocina, la satisfacción está consolidada, y el momento psicológico para hablar de mejoras o referidos es óptimo. Sin este agente, ese momento pasa sin que la empresa lo capture.

El impacto esperado es doble: generar pipeline de remodelaciones (proyectos de expansión sobre trabajos ya entregados, con ticket histórico conocido) y activar un canal de referidos que alimente el top del embudo sin costo publicitario. Ambas acciones quedan registradas en la tabla `client_reactivation_log` para garantizar que ningún cliente sea contactado más de una vez por este motivo y para medir la conversión a largo plazo.

---

## 2. Problema que resuelve

Innovar Cocinas tiene clientes que completaron proyectos exitosamente, pagaron y recibieron su obra. Pasados 9-12 meses, muchos de ellos considerarían una remodelación adicional (baño, closet, área de lavado) o estarían dispuestos a recomendar la empresa a conocidos. Sin embargo, sin un sistema activo de seguimiento, ese cliente entra en silencio absoluto: no recibe ninguna comunicación de la empresa y la probabilidad de re-engagement cae exponencialmente con el tiempo.

El pain point concreto es la ausencia de un proceso sistemático de contacto post-entrega. El equipo comercial está enfocado en leads nuevos y no tiene capacidad operativa para revisar manualmente el historial de proyectos entregados y generar contactos proactivos. El resultado: clientes satisfechos que hubieran referido o comprado de nuevo nunca lo hacen porque nadie los contactó en el momento oportuno.

---

## 3. Infraestructura existente que se reutiliza

**Tablas Supabase:**
- `projects` — contiene `id`, `client_id`, `opportunity_id`, `status`, `delivery_date` (campo clave del agente)
- `clients` — contiene `id`, `name`, `whatsapp_phone`
- `opportunities` — para obtener monto total del proyecto vía JOIN con `quotations`
- `quotations` — `total_amount` determina si el cliente recibe template de remodelación o referido
- `notification_queue` — cola central de WhatsApp; el agente hace INSERT aquí
- `whatsapp_message_log` — trazabilidad de envíos
- `scheduled_job_log` — log de ejecuciones del cron
- `system_settings` — para guardar configuración del agente (threshold de monto, DRY_RUN flag)

**Edge Functions:**
- `process-whatsapp-notifications` — ya maneja el despacho a Meta API; no hay que modificarla

**Patrones reutilizables:**
- Patrón de encolamiento: INSERT en `notification_queue` con `dedup_key`
- Patrón de cron: `cron.schedule` + `net.http_post` hacia Edge Function
- Patrón `scheduled_job_log`: ya documentado en el proyecto para audit trail de jobs

**Templates WhatsApp existentes que NO aplican directamente pero establecen el patrón:**
- `proyecto_completado_v1` — modelo de tono y estructura para comunicaciones post-proyecto

---

## 4. Gap Analysis — Lo que hay que construir

**Templates WhatsApp (nuevos, requieren aprobación Meta):**
- `reactivacion_remodelacion_v1` — no existe, hay que crear y someter a Meta
- `reactivacion_referido_v1` — no existe, hay que crear y someter a Meta

**Tabla nueva:**
- `client_reactivation_log` — no existe; necesaria para evitar re-contactos y medir resultados

**Campo nuevo en tabla existente:**
- `projects.delivery_date` — verificar si existe en producción; si no, agregar como `DATE NULL`

**Edge Function nueva:**
- `reactivate-clients` — lógica central del agente: consulta proyectos, decide template, encola mensajes, registra log

**Cron job nuevo:**
- Job pg_cron mensual que invoca `reactivate-clients` el día 1 de cada mes a las 9:00 AM hora Bogotá

**Migraciones SQL:**
- Migration 001: `client_reactivation_log` + índices
- Migration 002: verificar/agregar `projects.delivery_date`
- Migration 003: `system_settings` entries para configuración del agente
- Migration 004: `cron.schedule` para el job mensual

**Configuración system_settings:**
- `reactivador_clientes.dry_run` — `true` inicialmente
- `reactivador_clientes.monto_threshold_remodelacion` — `5000000` (COP, ajustable)
- `reactivador_clientes.dry_run_phone` — `+573183061286`
- `reactivador_clientes.ventana_dias` — `7` (±7 días alrededor de los 9 meses)

---

## 5. Arquitectura Técnica

### Stack
- **Scheduler:** pg_cron (Supabase nativo) — disparo mensual día 1
- **Orquestador:** Edge Function `reactivate-clients` (Deno/TypeScript)
- **Cola de mensajería:** tabla `notification_queue` (patrón existente)
- **Despachador WA:** Edge Function `process-whatsapp-notifications` (sin cambios)
- **Persistencia de audit:** `client_reactivation_log` + `scheduled_job_log`

### Flujo secuencial

```
[Día 1 del mes, 9:00 AM UTC-5]
        │
        ▼
[pg_cron] → POST /functions/v1/reactivate-clients
        │
        ▼
[EF: reactivate-clients]
  1. Leer config de system_settings
     (dry_run, monto_threshold, ventana_dias)
        │
        ▼
  2. Consultar proyectos elegibles:
     WHERE status = 'delivered' OR status = 'completed'
     AND delivery_date BETWEEN
         (now() - interval '9 months' - interval '{ventana_dias} days')
         AND
         (now() - interval '9 months' + interval '{ventana_dias} days')
     AND id NOT IN (SELECT project_id FROM client_reactivation_log)
        │
        ▼
  3. Para cada proyecto elegible:
     JOIN clients → obtener nombre + whatsapp_phone
     JOIN opportunities → JOIN quotations (approved)
     → obtener total_amount
        │
        ▼
  4. Decidir template:
     IF total_amount >= monto_threshold → reactivacion_remodelacion_v1
     ELSE                              → reactivacion_referido_v1
        │
        ▼
  5. Construir parámetros del template
     (nombre_cliente, nombre_proyecto, etc.)
        │
        ▼
  6. IF dry_run=true → phone = dry_run_phone
     ELSE            → phone = client.whatsapp_phone
        │
        ▼
  7. INSERT notification_queue
     (dedup_key = 'reactivador:{project_id}:{YYYY-MM}')
        │
        ▼
  8. INSERT client_reactivation_log
     (project_id, client_id, template_used, scheduled_at, dry_run)
        │
        ▼
  9. UPDATE scheduled_job_log
     (rows_processed, status='success')
        │
        ▼
[1 minuto después]
[EF: process-whatsapp-notifications]
  → Lee notification_queue
  → Llama Meta Graph API v21.0
  → UPDATE notification_queue.status
  → INSERT whatsapp_message_log
```

### Data flow de decisión de template

```
total_amount (COP)
      │
      ├── >= 5.000.000 → template: reactivacion_remodelacion_v1
      │                  vars: {{1}}=nombre, {{2}}=nombre_proyecto
      │
      └── < 5.000.000  → template: reactivacion_referido_v1
                         vars: {{1}}=nombre, {{2}}=nombre_proyecto
```

---

## 6. Templates WhatsApp requeridos

### Template 1: `reactivacion_remodelacion_v1`
**Estado:** NUEVO — requiere aprobación Meta
**Categoría Meta:** MARKETING
**Idioma:** es (español)
**Variables:** `{{1}}` = nombre del cliente, `{{2}}` = nombre del proyecto

**Texto propuesto para someter a Meta:**

> Hola {{1}}, ¿cómo está disfrutando su cocina? Han pasado 9 meses desde que entregamos {{2}} y nos encantaría saber cómo va todo. Si está pensando en remodelar otro espacio del hogar, estamos aquí para ayudarle. Escríbanos y con gusto le cotizamos.

**Notas de aprobación:**
- Longitud: ~220 caracteres (dentro del límite)
- No incluye links ni precios (reduce riesgo de rechazo Meta)
- Requiere header de tipo TEXT: "Innovar Cocinas - Seguimiento"
- Footer sugerido: "Responda STOP para no recibir más mensajes"

---

### Template 2: `reactivacion_referido_v1`
**Estado:** NUEVO — requiere aprobación Meta
**Categoría Meta:** MARKETING
**Idioma:** es (español)
**Variables:** `{{1}}` = nombre del cliente, `{{2}}` = nombre del proyecto

**Texto propuesto para someter a Meta:**

> Hola {{1}}, ¡esperamos que esté disfrutando su {{2}}! Si conoce a alguien que esté pensando en renovar su cocina, nos encantaría que nos recomendara. Cada referido suyo recibe un descuento especial. Escríbanos el nombre y lo contactamos.

**Notas de aprobación:**
- Longitud: ~230 caracteres
- No promete comisión específica (evita rechazo Meta por incentivo no verificable)
- Requiere header de tipo TEXT: "Innovar Cocinas - Referidos"
- Footer sugerido: "Responda STOP para no recibir más mensajes"

---

### Templates existentes reutilizados en este agente
**Ninguno.** Los templates existentes son para etapas previas del funnel (lead, visita, cotización, proyecto). Los dos templates anteriores son los únicos requeridos para este agente.

---

## 7. Schema de datos

### 7.1 Verificación / adición de campo existente

```sql
-- Migration 001: verificar delivery_date en projects
-- Ejecutar SOLO si la columna no existe en producción

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'projects'
    AND column_name = 'delivery_date'
  ) THEN
    ALTER TABLE public.projects
    ADD COLUMN delivery_date DATE NULL;

    COMMENT ON COLUMN public.projects.delivery_date
    IS 'Fecha real de entrega del proyecto al cliente. NULL hasta que el status pase a delivered.';
  END IF;
END;
$$;

-- Índice para el escaneo mensual (crítico para performance)
CREATE INDEX IF NOT EXISTS idx_projects_delivery_date_status
  ON public.projects (delivery_date, status)
  WHERE delivery_date IS NOT NULL;
```

---

### 7.2 Tabla nueva: `client_reactivation_log`

```sql
-- Migration 002: tabla de log de reactivaciones

CREATE TABLE IF NOT EXISTS public.client_reactivation_log (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_used     TEXT NOT NULL,
  -- Cuál template se envió: reactivacion_remodelacion_v1 | reactivacion_referido_v1
  amount_at_scan    NUMERIC(12,2) NULL,
  -- Monto del proyecto en el momento del escaneo (snapshot para auditoría)
  queue_id          UUID NULL REFERENCES public.notification_queue(id),
  -- FK a la fila encolada para trazabilidad
  scheduled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Momento en que el agente generó el intento
  dry_run           BOOLEAN NOT NULL DEFAULT true,
  -- TRUE si fue un run de prueba (phone override activo)
  phone_sent_to     TEXT NOT NULL,
  -- Número real al que se encoló (puede ser el override en dry_run)
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  -- queued: encolado en notification_queue
  -- sent: confirmado por whatsapp_message_log
  -- failed: error en despacho
  -- skipped: elegible pero omitido (ej: phone nulo)
  failure_reason    TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice principal: evitar re-contacto (consulta frecuente del agente)
CREATE INDEX IF NOT EXISTS idx_client_reactivation_log_project_id
  ON public.client_reactivation_log (project_id);

CREATE INDEX IF NOT EXISTS idx_client_reactivation_log_client_id
  ON public.client_reactivation_log (client_id);

-- Índice para métricas por período
CREATE INDEX IF NOT EXISTS idx_client_reactivation_log_scheduled_at
  ON public.client_reactivation_log (scheduled_at DESC);

COMMENT ON TABLE public.client_reactivation_log IS
  'Log de intentos de reactivación de clientes post-entrega. '
  'Una fila por proyecto por intento. Evita re-contacto en meses siguientes.';
```

---

### 7.3 Entradas en `system_settings`

```sql
-- Migration 003: configuración del agente en system_settings

INSERT INTO public.system_settings (key, value) VALUES
  ('reactivador_clientes.dry_run',                    'true'),
  ('reactivador_clientes.monto_threshold_remodelacion','5000000'),
  ('reactivador_clientes.dry_run_phone',               '+573183061286'),
  ('reactivador_clientes.ventana_dias',                '7'),
  ('reactivador_clientes.enabled',                     'true')
ON CONFLICT (key) DO NOTHING;
```

---

### 7.4 Consulta principal del agente (referencia para la EF)

```sql
-- Proyectos elegibles para reactivación este mes
WITH config AS (
  SELECT
    (SELECT value::int FROM system_settings
     WHERE key = 'reactivador_clientes.ventana_dias') AS ventana_dias,
    (SELECT value::numeric FROM system_settings
     WHERE key = 'reactivador_clientes.monto_threshold_remodelacion') AS threshold
),
ya_contactados AS (
  SELECT DISTINCT project_id FROM client_reactivation_log
)
SELECT
  p.id            AS project_id,
  p.delivery_date,
  p.client_id,
  c.name          AS client_name,
  c.whatsapp_phone,
  -- Nombre del proyecto: tomamos el primer item de la cotización aprobada o fallback
  COALESCE(
    (SELECT description FROM quotation_items qi
     JOIN quotations q ON q.id = qi.quotation_id
     WHERE q.opportunity_id = p.opportunity_id
     AND q.status = 'approved'
     ORDER BY qi.created_at
     LIMIT 1),
    'su proyecto'
  )               AS project_name,
  COALESCE(
    (SELECT q.total_amount FROM quotations q
     WHERE q.opportunity_id = p.opportunity_id
     AND q.status = 'approved'
     ORDER BY q.created_at DESC
     LIMIT 1),
    0
  )               AS total_amount
FROM projects p
JOIN clients c ON c.id = p.client_id
CROSS JOIN config cfg
WHERE p.status IN ('delivered', 'completed')
  AND p.delivery_date IS NOT NULL
  AND c.whatsapp_phone IS NOT NULL
  AND p.delivery_date BETWEEN
      (now() - INTERVAL '9 months' - (cfg.ventana_dias || ' days')::interval)
      AND
      (now() - INTERVAL '9 months' + (cfg.ventana_dias || ' days')::interval)
  AND p.id NOT IN (SELECT project_id FROM ya_contactados);
```

---

## 8. Implementación paso a paso

### Slice 1: Fundaciones de datos
**Objetivo:** Tener el schema listo y la configuración en DB antes de escribir código.

**Incluye:**
- Aplicar Migration 001 (`delivery_date` en `projects`)
- Aplicar Migration 002 (`client_reactivation_log`)
- Aplicar Migration 003 (entradas `system_settings`)
- Poblar manualmente `delivery_date` en proyectos históricos con `status = 'delivered'` o `'completed'` que tengan fecha conocida (puede ser `updated_at` del cambio de status como aproximación)
- Validar con un SELECT manual que la consulta de elegibles devuelve filas razonables (o vacías si no hay proyectos con 9 meses)

**SQL de backfill sugerido:**
```sql
-- Aproximación: usar la fecha del último cambio de status como delivery_date
-- Solo para proyectos que no tienen delivery_date aún
-- REVISAR manualmente antes de ejecutar en producción
UPDATE public.projects
SET delivery_date = DATE(updated_at)
WHERE status IN ('delivered', 'completed')
  AND delivery_date IS NULL;
```

**Criterio de aceptación:**
- `\d projects` muestra columna `delivery_date DATE`
- `SELECT COUNT(*) FROM client_reactivation_log` devuelve 0 (tabla vacía y lista)
- `SELECT * FROM system_settings WHERE key LIKE 'reactivador%'` devuelve 5 filas
- La consulta de eligibles del §7.4 corre sin error (puede devolver 0 filas — eso es válido)

---

### Slice 2: Edge Function `reactivate-clients`
**Objetivo:** Lógica central del agente deployable y testeable de forma aislada.

**Ruta del archivo:** `supabase/functions/reactivate-clients/index.ts`

**Incluye:**

```typescript
// supabase/functions/reactivate-clients/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const jobStartedAt = new Date().toISOString()
  let rowsProcessed = 0
  let jobStatus = 'success'
  let jobError: string | null = null

  try {
    // 1. Leer configuración
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'reactivador_clientes.dry_run',
        'reactivador_clientes.monto_threshold_remodelacion',
        'reactivador_clientes.dry_run_phone',
        'reactivador_clientes.ventana_dias',
        'reactivador_clientes.enabled',
      ])

    const cfg: Record<string, string> = {}
    for (const s of settings ?? []) cfg[s.key] = s.value

    if (cfg['reactivador_clientes.enabled'] !== 'true') {
      return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { status: 200 })
    }

    const isDryRun      = cfg['reactivador_clientes.dry_run'] !== 'false'
    const threshold     = parseFloat(cfg['reactivador_clientes.monto_threshold_remodelacion'] ?? '5000000')
    const dryRunPhone   = cfg['reactivador_clientes.dry_run_phone'] ?? '+573183061286'
    const ventanaDias   = parseInt(cfg['reactivador_clientes.ventana_dias'] ?? '7')
    const mesActual     = new Date().toISOString().slice(0, 7) // YYYY-MM

    // 2. Obtener proyectos elegibles
    const { data: yaContactados } = await supabase
      .from('client_reactivation_log')
      .select('project_id')

    const yaContactadosIds = new Set((yaContactados ?? []).map((r: any) => r.project_id))

    const limiteInf = new Date()
    limiteInf.setMonth(limiteInf.getMonth() - 9)
    limiteInf.setDate(limiteInf.getDate() - ventanaDias)

    const limiteSup = new Date()
    limiteSup.setMonth(limiteSup.getMonth() - 9)
    limiteSup.setDate(limiteSup.getDate() + ventanaDias)

    const { data: proyectos, error: projError } = await supabase
      .from('projects')
      .select(`
        id, delivery_date, client_id, opportunity_id,
        clients!inner ( name, whatsapp_phone ),
        opportunities!inner (
          quotations ( total_amount, status )
        )
      `)
      .in('status', ['delivered', 'completed'])
      .not('delivery_date', 'is', null)
      .gte('delivery_date', limiteInf.toISOString().slice(0, 10))
      .lte('delivery_date', limiteSup.toISOString().slice(0, 10))

    if (projError) throw projError

    const elegibles = (proyectos ?? []).filter((p: any) => !yaContactadosIds.has(p.id))

    // 3. Procesar cada proyecto elegible
    for (const proyecto of elegibles) {
      const client     = proyecto.clients as any
      const phone      = isDryRun ? dryRunPhone : client.whatsapp_phone
      const nombre     = client.name ?? 'Cliente'

      // Obtener monto de cotización aprobada
      const cotAprobada = ((proyecto.opportunities as any)?.quotations ?? [])
        .find((q: any) => q.status === 'approved')
      const monto = cotAprobada?.total_amount ?? 0

      // Decidir template
      const templateName = monto >= threshold
        ? 'reactivacion_remodelacion_v1'
        : 'reactivacion_referido_v1'

      // Nombre del proyecto (fallback genérico)
      const nombreProyecto = 'su cocina' // Mejorar en Slice 3 con JOIN a quotation_items

      const dedupKey = `reactivador:${proyecto.id}:${mesActual}`

      // 4. Encolar en notification_queue
      const { data: queueRow, error: queueError } = await supabase
        .from('notification_queue')
        .insert({
          recipient_phone:      phone,
          template_name:        templateName,
          template_language:    'es',
          template_parameters:  JSON.stringify([nombre, nombreProyecto]),
          dedup_key:            dedupKey,
          status:               'pending',
          attempt_count:        0,
        })
        .select('id')
        .single()

      const queueId = queueRow?.id ?? null
      const skipped = !!queueError // error de dedup_key duplicado = ya encolado

      // 5. Registrar en client_reactivation_log
      await supabase.from('client_reactivation_log').insert({
        project_id:    proyecto.id,
        client_id:     proyecto.client_id,
        template_used: templateName,
        amount_at_scan: monto,
        queue_id:      queueId,
        dry_run:       isDryRun,
        phone_sent_to: phone,
        status:        skipped ? 'skipped' : 'queued',
        failure_reason: skipped ? (queueError?.message ?? 'dedup') : null,
      })

      rowsProcessed++
    }

  } catch (err: any) {
    jobStatus = 'error'
    jobError  = err.message
    console.error('[reactivate-clients]', err)
  }

  // 6. Log del job
  await supabase.from('scheduled_job_log').insert({
    job_name:       'reactivate-clients',
    started_at:     jobStartedAt,
    finished_at:    new Date().toISOString(),
    rows_processed: rowsProcessed,
    status:         jobStatus,
    ...(jobError ? { notes: jobError } : {}),
  })

  return new Response(
    JSON.stringify({ ok: jobStatus === 'success', rows: rowsProcessed, dry_run: true }),
    { status: jobStatus === 'success' ? 200 : 500 }
  )
})
```

**Criterio de aceptación:**
- `supabase functions deploy reactivate-clients` termina sin error
- Llamada manual con `curl -X POST .../functions/v1/reactivate-clients -H "Authorization: Bearer <anon_key>"` devuelve `{"ok":true,"rows":N,"dry_run":true}`
- Si hay proyectos elegibles, aparecen filas en `client_reactivation_log` con `dry_run=true` y `phone_sent_to=+573183061286`
- Si hay filas en `client_reactivation_log`, al re-ejecutar inmediatamente el mismo job devuelve `rows: 0` (dedup funciona)

---

### Slice 3: Cron job mensual + nombre del proyecto mejorado
**Objetivo:** Activar el disparo automático mensual y mejorar el nombre del proyecto en el template.

**Incluye:**

**Migration 004 — Registro del cron:**
```sql
-- Registrar el job mensual (día 1, 14:00 UTC = 9:00 AM Bogotá UTC-5)
SELECT cron.schedule(
  'reactivar-clientes-mensual',
  '0 14 1 * *',
  $$
    SELECT net.http_post(
      url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/reactivate-clients',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Verificar registro
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'reactivar-clientes-mensual';
```

**Mejora del nombre del proyecto en la EF:**

Reemplazar `'su cocina'` en Slice 2 con la consulta real:
```typescript
// Dentro del loop, antes de decidir template:
const { data: primerItem } = await supabase
  .from('quotation_items')           // tabla asumida; verificar nombre real en prod
  .select('description')
  .eq('quotation_id',
    cotAprobada?.id ?? '00000000-0000-0000-0000-000000000000'
  )
  .order('created_at', { ascending: true })
  .limit(1)
  .single()

const nombreProyecto = primerItem?.description ?? 'su cocina'
```

> **Nota:** Si la tabla `quotation_items` no existe en el schema actual de producción, mantener el fallback `'su cocina'` y registrar como deuda técnica. El agente funciona correctamente sin este dato.

**Criterio de aceptación:**
- `SELECT * FROM cron.job WHERE jobname = 'reactivar-clientes-mensual'` devuelve 1 fila con `active = true`
- El primer día del mes siguiente aparece una entrada en `scheduled_job_log` con `job_name = 'reactivate-clients'`
- Si hay proyectos elegibles ese día, aparecen filas en `client_reactivation_log` y en `notification_queue`

---

### Slice 4: Activación en producción
**Objetivo:** Desactivar DRY_RUN y enviar a clientes reales, previa validación end-to-end.

**Incluye:**

1. Validar con el equipo que los dos templates Meta están aprobados (ver §10 Riesgos)
2. Ejecutar un smoke test manual con `dry_run=true` confirmando que llega el WA al número de Robert
3. Revisar las filas generadas en `client_reactivation_log` y confirmar que los datos (nombre, template elegido, monto) son correctos
4. Si todo es correcto, ejecutar:

```sql
UPDATE public.system_settings
SET value = 'false'
WHERE key = 'reactivador_clientes.dry_run';
```

5. Monitorear la próxima ejecución automática del cron en `scheduled_job_log`

**Criterio de aceptación:**
- `SELECT value FROM system_settings WHERE key = 'reactivador_clientes.dry_run'` devuelve `'false'`
- En la siguiente ejecución del cron, `client_reactivation_log.dry_run = false` para los nuevos registros
- `whatsapp_message_log` muestra mensajes con `status = 'sent'` vinculados a los `queue_id` del log de reactivación

---

## 9. Criterios de aceptación globales

- [ ] `projects.delivery_date` existe en producción y tiene datos para proyectos entregados
- [ ] `client_reactivation_log` existe con todos sus índices
- [ ] `system_settings` tiene las 5 keys del agente
- [ ] EF `reactivate-clients` deploya sin errores TypeScript
- [ ] Llamada manual a la EF con proyectos elegibles ficticio (insertar un proyecto de prueba con `delivery_date = now() - interval '9 months'`) genera 1 fila en `notification_queue` y 1 en `client_reactivation_log`
- [ ] Re-ejecución inmediata sobre el mismo proyecto de prueba genera `rows: 0` (dedup activo)
- [ ] El WA de prueba llega al número de Robert con el nombre correcto del cliente y del proyecto
- [ ] Cron job `reactivar-clientes-mensual` aparece en `cron.job` con `active = true`
- [ ] Templates `reactivacion_remodelacion_v1` y `reactivacion_referido_v1` están aprobados en Meta Business Manager
- [ ] `dry_run = 'false'` solo se activa después de que Robert valida el smoke test

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Templates rechazados por Meta | Media | Someter los dos templates juntos; si Meta rechaza, ajustar texto removiendo cualquier promesa de beneficio específico y re-someter. Tiempo estimado de aprobación: 2-5 días hábiles. Mientras tanto, el agente funciona pero no puede despachar mensajes. |
| `projects.delivery_date` sin datos históricos | Alta | El backfill de Slice 1 usa `updated_at` como aproximación. Revisar manualmente antes de activar producción para no contactar clientes en fechas incorrectas. |
| `quotation_items` no existe con ese nombre | Media | Verificar el nombre real de la tabla en producción antes de Slice 3. Usar el fallback `'su cocina'` sin bloquear el Slice 2. |
| Proyectos sin cotización aprobada | Media | La query usa `COALESCE(..., 0)` para el monto. Si `total_amount = 0`, el agente envía el template de referido (threshold no se alcanza). Comportamiento aceptable. |
| Cron invoca la EF pero el token de `app.service_role_key` no está en `current_setting` | Media | Alternativa: hardcodear el service_role_key como `Authorization: Bearer <key>` en el body del cron, o usar pg_net con header fijo. Verificar en Supabase si `current_setting('app.service_role_key')` está configurado en el proyecto. |
| Cliente sin `whatsapp_phone` | Baja | La consulta filtra `c.whatsapp_phone IS NOT NULL`. Si el phone es nulo, el proyecto queda fuera. Registrar en `client_reactivation_log` con `status = 'skipped'` y `failure_reason = 'phone_null'` para visibilidad. |
| Re-activación falsa (proyectos que no son de cocina) | Baja | En este punto todos los proyectos en la tabla son de Innovar Cocinas. Sin riesgo por ahora. |

---

## 11. Métricas de éxito

| Métrica | Cómo medirla | Target inicial |
|---|---|---|
| Tasa de ejecución exitosa del cron | `SELECT COUNT(*) FROM scheduled_job_log WHERE job_name='reactivate-clients' AND status='success'` / total ejecuciones | > 95% |
| Clientes contactados por mes | `SELECT COUNT(*) FROM client_reactivation_log WHERE dry_run=false AND DATE_TRUNC('month', scheduled_at) = DATE_TRUNC('month', now())` | Varía según proyectos entregados 9 meses atrás |
| Tasa de respuesta (conversión a conversación) | Manual: revisar en WhatsApp Business Manager cuántos respondieron al mensaje | > 15% sobre enviados |
| Proyectos de remodelación abiertos tras reactivación | `SELECT COUNT(*) FROM projects p WHERE p.created_at > (now() - interval '30 days') AND EXISTS (SELECT 1 FROM client_reactivation_log crl WHERE crl.client_id = p.client_id AND crl.scheduled_at > now() - interval '60 days')` | Al menos 1 por trimestre |
| Leads referidos registrados | Futura integración: verificar `leads.source = 'referido'` + fecha | Al menos 2 por trimestre |
| Mensajes con dedup (re-intentos bloqueados) | `SELECT COUNT(*) FROM client_reactivation_log WHERE status='skipped'` | 0 en condiciones normales |
| Tasa de entrega Meta | `SELECT COUNT(*) FROM whatsapp_message_log wml JOIN notification_queue nq ON nq.id = wml.queue_id JOIN client_reactivation_log crl ON crl.queue_id = nq.id WHERE wml.status='sent'` / total enviados | > 90% |

---

## 12. Notas de seguridad y DRY_RUN

### Protocolo de prueba obligatorio

**NUNCA activar `dry_run=false` sin haber completado los siguientes pasos:**

1. **Smoke test Slice 2:** insertar un proyecto ficticio en `projects` con `delivery_date = now() - interval '9 months'` y un cliente con `whatsapp_phone = '+573183061286'` (Robert). Invocar la EF manualmente. Verificar que:
   - Llega el WA al número de Robert con el nombre correcto
   - `client_reactivation_log` tiene la fila con `dry_run=true`
   - `notification_queue` tiene la fila con `status=pending` o `sent`

2. **Revisar datos reales:** antes de desactivar DRY_RUN, hacer un SELECT de todos los proyectos elegibles actuales y revisar que los nombres, teléfonos y montos son correctos. No debe haber clientes con datos incompletos.

3. **Confirmación explícita:** Robert debe confirmar por escrito (Slack o WhatsApp) que aprueba la activación en producción.

### Configuración de DRY_RUN

```sql
-- Para activar DRY_RUN (modo prueba):
UPDATE public.system_settings
SET value = 'true'
WHERE key = 'reactivador_clientes.dry_run';

-- Para desactivar DRY_RUN (producción real):
UPDATE public.system_settings
SET value = 'false'
WHERE key = 'reactivador_clientes.dry_run';

-- Para pausar el agente completamente:
UPDATE public.system_settings
SET value = 'false'
WHERE key = 'reactivador_clientes.enabled';
```

### Números de test autorizados
- Robert: `+573183061286`
- Heduin: `+584127862439`

### Límites de seguridad adicionales
- El `dedup_key` con formato `reactivador:{project_id}:{YYYY-MM}` garantiza que un mismo proyecto no genera dos mensajes en el mismo mes aunque el cron falle y se re-ejecute manualmente
- La tabla `client_reactivation_log` actúa como barrera permanente: una vez que un proyecto tiene una fila, nunca vuelve a ser elegible (independientemente del mes)
- El cron dispara una sola vez al mes (día 1). Si falla, no hay retry automático — se puede re-ejecutar manualmente sin riesgo gracias al dedup

### Cómo pausar en emergencia

```sql
-- Pausa inmediata del cron (no afecta ejecuciones ya disparadas):
SELECT cron.unschedule('reactivar-clientes-mensual');

-- Pausa de la EF sin tocar el cron:
UPDATE public.system_settings
SET value = 'false'
WHERE key = 'reactivador_clientes.enabled';
```
