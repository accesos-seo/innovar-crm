# PRD: Asistente de Postventa
**Capa:** 04 — Retención
**Prioridad:** MEDIA-BAJA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Asistente de Postventa es un agente automatizado que se activa en el momento exacto en que un proyecto de Innovar Cocinas alcanza el estado `delivered` (entregado al cliente). Su función es ejecutar una secuencia de tres mensajes WhatsApp con separación de 24 horas entre sí: una encuesta NPS para medir satisfacción, información sobre garantía y contacto de soporte, y una solicitud de referidos personalizada. Los tres mensajes se despachan a través del pipeline de `notification_queue` ya operativo en producción.

Para el negocio, este agente cierra el ciclo completo del cliente y convierte cada entrega en una oportunidad triple: medir la calidad del trabajo (NPS), reducir tickets de soporte post-entrega (garantía proactiva) y crecer el pipeline comercial sin costo de adquisición (referidos). Actualmente estos tres pasos no existen en ninguna forma automatizada — se hacen ad hoc o no se hacen.

El problema específico que resuelve es la pérdida de valor post-entrega: el cliente queda satisfecho pero desconectado, y la empresa no captura NPS ni referidos de forma sistemática. Con este agente, cada entrega se convierte en un punto de contacto estructurado que alimenta tanto la reputación como el pipeline comercial.

---

## 2. Problema que resuelve

Hoy en Innovar Cocinas el flujo termina con `proyecto_completado_v1` (estado `completed`), que es el cierre contable del proyecto. Pero el momento emocional del cliente — cuando recibe su cocina nueva — ocurre en `delivered`, horas o días antes del cierre formal.

**Pain points concretos:**
- No se mide NPS de forma sistemática. El equipo no sabe si los clientes están satisfechos hasta que llega una queja.
- La información de garantía se comunica verbalmente en la instalación y el cliente la olvida. Resultado: llamadas evitables al equipo técnico.
- Los referidos son el canal de adquisición más barato (cero costo) y más confiable, pero se solicitan solo cuando alguien se acuerda.
- El gap entre `delivered` y `completed` (cierre de pagos, verificaciones finales) puede ser de días o semanas — durante ese tiempo el cliente está en su punto de mayor disposición a recomendar y el equipo no lo aprovecha.

---

## 3. Infraestructura existente que se reutiliza

| Componente | Cómo se reutiliza |
|---|---|
| `projects` table | Fuente del trigger; columnas `status`, `client_id`, `opportunity_id`, `id` |
| `clients` table | `whatsapp_phone` y `name` del destinatario |
| `notification_queue` table | Encolar los 3 mensajes con `scheduled_for` para delay de 24h/48h |
| `process-whatsapp-notifications` EF | Procesa la cola automáticamente cada minuto; sin cambios |
| `system_settings` table | Clave `warranty_terms` para texto de garantía; clave `nps_form_url` para link de formulario |
| `whatsapp_message_log` table | Trazabilidad de los 3 mensajes enviados |
| `scheduled_job_log` table | Registro de ejecuciones del trigger/función |
| Patrón `dedup_key` | Evita duplicados si el status `delivered` se actualiza más de una vez |
| `proyecto_completado_v1` | Referencia de estructura (NO se modifica — es para `completed`, no `delivered`) |

---

## 4. Gap Analysis — Lo que hay que construir

**Templates Meta WhatsApp (NUEVOS — no existen en TEMPLATE_REGISTRY):**
- `nps_solicitud_v1` — Mensaje 1: encuesta NPS
- `garantia_info_v1` — Mensaje 2: términos de garantía
- `referido_solicitud_v1` — Mensaje 3: solicitud de referido

**Columna nueva en `notification_queue`:**
- `scheduled_for TIMESTAMPTZ` — para encolar mensajes con delay futuro. La EF `process-whatsapp-notifications` debe respetar esta columna antes de procesar.

**Modificación en `process-whatsapp-notifications` (Edge Function):**
- Agregar filtro `AND (scheduled_for IS NULL OR scheduled_for <= NOW())` al query de procesamiento.

