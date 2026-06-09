# PRD: Detector de Abandono
**Capa:** 01 — Adquisición
**Prioridad:** ALTA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Detector de Abandono es un agente autónomo de baja complejidad que monitorea diariamente todos los leads activos del CRM y detecta aquellos que llevan 5 o más días sin ninguna actividad registrada. Cuando detecta un lead abandonado, notifica al comercial responsable vía WhatsApp y crea automáticamente una tarea urgente de seguimiento en el CRM para que el lead no quede en el limbo.

Para el negocio de Innovar Cocinas, este agente resuelve un problema de fuga silenciosa en el embudo: leads que entran, reciben primer contacto y luego nadie los vuelve a tocar porque el comercial tiene muchos frentes abiertos. Sin un sistema de alerta proactiva, esos leads se enfrían y eventualmente se pierden sin que nadie lo note. A los 10 días sin actividad, el agente escala la alerta para que el supervisor sea consciente del riesgo.

La implementación no requiere nuevas tablas complejas ni integraciones externas nuevas — reutiliza el patrón de `notification_queue` + `process-whatsapp-notifications` ya probado en producción, el sistema de `tasks`, y un único cron `pg_cron` nuevo. Complejidad de implementación: baja. Tiempo estimado: 2-3 sesiones.

---

## 2. Problema que resuelve

**Pain point:** En Innovar Cocinas, los comerciales manejan múltiples leads simultáneamente. Es frecuente que un lead entre al CRM, sea contactado una primera vez, y luego quede en espera mientras el comercial atiende visitas u otras cotizaciones. Sin un recordatorio automático, ese lead puede pasar 5, 10 o 15 días sin que nadie lo contacte.

El resultado: el cliente potencial pierde interés, busca otra empresa, y el CRM acumula leads en estado `new` o `contacted` que nunca avanzan. El comercial no lo nota porque no tiene una lista priorizada de "quién está esperando respuesta". El supervisor tampoco lo nota porque no hay visibilidad agregada del abandono.

El agente crea ese mecanismo de vigilancia que el equipo no tiene tiempo de hacer manualmente, convirtiendo el seguimiento reactivo en proactivo.

---

## 3. Infraestructura existente que se reutiliza

**Tablas Supabase (sin modificar):**
- `leads` — fuente principal; campos `id`, `name`, `phone`, `commercial_id`, `status`, `updated_at`
- `visits` — actividad tipo visita relacionada al lead (vía `opportunity_id` → `opportunities.lead_id`)
- `tasks` — donde se crean las tareas urgentes de seguimiento; campos `id`, `title`, `assigned_to`, `related_entity`, `due_date`, `status`, `priority`
- `notification_queue` — patrón de encolamiento WA ya en producción
- `opportunities` — tabla puente para detectar actividad indirecta del lead
- `scheduled_job_log` — para registrar cada ejecución del cron

**Edge Functions (invocada, no modificada):**
- `process-whatsapp-notifications` — procesa `notification_queue` cada minuto; el agente solo hace INSERTs en la cola

**Templates WhatsApp aprobados que se reutilizan:**
- `task_assigned` (4 vars: `{{1}}`=equipo, `{{2}}`=tarea, `{{3}}`=vencimiento, `{{4}}`=cliente) — se reutiliza para la alerta D+5 al comercial como notificación interna

**Patrones reutilizados:**
- `dedup_key` pattern: `detector-abandono:{lead_id}:d5:{fecha_iso}` y `detector-abandono:{lead_id}:d10:{fecha_iso}`
- Cron `pg_cron` con `net.http_post` hacia Edge Function (patrón ya implementado en otros agentes)
- Campo `updated_at` en `leads` como proxy de última actividad (extendido en Slice 1)

---

## 4. Gap Analysis — Lo que hay que construir

**Nuevos templates WhatsApp Meta (requieren aprobación):**
- `alerta_abandono_d5_v1` — alerta D+5 al comercial (nuevo, texto propuesto en sección 6)
- `alerta_abandono_d10_v1` — alerta D+10 escalada (nuevo, texto propuesto en sección 6)

> Alternativa sin aprobación nueva: reutilizar `task_assigned` para ambas alertas (ver sección 6).

