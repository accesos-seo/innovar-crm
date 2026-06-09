# PRD: Coordinador de Producción
**Capa:** 03 — Entrega
**Prioridad:** MEDIA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Coordinador de Producción es un agente que detecta automáticamente cuando un proyecto de Innovar Cocinas pasa al estado `in_fabrication` y notifica al taller de fabricación con la información esencial del pedido vía WhatsApp. Elimina la dependencia de que un coordinador humano recuerde comunicar manualmente al taller qué debe construir y cuándo debe entregarlo.

Este agente resuelve el eslabón más crítico de la cadena operativa: el traspaso entre la fase comercial y la fase de producción. Sin él, el taller puede quedar sin instrucciones claras, lo que genera retrasos, errores de fabricación por falta de información y fechas de entrega incumplidas. Con él, cada vez que alguien en el CRM confirma que un proyecto entra a fabricación, el taller recibe instantáneamente los datos que necesita para arrancar el trabajo.

La implementación se diseña en dos versiones: V1 entrega un mensaje WhatsApp conciso con datos clave del proyecto y un link al CRM (rápida de construir, sin dependencias externas); V2 agrega PDF adjunto con ficha técnica completa (requiere generar el PDF desde Supabase Storage, se implementa en Slice 3 opcional). El agente también registra la fecha de entrega comprometida (`delivery_date`) en la tabla `projects` en el mismo flujo.

---

## 2. Problema que resuelve

Cuando un asesor comercial cambia el estado de un proyecto a "En Fabricación" en el CRM, actualmente no existe ningún mecanismo automático que informe al taller. El proceso manual implica:

1. El asesor o coordinador debe recordar avisar al taller.
2. Debe buscar los datos del proyecto (medidas, materiales, cliente, fecha de entrega).
3. Debe redactar y enviar un mensaje de WhatsApp al taller.
4. Si se olvida o demora, el taller puede estar esperando instrucciones sin saberlo.

Este gap genera dos tipos de falla costosa para Innovar Cocinas:
- **Falla de información:** el taller fabrica con datos incompletos o incorrectos porque no tuvo acceso a la ficha técnica.
- **Falla de tiempo:** el proyecto pierde días porque el taller no sabe que debe empezar, mientras el cliente espera dentro del plazo prometido.

---

## 3. Infraestructura existente que se reutiliza

| Componente | Uso en este agente |
|---|---|
| Tabla `projects` | Fuente del trigger (status = `in_fabrication`), escritura de `delivery_date` |
| Tabla `quotations` | Obtener número de cotización asociada al proyecto |
| Tabla `quotation_items` | Materiales, medidas y acabados del pedido |
| Tabla `clients` | Nombre del cliente y teléfono |
| Tabla `notification_queue` | Encolar mensajes WhatsApp al taller |
| Tabla `system_settings` | Leer `workshop_whatsapp` (número del taller) |
| Tabla `whatsapp_message_log` | Trazabilidad de mensajes enviados |
| Tabla `scheduled_job_log` | Registro de ejecuciones del agente |
| Edge Function `process-whatsapp-notifications` | Envío real al API de Meta (ya existe, no se toca) |
| Template `fabricacion_iniciada_v1` | Notificación al CLIENTE — ya existe, NO se usa para el taller |
| Patrón `dedup_key` en `notification_queue` | Evitar duplicados si el trigger se dispara dos veces |

---

## 4. Gap Analysis — Lo que hay que construir