**Función SQL o Trigger:**
- Función PL/pgSQL `fn_trigger_postventa()` invocada por trigger `trg_project_delivered` en `projects` AFTER UPDATE cuando `status = 'delivered'`.
- La función encola los 3 mensajes con `scheduled_for = NOW()`, `NOW() + interval '24 hours'`, `NOW() + interval '48 hours'`.

**Claves nuevas en `system_settings`:**
- `warranty_terms` — texto de garantía (si no existe ya)
- `nps_form_url` — URL del formulario NPS (Google Forms o Typeform)
- `support_contact_phone` — número de soporte para mensaje de garantía

**Tabla nueva (opcional pero recomendada):**
- `project_postventa_log` — registro de qué proyectos ya pasaron por el flujo, con estado de cada mensaje (para evitar que un re-trigger re-encole).

---

## 5. Arquitectura Técnica

### Stack
- Trigger: PostgreSQL trigger en `projects`
- Lógica de encolamiento: PL/pgSQL function
- Transporte: `notification_queue` → `process-whatsapp-notifications` EF → Meta WhatsApp API
- Configuración: `system_settings`
- Delay: columna `scheduled_for` en `notification_queue`

### Data Flow

```
UPDATE projects SET status = 'delivered'
        │
        ▼
trg_project_delivered (AFTER UPDATE, FOR EACH ROW)
        │
        ▼
fn_trigger_postventa()
        │
        ├─► Lee clients WHERE id = NEW.client_id
        │         → name, whatsapp_phone
        │
        ├─► Lee system_settings
        │         → nps_form_url, warranty_terms, support_contact_phone
        │
        ├─► Verifica project_postventa_log
        │         → Si ya existe row para NEW.id → RETURN (idempotencia)
        │
        ├─► INSERT notification_queue (Mensaje 1)
        │         template: nps_solicitud_v1
        │         scheduled_for: NOW()
        │         dedup_key: 'postventa:{project_id}:nps:{fecha}'
        │
        ├─► INSERT notification_queue (Mensaje 2)
        │         template: garantia_info_v1
        │         scheduled_for: NOW() + 24h
        │         dedup_key: 'postventa:{project_id}:garantia:{fecha}'
        │
        ├─► INSERT notification_queue (Mensaje 3)
        │         template: referido_solicitud_v1
        │         scheduled_for: NOW() + 48h
        │         dedup_key: 'postventa:{project_id}:referido:{fecha}'
        │
        └─► INSERT project_postventa_log
                  → Marca el proyecto como "postventa iniciado"

        │
        ▼ (cada minuto, cron existente)
process-whatsapp-notifications EF
        │
        ├─► SELECT FROM notification_queue
        │   WHERE status = 'pending'
        │   AND (scheduled_for IS NULL OR scheduled_for <= NOW())  ← NUEVO filtro
        │
        └─► POST Meta Graph API v21.0 /messages
                  → Template + variables
                  → Actualiza notification_queue.status = 'sent'
                  → INSERT whatsapp_message_log
```

---

## 6. Templates WhatsApp requeridos

### Template 1: `nps_solicitud_v1` — NUEVO

**Variables:** `{{1}}` = nombre_cliente, `{{2}}` = nombre_proyecto, `{{3}}` = link_formulario_nps

**Texto propuesto para Meta:**
```
Hola {{1}}, tu proyecto "{{2}}" fue entregado. 🏠
¿Cómo calificarías tu experiencia con nosotros del 1 al 10?
Tómate 2 minutos: {{3}}
¡Tu opinión nos ayuda a mejorar!
```

**Categoría Meta:** UTILITY
**Idioma:** es (Español)
**Tipo de mensaje:** texto simple, sin botones (el link va en el cuerpo)
**Notas:** El link debe ser acortado (bit.ly o similar) para no sobrepasar el límite. Google Forms acepta respuestas anónimas — configurar para pre-llenar el nombre via `?usp=pp_url&entry.XXX={{nombre}}` en la URL.

---

### Template 2: `garantia_info_v1` — NUEVO

**Variables:** `{{1}}` = nombre_cliente, `{{2}}` = resumen_garantia, `{{3}}` = telefono_soporte

