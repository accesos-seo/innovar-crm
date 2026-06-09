# PRD: Vigía de Pagos
**Capa:** 02 — Conversión
**Prioridad:** ALTA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Vigía de Pagos es un agente autónomo que monitorea el ciclo de vida de una cotización aprobada y garantiza que el pago llegue. Una vez que un cliente aprueba una cotización, el agente entra en modo vigilancia: si en 24 horas no hay un pago verificado en el sistema, inicia una secuencia escalonada de recordatorios vía WhatsApp al cliente y alertas internas al comercial responsable.

El agente opera en cuatro etapas temporales (D+1, D+7, D+14, D+30) con tono progresivamente más urgente: arranca con un mensaje amable que incluye los datos bancarios, sube a un seguimiento con copia al comercial, escala a alerta urgente para intervención manual, y finalmente cierra la cotización como expirada si el silencio persiste. Cada etapa tiene su dedup_key para evitar duplicados, respeta el horario hábil (L-V 9am-5pm Bogotá) y se puede auditar en scheduled_job_log.

Para Innovar Cocinas este agente resuelve directamente el problema de cotizaciones que "se pierden en el aire" — el punto más costoso del embudo, donde el cliente ya dijo sí pero el dinero nunca llegó porque nadie hizo seguimiento sistemático. Convierte un proceso que hoy depende de la memoria del comercial en una máquina de seguimiento que nunca olvida.

---

## 2. Problema que resuelve

En el proceso comercial actual de Innovar Cocinas, cuando un cliente aprueba una cotización no existe ningún mecanismo automático que garantice el cobro. El comercial debe recordar manualmente hacer seguimiento al pago, lo que produce tres fallos recurrentes:

1. **Cotizaciones fantasma:** el cliente aprueba verbalmente o por mensaje pero nunca transfiere. La cotización queda en estado `approved` indefinidamente sin que nadie la persiga.
2. **Pérdida de oportunidades por demora:** sin recordatorio en las primeras 24 horas, el cliente pierde el momentum de compra y el proyecto se enfría.
3. **Sin trazabilidad:** no hay registro de cuántas cotizaciones aprobadas quedan sin pago, ni en qué etapa del seguimiento está cada una. El gerente no puede ver el cuello de botella.

El agente convierte este proceso manual y dependiente de personas en un ciclo automático y auditable.

---

## 3. Infraestructura existente que se reutiliza

**Tablas (sin modificaciones):**
- `quotations` — fuente de verdad de cotizaciones; campos usados: `id`, `opportunity_id`, `status`, `valid_until`, `total_amount`, `updated_at`
- `payments` — se consulta para verificar si existe al menos un pago con `status = 'verified'` vinculado al proyecto de esa cotización
- `projects` — join intermedio: `quotations → opportunities → projects` para llegar a `payments`
- `clients` — para obtener `whatsapp_phone` y `name` del cliente
- `opportunities` — join para llegar a `commercial_id` (quién es el comercial responsable)
- `leads` — para obtener `phone` del comercial si no está en otra tabla (join por `commercial_id` → `leads.id`)
- `notification_queue` — mecanismo estándar de envío WA; INSERT aquí y la EF lo procesa
- `whatsapp_message_log` — auditoría de mensajes enviados
- `scheduled_job_log` — registro de cada ejecución del cron
- `system_settings` — leer datos bancarios (banco, cuenta, titular) para no hardcodearlos

**Edge Functions (sin modificaciones):**
- `process-whatsapp-notifications` — ya procesa `notification_queue` cada minuto; no hay que tocarla

**Templates WhatsApp ya aprobados en Meta (reutilizar tal cual):**
- `payment_request_v1` (5 vars) — usar para D+1 al cliente: `{{1}}=nombre, {{2}}=banco, {{3}}=cuenta, {{4}}=titular, {{5}}=monto`
- `admin_quotation_expired_v1` (4 vars) — usar para cierre D+30 al comercial

**Patrones reutilizables:**
- Patrón dedup_key: `{agent_id}:{entity_id}:{etapa}:{fecha_iso}` → ej. `vigia-pagos:cot-uuid:d1:2026-06-10`
- Patrón cron: `SELECT cron.schedule(...)` con `net.http_post` a la EF
- Patrón horario hábil: verificar hora en Bogotá (UTC-5) antes de encolar mensaje