| Qué falta | Tipo | Descripción |
|---|---|---|
| Template `ficha_taller_v1` | Template WhatsApp (nuevo) | Notificación al taller con datos del proyecto — requiere aprobación Meta |
| Edge Function `coordinador-produccion` | Nueva EF Supabase | Lógica principal del agente |
| Trigger PostgreSQL en `projects` | SQL nuevo | Detecta cambio de status a `in_fabrication` y llama a la EF |
| Clave `workshop_whatsapp` en `system_settings` | INSERT SQL | Número de WhatsApp del taller (si no existe aún) |
| Campo `delivery_date` en `projects` | Verificar si existe | Si no existe, agregar columna `delivery_date DATE` |
| Campo `fabrication_started_at` en `projects` | Columna nueva | Timestamp de inicio de fabricación para métricas |
| Función SQL `get_project_ficha_tecnica(project_id)` | Función SQL nueva | Compila datos del proyecto en un JSON estructurado |
| Índice en `projects(status, updated_at)` | SQL nuevo | Optimiza consultas de proyectos recién cambiados a `in_fabrication` |

---

## 5. Arquitectura Técnica

### Flujo de datos (V1 — mensaje simple)

```
Asesor cambia status → "in_fabrication" en CRM (React)
    │
    ▼
UPDATE projects SET status = 'in_fabrication' (Supabase PostgreSQL)
    │
    ▼
TRIGGER after_project_status_change (PostgreSQL trigger)
    │  Condición: NEW.status = 'in_fabrication' AND OLD.status != 'in_fabrication'
    │
    ▼
pg_net.http_post → Edge Function: coordinador-produccion
    │  Payload: { project_id, triggered_at }
    │
    ▼
Edge Function coordinador-produccion
    ├─ 1. Leer projects + clients + quotations + quotation_items
    ├─ 2. Leer system_settings WHERE key = 'workshop_whatsapp'
    ├─ 3. Calcular delivery_date (si no está seteada: NOW() + 15 días hábiles)
    ├─ 4. UPDATE projects SET delivery_date = ..., fabrication_started_at = NOW()
    ├─ 5. INSERT notification_queue (template: ficha_taller_v1, to: taller)
    └─ 6. INSERT scheduled_job_log (resultado)
         │
         ▼
process-whatsapp-notifications (cron cada 1 min)
    │  Lee notification_queue, llama Meta Graph API v21.0
    │
    ▼
WhatsApp del taller recibe ficha técnica
```

### Stack

- **Runtime:** Deno (Supabase Edge Functions, TypeScript)
- **Trigger:** PostgreSQL trigger + `pg_net` para HTTP async (o Supabase Database Webhooks si está habilitado)
- **Mensajería:** Meta WhatsApp Business API v21.0 vía `notification_queue` + `process-whatsapp-notifications`
- **Datos:** Supabase PostgreSQL (`xdzbjptozeqcbnaqhtye`)

### Consideración sobre el trigger compartido con `notificador-proyecto`

`fabricacion_iniciada_v1` y este agente reaccionan al mismo evento. Para evitar condición de carrera, el trigger PostgreSQL debe llamar AMBAS Edge Functions en secuencia dentro del mismo trigger (o usar un único trigger dispatcher que llame a una EF de routing). La solución más simple: **un trigger, dos pg_net.http_post** (son async, no bloquean). El `dedup_key` en cada inserción a `notification_queue` garantiza que no se dupliquen mensajes aunque el trigger se dispare más de una vez.

---

## 6. Templates WhatsApp requeridos

### Template existente (ya aprobado, NO crear de nuevo)

**`fabricacion_iniciada_v1`** — Se usa para el CLIENTE, NO para el taller.
- Vars: `{{1}}` = nombre_cliente, `{{2}}` = días_estimados
- Este template SIGUE enviándose al cliente (responsabilidad de `notificador-proyecto`, no de este agente)

---

### Template nuevo — requiere aprobación Meta

**Nombre:** `ficha_taller_v1`
**Categoría Meta:** `UTILITY`
**Idioma:** `es`
**Destinatario:** Taller de fabricación (número en `system_settings.workshop_whatsapp`)

**Texto propuesto para someter a Meta:**

```
*NUEVO TRABAJO — Innovar Cocinas*

Proyecto: {{1}}
Cliente: {{2}}
Entrega: {{3}}

Materiales: {{4}}

Ver ficha completa: {{5}}
```