**Nueva Edge Function:**
- `detector-abandono` — función principal que ejecuta el escaneo, crea tareas e inserta en `notification_queue`

**Nueva migración SQL:**
- Vista `v_lead_last_activity` — calcula `last_activity_at` dinámicamente como el `MAX` de varios timestamps
- Tabla `abandonment_log` — registro de qué leads fueron alertados y en qué etapa (evita doble alerta)
- Índice sobre `leads(commercial_id, status, updated_at)` para performance del escaneo
- Registro del cron en `pg_cron`

**No se necesita:**
- Ningún workflow n8n (el patrón de cron nativo de Supabase es suficiente para esta complejidad)
- Ningún componente frontend (el agente es 100% backend; el comercial ve la tarea en el CRM existente)
- OpenRouter / LLM (no hay decisión semántica que requiera IA)

---

## 5. Arquitectura Técnica

### Flujo completo

```
[pg_cron] 9:00am Bogotá L-V
    │
    ▼
POST /functions/v1/detector-abandono
    │
    ├─── Query: v_lead_last_activity WHERE dias_sin_actividad >= 5
    │         AND status IN ('new','contacted','qualified')
    │         AND commercial_id IS NOT NULL
    │
    ├─── Para cada lead con 5-9 días sin actividad:
    │       ├─ ¿Ya tiene registro en abandonment_log (etapa='d5', fecha_alerta=hoy)?
    │       │     SÍ → skip (dedup)
    │       │     NO →
    │       │         ├─ INSERT tasks (urgente, assigned_to=commercial_id)
    │       │         ├─ INSERT notification_queue (template alerta D+5, recipient=comercial.phone)
    │       │         └─ INSERT abandonment_log (lead_id, etapa='d5', fecha_alerta)
    │
    ├─── Para cada lead con 10+ días sin actividad:
    │       ├─ ¿Ya tiene registro en abandonment_log (etapa='d10', fecha_alerta=hoy)?
    │       │     SÍ → skip (dedup)
    │       │     NO →
    │       │         ├─ INSERT notification_queue (template alerta D+10 escalada)
    │       │         └─ INSERT abandonment_log (lead_id, etapa='d10', fecha_alerta)
    │
    └─── INSERT scheduled_job_log (rows_processed, status, duración)

[process-whatsapp-notifications] cron cada 1 minuto
    │
    └─── Recoge notification_queue → llama Meta API → marca sent/failed
```

### Stack de esta función

| Componente | Tecnología | Rol |
|---|---|---|
| Scheduler | `pg_cron` Supabase | Dispara a las 9am L-V |
| Función principal | Supabase Edge Function (Deno/TypeScript) | Lógica de detección + encolamiento |
| Detección de actividad | Vista SQL `v_lead_last_activity` | Calcula días de inactividad |
| Dedup de alertas | Tabla `abandonment_log` | Evita alertas repetidas el mismo día |
| Mensajería | `notification_queue` + `process-whatsapp-notifications` | Entrega WA al comercial |
| Tareas CRM | Tabla `tasks` | Crea tarea urgente visible en el CRM |

### Lógica de `last_activity_at`

```
last_activity_at = MAX(
  leads.updated_at,
  MAX(tasks.updated_at) WHERE tasks.related_entity LIKE 'lead:{lead_id}',
  MAX(visits.updated_at) WHERE visits → opportunities.lead_id = lead.id
)
```

Si no hay ningún timestamp, `last_activity_at = leads.created_at`.

---

## 6. Templates WhatsApp requeridos

### Opción A — Reutilizar `task_assigned` (sin aprobación nueva)

Para la alerta D+5, se puede usar `task_assigned` con:
- `{{1}}` = nombre del comercial (ej. "Carlos")
- `{{2}}` = "Seguimiento urgente a lead abandonado"
- `{{3}}` = fecha de hoy en formato dd/mm/yyyy
- `{{4}}` = nombre del lead (ej. "María González")

**Ventaja:** listo para usar hoy, sin esperar aprobación Meta.
**Desventaja:** texto genérico, no menciona los días de inactividad.

### Opción B — Templates nuevos dedicados (recomendada a mediano plazo)