---

## 4. Gap Analysis — Lo que hay que construir

**Templates WhatsApp nuevos (requieren aprobación Meta):**
- `payment_followup_d7_v1` — recordatorio D+7 al cliente, tono más directo
- `payment_escalation_d14_v1` — alerta D+14 al comercial, tono urgente interno

**Edge Function nueva:**
- `vigia-pagos` — función principal que contiene toda la lógica de detección y encolamiento; llamada por cron

**Crons nuevos (2):**
- `vigia-pagos-check` — corre L-V 9am Bogotá (14:00 UTC), invoca `vigia-pagos`
- El mismo cron sirve para las cuatro etapas (la EF evalúa internamente qué etapa corresponde)

**Columnas nuevas en tabla `quotations`:**
- `vigia_stage` — `text`, valores: `null | 'd1_sent' | 'd7_sent' | 'd14_sent' | 'expired'`; indica en qué etapa está el seguimiento
- `vigia_last_action_at` — `timestamptz`; cuándo se ejecutó la última acción del vigía

**Vista SQL nueva:**
- `v_quotations_pending_payment` — vista materializable para simplificar la consulta del cron; une `quotations`, `opportunities`, `clients`, `projects`, `payments`

**Índice nuevo:**
- `idx_quotations_vigia` en `quotations(status, vigia_stage, updated_at)` para que el cron sea rápido

---

## 5. Arquitectura Técnica

### Stack
- **Disparador:** pg_cron (Supabase) — L-V 14:00 UTC (9am Bogotá)
- **Motor:** Edge Function `vigia-pagos` (Deno/TypeScript)
- **Mensajería:** INSERT en `notification_queue` → EF `process-whatsapp-notifications` → Meta Graph API v21.0
- **Persistencia de estado:** columna `vigia_stage` en `quotations`
- **Auditoría:** INSERT en `scheduled_job_log` al inicio y fin de cada ejecución

### Flujo de datos (secuencial)

```
[pg_cron 14:00 UTC L-V]
        │
        ▼
[EF: vigia-pagos]
        │
        ├─ INSERT scheduled_job_log (started)
        │
        ├─ QUERY: SELECT cotizaciones candidatas
        │   WHERE quotations.status = 'approved'
        │     AND NO existe payment con status='verified' en el proyecto asociado
        │     AND quotations.vigia_stage IN (null, 'd1_sent', 'd7_sent', 'd14_sent')
        │
        ├─ Para cada cotización candidata:
        │   ├─ Calcular días desde updated_at (cuando cambió a 'approved')
        │   │
        │   ├─ [días >= 1  AND vigia_stage IS NULL]
        │   │   → INSERT notification_queue (payment_request_v1 → cliente)
        │   │   → UPDATE quotations SET vigia_stage='d1_sent', vigia_last_action_at=now()
        │   │
        │   ├─ [días >= 7  AND vigia_stage = 'd1_sent']
        │   │   → INSERT notification_queue (payment_followup_d7_v1 → cliente)
        │   │   → INSERT notification_queue (payment_followup_d7_v1 → comercial, tono interno)
        │   │   → UPDATE quotations SET vigia_stage='d7_sent', vigia_last_action_at=now()
        │   │
        │   ├─ [días >= 14 AND vigia_stage = 'd7_sent']
        │   │   → INSERT notification_queue (payment_escalation_d14_v1 → comercial)
        │   │   → UPDATE quotations SET vigia_stage='d14_sent', vigia_last_action_at=now()
        │   │
        │   └─ [días >= 30 AND vigia_stage = 'd14_sent']
        │       → UPDATE quotations SET status='expired', vigia_stage='expired'
        │       → INSERT notification_queue (admin_quotation_expired_v1 → comercial)
        │
        └─ UPDATE scheduled_job_log (finished, rows_processed, status)

[1 minuto después]
[EF: process-whatsapp-notifications]
        │
        ▼
[Meta Graph API v21.0]
        │
        ▼
[WhatsApp cliente / comercial]
```

### Regla de horario hábil
La EF `vigia-pagos` al inicio verifica:
```typescript
const now = new Date();
const bogotaHour = Number(new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota', hour: 'numeric', hour12: false
}).format(now));
const dayOfWeek = now.getDay(); // 0=Dom, 6=Sab
if (dayOfWeek === 0 || dayOfWeek === 6 || bogotaHour < 9 || bogotaHour >= 17) {
  return new Response('Fuera de horario hábil', { status: 200 });
}
```
(El cron ya apunta a 9am Bogotá, pero esta guarda defensiva evita ejecuciones manuales fuera de hora.)