**Texto propuesto para Meta:**
```
Hola {{1}}, recuerda que tu cocina tiene garantía: {{2}}
Ante cualquier novedad, contáctanos: {{3}}
En Innovar Cocinas siempre estamos para ti. ✅
```

**Categoría Meta:** UTILITY
**Idioma:** es
**Tipo de mensaje:** texto simple
**Notas:** `{{2}}` debe ser una cadena corta (ej: "1 año en instalación, 5 años en estructura"). El texto completo de garantía vive en `system_settings.warranty_terms` pero la variable del template debe ser el resumen breve. Considerar crear `warranty_terms_short` en `system_settings` para el resumen.

---

### Template 3: `referido_solicitud_v1` — NUEVO

**Variables:** `{{1}}` = nombre_cliente, `{{2}}` = nombre_proyecto

**Texto propuesto para Meta:**
```
{{1}}, tu cocina "{{2}}" quedó hermosa. 🍳✨
¿Conoces a alguien que también quiera renovar su cocina?
Si nos refieres un contacto y concretamos, te obsequiamos un detalle especial.
Escríbenos aquí mismo con el nombre y teléfono de tu referido.
```

**Categoría Meta:** MARKETING (requiere opt-in previo del cliente)
**Idioma:** es
**Tipo de mensaje:** texto conversacional
**Notas:** Este es el único template MARKETING. Confirmar que los clientes aceptaron recibir mensajes de marketing en el momento del registro. Si no hay opt-in formal, bajar al nivel UTILITY reformulando el texto como agradecimiento + solicitud de opinión. El referido llega como respuesta libre al número de WA Business — el equipo lo procesa manualmente o via webhook de inbound messages.

---

### Templates existentes que se usan en flujos relacionados (NO modificar)

| Template | Estado | Uso en postventa |
|---|---|---|
| `proyecto_completado_v1` | Aprobado | Se dispara en `completed` (distinto de `delivered`) — no interferir |
| `fabricacion_iniciada_v1` | Aprobado | Etapa anterior — sin relación |
| `instalacion_programada_v1` | Aprobado | Etapa anterior — sin relación |

---

## 7. Schema de datos

### Columna nueva en `notification_queue`

```sql
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN notification_queue.scheduled_for IS
  'Si se especifica, el mensaje no se procesa hasta que NOW() >= scheduled_for. NULL = procesar de inmediato.';

CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled
  ON notification_queue (status, scheduled_for)
  WHERE status = 'pending';
```

### Tabla nueva: `project_postventa_log`

```sql
CREATE TABLE IF NOT EXISTS project_postventa_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id        UUID NOT NULL REFERENCES clients(id),
  nps_queue_id     UUID REFERENCES notification_queue(id),
  garantia_queue_id UUID REFERENCES notification_queue(id),
  referido_queue_id UUID REFERENCES notification_queue(id),
  status           TEXT NOT NULL DEFAULT 'initiated'
                   CHECK (status IN ('initiated', 'partial', 'completed', 'error')),
  error_detail     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_postventa_log_project
  ON project_postventa_log (project_id);

COMMENT ON TABLE project_postventa_log IS
  'Registro idempotente de proyectos que ya iniciaron el flujo de postventa. Un proyecto solo puede tener un row.';
```

### Claves nuevas en `system_settings`

```sql
INSERT INTO system_settings (key, value) VALUES
  ('nps_form_url',        'https://forms.gle/XXXXXXXXXXXXXXX'),
  ('warranty_terms_short','1 año en instalación, 5 años en estructura'),
  ('support_contact_phone','+573XXXXXXXXX')
ON CONFLICT (key) DO NOTHING;
```

### Función de trigger: `fn_trigger_postventa`

