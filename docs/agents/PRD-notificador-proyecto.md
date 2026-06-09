# PRD: Notificador de Proyecto

**Capa:** 03 — Entrega
**Prioridad:** MEDIA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Notificador de Proyecto es un agente de la capa de Entrega que informa proactivamente al cliente cada vez que su proyecto de cocina avanza a una nueva fase del proceso productivo. Funciona mediante un trigger PostgreSQL que detecta cambios de estado en la tabla `projects` y encola un mensaje WhatsApp personalizado usando Meta Business API, sin intervención humana.

Para Innovar Cocinas, mantener al cliente informado durante las semanas que tarda la fabricación e instalación es un diferenciador de servicio directo. Hoy ese seguimiento ocurre ad hoc (el comercial recuerda avisar o no), lo que genera llamadas de clientes preguntando "¿cómo va mi cocina?", desgaste en el equipo y percepción de desorden. Este agente elimina ese ruido automatizando cada notificación de avance.

El agente cubre seis transiciones de estado en `projects.status` (planning → in_design → materials → in_fabrication → installation → completed), reutiliza tres templates Meta ya aprobados y requiere dos nuevos. La V1 opera sin foto adjunta para acelerar el lanzamiento; la foto queda documentada como V2.

---

## 2. Problema que resuelve

El proceso productivo de Innovar Cocinas dura entre 4 y 8 semanas. Durante ese tiempo el cliente no recibe actualizaciones sistemáticas: sabe que aprobó la cotización y pagó, pero no sabe si ya empezaron a diseñar, si los materiales llegaron, si su cocina está en fabricación. Esto produce:

- **Llamadas entrantes innecesarias** al equipo comercial o de taller pidiendo "novedades"
- **Ansiedad del cliente** que percibe silencio como problema
- **Dependencia del olvido humano**: el aviso sale si el comercial recuerda, no como proceso

El trigger resuelve esto en el momento exacto en que el operador actualiza el estado del proyecto en el sistema: el cliente recibe un WhatsApp en segundos, personalizado, con el nombre de su proyecto y la información relevante de esa fase (días estimados, fecha de instalación, etc.).

---

## 3. Infraestructura existente que se reutiliza

**Tablas:**
- `projects` — fuente de la detección de cambio (`id`, `client_id`, `status`, `opportunity_id`, `delivery_date`)
- `clients` — para obtener `whatsapp_phone` y `name` del destinatario
- `notification_queue` — cola de salida estándar (`recipient_phone`, `template_name`, `template_language`, `template_parameters`, `status`, `dedup_key`)
- `whatsapp_message_log` — log de entregas (se puebla automáticamente por `process-whatsapp-notifications`)

**Edge Functions:**
- `process-whatsapp-notifications` — ya procesa la `notification_queue` cada minuto vía pg_cron; no hay que modificarla

**Templates Meta ya aprobados (reutilizables sin tramitación):**
- `fabricacion_iniciada_v1` — cubre transición `materials → in_fabrication`; vars: `{{1}}=nombre`, `{{2}}=días_estimados`
- `instalacion_programada_v1` — cubre transición `in_fabrication → installation`; vars: `{{1}}=nombre`, `{{2}}=fecha`
- `proyecto_completado_v1` — cubre transición `installation → completed`; vars: `{{1}}=nombre`, `{{2}}=nombre_proyecto`

**Patrón de dedup_key:**
```
notificador-proyecto:{project_id}:{new_status}:{YYYY-MM-DD}
```
Ejemplo: `notificador-proyecto:abc123:in_fabrication:2026-06-09`

---

## 4. Gap Analysis — Lo que hay que construir