**Variables:**
| Var | Nombre lógico | Ejemplo | Fuente |
|---|---|---|---|
| `{{1}}` | `nombre_proyecto` | `Cocina Integral - Apt 402` | `projects.name` o `clients.name + " - " + projects.id` |
| `{{2}}` | `nombre_cliente` | `Carlos Ramírez` | `clients.name` |
| `{{3}}` | `fecha_entrega` | `25 Jun 2026` | `projects.delivery_date` formateado |
| `{{4}}` | `resumen_materiales` | `Melamina blanca, puertas MDF, herrajes Grass` | Top 3 materiales de `quotation_items`, concatenados, máx 80 chars |
| `{{5}}` | `link_proyecto` | `https://innovarcocinas.co/projects/abc123` | URL fija del CRM + `projects.id` |

**Restricción de caracteres:** El body completo con las vars ocupadas no debe superar 1024 chars. Con el texto propuesto + datos reales estimados (~300 chars), hay margen suficiente.

**Nota V2:** Para enviar PDF adjunto (Slice 3 opcional), Meta requiere un template con `DOCUMENT` en el header y el PDF pre-subido a un Media ID. El body puede ser el mismo o más corto.

---

## 7. Schema de datos

### Verificar y/o crear columnas en `projects`

```sql
-- Verificar si delivery_date existe; si no, crear
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS fabrication_started_at TIMESTAMPTZ;

-- Índice para consultas del agente
CREATE INDEX IF NOT EXISTS idx_projects_status_updated
  ON projects (status, updated_at DESC);
```

### Insertar configuración del taller en `system_settings`

```sql
-- Insertar solo si no existe
INSERT INTO system_settings (key, value)
VALUES ('workshop_whatsapp', '573XXXXXXXXX')  -- reemplazar con número real
ON CONFLICT (key) DO NOTHING;

-- También registrar días de fabricación por defecto
INSERT INTO system_settings (key, value)
VALUES ('default_fabrication_days', '15')
ON CONFLICT (key) DO NOTHING;

-- URL base del CRM para links en WA
INSERT INTO system_settings (key, value)
VALUES ('crm_base_url', 'https://innovarcocinas.co')
ON CONFLICT (key) DO NOTHING;
```

### Función SQL auxiliar

```sql
-- Función que compila la ficha técnica como JSON estructurado
CREATE OR REPLACE FUNCTION get_project_ficha_tecnica(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'project_id',       p.id,
    'project_label',    COALESCE(cl.name || ' - #' || LEFT(p.id::TEXT, 8), 'Proyecto'),
    'client_name',      cl.name,
    'client_phone',     cl.whatsapp_phone,
    'delivery_date',    p.delivery_date,
    'status',           p.status,
    'quotation_id',     q.id,
    'quotation_number', q.id,  -- ajustar si hay campo nro_cotizacion
    'total_amount',     q.total_amount,
    'items',            COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'quantity',    qi.quantity,
        'unit',        qi.unit,
        'material',    qi.material,
        'finish',      qi.finish,
        'width_cm',    qi.width_cm,
        'height_cm',   qi.height_cm,
        'depth_cm',    qi.depth_cm
      ) ORDER BY qi.sort_order)
       FROM quotation_items qi
       WHERE qi.quotation_id = q.id),
      '[]'::JSONB
    )
  )
  INTO v_result
  FROM projects p
  JOIN clients cl ON cl.id = p.client_id
  LEFT JOIN quotations q ON q.opportunity_id = p.opportunity_id
    AND q.status = 'approved'
  WHERE p.id = p_project_id;

  RETURN v_result;
END;
$$;
```

**Nota:** Si `quotation_items` no tiene las columnas `material`, `finish`, `width_cm`, `height_cm`, `depth_cm`, la función simplemente las omitirá (COALESCE a NULL). Verificar el schema real antes del Slice 1.

### Trigger PostgreSQL