```sql
CREATE OR REPLACE FUNCTION fn_trigger_postventa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client         clients%ROWTYPE;
  v_nps_url        TEXT;
  v_warranty_short TEXT;
  v_support_phone  TEXT;
  v_project_name   TEXT;
  v_nps_id         UUID;
  v_garantia_id    UUID;
  v_referido_id    UUID;
  v_fecha_key      TEXT;
BEGIN
  -- Solo disparar cuando status cambia a 'delivered'
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Idempotencia: si ya existe log para este proyecto, no re-encolar
  IF EXISTS (SELECT 1 FROM project_postventa_log WHERE project_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Leer datos del cliente
  SELECT * INTO v_client FROM clients WHERE id = NEW.client_id;
  IF NOT FOUND OR v_client.whatsapp_phone IS NULL THEN
    INSERT INTO project_postventa_log (project_id, client_id, status, error_detail)
    VALUES (NEW.id, NEW.client_id, 'error', 'cliente sin whatsapp_phone');
    RETURN NEW;
  END IF;

  -- Leer configuración
  SELECT value INTO v_nps_url        FROM system_settings WHERE key = 'nps_form_url';
  SELECT value INTO v_warranty_short FROM system_settings WHERE key = 'warranty_terms_short';
  SELECT value INTO v_support_phone  FROM system_settings WHERE key = 'support_contact_phone';

  -- Nombre del proyecto: usar opportunity_id como fallback si no hay nombre
  v_project_name := COALESCE(
    (SELECT o.id::TEXT FROM opportunities o WHERE o.id = NEW.opportunity_id LIMIT 1),
    'tu proyecto'
  );

  v_fecha_key := TO_CHAR(NOW(), 'YYYY-MM-DD');

  -- Mensaje 1: NPS (inmediato)
  INSERT INTO notification_queue (
    recipient_phone, template_name, template_language,
    template_parameters, status, dedup_key, scheduled_for
  ) VALUES (
    v_client.whatsapp_phone,
    'nps_solicitud_v1',
    'es',
    jsonb_build_array(v_client.name, v_project_name, v_nps_url),
    'pending',
    'postventa:' || NEW.id::TEXT || ':nps:' || v_fecha_key,
    NOW()
  ) RETURNING id INTO v_nps_id;

  -- Mensaje 2: Garantía (24h)
  INSERT INTO notification_queue (
    recipient_phone, template_name, template_language,
    template_parameters, status, dedup_key, scheduled_for
  ) VALUES (
    v_client.whatsapp_phone,
    'garantia_info_v1',
    'es',
    jsonb_build_array(v_client.name, v_warranty_short, v_support_phone),
    'pending',
    'postventa:' || NEW.id::TEXT || ':garantia:' || v_fecha_key,
    NOW() + INTERVAL '24 hours'
  ) RETURNING id INTO v_garantia_id;

  -- Mensaje 3: Referido (48h)
  INSERT INTO notification_queue (
    recipient_phone, template_name, template_language,
    template_parameters, status, dedup_key, scheduled_for
  ) VALUES (
    v_client.whatsapp_phone,
    'referido_solicitud_v1',
    'es',
    jsonb_build_array(v_client.name, v_project_name),
    'pending',
    'postventa:' || NEW.id::TEXT || ':referido:' || v_fecha_key,
    NOW() + INTERVAL '48 hours'
  ) RETURNING id INTO v_referido_id;

  -- Registrar log
  INSERT INTO project_postventa_log (
    project_id, client_id,
    nps_queue_id, garantia_queue_id, referido_queue_id,
    status
  ) VALUES (
    NEW.id, NEW.client_id,
    v_nps_id, v_garantia_id, v_referido_id,
    'initiated'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO project_postventa_log (project_id, client_id, status, error_detail)
  VALUES (NEW.id, NEW.client_id, 'error', SQLERRM)
  ON CONFLICT (project_id) DO UPDATE SET status = 'error', error_detail = SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger en projects
DROP TRIGGER IF EXISTS trg_project_delivered ON projects;
CREATE TRIGGER trg_project_delivered
  AFTER UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_postventa();
```

---

## 8. Implementación paso a paso

### Slice 1: Base de datos y columna `scheduled_for`

**Qué incluye:**
- Columna `scheduled_for` en `notification_queue`
- Tabla `project_postventa_log`
- Claves iniciales en `system_settings`
- Índice de rendimiento

**SQL necesario:** Ver sección §7 completa (ALTER TABLE, CREATE TABLE, INSERT system_settings, CREATE INDEX).

**EF/n8n:** Ninguno en este slice. Solo SQL puro.