---

## 6. Templates WhatsApp requeridos

### Template 1 — YA EXISTE (reutilizar sin cambios)
**Nombre:** `payment_request_v1`
**Uso:** D+1, mensaje al cliente
**Variables:**
- `{{1}}` = nombre del cliente
- `{{2}}` = nombre del banco
- `{{3}}` = número de cuenta
- `{{4}}` = nombre del titular
- `{{5}}` = monto formateado (ej: "$4.500.000")

**Fuente de las variables de banco:** leer de `system_settings` con keys `bank_name`, `bank_account`, `bank_account_holder`. Si no existen, la EF debe abortar y loguear el error (no enviar con datos vacíos).

---

### Template 2 — NUEVO (requiere aprobación Meta)
**Nombre:** `payment_followup_d7_v1`
**Uso:** D+7, mensaje al cliente (versión más directa)
**Variables:**
- `{{1}}` = nombre del cliente
- `{{2}}` = monto formateado
- `{{3}}` = número de cotización (quotation.id truncado o correlativo)

**Texto propuesto para Meta (cuerpo, máx 160 chars):**
```
Hola {{1}}, te recordamos que tu cotización por {{2}} está pendiente de pago.
¿Necesitas ayuda con los datos bancarios o tienes alguna pregunta? Estamos aquí para apoyarte.
```
**Nota:** texto en dos frases cortas, tono cordial pero directo. Incluir nombre y monto como ancla de contexto. Sin links por ahora (simplifica aprobación Meta).

**Categoría Meta:** `UTILITY`
**Idioma:** `es`

---

### Template 3 — NUEVO (requiere aprobación Meta)
**Nombre:** `payment_escalation_d14_v1`
**Uso:** D+14, alerta interna al comercial
**Variables:**
- `{{1}}` = nombre del cliente
- `{{2}}` = monto formateado
- `{{3}}` = días transcurridos desde aprobación (ej: "14")
- `{{4}}` = número de cotización

**Texto propuesto para Meta (cuerpo, máx 160 chars):**
```
ALERTA: El cliente {{1}} tiene la cotización {{4}} aprobada por {{2}} hace {{3}} días sin pago registrado. Se requiere seguimiento manual urgente.
```
**Nota:** va al teléfono del comercial (o del admin si no tiene teléfono). Tono interno, informativo, sin saludos innecesarios.

**Categoría Meta:** `UTILITY`
**Idioma:** `es`

---

### Template 4 — YA EXISTE (reutilizar sin cambios)
**Nombre:** `admin_quotation_expired_v1`
**Uso:** D+30, cierre automático, alerta al comercial
**Variables (asumidas por el nombre, verificar con el registro existente):**
- `{{1}}` = nombre del cliente
- `{{2}}` = número de cotización
- `{{3}}` = monto formateado
- `{{4}}` = días transcurridos

---

## 7. Schema de datos

### Modificaciones a tabla existente: `quotations`

```sql
-- Migración: 0XX_vigia_pagos_columns.sql
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS vigia_stage TEXT
    CHECK (vigia_stage IN ('d1_sent', 'd7_sent', 'd14_sent', 'expired'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vigia_last_action_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN quotations.vigia_stage IS
  'Estado de seguimiento del Vigía de Pagos. null=no iniciado, d1_sent=recordatorio 24h enviado, d7_sent=seguimiento 7d enviado, d14_sent=escalamiento 14d enviado, expired=cerrado por inactividad D+30';

COMMENT ON COLUMN quotations.vigia_last_action_at IS
  'Timestamp de la última acción ejecutada por el Vigía de Pagos';
```

### Índice de rendimiento

```sql
CREATE INDEX IF NOT EXISTS idx_quotations_vigia
  ON quotations (status, vigia_stage, updated_at)
  WHERE status = 'approved';
```

### Vista de apoyo