```sql
-- Función invocada por el trigger
CREATE OR REPLACE FUNCTION notify_fabrication_started()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'in_fabrication' AND (OLD.status IS DISTINCT FROM 'in_fabrication') THEN
    -- Llamada async a la EF (no bloquea el UPDATE)
    PERFORM net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/coordinador-produccion',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := jsonb_build_object(
        'project_id',   NEW.id,
        'triggered_at', NOW()
      )::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger en la tabla projects
DROP TRIGGER IF EXISTS trg_fabrication_started ON projects;
CREATE TRIGGER trg_fabrication_started
  AFTER UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_fabrication_started();
```

---

## 8. Implementación paso a paso

### Slice 1: Fundamentos de datos y configuración

**Qué incluye:**
- Verificar/crear columnas `delivery_date` y `fabrication_started_at` en `projects`
- Verificar columnas en `quotation_items` (material, finish, medidas)
- Insertar claves en `system_settings` (`workshop_whatsapp`, `default_fabrication_days`, `crm_base_url`)
- Crear función SQL `get_project_ficha_tecnica`
- Crear índice `idx_projects_status_updated`

**SQL completo:**

```sql
-- 1. Columnas en projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS fabrication_started_at TIMESTAMPTZ;

-- 2. Columnas en quotation_items (solo si no existen)
ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS material TEXT,
  ADD COLUMN IF NOT EXISTS finish TEXT,
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS depth_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_projects_status_updated
  ON projects (status, updated_at DESC);

-- 4. system_settings
INSERT INTO system_settings (key, value)
VALUES
  ('workshop_whatsapp', '573XXXXXXXXX'),
  ('default_fabrication_days', '15'),
  ('crm_base_url', 'https://innovarcocinas.co')
ON CONFLICT (key) DO NOTHING;

-- 5. Función ficha técnica (ver sección 7)
-- [pegar función get_project_ficha_tecnica aquí]
```

**Criterio de aceptación:**
- `SELECT * FROM system_settings WHERE key IN ('workshop_whatsapp','default_fabrication_days','crm_base_url')` devuelve 3 filas
- `SELECT delivery_date, fabrication_started_at FROM projects LIMIT 1` no da error de columna
- `SELECT get_project_ficha_tecnica('<uuid-proyecto-real>')` devuelve JSON con client_name y items

---

### Slice 2: Edge Function + Trigger (V1 — mensaje simple)

**Qué incluye:**
- Edge Function `coordinador-produccion` en TypeScript/Deno
- Trigger PostgreSQL `trg_fabrication_started`
- Lógica: leer datos → calcular fecha → UPDATE projects → INSERT notification_queue