#### Template 1: `alerta_abandono_d5_v1`

| Campo | Valor |
|---|---|
| Nombre | `alerta_abandono_d5_v1` |
| Idioma | `es` (español) |
| Categoría | `UTILITY` |
| Variables | 4 |
| Estado | NUEVO — requiere aprobación Meta |

**Texto propuesto para Meta (cuerpo, máx 160 chars):**
```
Hola {{1}}, el lead *{{2}}* lleva {{3}} días sin actividad en el CRM.
Crea un contacto hoy para mantener viva la oportunidad. Vence: {{4}}.
```

Mapping de variables:
- `{{1}}` = nombre_comercial (ej. "Carlos")
- `{{2}}` = nombre_lead (ej. "María González")
- `{{3}}` = días_sin_actividad (ej. "5")
- `{{4}}` = fecha_vencimiento_tarea (ej. "09/06/2026")

---

#### Template 2: `alerta_abandono_d10_v1`

| Campo | Valor |
|---|---|
| Nombre | `alerta_abandono_d10_v1` |
| Idioma | `es` (español) |
| Categoría | `UTILITY` |
| Variables | 4 |
| Estado | NUEVO — requiere aprobación Meta |

**Texto propuesto para Meta (cuerpo, máx 160 chars):**
```
⚠️ {{1}}, el lead *{{2}}* lleva {{3}} días sin contacto.
Riesgo de pérdida alto. Reactivá o marcá como perdido hoy. Tarea: {{4}}.
```

Mapping de variables:
- `{{1}}` = nombre_comercial
- `{{2}}` = nombre_lead
- `{{3}}` = días_sin_actividad (ej. "10")
- `{{4}}` = fecha_vencimiento_tarea

---

**Decisión de implementación:**
- **Slice 1 y 2:** usar `task_assigned` (sin bloqueo por aprobación)
- **Slice 3 (post-validación):** migrar a `alerta_abandono_d5_v1` y `alerta_abandono_d10_v1` cuando Meta los apruebe

---

## 7. Schema de datos

### Vista: `v_lead_last_activity` (nueva)

```sql
CREATE OR REPLACE VIEW v_lead_last_activity AS
SELECT
  l.id                          AS lead_id,
  l.name                        AS lead_name,
  l.phone                       AS lead_phone,
  l.status                      AS lead_status,
  l.commercial_id,
  u.phone                       AS commercial_phone,
  u.raw_user_meta_data->>'name' AS commercial_name,
  GREATEST(
    l.updated_at,
    COALESCE((
      SELECT MAX(t.updated_at)
      FROM tasks t
      WHERE t.related_entity = 'lead:' || l.id::text
    ), l.created_at),
    COALESCE((
      SELECT MAX(v.updated_at)
      FROM visits v
      JOIN opportunities o ON o.id = v.opportunity_id
      WHERE o.lead_id = l.id
    ), l.created_at)
  )                             AS last_activity_at,
  EXTRACT(
    DAY FROM (NOW() - GREATEST(
      l.updated_at,
      COALESCE((
        SELECT MAX(t.updated_at) FROM tasks t
        WHERE t.related_entity = 'lead:' || l.id::text
      ), l.created_at),
      COALESCE((
        SELECT MAX(v.updated_at) FROM visits v
        JOIN opportunities o ON o.id = v.opportunity_id
        WHERE o.lead_id = l.id
      ), l.created_at)
    ))
  )::int                        AS dias_sin_actividad
FROM leads l
LEFT JOIN auth.users u ON u.id = l.commercial_id
WHERE l.status IN ('new', 'contacted', 'qualified')
  AND l.commercial_id IS NOT NULL;
```

---

### Tabla nueva: `abandonment_log`

```sql
CREATE TABLE IF NOT EXISTS abandonment_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  etapa           text NOT NULL CHECK (etapa IN ('d5', 'd10')),
  fecha_alerta    date NOT NULL DEFAULT CURRENT_DATE,
  dias_inactivo   int NOT NULL,
  task_id         uuid REFERENCES tasks(id),
  queue_id        uuid REFERENCES notification_queue(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (lead_id, etapa, fecha_alerta)
);

CREATE INDEX idx_abandonment_log_lead_etapa
  ON abandonment_log(lead_id, etapa);

COMMENT ON TABLE abandonment_log IS
  'Registro de alertas de abandono enviadas por el agente detector-abandono. La constraint UNIQUE (lead_id, etapa, fecha_alerta) es el mecanismo de dedup.';
```