```sql
CREATE OR REPLACE VIEW v_quotations_pending_payment AS
SELECT
  q.id                    AS quotation_id,
  q.opportunity_id,
  q.status                AS quotation_status,
  q.valid_until,
  q.total_amount,
  q.vigia_stage,
  q.vigia_last_action_at,
  q.updated_at            AS approved_at,
  EXTRACT(DAY FROM now() - q.updated_at)::INT AS days_since_approval,
  c.id                    AS client_id,
  c.name                  AS client_name,
  c.whatsapp_phone        AS client_phone,
  o.commercial_id,
  l.phone                 AS commercial_phone,
  p.id                    AS project_id,
  -- ¿Existe algún pago verificado?
  EXISTS (
    SELECT 1 FROM payments pm
    WHERE pm.project_id = p.id
      AND pm.status = 'verified'
  ) AS has_verified_payment
FROM quotations q
JOIN opportunities o      ON o.id = q.opportunity_id
JOIN clients c            ON c.id = o.client_id
LEFT JOIN leads l         ON l.id = o.commercial_id
LEFT JOIN projects p      ON p.opportunity_id = o.id
WHERE q.status = 'approved';

COMMENT ON VIEW v_quotations_pending_payment IS
  'Vista para el Vigía de Pagos: cotizaciones aprobadas con datos de cliente, comercial y estado de pago';
```

### Campos de system_settings requeridos (INSERT si no existen)

```sql
INSERT INTO system_settings (key, value) VALUES
  ('bank_name',           'Bancolombia'),
  ('bank_account',        '000-000000-00'),
  ('bank_account_holder', 'Innovar Cocinas Arte SAS')
ON CONFLICT (key) DO NOTHING;
```

### Tabla scheduled_job_log (verificar que existe, si no crearla)

```sql
CREATE TABLE IF NOT EXISTS scheduled_job_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  rows_processed INT DEFAULT 0,
  status        TEXT CHECK (status IN ('running', 'success', 'error')) DEFAULT 'running',
  error_message TEXT,
  metadata      JSONB
);
```

---

## 8. Implementación paso a paso

### Slice 1: Base de datos y configuración (sin EF, sin cron)
**Objetivo:** dejar el schema listo y los datos bancarios configurados. Deployable y reversible sin riesgo.

**Incluye:**
- Migración SQL con ALTER TABLE en `quotations` (columnas `vigia_stage`, `vigia_last_action_at`)
- Creación de índice `idx_quotations_vigia`
- Creación de vista `v_quotations_pending_payment`
- INSERT en `system_settings` de datos bancarios (con ON CONFLICT DO NOTHING)
- Verificación / creación de `scheduled_job_log`

**SQL completo (archivo: `supabase/migrations/0XX_vigia_pagos_schema.sql`):**

```sql
-- 1. Columnas en quotations
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS vigia_stage TEXT
    CHECK (vigia_stage IN ('d1_sent', 'd7_sent', 'd14_sent', 'expired'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vigia_last_action_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Índice
CREATE INDEX IF NOT EXISTS idx_quotations_vigia
  ON quotations (status, vigia_stage, updated_at)
  WHERE status = 'approved';

-- 3. scheduled_job_log (idempotente)
CREATE TABLE IF NOT EXISTS scheduled_job_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  rows_processed INT DEFAULT 0,
  status        TEXT CHECK (status IN ('running', 'success', 'error')) DEFAULT 'running',
  error_message TEXT,
  metadata      JSONB
);

-- 4. Vista
CREATE OR REPLACE VIEW v_quotations_pending_payment AS
SELECT
  q.id                    AS quotation_id,
  q.opportunity_id,
  q.status                AS quotation_status,
  q.valid_until,
  q.total_amount,
  q.vigia_stage,
  q.vigia_last_action_at,
  q.updated_at            AS approved_at,
  EXTRACT(DAY FROM now() - q.updated_at)::INT AS days_since_approval,
  c.id                    AS client_id,
  c.name                  AS client_name,
  c.whatsapp_phone        AS client_phone,
  o.commercial_id,
  l.phone                 AS commercial_phone,
  p.id                    AS project_id,
  EXISTS (
    SELECT 1 FROM payments pm
    WHERE pm.project_id = p.id AND pm.status = 'verified'
  ) AS has_verified_payment
FROM quotations q
JOIN opportunities o ON o.id = q.opportunity_id
JOIN clients c       ON c.id = o.client_id
LEFT JOIN leads l    ON l.id = o.commercial_id
LEFT JOIN projects p ON p.opportunity_id = o.id
WHERE q.status = 'approved';

-- 5. Datos bancarios (no sobreescribir si ya existen)
INSERT INTO system_settings (key, value) VALUES
  ('bank_name',           'Bancolombia'),
  ('bank_account',        '000-000000-00'),
  ('bank_account_holder', 'Innovar Cocinas Arte SAS')
ON CONFLICT (key) DO NOTHING;
```