| Componente | Estado | Acción |
|---|---|---|
| Template `proyecto_en_diseno_v1` | ❌ Falta | Crear y someter a Meta |
| Template `materiales_en_proceso_v1` | ❌ Falta | Crear y someter a Meta |
| Trigger `trg_project_phase_change` en tabla `projects` | ❌ Falta | Crear función + trigger SQL |
| Función SQL `fn_notify_project_phase_change` | ❌ Falta | Crear en Supabase |
| Campo `name` accesible desde trigger | ⚠️ Verificar | Requiere JOIN a `clients` dentro de la función trigger; `clients.name` y `clients.whatsapp_phone` |
| Campo `nombre_proyecto` en `projects` | ⚠️ Verificar | `projects` no expone un nombre propio; proponer `name` o usar `opportunity_id` como fallback |
| Campo `estimated_days` en `projects` | ❌ Falta | Agregar columna `estimated_fabrication_days INTEGER` a `projects` o leer de `system_settings` |
| Campo `installation_date` en `projects` | ⚠️ Verificar | Verificar si `delivery_date` cumple o si se necesita `installation_scheduled_at TIMESTAMPTZ` |
| Índice en `projects(status)` | ⚠️ Revisar | Para trigger eficiente — probablemente ya existe por PK y FK, confirmar |
| Log de transiciones `project_phase_log` | ❌ Falta | Tabla de auditoría para debugging y métricas |

---

## 5. Arquitectura Técnica

### Flujo de datos

```
Operador actualiza projects.status en el CRM
          │
          ▼
[TRIGGER] trg_project_phase_change (AFTER UPDATE ON projects)
          │  Solo si NEW.status != OLD.status
          │
          ▼
[FUNCIÓN] fn_notify_project_phase_change()
          │
          ├─── JOIN clients ON clients.id = NEW.client_id
          │    → obtiene: whatsapp_phone, name
          │
          ├─── Evalúa NEW.status
          │    ┌─ 'in_design'      → template: proyecto_en_diseno_v1
          │    ├─ 'materials'      → template: materiales_en_proceso_v1
          │    ├─ 'in_fabrication' → template: fabricacion_iniciada_v1
          │    ├─ 'installation'   → template: instalacion_programada_v1
          │    ├─ 'completed'      → template: proyecto_completado_v1
          │    └─ otros (planning, delivered) → EXIT (sin notificación)
          │
          ├─── Construye dedup_key
          │    → 'notificador-proyecto:{project_id}:{new_status}:{YYYY-MM-DD}'
          │
          ├─── Verifica: no existe row en notification_queue con mismo dedup_key
          │    Si existe → EXIT (idempotente)
          │
          ├─── INSERT INTO notification_queue
          │    (recipient_phone, template_name, template_language,
          │     template_parameters, status, dedup_key)
          │
          └─── INSERT INTO project_phase_log
               (project_id, old_status, new_status, client_id, notified_at)
          │
          ▼
[CRON — ya existente, cada 1 min]
process-whatsapp-notifications Edge Function
          │
          ▼
Meta WhatsApp Business API (Graph API v21.0)
          │
          ▼
WhatsApp del cliente (+57XXXXXXXXXX)
          │
          ▼
UPDATE notification_queue SET status = 'sent'
INSERT INTO whatsapp_message_log
```

### Stack

- **Trigger + función PL/pgSQL:** Supabase PostgreSQL, sin dependencias externas
- **Cola de salida:** `notification_queue` (patrón existente)
- **Dispatcher:** `process-whatsapp-notifications` Edge Function (ya en producción)
- **Destino:** Meta WhatsApp Business API, phone_id de SeoLab Agency
- **Auditoría:** tabla nueva `project_phase_log`

### Notas de diseño

La función trigger corre en el contexto de la transacción del UPDATE. Si el INSERT en `notification_queue` falla, el UPDATE en `projects` también se revierte (ACID). Esto es el comportamiento correcto: nunca queremos notificar sin que el estado se haya guardado.

Los parámetros del template se construyen como `jsonb` directamente en la función PL/pgSQL usando `jsonb_build_array()`.

---

## 6. Templates WhatsApp requeridos

### Templates existentes (ya aprobados en Meta — usar directamente)