**Criterio de aceptación:**
- `SELECT column_name FROM information_schema.columns WHERE table_name='notification_queue' AND column_name='scheduled_for'` devuelve 1 row.
- `SELECT * FROM project_postventa_log LIMIT 1` no da error de tabla inexistente.
- `SELECT value FROM system_settings WHERE key IN ('nps_form_url','warranty_terms_short','support_contact_phone')` devuelve 3 rows.

---

### Slice 2: Modificación de `process-whatsapp-notifications`

**Qué incluye:**
- Agregar el filtro `scheduled_for` al query de procesamiento de la cola.
- La EF solo debe procesar rows donde `scheduled_for IS NULL OR scheduled_for <= NOW()`.

**Archivo:** `supabase/functions/process-whatsapp-notifications/index.ts`

**Cambio exacto a aplicar** (buscar el SELECT principal de la EF y agregar la condición):

```typescript
// ANTES (línea aproximada donde se consulta la queue):
.eq('status', 'pending')
.limit(50)

// DESPUÉS:
.eq('status', 'pending')
.or('scheduled_for.is.null,scheduled_for.lte.' + new Date().toISOString())
.limit(50)
```

**Deploy:** `supabase functions deploy process-whatsapp-notifications` con el token del `.env`.

**Criterio de aceptación:**
- Insertar un row en `notification_queue` con `scheduled_for = NOW() + interval '2 hours'` y status `pending`. Esperar 2 minutos (2 ciclos de cron). El row NO debe haber sido procesado (status sigue en `pending`). Confirmar que un row con `scheduled_for = NOW() - interval '1 minute'` sí se procesa en el próximo ciclo.

---

### Slice 3: Trigger y función PL/pgSQL

**Qué incluye:**
- Función `fn_trigger_postventa()` — ver SQL completo en §7.
- Trigger `trg_project_delivered` en `projects`.
- Prueba en DRY_RUN: insertar manualmente en `notification_queue` con template `dry_run_nps_v1` en lugar de los templates reales, controlado por una variable de entorno `POSTVENTA_DRY_RUN` leída desde `system_settings`.

**SQL necesario:** Ver función completa en §7.

**EF/n8n:** No requiere EF nueva. El trigger es 100% SQL. El procesamiento lo hace la EF existente.

**Criterio de aceptación (DRY_RUN):**
```sql
-- Test: cambiar un proyecto de cualquier status → 'delivered'
UPDATE projects SET status = 'delivered' WHERE id = '<project_id_de_prueba>';

-- Verificar log creado
SELECT * FROM project_postventa_log WHERE project_id = '<project_id_de_prueba>';
-- Debe tener status = 'initiated', tres queue IDs no nulos

-- Verificar mensajes encolados
SELECT id, template_name, scheduled_for, status, dedup_key
FROM notification_queue
WHERE dedup_key LIKE 'postventa:<project_id_de_prueba>%'
ORDER BY scheduled_for;
-- Debe mostrar 3 rows con scheduled_for: NOW(), NOW()+24h, NOW()+48h

-- Idempotencia: aplicar el UPDATE nuevamente
UPDATE projects SET status = 'planning' WHERE id = '<project_id_de_prueba>';
UPDATE projects SET status = 'delivered' WHERE id = '<project_id_de_prueba>';
-- NO deben crearse rows adicionales en project_postventa_log ni notification_queue
SELECT COUNT(*) FROM project_postventa_log WHERE project_id = '<project_id_de_prueba>';
-- Debe seguir siendo 1
```

---

### Slice 4: Templates Meta y activación en producción

**Qué incluye:**
- Someter los 3 templates a Meta Business Manager para aprobación.
- Actualizar `TEMPLATE_REGISTRY` en el código del proyecto con los 3 nuevos templates.
- Configurar URLs reales en `system_settings` (formulario NPS real, teléfono de soporte real).
- Cambiar `status` de los 3 rows en `notification_queue` de `dry_run` a `pending` (o eliminar los registros de prueba y hacer una entrega real de test con número de Robert).