**Archivo:** `supabase/functions/coordinador-produccion/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DRY_RUN = Deno.env.get('DRY_RUN') === 'true'

serve(async (req) => {
  const jobStart = new Date()
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const body = await req.json()
    const { project_id, triggered_at } = body

    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id requerido' }), { status: 400 })
    }

    // 1. Leer ficha técnica compilada
    const { data: ficha, error: fichaError } = await supabase
      .rpc('get_project_ficha_tecnica', { p_project_id: project_id })
    if (fichaError) throw new Error(`Error get_project_ficha_tecnica: ${fichaError.message}`)
    if (!ficha) throw new Error(`Proyecto ${project_id} no encontrado`)

    // 2. Leer configuración del taller
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['workshop_whatsapp', 'default_fabrication_days', 'crm_base_url'])
    if (settingsError) throw new Error(`Error system_settings: ${settingsError.message}`)

    const settingsMap: Record<string, string> = {}
    for (const s of (settings ?? [])) settingsMap[s.key] = s.value

    const workshopPhone = settingsMap['workshop_whatsapp']
    if (!workshopPhone) throw new Error('workshop_whatsapp no configurado en system_settings')

    const defaultDays = parseInt(settingsMap['default_fabrication_days'] ?? '15', 10)
    const crmBaseUrl = settingsMap['crm_base_url'] ?? 'https://innovarcocinas.co'

    // 3. Calcular delivery_date si no está seteada
    let deliveryDate: string = ficha.delivery_date
    if (!deliveryDate) {
      const d = new Date()
      d.setDate(d.getDate() + defaultDays)
      deliveryDate = d.toISOString().split('T')[0]
    }

    // Formatear fecha para WhatsApp (ej: "25 Jun 2026")
    const deliveryFormatted = new Date(deliveryDate + 'T00:00:00').toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

    // 4. Compilar resumen de materiales (máx 80 chars)
    const items: Array<{ description: string; material?: string }> = ficha.items ?? []
    const materialesRaw = items
      .slice(0, 3)
      .map(i => i.material || i.description)
      .filter(Boolean)
      .join(', ')
    const materiales = materialesRaw.length > 80
      ? materialesRaw.substring(0, 77) + '...'
      : materialesRaw || 'Ver detalle en CRM'

    // 5. Link al proyecto
    const linkProyecto = `${crmBaseUrl}/projects/${project_id}`

    // 6. UPDATE projects
    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          delivery_date: deliveryDate,
          fabrication_started_at: triggered_at ?? new Date().toISOString()
        })
        .eq('id', project_id)
      if (updateError) throw new Error(`Error UPDATE projects: ${updateError.message}`)
    }

    // 7. INSERT notification_queue (al taller)
    const dedupKey = `coordinador-produccion:${project_id}:ficha_taller:${new Date().toISOString().split('T')[0]}`

    if (!DRY_RUN) {
      const { error: queueError } = await supabase
        .from('notification_queue')
        .insert({
          recipient_phone: workshopPhone,
          template_name: 'ficha_taller_v1',
          template_language: 'es',
          template_parameters: {
            '1': ficha.project_label,
            '2': ficha.client_name,
            '3': deliveryFormatted,
            '4': materiales,
            '5': linkProyecto
          },
          dedup_key: dedupKey,
          status: 'pending',
          attempt_count: 0
        })
      if (queueError && !queueError.message.includes('duplicate')) {
        throw new Error(`Error INSERT notification_queue: ${queueError.message}`)
      }
    }

    // 8. Log de ejecución
    await supabase.from('scheduled_job_log').insert({
      job_name: 'coordinador-produccion',
      started_at: jobStart.toISOString(),
      finished_at: new Date().toISOString(),
      rows_processed: 1,
      status: DRY_RUN ? 'dry_run' : 'success',
      metadata: { project_id, dry_run: DRY_RUN, delivery_date: deliveryDate }
    })

    return new Response(JSON.stringify({
      ok: true,
      dry_run: DRY_RUN,
      project_id,
      delivery_date: deliveryDate,
      taller_phone: workshopPhone,
      template: 'ficha_taller_v1'
    }), { status: 200 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('scheduled_job_log').insert({
      job_name: 'coordinador-produccion',
      started_at: jobStart.toISOString(),
      finished_at: new Date().toISOString(),
      rows_processed: 0,
      status: 'error',
      metadata: { error: msg }
    }).catch(() => {})

    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 })
  }
})
```

**Trigger SQL:**

```sql
-- (Ver sección 7 — copiar función notify_fabrication_started y el CREATE TRIGGER)
```

**Deploy:**

```bash
supabase functions deploy coordinador-produccion --project-ref xdzbjptozeqcbnaqhtye
```

**Criterio de aceptación:**

1. `DRY_RUN=true`: llamar la EF con `project_id` de un proyecto en `in_fabrication` → respuesta 200 con `dry_run: true`, sin INSERT en `notification_queue`, sin UPDATE en `projects`
2. `DRY_RUN=false`: cambiar manualmente un proyecto de test a `in_fabrication` → `notification_queue` tiene 1 nueva fila con `template_name = 'ficha_taller_v1'` y `status = 'pending'`
3. Al cabo de ≤ 2 minutos, `whatsapp_message_log` tiene la fila correspondiente con `status = 'sent'`
4. El taller (número de prueba: Robert `+573183061286`) recibe el mensaje
5. `projects.delivery_date` y `fabrication_started_at` quedan populados