---

### Índice nuevo en `leads`

```sql
CREATE INDEX IF NOT EXISTS idx_leads_commercial_status_updated
  ON leads(commercial_id, status, updated_at)
  WHERE status IN ('new', 'contacted', 'qualified');
```

---

### Campos de `tasks` usados (ya existen — confirmar antes del deploy)

| Campo | Tipo | Valor que inserta el agente |
|---|---|---|
| `title` | text | `'Seguimiento urgente — lead sin actividad: ' \|\| lead_name` |
| `assigned_to` | uuid | `commercial_id` del lead |
| `related_entity` | text | `'lead:' \|\| lead_id` |
| `due_date` | date | `CURRENT_DATE` |
| `status` | text | `'pending'` |
| `priority` | text | `'urgent'` (D+5) / `'critical'` (D+10) |

---

### Campos de `notification_queue` usados (ya existen)

| Campo | Valor |
|---|---|
| `recipient_phone` | `commercial_phone` (teléfono del comercial, con +57) |
| `template_name` | `'task_assigned'` (Slice 1-2) / `'alerta_abandono_d5_v1'` (Slice 3) |
| `template_language` | `'es'` |
| `template_parameters` | jsonb con las 4 variables del template |
| `dedup_key` | `'detector-abandono:' \|\| lead_id \|\| ':d5:' \|\| CURRENT_DATE` |
| `status` | `'pending'` |

---

## 8. Implementación paso a paso

---

### Slice 1: Base de datos y vista de actividad

**Objetivo:** Tener la infraestructura SQL lista y poder consultar leads abandonados con una sola query.

**Incluye:**
- Migración que crea `v_lead_last_activity`
- Migración que crea `abandonment_log` con su índice
- Migración que crea índice en `leads`
- Script de validación: query manual que devuelve los leads candidatos actuales

**SQL de validación post-migración:**

```sql
-- Debe devolver leads con >= 5 días sin actividad
SELECT lead_id, lead_name, commercial_name, dias_sin_actividad, lead_status
FROM v_lead_last_activity
WHERE dias_sin_actividad >= 5
ORDER BY dias_sin_actividad DESC
LIMIT 20;
```

**Criterio de aceptación:**
- La vista `v_lead_last_activity` existe y devuelve resultados coherentes con los datos reales
- `abandonment_log` existe vacía con constraints correctos
- La query de validación no tarda más de 2 segundos con el dataset actual
- `UNIQUE (lead_id, etapa, fecha_alerta)` está activo (intentar insertar duplicado debe fallar con error 23505)

---

### Slice 2: Edge Function + cron (usando `task_assigned`)

**Objetivo:** El agente corre diariamente, crea tareas e inserta en `notification_queue` usando el template `task_assigned` ya aprobado.

**Edge Function: `detector-abandono`**