**Criterio de aceptación del Slice 1:**
- `SELECT vigia_stage FROM quotations LIMIT 1;` no arroja error
- `SELECT * FROM v_quotations_pending_payment LIMIT 5;` retorna filas o está vacía (no error)
- `SELECT value FROM system_settings WHERE key = 'bank_name';` retorna el banco configurado

---

### Slice 2: Edge Function `vigia-pagos` con DRY_RUN
**Objetivo:** construir y deployar la EF completa en modo DRY_RUN (solo loguea, no escribe en notification_queue ni modifica quotations). Permite validar la lógica de detección sin efectos secundarios.

**Incluye:**
- Archivo `supabase/functions/vigia-pagos/index.ts`
- Variable de entorno `VIGIA_DRY_RUN=true` en Supabase Vault
- Variable de entorno `VIGIA_TEST_PHONE=+573183061286` (Robert) para el modo test
- Deploy de la EF

**Estructura del archivo `index.ts`:**

```typescript
// supabase/functions/vigia-pagos/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DRY_RUN = Deno.env.get('VIGIA_DRY_RUN') === 'true';
const TEST_PHONE = Deno.env.get('VIGIA_TEST_PHONE') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Formato moneda colombiana
function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(amount);
}

// Número de cotización legible (últimos 8 chars del UUID)
function shortId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(-8).toUpperCase();
}

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const jobId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Guardia de horario hábil (L-V, 9-17 Bogotá)
  const now = new Date();
  const bogotaHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', hour: 'numeric', hour12: false
    }).format(now)
  );
  const dow = now.getDay();
  if (!DRY_RUN && (dow === 0 || dow === 6 || bogotaHour < 9 || bogotaHour >= 17)) {
    return new Response(JSON.stringify({ status: 'skipped', reason: 'fuera_horario' }), { status: 200 });
  }

  // Registrar inicio en scheduled_job_log
  await supabase.from('scheduled_job_log').insert({
    id: jobId, job_name: 'vigia-pagos', started_at: startedAt, status: 'running'
  });

  // Leer datos bancarios
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['bank_name', 'bank_account', 'bank_account_holder']);
  const cfg: Record<string, string> = {};
  for (const s of settings ?? []) cfg[s.key] = s.value;

  if (!cfg.bank_name || !cfg.bank_account || !cfg.bank_account_holder) {
    await supabase.from('scheduled_job_log').update({
      finished_at: new Date().toISOString(), status: 'error',
      error_message: 'Datos bancarios incompletos en system_settings'
    }).eq('id', jobId);
    return new Response(JSON.stringify({ error: 'datos_bancarios_faltantes' }), { status: 500 });
  }

  // Obtener cotizaciones candidatas
  const { data: rows, error } = await supabase
    .from('v_quotations_pending_payment')
    .select('*')
    .eq('has_verified_payment', false)
    .in('vigia_stage', [null, 'd1_sent', 'd7_sent', 'd14_sent'])
    .or('vigia_stage.is.null,vigia_stage.in.(d1_sent,d7_sent,d14_sent)');

  if (error) {
    await supabase.from('scheduled_job_log').update({
      finished_at: new Date().toISOString(), status: 'error',
      error_message: error.message
    }).eq('id', jobId);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const row of rows ?? []) {
    const days = row.days_since_approval ?? 0;
    const stage = row.vigia_stage;
    const clientPhone = DRY_RUN ? TEST_PHONE : row.client_phone;
    const commercialPhone = DRY_RUN ? TEST_PHONE : (row.commercial_phone ?? TEST_PHONE);
    const monto = formatCOP(row.total_amount ?? 0);
    const cotNum = shortId(row.quotation_id);
    const daysStr = String(days);

    // --- D+1: primer recordatorio al cliente ---
    if (days >= 1 && stage === null) {
      const dedupKey = `vigia-pagos:${row.quotation_id}:d1:${today}`;
      if (!DRY_RUN) {
        await supabase.from('notification_queue').insert({
          recipient_phone: clientPhone,
          template_name: 'payment_request_v1',
          template_language: 'es',
          template_parameters: {
            '1': row.client_name,
            '2': cfg.bank_name,
            '3': cfg.bank_account,
            '4': cfg.bank_account_holder,
            '5': monto
          },
          dedup_key: dedupKey,
          status: 'pending'
        });
        await supabase.from('quotations')
          .update({ vigia_stage: 'd1_sent', vigia_last_action_at: new Date().toISOString() })
          .eq('id', row.quotation_id);
      }
      console.log(`[DRY_RUN=${DRY_RUN}] D+1 → ${row.client_name} (${clientPhone}) cotiz ${cotNum}`);
      processed++;
    }

    // --- D+7: seguimiento cliente + alerta comercial ---
    else if (days >= 7 && stage === 'd1_sent') {
      const dedupKeyClient = `vigia-pagos:${row.quotation_id}:d7-client:${today}`;
      const dedupKeyComm   = `vigia-pagos:${row.quotation_id}:d7-comm:${today}`;
      if (!DRY_RUN) {
        await supabase.from('notification_queue').insert([
          {
            recipient_phone: clientPhone,
            template_name: 'payment_followup_d7_v1',
            template_language: 'es',
            template_parameters: { '1': row.client_name, '2': monto, '3': cotNum },
            dedup_key: dedupKeyClient, status: 'pending'
          },
          {
            recipient_phone: commercialPhone,
            template_name: 'payment_followup_d7_v1',
            template_language: 'es',
            template_parameters: { '1': row.client_name, '2': monto, '3': cotNum },
            dedup_key: dedupKeyComm, status: 'pending'
          }
        ]);
        await supabase.from('quotations')
          .update({ vigia_stage: 'd7_sent', vigia_last_action_at: new Date().toISOString() })
          .eq('id', row.quotation_id);
      }
      console.log(`[DRY_RUN=${DRY_RUN}] D+7 → cliente ${row.client_name} + comercial ${commercialPhone}`);
      processed++;
    }

    // --- D+14: escalamiento urgente al comercial ---
    else if (days >= 14 && stage === 'd7_sent') {
      const dedupKey = `vigia-pagos:${row.quotation_id}:d14:${today}`;
      if (!DRY_RUN) {
        await supabase.from('notification_queue').insert({
          recipient_phone: commercialPhone,
          template_name: 'payment_escalation_d14_v1',
          template_language: 'es',
          template_parameters: {
            '1': row.client_name,
            '2': monto,
            '3': daysStr,
            '4': cotNum
          },
          dedup_key: dedupKey, status: 'pending'
        });
        await supabase.from('quotations')
          .update({ vigia_stage: 'd14_sent', vigia_last_action_at: new Date().toISOString() })
          .eq('id', row.quotation_id);
      }
      console.log(`[DRY_RUN=${DRY_RUN}] D+14 escalamiento → comercial ${commercialPhone}`);
      processed++;
    }

    // --- D+30: cierre como expirada ---
    else if (days >= 30 && stage === 'd14_sent') {
      const dedupKey = `vigia-pagos:${row.quotation_id}:expired:${today}`;
      if (!DRY_RUN) {
        await supabase.from('quotations')
          .update({
            status: 'expired',
            vigia_stage: 'expired',
            vigia_last_action_at: new Date().toISOString()
          })
          .eq('id', row.quotation_id);
        await supabase.from('notification_queue').insert({
          recipient_phone: commercialPhone,
          template_name: 'admin_quotation_expired_v1',
          template_language: 'es',
          template_parameters: {
            '1': row.client_name,
            '2': cotNum,
            '3': monto,
            '4': daysStr
          },
          dedup_key: dedupKey, status: 'pending'
        });
      }
      console.log(`[DRY_RUN=${DRY_RUN}] D+30 expirada → ${row.client_name} cotiz ${cotNum}`);
      processed++;
    }
  }

  await supabase.from('scheduled_job_log').update({
    finished_at: new Date().toISOString(),
    rows_processed: processed,
    status: 'success',
    metadata: { dry_run: DRY_RUN, total_candidates: (rows ?? []).length }
  }).eq('id', jobId);

  return new Response(JSON.stringify({ processed, dry_run: DRY_RUN }), { status: 200 });
});
```