**`fabricacion_iniciada_v1`**
- Cubre: transición → `in_fabrication`
- Variables: `{{1}}=nombre_cliente`, `{{2}}=días_estimados`
- Estado: APROBADO

**`instalacion_programada_v1`**
- Cubre: transición → `installation`
- Variables: `{{1}}=nombre_cliente`, `{{2}}=fecha_instalacion`
- Estado: APROBADO

**`proyecto_completado_v1`**
- Cubre: transición → `completed`
- Variables: `{{1}}=nombre_cliente`, `{{2}}=nombre_proyecto`
- Estado: APROBADO

---

### Templates nuevos a crear y someter a Meta

**Template 1: `proyecto_en_diseno_v1`**
- Cubre: transición → `in_design`
- Categoría Meta: `UTILITY`
- Variables: `{{1}}=nombre_cliente`, `{{2}}=nombre_proyecto`
- Idioma: `es` (Spanish)

Texto propuesto para el cuerpo del mensaje (máx 160 chars):
```
Hola {{1}}, ¡buenas noticias! 🎨 Tu proyecto *{{2}}* ya está en la fase de diseño. Nuestro equipo está trabajando en los planos personalizados para ti. Te avisamos en cada avance.
```

Nota: mantener bajo 160 chars en el cuerpo principal para no truncar en vistas de notificación. El texto completo puede ser hasta 1024 chars en Meta.

Texto para Meta Business Manager (campo "Message body"):
```
Hola {{1}}, ¡buenas noticias! Tu proyecto {{2}} ya está en la fase de diseño. Nuestro equipo está trabajando en los planos personalizados para ti. Te avisamos en cada avance. — Innovar Cocinas
```

---

**Template 2: `materiales_en_proceso_v1`**
- Cubre: transición → `materials`
- Categoría Meta: `UTILITY`
- Variables: `{{1}}=nombre_cliente`, `{{2}}=nombre_proyecto`
- Idioma: `es` (Spanish)

Texto propuesto:
```
Hola {{1}}, el diseño de tu cocina {{2}} fue aprobado y ya estamos gestionando la compra de materiales. En cuanto lleguen al taller, comenzamos la fabricación. Te mantenemos al tanto. — Innovar Cocinas
```

---

### Mapeo completo status → template

| `projects.status` | Template | Variables que construir |
|---|---|---|
| `in_design` | `proyecto_en_diseno_v1` | `[client.name, project.name]` |
| `materials` | `materiales_en_proceso_v1` | `[client.name, project.name]` |
| `in_fabrication` | `fabricacion_iniciada_v1` | `[client.name, projects.estimated_fabrication_days::text]` |
| `installation` | `instalacion_programada_v1` | `[client.name, to_char(projects.installation_scheduled_at, 'DD/MM/YYYY')]` |
| `completed` | `proyecto_completado_v1` | `[client.name, project.name]` |
| `planning`, `delivered` | — (sin notificación) | — |

---

## 7. Schema de datos

### Cambios en tabla `projects` (existente)

```sql
-- Agregar campos necesarios para los templates
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS estimated_fabrication_days INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS installation_scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN projects.name IS 'Nombre descriptivo del proyecto, ej: "Cocina Principal Apartamento 402"';
COMMENT ON COLUMN projects.estimated_fabrication_days IS 'Días hábiles estimados para fabricación, se informa al cliente al pasar a in_fabrication';
COMMENT ON COLUMN projects.installation_scheduled_at IS 'Fecha y hora programada de instalación, se informa al cliente al pasar a installation';
```

### Nueva tabla: `project_phase_log`