**Archivo a actualizar:** Buscar el `TEMPLATE_REGISTRY` en el código y agregar:
```typescript
nps_solicitud_v1: {
  name: 'nps_solicitud_v1',
  language: 'es',
  variableCount: 3,
  variables: ['nombre_cliente', 'nombre_proyecto', 'link_formulario_nps']
},
garantia_info_v1: {
  name: 'garantia_info_v1',
  language: 'es',
  variableCount: 3,
  variables: ['nombre_cliente', 'resumen_garantia', 'telefono_soporte']
},
referido_solicitud_v1: {
  name: 'referido_solicitud_v1',
  language: 'es',
  variableCount: 2,
  variables: ['nombre_cliente', 'nombre_proyecto']
}
```

**Criterio de aceptación:**
- Los 3 templates aparecen como `APPROVED` en Meta Business Manager.
- Un cliente de prueba (número: Robert `+573183061286`) recibe los 3 mensajes en la secuencia correcta al marcar un proyecto como `delivered`.
- Los mensajes llegan con las separaciones de ~24h y ~48h confirmadas.

---

## 9. Criterios de aceptación globales

- [ ] `project_postventa_log` tiene UNIQUE constraint en `project_id` — no puede haber duplicados por proyecto.
- [ ] Cambiar `status = 'delivered'` en un proyecto real de prueba genera exactamente 3 rows en `notification_queue` con los `dedup_key` correctos.
- [ ] Cambiar `status = 'delivered'` dos veces en el mismo proyecto NO genera filas adicionales (idempotencia confirmada).
- [ ] Un proyecto cuyo cliente tiene `whatsapp_phone = NULL` genera un row en `project_postventa_log` con `status = 'error'` y no lanza excepción no capturada.
- [ ] El Mensaje 1 (NPS) se envía en los primeros 2 minutos post-entrega.
- [ ] El Mensaje 2 (garantía) no se procesa antes de las 23h 58m post-entrega.
- [ ] El Mensaje 3 (referido) no se procesa antes de las 47h 58m post-entrega.
- [ ] Los 3 templates están aprobados en Meta y en `TEMPLATE_REGISTRY`.
- [ ] `system_settings` tiene valores reales (no placeholder) para `nps_form_url`, `warranty_terms_short`, `support_contact_phone`.
- [ ] La EF `process-whatsapp-notifications` no procesa mensajes con `scheduled_for` en el futuro.
- [ ] El flujo de `proyecto_completado_v1` (status `completed`) no es afectado ni interferido.

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Templates rechazados por Meta | MEDIA | Categoría MARKETING (`referido_solicitud_v1`) tiene más fricción. Alternativa: reformular como UTILITY ("¿Conoces a alguien que lo necesite?"). Preparar versión UTILITY de respaldo antes de someter. |
| Cliente sin `whatsapp_phone` | ALTA (hay registros legacy) | Capturado en la función: genera log con status `error`, no lanza excepción. Agregar validación en UI al crear clientes. |
| Re-trigger involuntario (status bounces) | MEDIA | UNIQUE constraint en `project_postventa_log.project_id` + check `OLD.status = 'delivered'` en la función. |
| Delay inexacto por cron de 1 minuto | BAJA | El cron procesa cada minuto. Un delay de ±1 minuto sobre 24h es aceptable para este caso de uso. |
| `process-whatsapp-notifications` no lee `scheduled_for` (Slice 2 no deployado) | ALTA si se omite el orden | Los Slices 1→2→3→4 son estrictamente ordenados. No deployar el trigger (Slice 3) sin antes deployar la EF modificada (Slice 2). |
| Nombre del proyecto vacío | MEDIA | La función usa `opportunity_id` como fallback. Mejor solución: agregar columna `name TEXT` en `projects` (fuera del scope de este PRD, pero se recomienda). |
| Formulario NPS sin configurar al momento del primer deploy | ALTA | Configurar `nps_form_url` en `system_settings` ANTES de activar el trigger. El trigger leerá NULL si no existe y enviará un link vacío. |

**Dependencias externas:**
- Aprobación de 3 templates en Meta Business Manager (SLA: 1-48h normalmente).
- Creación del formulario Google Forms (5 minutos, sin dependencias técnicas).
- Definición del texto de garantía por parte del equipo de Innovar.
- Número de soporte técnico real para `support_contact_phone`.