**Criterio de aceptación del Slice 2:**
- Deploy sin errores: `supabase functions deploy vigia-pagos`
- Llamada manual con `curl -X POST https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/vigia-pagos -H "Authorization: Bearer <ANON_KEY>"` retorna `{ processed: N, dry_run: true }`
- Los logs de la EF muestran qué cotizaciones procesaría sin haber insertado nada en `notification_queue`
- `scheduled_job_log` tiene un registro con `status='success'` después de la llamada

---

### Slice 3: Templates Meta nuevos + activación en producción
**Objetivo:** someter los 2 templates nuevos a Meta y, una vez aprobados, activar el cron en producción.

**Incluye:**
- Solicitud formal de 2 templates a Meta Business Manager (manual, lo hace Robert o el agente vía API Meta si tiene acceso)
- Registro del cron en pg_cron
- Cambio de `VIGIA_DRY_RUN` de `true` a `false` en Supabase Vault
- Smoke test en producción con una cotización de prueba

**SQL para registrar el cron:**

```sql
-- Cron: L-V a las 9am Bogotá = 14:00 UTC
SELECT cron.schedule(
  'vigia-pagos-check',
  '0 14 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/vigia-pagos',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

**Verificación del cron:**
```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'vigia-pagos-check';
```

**Smoke test para producción:**
```sql
-- Crear una cotización aprobada con timestamp de hace 2 días para forzar D+1
-- (solo en entorno de test o con un lead/cliente de prueba)
UPDATE quotations
SET status = 'approved', updated_at = now() - INTERVAL '2 days', vigia_stage = NULL
WHERE id = '<uuid-de-cotizacion-de-prueba>';