```sql
CREATE TABLE IF NOT EXISTS project_phase_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  old_status      TEXT NOT NULL,
  new_status      TEXT NOT NULL,
  notified        BOOLEAN NOT NULL DEFAULT FALSE,
  skip_reason     TEXT,           -- 'duplicate_dedup_key' | 'no_phone' | 'no_template' | 'client_phase'
  queue_id        UUID REFERENCES notification_queue(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by      UUID            -- auth.uid() si aplica, nullable para cambios programáticos
);

CREATE INDEX IF NOT EXISTS idx_project_phase_log_project_id
  ON project_phase_log(project_id);

CREATE INDEX IF NOT EXISTS idx_project_phase_log_changed_at
  ON project_phase_log(changed_at DESC);

COMMENT ON TABLE project_phase_log IS 'Auditoría de cambios de fase en proyectos y resultado de notificación al cliente';
```

### Índice adicional en `notification_queue`

```sql
-- Acelera la búsqueda de dedup por agente
CREATE INDEX IF NOT EXISTS idx_notification_queue_dedup_key
  ON notification_queue(dedup_key)
  WHERE dedup_key IS NOT NULL;
```

### Verificación de campos necesarios en `clients`

```sql
-- Confirmar que clients tiene whatsapp_phone y name antes del Slice 2
-- (ejecutar solo como verificación, no como cambio)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'clients'
  AND column_name IN ('name', 'whatsapp_phone');
```

---

## 8. Implementación paso a paso

### Slice 1: Datos y auditoría

**Qué incluye:**
- Agregar columnas faltantes a `projects`
- Crear tabla `project_phase_log`
- Crear índice de dedup en `notification_queue`
- Verificar campos en `clients`

**SQL completo:**

```sql
-- ============================================================
-- Slice 1: Schema para Notificador de Proyecto
-- Idempotente: seguro de ejecutar múltiples veces
-- ============================================================

-- 1. Columnas nuevas en projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS estimated_fabrication_days INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS installation_scheduled_at TIMESTAMPTZ;

-- 2. Tabla de auditoría de fases
CREATE TABLE IF NOT EXISTS project_phase_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id),
  old_status      TEXT NOT NULL,
  new_status      TEXT NOT NULL,
  notified        BOOLEAN NOT NULL DEFAULT FALSE,
  skip_reason     TEXT,
  queue_id        UUID REFERENCES notification_queue(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by      UUID
);

CREATE INDEX IF NOT EXISTS idx_project_phase_log_project_id
  ON project_phase_log(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phase_log_changed_at
  ON project_phase_log(changed_at DESC);

-- 3. Índice dedup en notification_queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_dedup_key
  ON notification_queue(dedup_key)
  WHERE dedup_key IS NOT NULL;

-- 4. Verificación de clients (debe devolver 2 filas)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'clients'
  AND column_name IN ('name', 'whatsapp_phone');
```

**Criterio de aceptación del Slice 1:**
- `SELECT column_name FROM information_schema.columns WHERE table_name='projects' AND column_name IN ('name','estimated_fabrication_days','installation_scheduled_at')` devuelve 3 filas
- `SELECT to_regclass('public.project_phase_log')` devuelve valor no nulo
- La verificación de `clients` devuelve 2 filas (`name` y `whatsapp_phone`)
- No hay errores en el SQL (idempotente: segunda ejecución no falla)

---

### Slice 2: Función trigger y lógica de notificación

**Qué incluye:**
- Función PL/pgSQL `fn_notify_project_phase_change`
- Trigger `trg_project_phase_change` en `projects`
- Lógica de dedup, selección de template, construcción de parámetros e INSERT en `notification_queue`

**SQL completo:**