---

### Slice 3 (opcional — V2): PDF adjunto al taller

**Qué incluye:**
- Nuevo template Meta `ficha_taller_pdf_v1` con header tipo DOCUMENT
- Lógica en la EF para llamar `generate-pdf-quotation` y obtener un Media ID de Meta
- Upload del PDF a WhatsApp Media y envío como mensaje con documento adjunto

**Pre-requisitos:**
- `generate-pdf-quotation` debe poder generar un PDF de ficha técnica (no solo cotización)
- Bucket de Storage en Supabase para archivos temporales, o uso directo de Media Upload API de Meta

**Diseño del template `ficha_taller_pdf_v1`:**

```
Header: DOCUMENT (PDF adjunto)
Body: "Hola taller 👋 Nuevo trabajo ingresado. Adjunto la ficha técnica de {{1}} para {{2}}. Entrega: {{3}}."
```

**Nota de implementación:** Meta requiere subir el PDF con `POST https://graph.facebook.com/v21.0/{phone-number-id}/media` antes de enviar el template. Esto agrega ~2-3 segundos al flujo. Implementar solo si el V1 ya está en producción y estable.

**Criterio de aceptación:**
- El taller recibe PDF legible con todas las medidas y materiales
- El PDF se genera en < 5 segundos
- Si la generación falla, la EF hace fallback al mensaje V1 (degradación elegante)

---

## 9. Criterios de aceptación globales

- [ ] `system_settings` contiene `workshop_whatsapp` con número real del taller colombiano (+57...)
- [ ] La función `get_project_ficha_tecnica` retorna JSON válido con `client_name`, `delivery_date` e `items` para cualquier proyecto con cotización aprobada
- [ ] El trigger `trg_fabrication_started` se dispara SOLO cuando el status cambia DE otro estado A `in_fabrication` (no en cada UPDATE)
- [ ] Si el mismo proyecto se pone en `in_fabrication` dos veces seguidas, el `dedup_key` evita enviar dos mensajes el mismo día
- [ ] `projects.delivery_date` y `projects.fabrication_started_at` quedan escritos dentro de los 10 segundos siguientes al cambio de status
- [ ] El mensaje llega al taller en ≤ 2 minutos desde el cambio de estado
- [ ] El template `ficha_taller_v1` está aprobado por Meta antes de activar en producción
- [ ] El agente NO envía mensajes al cliente (eso lo hace `fabricacion_iniciada_v1` vía `notificador-proyecto`)
- [ ] `scheduled_job_log` registra cada ejecución con status `success`, `error` o `dry_run`
- [ ] Si `workshop_whatsapp` no está configurado, la EF falla con error descriptivo y lo registra en `scheduled_job_log` sin crashear el proceso del asesor
- [ ] Deploy con `DRY_RUN=true` como variable de entorno antes de activar en producción

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Template `ficha_taller_v1` rechazado por Meta | Media | Tener texto de backup más neutro. Categoría UTILITY tiene menor tasa de rechazo que MARKETING |
| `quotation_items` no tiene columnas de medidas/materiales | Alta | Slice 1 agrega las columnas; si están vacías, el mensaje muestra "Ver detalle en CRM" sin fallar |
| `workshop_whatsapp` no está en `system_settings` | Media | La EF valida al inicio y lanza error descriptivo; nunca silencia el problema |
| El trigger se dispara en cascada (otro proceso hace UPDATE de status) | Media | La condición `OLD.status IS DISTINCT FROM 'in_fabrication'` garantiza que solo se activa en el primer cambio |
| Conflicto con `notificador-proyecto` en el mismo trigger | Media | Ambos usan `dedup_key` distintas; pg_net es async, no hay bloqueo. Verificar que `notificador-proyecto` no use el mismo `dedup_key` |
| La EF tarda > 60s y Meta timeout | Baja | La inserción en `notification_queue` es el paso crítico; el envío real lo hace `process-whatsapp-notifications` de forma desacoplada |
| `delivery_date` ya tiene valor y no debe pisarse | Media | La EF solo escribe `delivery_date` si el campo es NULL; si ya tiene valor, lo respeta |
| Número del taller cambia | Baja | `system_settings` es editable desde el CRM sin redeploy |
| `generate-pdf-quotation` no soporta ficha de proyecto (Slice 3) | Alta para Slice 3 | Slice 3 es explícitamente opcional; V1 no depende de él |