---

## 11. Métricas de éxito

| Métrica | Cómo medirla | Target a 30 días |
|---|---|---|
| Tasa de activación | `SELECT COUNT(*) FROM project_postventa_log WHERE status = 'initiated'` / total proyectos delivered | 100% (sin excepciones silenciosas) |
| Tasa de entrega Mensaje 1 (NPS) | Rows en `whatsapp_message_log` con template `nps_solicitud_v1` y status `delivered` | >90% |
| Respuestas NPS recibidas | Responses en el formulario Google Forms | >30% de clientes que reciben el Mensaje 1 |
| Score NPS promedio | Calculado en el formulario | Baseline para el primer mes |
| Errores en `project_postventa_log` | `SELECT COUNT(*) WHERE status = 'error'` | 0 errores por clientes con phone válido |
| Referidos generados | Mensajes inbound respondiendo al Mensaje 3 | KPI cualitativo — registrar manualmente en primeros 60 días |
| Cobertura de templates | `SELECT COUNT(*) FROM notification_queue WHERE template_name IN ('nps_solicitud_v1','garantia_info_v1','referido_solicitud_v1') AND status = 'sent'` | 3 mensajes por proyecto delivered |

---

## 12. Notas de seguridad y DRY_RUN

### Protocolo de prueba

**Número de test:** Robert `+573183061286` — usar como `whatsapp_phone` en el cliente de prueba.

**Paso a paso para smoke test sin afectar clientes reales:**
1. Crear un cliente temporal en `clients` con `whatsapp_phone = '+573183061286'` y `name = 'Test Postventa'`.
2. Crear un proyecto temporal en `projects` vinculado a ese cliente con `status = 'installation'`.
3. Verificar que `system_settings` tiene las 3 claves con valores reales.
4. Ejecutar: `UPDATE projects SET status = 'delivered' WHERE id = '<test_project_id>'`
5. Verificar `project_postventa_log` — debe aparecer 1 row con status `initiated`.
6. Verificar `notification_queue` — 3 rows con templates y `scheduled_for` correctos.
7. Esperar el ciclo del cron (máx 1 minuto) — el Mensaje 1 debe llegar a Robert.
8. Verificar `whatsapp_message_log` — row con status `delivered`.
9. Para el Mensaje 2 y 3: ajustar manualmente `scheduled_for` a `NOW()` en los rows pendientes para acelerar la prueba sin esperar 24/48h reales.

### DRY_RUN flag

Agregar a `system_settings`:
```sql
INSERT INTO system_settings (key, value) VALUES ('postventa_dry_run', 'true')
ON CONFLICT (key) DO NOTHING;
```

Modificar `fn_trigger_postventa()` para que si `postventa_dry_run = 'true'`, encole los mensajes con `status = 'dry_run'` en lugar de `pending`. La EF `process-whatsapp-notifications` no procesa status `dry_run` — los mensajes quedan registrados pero no se envían.

Para activar en producción real:
```sql
UPDATE system_settings SET value = 'false' WHERE key = 'postventa_dry_run';
```

### Restricciones de seguridad

- La función `fn_trigger_postventa` usa `SECURITY DEFINER` — ejecuta con permisos del owner de la función, no del usuario que hace el UPDATE. Esto es necesario para escribir en `notification_queue` desde un trigger de usuario normal.
- Los `dedup_key` incluyen la fecha (`YYYY-MM-DD`) del trigger. Si por alguna razón se elimina el registro del `project_postventa_log` y el proyecto vuelve a `delivered` en el mismo día, el UNIQUE en `dedup_key` de `notification_queue` previene el duplicado. Si es al día siguiente, el `project_postventa_log` es la barrera principal.
- NUNCA testear con el número de un cliente real. Solo Robert (`+573183061286`) o Heduin (`+584127862439`) para pruebas.
- El Mensaje 3 (`referido_solicitud_v1`) es categoría MARKETING. No enviar a clientes que no hayan dado opt-in explícito. Si no hay sistema de opt-in, cambiar categoría a UTILITY ajustando el texto (ver nota en §6).