```sql
-- ============================================================
-- Slice 2: Trigger de cambio de fase — Notificador de Proyecto
-- ============================================================

CREATE OR REPLACE FUNCTION fn_notify_project_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client          RECORD;
  v_template_name   TEXT;
  v_template_params JSONB;
  v_dedup_key       TEXT;
  v_project_name    TEXT;
  v_queue_id        UUID;
  v_skip_reason     TEXT := NULL;
  v_notified        BOOLEAN := FALSE;
  v_install_date    TEXT;
BEGIN
  -- ── Guard: solo cuando la fase realmente cambia ──────────────
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- ── Guard: solo fases que generan notificación ───────────────
  IF NEW.status NOT IN ('in_design', 'materials', 'in_fabrication', 'installation', 'completed') THEN
    RETURN NEW;
  END IF;

  -- ── Obtener datos del cliente ─────────────────────────────────
  SELECT name, whatsapp_phone
  INTO v_client
  FROM clients
  WHERE id = NEW.client_id;

  IF NOT FOUND OR v_client.whatsapp_phone IS NULL OR v_client.whatsapp_phone = '' THEN
    v_skip_reason := 'no_phone';
    INSERT INTO project_phase_log
      (project_id, client_id, old_status, new_status, notified, skip_reason)
    VALUES
      (NEW.id, NEW.client_id, OLD.status, NEW.status, FALSE, v_skip_reason);
    RETURN NEW;
  END IF;

  -- ── Nombre del proyecto (fallback a ID si no tiene nombre) ────
  v_project_name := COALESCE(NULLIF(NEW.name, ''), 'Proyecto ' || LEFT(NEW.id::TEXT, 8));

  -- ── Construir dedup_key ───────────────────────────────────────
  v_dedup_key := 'notificador-proyecto:' || NEW.id::TEXT || ':' || NEW.status || ':' || TO_CHAR(NOW(), 'YYYY-MM-DD');

  -- ── Guard: idempotencia ───────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM notification_queue
    WHERE dedup_key = v_dedup_key
  ) THEN
    RETURN NEW;
  END IF;

  -- ── Seleccionar template y construir parámetros ───────────────
  CASE NEW.status

    WHEN 'in_design' THEN
      v_template_name   := 'proyecto_en_diseno_v1';
      v_template_params := jsonb_build_array(
        jsonb_build_object('type','text','text', v_client.name),
        jsonb_build_object('type','text','text', v_project_name)
      );

    WHEN 'materials' THEN
      v_template_name   := 'materiales_en_proceso_v1';
      v_template_params := jsonb_build_array(
        jsonb_build_object('type','text','text', v_client.name),
        jsonb_build_object('type','text','text', v_project_name)
      );

    WHEN 'in_fabrication' THEN
      v_template_name   := 'fabricacion_iniciada_v1';
      v_template_params := jsonb_build_array(
        jsonb_build_object('type','text','text', v_client.name),
        jsonb_build_object('type','text','text',
          COALESCE(NEW.estimated_fabrication_days::TEXT, '15') || ' días hábiles'
        )
      );

    WHEN 'installation' THEN
      IF NEW.installation_scheduled_at IS NULL THEN
        v_skip_reason := 'missing_installation_date';
        INSERT INTO project_phase_log
          (project_id, client_id, old_status, new_status, notified, skip_reason)
        VALUES
          (NEW.id, NEW.client_id, OLD.status, NEW.status, FALSE, v_skip_reason);
        RETURN NEW;
      END IF;
      v_install_date    := TO_CHAR(NEW.installation_scheduled_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY');
      v_template_name   := 'instalacion_programada_v1';
      v_template_params := jsonb_build_array(
        jsonb_build_object('type','text','text', v_client.name),
        jsonb_build_object('type','text','text', v_install_date)
      );

    WHEN 'completed' THEN
      v_template_name   := 'proyecto_completado_v1';
      v_template_params := jsonb_build_array(
        jsonb_build_object('type','text','text', v_client.name),
        jsonb_build_object('type','text','text', v_project_name)
      );

    ELSE
      RETURN NEW;

  END CASE;

  -- ── Insertar en notification_queue ────────────────────────────
  INSERT INTO notification_queue
    (recipient_phone, template_name, template_language,
     template_parameters, status, dedup_key)
  VALUES
    (v_client.whatsapp_phone, v_template_name, 'es',
     v_template_params, 'pending', v_dedup_key)
  RETURNING id INTO v_queue_id;

  v_notified := TRUE;

  -- ── Log de auditoría ──────────────────────────────────────────
  INSERT INTO project_phase_log
    (project_id, client_id, old_status, new_status, notified, queue_id, changed_by)
  VALUES
    (NEW.id, NEW.client_id, OLD.status, NEW.status, v_notified, v_queue_id, auth.uid());

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- No bloquear el UPDATE del proyecto si la notificación falla
  INSERT INTO project_phase_log
    (project_id, client_id, old_status, new_status, notified, skip_reason)
  VALUES
    (NEW.id, NEW.client_id, OLD.status, NEW.status, FALSE,
     'exception:' || SQLERRM);
  RETURN NEW;
END;
$$;

-- ── Crear el trigger ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_project_phase_change ON projects;

CREATE TRIGGER trg_project_phase_change
  AFTER UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_project_phase_change();
```