Archivo: `supabase/functions/detector-abandono/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DRY_RUN = Deno.env.get("DETECTOR_ABANDONO_DRY_RUN") === "true";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jobStart = new Date();
  let rowsProcessed = 0;
  const errors: string[] = [];

  try {
    // 1. Obtener leads abandonados
    const { data: leads, error: queryError } = await supabase
      .from("v_lead_last_activity")
      .select("*")
      .gte("dias_sin_actividad", 5)
      .order("dias_sin_actividad", { ascending: false });

    if (queryError) throw queryError;
    if (!leads || leads.length === 0) {
      await logJob(supabase, jobStart, 0, "ok");
      return new Response(JSON.stringify({ ok: true, leads_procesados: 0 }));
    }

    for (const lead of leads) {
      const etapa = lead.dias_sin_actividad >= 10 ? "d10" : "d5";
      const hoy = new Date().toISOString().split("T")[0];

      // 2. Dedup: ¿ya se alertó hoy para esta etapa?
      const { data: existing } = await supabase
        .from("abandonment_log")
        .select("id")
        .eq("lead_id", lead.lead_id)
        .eq("etapa", etapa)
        .eq("fecha_alerta", hoy)
        .maybeSingle();

      if (existing) continue; // ya alertado hoy

      // 3. Crear tarea urgente
      let taskId: string | null = null;
      if (!DRY_RUN) {
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            title: `Seguimiento urgente — lead sin actividad: ${lead.lead_name}`,
            assigned_to: lead.commercial_id,
            related_entity: `lead:${lead.lead_id}`,
            due_date: hoy,
            status: "pending",
            priority: etapa === "d5" ? "urgent" : "critical",
          })
          .select("id")
          .single();
        if (taskError) { errors.push(`task:${lead.lead_id}:${taskError.message}`); continue; }
        taskId = task.id;
      }

      // 4. Encolar notificación WA al comercial
      const dedupKey = `detector-abandono:${lead.lead_id}:${etapa}:${hoy}`;
      const fechaLegible = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
      const templateParams = etapa === "d5"
        ? [lead.commercial_name ?? "Comercial", lead.lead_name, `${lead.dias_sin_actividad}`, fechaLegible]
        : [lead.commercial_name ?? "Comercial", lead.lead_name, `${lead.dias_sin_actividad}`, fechaLegible];

      let queueId: string | null = null;
      if (!DRY_RUN) {
        const { data: queued, error: queueError } = await supabase
          .from("notification_queue")
          .insert({
            recipient_phone: lead.commercial_phone,
            template_name: "task_assigned",   // Slice 2: reutiliza existente
            template_language: "es",
            template_parameters: templateParams,
            dedup_key: dedupKey,
            status: "pending",
          })
          .select("id")
          .single();
        if (queueError && !queueError.message.includes("duplicate")) {
          errors.push(`queue:${lead.lead_id}:${queueError.message}`);
          continue;
        }
        queueId = queued?.id ?? null;
      }

      // 5. Registrar en abandonment_log
      if (!DRY_RUN) {
        await supabase.from("abandonment_log").insert({
          lead_id: lead.lead_id,
          etapa,
          fecha_alerta: hoy,
          dias_inactivo: lead.dias_sin_actividad,
          task_id: taskId,
          queue_id: queueId,
        });
      }

      rowsProcessed++;

      if (DRY_RUN) {
        console.log(`[DRY_RUN] Lead ${lead.lead_name} (${etapa}): ${lead.dias_sin_actividad} días inactivo. Comercial: ${lead.commercial_name} (${lead.commercial_phone})`);
      }
    }

    await logJob(supabase, jobStart, rowsProcessed, errors.length > 0 ? "partial" : "ok", errors);
    return new Response(JSON.stringify({ ok: true, leads_procesados: rowsProcessed, dry_run: DRY_RUN, errors }));

  } catch (err) {
    await logJob(supabase, jobStart, rowsProcessed, "error", [String(err)]);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});

async function logJob(
  supabase: ReturnType<typeof createClient>,
  start: Date,
  rows: number,
  status: string,
  errors: string[] = []
) {
  await supabase.from("scheduled_job_log").insert({
    job_name: "detector-abandono",
    started_at: start.toISOString(),
    finished_at: new Date().toISOString(),
    rows_processed: rows,
    status,
    ...(errors.length > 0 ? { error_detail: errors.join(" | ") } : {}),
  });
}
```

**Registro del cron (SQL):**

```sql
-- Verificar que pg_cron y pg_net estén habilitados antes de correr
SELECT cron.schedule(
  'detector-abandono-diario',
  '0 14 * * 1-5',  -- 9:00am UTC-5 (Bogotá) = 14:00 UTC, lunes a viernes
  $$
  SELECT net.http_post(
    url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/detector-abandono',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  )
  $$
);
```

**Variables de entorno necesarias en Supabase Secrets:**

```
DETECTOR_ABANDONO_DRY_RUN=true   ← en producción, cambiar a false
```