-- Luego invocar manualmente la EF (con DRY_RUN=false)
-- y verificar que llegue WA a TEST_PHONE
```

**Cambiar a producción:**
```bash
# En Supabase Vault (o CLI):
supabase secrets set VIGIA_DRY_RUN=false --project-ref xdzbjptozeqcbnaqhtye
supabase secrets set VIGIA_TEST_PHONE=+573183061286 --project-ref xdzbjptozeqcbnaqhtye
```

**Criterio de aceptación del Slice 3:**
- Templates `payment_followup_d7_v1` y `payment_escalation_d14_v1` aparecen con status `APPROVED` en Meta Business Manager
- `VIGIA_DRY_RUN=false` en Vault
- Cron activo: `SELECT active FROM cron.job WHERE jobname='vigia-pagos-check'` retorna `true`
- WA de prueba D+1 llega al número de Robert con datos bancarios reales
- `scheduled_job_log` registra la ejecución productiva con `status='success'`

---

## 9. Criterios de aceptación globales

- [ ] Cotización en `status='approved'` sin pago → después de 24h recibe WA D+1 vía `payment_request_v1`
- [ ] Cotización en `vigia_stage='d1_sent'` a los 7 días → cliente recibe `payment_followup_d7_v1` Y comercial recibe copia
- [ ] Cotización en `vigia_stage='d7_sent'` a los 14 días → comercial recibe `payment_escalation_d14_v1`
- [ ] Cotización en `vigia_stage='d14_sent'` a los 30 días → `status` cambia a `expired` Y comercial recibe `admin_quotation_expired_v1`
- [ ] Si se registra un `payment` con `status='verified'`, el vigía NO envía más mensajes (la vista filtra `has_verified_payment=false`)
- [ ] Ninguna cotización recibe el mismo mensaje dos veces (dedup_key cumple su función)
- [ ] El cron no ejecuta en fin de semana ni fuera de 9-17 Bogotá
- [ ] `scheduled_job_log` tiene registro de cada ejecución del cron
- [ ] DRY_RUN=true no modifica ninguna tabla ni encola ningún mensaje
- [ ] Los datos bancarios en los mensajes provienen de `system_settings`, no están hardcodeados
- [ ] Si `system_settings` no tiene datos bancarios, la EF termina con `status='error'` en el log y no envía nada

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Templates D+7 / D+14 rechazados por Meta | Media | Alto — bloquea producción | Tener texto de respaldo más neutro; el template `payment_request_v1` (D+1) sigue funcionando mientras se aprueba el resto |
| Cotización sin `project_id` asociado (join roto) | Baja | Medio — vigía la ignora silenciosamente | La vista usa LEFT JOIN en `projects`; agregar log de cotizaciones sin proyecto en el metadata de `scheduled_job_log` |
| `commercial_phone` nulo (lead sin teléfono) | Media | Medio — D+7 y D+14 al comercial no se envían | La EF usa `commercialPhone = commercial_phone ?? TEST_PHONE` en producción → redirige al admin; en producción real cambiar fallback por el teléfono fijo del gerente |
| Doble ejecución manual del cron | Baja | Bajo | dedup_key incluye fecha ISO del día; dos ejecuciones el mismo día producen conflicto de unicidad en `notification_queue.dedup_key` (si hay constraint UNIQUE) |
| `system_settings` con datos bancarios desactualizados | Baja | Alto — cliente recibe cuenta incorrecta | Agregar validación en el frontend admin para editar estos settings; el PRD de Config lo debe contemplar |
| Templates D+7/D+14 aprobados bajo categoría MARKETING (costo mayor) | Media | Bajo-medio | Presentarlos explícitamente como UTILITY en la solicitud; el texto propuesto no tiene tono promocional |

**Dependencia bloqueante para Slice 3:**
- Aprobación de Meta para `payment_followup_d7_v1` y `payment_escalation_d14_v1` (tiempo estimado 1-3 días hábiles)

---

## 11. Métricas de éxito

| Métrica | Definición | Objetivo inicial (30 días) |
|---------|-----------|---------------------------|
| **Tasa de cobro D+1** | % de cotizaciones aprobadas que registran pago dentro de las 48h siguientes al primer recordatorio | > 40% |
| **Reducción de cotizaciones expiradas** | Cotizaciones que llegan a `status='expired'` vs. total aprobadas | < 10% |
| **Tiempo promedio de cobro** | Días desde `approved` hasta `payment.status='verified'` | < 10 días |
| **Tasa de entrega WA** | Mensajes en `whatsapp_message_log` con `status='delivered'` / total encolados por vigía | > 95% |
| **Ejecuciones sin error** | `scheduled_job_log` registros con `status='success'` / total | > 99% |
| **Cobertura de seguimiento** | % de cotizaciones aprobadas con al menos un `vigia_stage` asignado en las primeras 48h | 100% |

---

## 12. Notas de seguridad y DRY_RUN

### Flag DRY_RUN
- **Variable de entorno:** `VIGIA_DRY_RUN` en Supabase Vault
- **Valor por defecto al deployar:** `true` (nunca arrancar en producción directo)
- **En modo DRY_RUN:** la EF ejecuta toda la lógica de consulta y evaluación, escribe en `scheduled_job_log` con `metadata.dry_run=true`, imprime en logs qué mensajes enviaría y a qué cotizaciones afectaría, pero NO inserta en `notification_queue` y NO modifica `quotations`
- **Cambiar a producción:** `supabase secrets set VIGIA_DRY_RUN=false` — solo Robert puede autorizar este cambio

### Números de prueba
- **Robert (admin):** `+573183061286`
- **Heduin (QA):** `+584127862439`
- En modo DRY_RUN=false pero previo a producción real, configurar `VIGIA_TEST_PHONE=+573183061286` para que todos los mensajes (cliente y comercial) vayan a Robert

### Activación en producción (checklist)
1. Slice 1 aplicado y verificado en Supabase
2. Slice 2 deployado y probado en DRY_RUN=true (al menos 1 ejecución exitosa con candidatos reales)
3. Templates D+7 y D+14 APROBADOS en Meta (verificar en Business Manager)
4. Robert revisa el log de DRY_RUN y confirma que las cotizaciones detectadas son correctas
5. `VIGIA_TEST_PHONE` cambiado a número de prueba, primera ejecución en producción verificada manualmente
6. Confirmado que llega WA con datos bancarios correctos
7. `VIGIA_TEST_PHONE` eliminado del Vault (o dejarlo como fallback para comerciales sin teléfono)
8. Cron activado: `SELECT cron.schedule(...)` del Slice 3

### Constraint de dedup (recomendado agregar en Slice 1)
```sql
ALTER TABLE notification_queue
  ADD CONSTRAINT uq_notification_dedup_key UNIQUE (dedup_key);
```
Esto hace que el doble-INSERT por la misma etapa/día falle silenciosamente (ON CONFLICT DO NOTHING en la EF) en lugar de duplicar mensajes.