**Criterio de aceptación del Slice 2:**
- `SELECT to_regclass('public.trg_project_phase_change')` — no aplica para triggers; usar: `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_project_phase_change'` → devuelve 1 fila
- Ejecutar manualmente un UPDATE de prueba con número de test:
  ```sql
  -- Setup de prueba
  UPDATE projects
  SET status = 'in_design'
  WHERE id = '<project_id_de_prueba>';
  ```
- `SELECT * FROM notification_queue WHERE dedup_key LIKE 'notificador-proyecto%' ORDER BY created_at DESC LIMIT 5` muestra el registro encolado
- `SELECT * FROM project_phase_log ORDER BY changed_at DESC LIMIT 5` muestra el log de la transición
- Un segundo UPDATE al mismo estado NO genera duplicado en `notification_queue`
- Un UPDATE de `planning` a `planning` (mismo estado) NO genera log ni notificación

---

### Slice 3: Templates Meta + smoke test E2E

**Qué incluye:**
- Someter los 2 templates nuevos a Meta Business Manager
- Smoke test completo E2E con número de prueba (+573183061286)
- Activación en producción (cambiar teléfonos de prueba a reales)

**Pasos de Meta Business Manager:**

1. Ir a Meta Business Manager → WhatsApp → Plantillas de mensajes → Crear plantilla
2. Para cada template nuevo:
   - Categoría: `Utility`
   - Idioma: `Español (es)`
   - Nombre: exactamente `proyecto_en_diseno_v1` / `materiales_en_proceso_v1` (minúsculas, guión bajo)
   - Cuerpo: texto propuesto en sección 6
   - Variables: `{{1}}` y `{{2}}` dentro del texto
3. Esperar aprobación (típicamente 24h–72h para `UTILITY` en español)

**Script de smoke test E2E:**

```sql
-- ============================================================
-- Smoke Test E2E — Notificador de Proyecto
-- Ejecutar con número de PRUEBA: +573183061286 (Robert)
-- ============================================================

-- 1. Identificar un proyecto de prueba o crear uno dummy
-- Asegurarse de que el client.whatsapp_phone = '+573183061286' para el test

-- 2. Test fase in_design
UPDATE projects
SET status = 'in_design',
    name   = 'Cocina Test E2E'
WHERE id = '<UUID_PROYECTO_PRUEBA>';

-- Verificar
SELECT nq.template_name, nq.status, nq.dedup_key, ppl.notified
FROM notification_queue nq
JOIN project_phase_log ppl ON ppl.queue_id = nq.id
WHERE nq.dedup_key LIKE 'notificador-proyecto:<UUID_PROYECTO_PRUEBA>%'
ORDER BY nq.created_at DESC;

-- 3. Esperar ~1 min para que process-whatsapp-notifications procese
-- Verificar en whatsapp_message_log:
SELECT * FROM whatsapp_message_log
WHERE queue_id IN (
  SELECT id FROM notification_queue
  WHERE dedup_key LIKE 'notificador-proyecto:<UUID_PROYECTO_PRUEBA>%'
);

-- 4. Repetir para cada fase (materials, in_fabrication, installation, completed)
-- Recordar agregar installation_scheduled_at antes de cambiar a 'installation':
UPDATE projects
SET installation_scheduled_at = NOW() + INTERVAL '7 days'
WHERE id = '<UUID_PROYECTO_PRUEBA>';

UPDATE projects SET status = 'installation' WHERE id = '<UUID_PROYECTO_PRUEBA>';
```