**Criterio de aceptación del Slice 2:**
- Con `DRY_RUN=true`, invocar la función manualmente vía `curl` devuelve 200 y lista en logs los leads candidatos con su comercial asignado
- No se crean tareas ni notificaciones reales en DRY_RUN
- El cron aparece en `cron.job` con nombre `detector-abandono-diario`
- `scheduled_job_log` tiene una fila por cada invocación con `status=ok`
- Si se invoca dos veces el mismo día, la segunda ejecución procesa 0 leads (dedup activo)

---

### Slice 3: Templates dedicados + activación en producción

**Objetivo:** Reemplazar `task_assigned` por los templates específicos `alerta_abandono_d5_v1` y `alerta_abandono_d10_v1`, y activar el agente en producción.

**Prerrequisitos:**
- Meta aprobó `alerta_abandono_d5_v1` y `alerta_abandono_d10_v1`
- Slice 2 validado con DRY_RUN durante al menos 2 días laborales

**Cambios en la Edge Function:**

Reemplazar en el INSERT a `notification_queue`:
```typescript
// Slice 2 (reemplazar):
template_name: "task_assigned"

// Slice 3 (nuevo):
template_name: etapa === "d5" ? "alerta_abandono_d5_v1" : "alerta_abandono_d10_v1"
```

**Activación en producción:**

```bash
# 1. Cambiar secret en Supabase
supabase secrets set DETECTOR_ABANDONO_DRY_RUN=false --project-ref xdzbjptozeqcbnaqhtye

# 2. Re-deployar la función
supabase functions deploy detector-abandono --project-ref xdzbjptozeqcbnaqhtye

# 3. Verificar cron activo
# En SQL editor: SELECT * FROM cron.job WHERE jobname = 'detector-abandono-diario';
```

**Criterio de aceptación del Slice 3:**
- Al día siguiente de la activación, el comercial de prueba (número de test) recibe WA con el template dedicado
- La tarea aparece en el CRM del comercial con prioridad `urgent` o `critical` según corresponda
- `abandonment_log` tiene filas con `etapa='d5'` y/o `'d10'`
- `whatsapp_message_log` muestra `status=delivered` para los mensajes enviados
- No se envían mensajes a clientes finales (solo a comerciales internos)

---

## 9. Criterios de aceptación globales

- [ ] La vista `v_lead_last_activity` devuelve resultados coherentes comparados con revisión manual de 5 leads seleccionados al azar
- [ ] Un lead sin `updated_at` en los últimos 5 días aparece en la vista con `dias_sin_actividad >= 5`
- [ ] Si el comercial actualiza el lead hoy, al día siguiente ya NO aparece como candidato (activity window reset)
- [ ] Invocar la función dos veces el mismo día procesa 0 leads en la segunda invocación (dedup funcional)
- [ ] `abandonment_log` tiene la constraint `UNIQUE (lead_id, etapa, fecha_alerta)` activa
- [ ] El cron se ejecuta exclusivamente L-V (no hay entradas en `scheduled_job_log` de sábado/domingo)
- [ ] Leads con `status='lost'` nunca aparecen como candidatos
- [ ] Leads sin `commercial_id` nunca generan notificación
- [ ] La función completa en menos de 10 segundos con el volumen actual de leads
- [ ] `scheduled_job_log` tiene una entrada por ejecución con `status` y `rows_processed` correctos
- [ ] En producción: al tercer día laborable, hay al menos una tarea urgente creada en CRM y un registro en `abandonment_log`

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `commercial_phone` nulo en `auth.users` para algunos comerciales | Media | La vista filtra `commercial_id IS NOT NULL` pero el teléfono puede ser nulo; agregar guard en la EF: si `commercial_phone IS NULL`, crear tarea pero no encolar WA; loguear como warning en `scheduled_job_log` |
| Meta rechaza los templates nuevos | Media | Slice 2 funciona completamente con `task_assigned` ya aprobado; Slice 3 es una mejora, no un bloqueante |
| Zona horaria: el cron en UTC corre a las 14:00 pero Bogotá puede estar en UTC-5 | Baja | Verificar en producción la primera semana; ajustar a `0 14 * * 1-5` (14 UTC = 9am UTC-5). Ojo: Colombia NO tiene horario de verano, siempre UTC-5 |
| Leads con actividad en tablas no cubiertas (ej. mensajes WA recibidos) | Baja | Documentado explícitamente: `last_activity_at` mide `leads.updated_at`, `tasks.updated_at` y `visits.updated_at`. Si se agregan fuentes en el futuro, actualizar la vista |
| `tasks.related_entity` tiene formato diferente al esperado | Media | Verificar antes de la migración el formato actual de `related_entity` en tasks existentes. Si el formato es distinto (ej. UUID puro en vez de `lead:uuid`), ajustar la vista y la EF |
| Carga masiva al activar: hay 50+ leads abandonados el día 1 | Baja | Los INSERTs son en serie con dedup; el volumen inicial puede generar muchos mensajes. Opción: agregar `LIMIT 20` en la primera ejecución de producción y quitar el límite al día siguiente |
| `scheduled_job_log` no tiene columna `error_detail` | Media | Verificar el schema de `scheduled_job_log` antes del deploy; si no tiene esa columna, omitir ese campo en el INSERT o agregar la migración `ALTER TABLE` |