---

## 11. Métricas de éxito

| Métrica | Objetivo | Cómo medirlo |
|---|---|---|
| Tasa de notificación exitosa | ≥ 98% de proyectos que pasan a `in_fabrication` generan un WA enviado | `SELECT COUNT(*) FROM whatsapp_message_log wml JOIN notification_queue nq ON nq.id = wml.queue_id WHERE nq.template_name = 'ficha_taller_v1'` vs total proyectos en `in_fabrication` |
| Latencia trigger → mensaje enviado | ≤ 2 minutos en horario normal | `wml.sent_at - p.fabrication_started_at` promedio por semana |
| Errores por semana | ≤ 1 error en `scheduled_job_log` | `SELECT COUNT(*) FROM scheduled_job_log WHERE job_name = 'coordinador-produccion' AND status = 'error' AND started_at > NOW() - INTERVAL '7 days'` |
| `delivery_date` poblada | 100% de proyectos en `in_fabrication` o posterior tienen `delivery_date` no nula | `SELECT COUNT(*) FROM projects WHERE status IN ('in_fabrication','installation','delivered','completed') AND delivery_date IS NULL` → debe ser 0 |
| Reducción de olvidos reportados por el taller | Cero reportes de "no sabía que había un pedido nuevo" en el primer mes | Seguimiento manual con el coordinador de taller |

---

## 12. Notas de seguridad y DRY_RUN

### Variable de entorno DRY_RUN

Agregar al `.env` del proyecto y cargar como secret en Supabase Vault:

```bash
# En .env local (desarrollo y pruebas)
DRY_RUN=true

# Activar producción:
DRY_RUN=false
```

```bash
# Cargar secret en Supabase
supabase secrets set DRY_RUN=true --project-ref xdzbjptozeqcbnaqhtye
# Cuando todo esté validado:
supabase secrets set DRY_RUN=false --project-ref xdzbjptozeqcbnaqhtye
```

### Protocolo de prueba

1. **Fase 1 — Prueba aislada de la EF (DRY_RUN=true):**
   - Invocar la EF directamente con `curl` pasando un `project_id` real en estado `in_fabrication`
   - Verificar respuesta 200 y log en `scheduled_job_log` con `status = 'dry_run'`
   - Confirmar que NO hay fila nueva en `notification_queue`

2. **Fase 2 — Prueba end-to-end con número de test:**
   - Temporalmente cambiar `workshop_whatsapp` a `+573183061286` (Robert) en `system_settings`
   - Cambiar `DRY_RUN=false`
   - Crear un proyecto de test y moverlo a `in_fabrication` desde el CRM
   - Verificar que Robert recibe el WhatsApp con los datos del proyecto de test
   - Verificar `projects.delivery_date` y `fabrication_started_at` escritos

3. **Fase 3 — Activación producción:**
   - Restaurar `workshop_whatsapp` al número real del taller
   - Confirmar con el taller que recibió correctamente el mensaje de prueba
   - El agente queda activo de forma permanente (no necesita cron — es event-driven)

### Seguridad de datos

- La EF usa `SUPABASE_SERVICE_ROLE_KEY` — solo se invoca desde el trigger interno de Supabase, no está expuesta a usuarios finales
- El número del taller (`workshop_whatsapp`) nunca se expone en el frontend
- El `dedup_key` incluye la fecha, por lo que si un proyecto se reactiva al día siguiente (edge case), el taller recibe la notificación correctamente