**Criterio de aceptación del Slice 3:**
- Los 2 templates nuevos aparecen como `APPROVED` en Meta Business Manager
- Las 5 transiciones de fase generan exactamente 1 mensaje WhatsApp cada una en el número de prueba
- El mensaje recibido tiene el texto correcto con los datos reales del proyecto/cliente
- La tabla `whatsapp_message_log` muestra `status = 'sent'` (o `delivered`) para cada mensaje
- Un segundo UPDATE al mismo estado no reenvía el mensaje (dedup funcionando)
- El campo `skip_reason` en `project_phase_log` está NULL para los 5 envíos exitosos

---

## 9. Criterios de aceptación globales

- [ ] Trigger `trg_project_phase_change` activo en la tabla `projects` de producción
- [ ] Los 5 templates requeridos existen y están aprobados en Meta (3 preexistentes + 2 nuevos)
- [ ] Las 5 transiciones de fase relevantes generan notificación al cliente en ≤ 90 segundos
- [ ] Las transiciones `planning` y `delivered` no generan notificación (estados no notificables)
- [ ] Un cambio de estado al mismo valor (UPDATE sin cambio real) no genera notificación
- [ ] Un cliente sin `whatsapp_phone` no bloquea el UPDATE del proyecto (falla silenciosa con log)
- [ ] Toda transición queda registrada en `project_phase_log` (notificada o no)
- [ ] La dedup_key previene duplicados si el mismo estado se setea dos veces en el mismo día
- [ ] El texto del WhatsApp en `in_fabrication` incluye el número de días estimados
- [ ] El texto del WhatsApp en `installation` incluye la fecha formateada en zona horaria Bogotá
- [ ] El campo `projects.name` se usa en los mensajes; el fallback `'Proyecto ' || LEFT(id,8)` funciona si es NULL
- [ ] No hay errores en `scheduled_job_log` relacionados a `process-whatsapp-notifications` post-deploy

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Templates `proyecto_en_diseno_v1` / `materiales_en_proceso_v1` rechazados por Meta | Media | Alto — bloquea esas 2 fases | Tener texto de reserva sin emojis; categoría `UTILITY` tiene mayor tasa de aprobación que `MARKETING` |
| `clients.whatsapp_phone` con formato incorrecto (sin `+57`, con espacios) | Media | Medio — mensaje no entregado, no falla el UPDATE | Agregar función de normalización de teléfono en la función trigger: `regexp_replace(phone, '[^0-9+]', '', 'g')` |
| `projects.installation_scheduled_at` NULL al cambiar a `installation` | Alta — es probable que operadores olviden | Medio — notificación omitida con `skip_reason` | UI debe validar que la fecha esté seteada antes de permitir el cambio de estado; el trigger logea el skip |
| Trigger lento bajo carga (muchos proyectos actualizados en bulk) | Baja | Bajo — el trigger es simple, sin LLM ni HTTP | El INSERT en `notification_queue` es local; no hay latencia externa en el trigger |
| Doble disparo si alguien hace UPDATE masivo de estado | Media | Medio | El dedup_key por fecha previene duplicados en el mismo día; el dedup_key usa el `project_id` específico |
| `process-whatsapp-notifications` falla y los mensajes quedan en `pending` | Baja | Medio | La EF tiene `attempt_count`; revisar `scheduled_job_log` para detectar stalls; el cron ya existe |
| El campo `projects.name` queda NULL para proyectos existentes | Alta — nueva columna | Bajo — hay fallback | Ejecutar `UPDATE projects SET name = 'Proyecto ' || LEFT(id::TEXT, 8) WHERE name IS NULL` como data migration |

---