---

## 11. Métricas de éxito

| Métrica | Objetivo semana 1 | Objetivo mes 1 |
|---|---|---|
| Leads detectados por semana | > 0 (al menos 1 lead en estado de abandono detectado) | > 5 leads/semana |
| Tasa de respuesta del comercial | No medible aún (requiere campo en leads) | Definir baseline |
| Leads que salen de abandono tras alerta D+5 | — | > 40% de los alertados reciben actividad en 48h |
| Alertas duplicadas enviadas | 0 | 0 (dedup activo) |
| Errores en `scheduled_job_log` | 0 | < 2% de ejecuciones con `status=error` |
| Tiempo de ejecución promedio de la EF | < 5 segundos | < 5 segundos |
| Leads con `status=lost` recibiendo alertas | 0 | 0 (filtro activo) |

---

## 12. Notas de seguridad y DRY_RUN

### Protocolo de prueba

**Fase 1 — DRY_RUN (Slice 2, días 1-2):**
```bash
# Invocar manualmente con curl
curl -X POST \
  https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/detector-abandono \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Verificar logs: no deben existir filas nuevas en tasks ni notification_queue
# Solo deben aparecer líneas de console.log en los logs de la EF
```

**Fase 2 — Test con número real de prueba:**
- Crear un lead de prueba con nombre "TEST ABANDONO" y asignarlo a comercial con teléfono de Robert (`+573183061286`) o Heduin (`+584127862439`)
- Actualizar `leads.updated_at` manualmente a hace 6 días:
```sql
UPDATE leads SET updated_at = NOW() - INTERVAL '6 days'
WHERE name = 'TEST ABANDONO';
```
- Ejecutar la EF con `DRY_RUN=false` en modo test
- Verificar que llega el WA a `+573183061286` y aparece la tarea en CRM

**Fase 3 — Activación producción:**
- Confirmar con Robert que el equipo está al tanto de que comenzarán a recibir alertas
- Cambiar `DETECTOR_ABANDONO_DRY_RUN=false` en Supabase Secrets
- Re-deployar la función
- Monitorear `scheduled_job_log` y `abandonment_log` las primeras 3 ejecuciones

### Números de test autorizados
- Robert (dueño): `+573183061286`
- Heduin (pruebas): `+584127862439`
- NUNCA enviar alertas de prueba a los teléfonos de los comerciales reales hasta haber validado el template

### Flag DRY_RUN
```
Secret name: DETECTOR_ABANDONO_DRY_RUN
Valor DRY_RUN:    "true"   → solo loguea, no inserta nada
Valor producción: "false"  → crea tareas + encola WA
Default recomendado para deploy inicial: "true"
```

### Seguridad de datos
- La EF usa `SUPABASE_SERVICE_ROLE_KEY` (ya disponible como variable de entorno en Edge Functions de Supabase, sin necesidad de configuración adicional)
- No expone datos de leads fuera del sistema (solo INSERT interno)
- Los teléfonos de comerciales viven en `auth.users` — la EF tiene acceso vía service role
- `abandonment_log` no contiene datos sensibles del cliente, solo IDs y fechas