## 11. Métricas de éxito

| Métrica | Cómo medirla | Target |
|---|---|---|
| Tasa de notificación | `SELECT notified::INT * 100.0 / COUNT(*) FROM project_phase_log` | ≥ 95% de transiciones notificables |
| Tiempo de envío | `wml.sent_at - ppl.changed_at` (join `project_phase_log` + `whatsapp_message_log`) | ≤ 90 segundos en percentil 95 |
| Tasa de entrega Meta | `status = 'delivered'` en `whatsapp_message_log` / total enviados | ≥ 90% |
| Duplicados prevenidos | `SELECT COUNT(*) FROM notification_queue WHERE dedup_key LIKE 'notificador-proyecto%' AND status = 'skipped'` | 0 envíos duplicados en producción |
| Skips por falta de teléfono | `SELECT COUNT(*) FROM project_phase_log WHERE skip_reason = 'no_phone'` | Debería tender a 0 tras normalización de datos |
| Llamadas entrantes de clientes preguntando estado | Tracking manual en CRM (campo `notes` en calls) | Reducción ≥ 40% vs. baseline pre-implementación (medir 30 días post-deploy) |

---

## 12. Notas de seguridad y DRY_RUN

### Protocolo de prueba

**Números de test autorizados:**
- Robert: `+573183061286`
- Heduin: `+584127862439`

**Nunca enviar a teléfonos de clientes reales durante desarrollo o QA.**

### Activación controlada (DRY_RUN flag)

El trigger PL/pgSQL no tiene un flag DRY_RUN nativo (los triggers son síncronos). La forma de activarlo de forma controlada es:

**Opción A — Control por `system_settings` (recomendada):**

```sql
-- Agregar flag en system_settings
INSERT INTO system_settings (key, value)
VALUES ('notificador_proyecto_dry_run', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
```

Luego en la función trigger, agregar al inicio del bloque de INSERT en `notification_queue`:

```sql
-- Leer DRY_RUN de system_settings
IF EXISTS (
  SELECT 1 FROM system_settings
  WHERE key = 'notificador_proyecto_dry_run'
    AND value = 'true'
) THEN
  -- Solo loguear, no encolar
  INSERT INTO project_phase_log
    (project_id, client_id, old_status, new_status, notified, skip_reason)
  VALUES
    (NEW.id, NEW.client_id, OLD.status, NEW.status, FALSE, 'dry_run');
  RETURN NEW;
END IF;
```

**Para activar en producción (tras smoke test exitoso):**

```sql
UPDATE system_settings
SET value = 'false'
WHERE key = 'notificador_proyecto_dry_run';
```

**Opción B — Trigger deshabilitado hasta validación (más simple):**

```sql
-- Durante testing
ALTER TABLE projects DISABLE TRIGGER trg_project_phase_change;

-- Al activar en producción
ALTER TABLE projects ENABLE TRIGGER trg_project_phase_change;
```

### Rollback completo si hay problema en producción

```sql
-- Deshabilitar el trigger sin perder el código
ALTER TABLE projects DISABLE TRIGGER trg_project_phase_change;

-- Los mensajes ya encolados se pueden cancelar:
UPDATE notification_queue
SET status = 'cancelled'
WHERE dedup_key LIKE 'notificador-proyecto:%'
  AND status = 'pending';
```

### Secuencia de activación recomendada

1. Aplicar Slice 1 (schema) — sin riesgo
2. Aplicar Slice 2 con `system_settings.notificador_proyecto_dry_run = 'true'`
3. Hacer smoke test con proyecto de prueba conectado al número de Robert
4. Verificar logs en `project_phase_log` y `notification_queue`
5. Someter templates nuevos a Meta y esperar aprobación
6. Con ambos templates aprobados: `UPDATE system_settings SET value = 'false' WHERE key = 'notificador_proyecto_dry_run'`
7. Monitorear `project_phase_log` durante 48h de producción real
8. Revisar métricas a los 30 días
