# PRD: Orquestador de Agenda
**Capa:** 02 — Conversión
**Prioridad:** MEDIA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Orquestador de Agenda es un agente que automatiza el ciclo completo de agendamiento de visitas técnicas para Innovar Cocinas: desde la consulta de disponibilidad hasta el recordatorio de confirmación 24 horas antes de la cita. Se activa cuando un cliente expresa interés en una visita (vía chat de NOVA o por acción manual del comercial) y produce: un slot bloqueado en el calendario, una confirmación por WhatsApp al cliente y un recordatorio automático al día siguiente.

El agente elimina la fricción operativa más frecuente del proceso comercial: el coordinador debe revisar manualmente el calendario, proponer horarios por WhatsApp, esperar respuesta y volver a bloquear el slot. Ese flujo manual toma entre 30 minutos y varios días, con alta tasa de olvidos en los recordatorios. El agente colapsa ese ciclo a menos de 5 minutos con cero intervención humana en el caso estándar.

La implementación se diseña en tres slices progresivos: V1 automatiza solo el recordatorio 24h (impacto inmediato, riesgo cero), V2 agrega la confirmación automática cuando el comercial asigna el slot desde el CRM, y V3 cierra el loop con propuesta interactiva vía WhatsApp bidireccional.

---

## 2. Problema que resuelve

**Pain point principal:** El proceso de agendamiento de visitas técnicas en Innovar Cocinas es manual en su totalidad. El comercial debe: (1) abrir el calendario, (2) identificar slots libres los martes y jueves, (3) enviar una propuesta al cliente por WhatsApp, (4) esperar confirmación, (5) bloquear el slot en el sistema y (6) configurar un recordatorio manual en su celular. Cada paso es propenso a error y olvido.

**Consecuencias observadas:**
- Visitas sin recordatorio previo generan no-shows (cliente olvida, comercial pierde el desplazamiento)
- Slots bloqueados mentalmente pero no en el sistema producen doble booking
- La propuesta de horario tarda en promedio 2-4 horas porque depende de que el comercial esté disponible
- No hay registro de que el cliente confirmó — si hay disputa, no hay trazabilidad

**Resultado esperado con el agente:** el cliente confirma interés → en menos de 5 minutos recibe propuesta con fecha y hora → al confirmar, el slot queda bloqueado → 24h antes recibe recordatorio automático. El comercial solo interviene si el cliente rechaza el horario propuesto.

---

## 3. Infraestructura existente que se reutiliza

**Tablas Supabase (sin modificación):**
- `availability_slots` — fuente de verdad de slots disponibles; columnas `id`, `date`, `time_slot`, `is_available`, `visit_id`
- `visits` — registro de visitas; columnas `id`, `opportunity_id`, `client_id`, `visitor_id`, `scheduled_at`, `status`, `address`
- `opportunities` — estado del proceso comercial; columna `status` con valor `scheduled` indica visita confirmada
- `clients` — datos de contacto; columna `whatsapp_phone`
- `notification_queue` — cola de envíos WhatsApp; patrón INSERT → process-whatsapp-notifications la recoge
- `scheduled_job_log` — log de ejecuciones de cron jobs
- `system_settings` — configuración global (horarios permitidos, capacidad del taller)

**Edge Functions existentes:**
- `process-whatsapp-notifications` — procesa `notification_queue` cada minuto, llama Meta API. No requiere cambios.
- `book-public-visit` — contiene lógica de bloqueo de slots; se analiza para reutilizar su RPC interna o replicar el patrón.

**Templates WhatsApp ya aprobados en Meta (reutilizables directamente):**
- `appointment_booked` — 4 vars: `{{1}}`=nombre, `{{2}}`=título, `{{3}}`=fecha, `{{4}}`=hora — se usa para confirmación de visita agendada
- `visit_reminder_24h_internal_v1` — 5 vars — se usa para recordatorio 24h (Slice 1)
- `visit_reminder_2h_client_v1` — 2 vars: `{{1}}`=nombre, `{{2}}`=hora — se usa para recordatorio 2h (bonus Slice 3)
- `visit_assigned_admin_v1` — 4 vars: `{{1}}`=cliente, `{{2}}`=fecha, `{{3}}`=hora, `{{4}}`=dirección — notificación interna al equipo

**Patrones reutilizables:**
- Patrón `dedup_key` en `notification_queue` para evitar recordatorios duplicados
- Patrón `cron.schedule` con `net.http_post` para jobs programados
- Patrón de log en `scheduled_job_log` para auditoría

---

## 4. Gap Analysis — Lo que hay que construir

**Templates WhatsApp nuevos (requieren aprobación Meta):**
- `visit_proposal_client_v1` — propuesta de horario al cliente con dos opciones (Slice 2)
- `visit_confirmation_request_v1` — solicitud de confirmación con respuesta esperada Sí/No (Slice 3)

**Edge Functions nuevas:**
- `schedule-visit-reminder` — cron que consulta visitas con `scheduled_at` en las próximas 24-26h y encola recordatorios. Es el core del Slice 1.
- `confirm-visit-booking` — llamada desde el frontend CRM cuando el comercial asigna slot manualmente; bloquea el slot, crea la visita y encola `appointment_booked`. Core del Slice 2.
- `whatsapp-visit-webhook` — recibe respuesta del cliente (Sí/No) vía webhook de Meta; procesa la confirmación o propone alternativa. Core del Slice 3.

**Tabla nueva:**
- `visit_confirmations` — registro de propuestas enviadas al cliente, respuesta recibida y estado de confirmación (Slice 3 solamente). Permite trazabilidad de la interacción bidireccional.

**Columnas nuevas en tablas existentes:**
- `visits.reminder_24h_sent_at` — timestamp para evitar recordatorios duplicados (tipo `timestamptz`, nullable)
- `visits.confirmation_sent_at` — timestamp para trazabilidad de confirmación enviada (Slice 2)
- `opportunities.scheduling_status` — enum: `pending_slot` | `slot_proposed` | `confirmed` | `rescheduled` (Slice 2+3)

**Cron jobs nuevos:**
- `visit-reminder-24h` — se ejecuta todos los días a las 9:00 AM hora Colombia (UTC-5 = 14:00 UTC), lunes a domingo

**Workflow n8n nuevo (opcional, Slice 3):**
- Webhook que recibe respuesta WA de Meta → decide si confirmar o proponer alternativa → llama EF correspondiente

---

## 5. Arquitectura Técnica

### Stack
- Supabase Edge Functions (Deno/TypeScript) — lógica de negocio
- pg_cron + net.http_post — scheduling del recordatorio 24h
- Meta WhatsApp Graph API v21.0 — mensajería al cliente
- notification_queue — desacoplamiento de envíos (patrón existente)
- n8n (Slice 3) — orquestación del webhook bidireccional

### Flujo V1 — Solo recordatorio 24h

```
[pg_cron 9:00 AM CO]
        |
        v
[EF: schedule-visit-reminder]
        |
        v
[SELECT visits WHERE scheduled_at BETWEEN NOW()+23h AND NOW()+25h
                  AND status = 'scheduled'
                  AND reminder_24h_sent_at IS NULL]
        |
    [por cada visita]
        |
        v
[INSERT notification_queue]
  template: visit_reminder_24h_internal_v1
  recipient_phone: clients.whatsapp_phone
  dedup_key: 'reminder-24h:{visit_id}:{date}'
        |
        v
[UPDATE visits SET reminder_24h_sent_at = NOW()]
        |
        v
[process-whatsapp-notifications recoge en < 1 min]
        |
        v
[Cliente recibe WA recordatorio]
```

### Flujo V2 — Confirmación desde CRM (comercial asigna slot)

```
[Comercial selecciona slot en CRM UI]
        |
        v
[POST /functions/v1/confirm-visit-booking]
  body: { opportunity_id, slot_id, address }
        |
        v
[BEGIN TRANSACTION]
  1. SELECT availability_slots WHERE id = slot_id FOR UPDATE
  2. Verificar is_available = true → si false: return error 409
  3. INSERT visits (opportunity_id, client_id, visitor_id, scheduled_at, status='scheduled', address)
  4. UPDATE availability_slots SET is_available=false, visit_id=visits.id
  5. UPDATE opportunities SET status='scheduled', scheduling_status='confirmed'
[COMMIT]
        |
        v
[INSERT notification_queue × 2]
  A) appointment_booked → cliente (whatsapp_phone)
     dedup_key: 'appt-booked:{opportunity_id}:{slot_id}'
  B) visit_assigned_admin_v1 → equipo interno (número admin)
     dedup_key: 'visit-assigned-admin:{visit_id}'
        |
        v
[process-whatsapp-notifications envía en < 1 min]
        |
        v
[Cliente recibe confirmación WA]
[Equipo recibe notificación interna]
```

### Flujo V3 — Propuesta interactiva WA (bidireccional)

```
[NOVA detecta interés en visita O comercial click "Proponer horario"]
        |
        v
[EF: propose-visit-slot]
  - Consulta availability_slots WHERE is_available=true
    AND date >= CURRENT_DATE + 1
    ORDER BY date, time_slot LIMIT 2
  - INSERT visit_confirmations (opportunity_id, proposed_slot_1, proposed_slot_2, status='proposed')
  - INSERT notification_queue: visit_proposal_client_v1
    dedup_key: 'visit-proposal:{opportunity_id}:{date::date}'
        |
        v
[Cliente recibe WA con 2 opciones de horario]
        |
  [Cliente responde "1" o "2" o texto libre]
        |
        v
[Meta Webhook POST → n8n Workflow]
        |
        v
[n8n evalúa respuesta]
  Si "1" o "primer" → confirmar slot_1
  Si "2" o "segundo" → confirmar slot_2
  Si otro texto → OpenRouter clasifica intención
        |
        v
[n8n llama confirm-visit-booking con slot elegido]
        |
        v
[Flujo V2 desde aquí en adelante]
```

---

## 6. Templates WhatsApp requeridos

### Templates YA APROBADOS — usar directamente

**`appointment_booked`** (existe)
- Variables: `{{1}}`=nombre_cliente, `{{2}}`=título_visita, `{{3}}`=fecha (ej: "martes 17 de junio"), `{{4}}`=hora (ej: "10:00 AM")
- Uso: confirmación inmediata cuando comercial asigna slot (Slice 2)
- Dedup key: `appt-booked:{opportunity_id}:{slot_id}`

**`visit_reminder_24h_internal_v1`** (existe, 5 vars)
- Variables a confirmar en código actual del template: consultar Meta Business Manager para obtener el texto exacto y mapeo de variables.
- Uso: recordatorio automático la víspera (Slice 1)
- Dedup key: `reminder-24h:{visit_id}:{scheduled_at::date}`

**`visit_assigned_admin_v1`** (existe)
- Variables: `{{1}}`=nombre_cliente, `{{2}}`=fecha, `{{3}}`=hora, `{{4}}`=dirección
- Uso: notificación interna al equipo cuando se confirma visita
- Dedup key: `visit-assigned-admin:{visit_id}`

**`visit_reminder_2h_client_v1`** (existe)
- Variables: `{{1}}`=nombre_cliente, `{{2}}`=hora
- Uso: recordatorio 2 horas antes (Slice 3, bonus)
- Dedup key: `reminder-2h:{visit_id}:{scheduled_at::date}`

---

### Templates NUEVOS — requieren aprobación Meta

**`visit_proposal_client_v1`** (nuevo — Slice 2/3)
```
Nombre en Meta: visit_proposal_client_v1
Idioma: es (Spanish)
Categoría: UTILITY
Cuerpo del mensaje (máx 160 chars):
"Hola {{1}}, tenemos estos horarios disponibles para tu visita:

1️⃣ {{2}} a las {{3}}
2️⃣ {{4}} a las {{5}}

Responde 1 o 2 para confirmar 😊"

Variables:
  {{1}} = nombre_cliente
  {{2}} = fecha_opcion_1 (ej: "martes 17 de junio")
  {{3}} = hora_opcion_1 (ej: "10:00 AM")
  {{4}} = fecha_opcion_2 (ej: "jueves 19 de junio")
  {{5}} = hora_opcion_2 (ej: "2:00 PM")

Nota: Este template inicia una conversación fuera de ventana 24h → requiere categoría UTILITY.
```

**`visit_reschedule_client_v1`** (nuevo — Slice 3, contingencia)
```
Nombre en Meta: visit_reschedule_client_v1
Idioma: es (Spanish)
Categoría: UTILITY
Cuerpo del mensaje:
"Hola {{1}}, lamentamos que no puedas en esos horarios. Un asesor de Innovar Cocinas te contactará pronto para reagendar tu visita. 🏠"

Variables:
  {{1}} = nombre_cliente

Uso: cuando cliente rechaza ambas opciones propuestas.
```

---

## 7. Schema de datos

### Columnas nuevas en tablas existentes

```sql
-- Slice 1: tracking de recordatorios enviados
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at  TIMESTAMPTZ DEFAULT NULL;

-- Índice para el cron query (evita full scan diario)
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_reminder
  ON visits (scheduled_at, status, reminder_24h_sent_at)
  WHERE status = 'scheduled' AND reminder_24h_sent_at IS NULL;

-- Slice 2: estado de agendamiento en opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT
    CHECK (scheduling_status IN ('pending_slot','slot_proposed','confirmed','rescheduled'))
    DEFAULT 'pending_slot';
```

### Tabla nueva — `visit_confirmations` (Slice 3 únicamente)

```sql
CREATE TABLE IF NOT EXISTS visit_confirmations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  proposed_slot_1   UUID REFERENCES availability_slots(id),
  proposed_slot_2   UUID REFERENCES availability_slots(id),
  chosen_slot       UUID REFERENCES availability_slots(id) DEFAULT NULL,
  status            TEXT NOT NULL
    CHECK (status IN ('proposed','confirmed','rejected','expired','rescheduled'))
    DEFAULT 'proposed',
  client_response   TEXT DEFAULT NULL,         -- texto crudo del mensaje WA recibido
  proposed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ DEFAULT NULL,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_confirmations_opportunity
  ON visit_confirmations (opportunity_id, status);

CREATE INDEX IF NOT EXISTS idx_visit_confirmations_expires
  ON visit_confirmations (expires_at)
  WHERE status = 'proposed';
```

### Log de cron (tabla existente — insertar en cada ejecución)

```sql
-- Usar scheduled_job_log existente con job_name = 'visit-reminder-24h'
-- Columnas: job_name, started_at, finished_at, rows_processed, status
```

---

## 8. Implementación paso a paso

---

### Slice 1: Recordatorio automático 24h antes de la visita

**Objetivo:** cero cambios en el flujo de trabajo del comercial. Solo activar el recordatorio automático de las visitas ya agendadas. Es el slice de mayor impacto y menor riesgo.

**Qué incluye:**
- Migración SQL con columna `reminder_24h_sent_at` en `visits`
- Edge Function `schedule-visit-reminder`
- Cron job `visit-reminder-24h` (diario 9:00 AM Colombia)
- DRY_RUN flag de seguridad

**SQL (migración idempotente):**
```sql
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at  TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_visits_scheduled_reminder
  ON visits (scheduled_at, status, reminder_24h_sent_at)
  WHERE status = 'scheduled' AND reminder_24h_sent_at IS NULL;

-- Cron job (ejecutar una vez como superuser o vía Supabase Dashboard → SQL Editor)
SELECT cron.schedule(
  'visit-reminder-24h',
  '0 14 * * *',  -- 14:00 UTC = 9:00 AM UTC-5 (Colombia), todos los días
  $$
  SELECT net.http_post(
    url     := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/schedule-visit-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{"dry_run": false}'::jsonb
  )
  $$
);
```

**Edge Function: `schedule-visit-reminder`**

Ruta: `D:\Agents-automations\04-Innovar\supabase\functions\schedule-visit-reminder\index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DRY_RUN_DEFAULT = Deno.env.get('VISIT_REMINDER_DRY_RUN') === 'true'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const dryRun: boolean = body.dry_run ?? DRY_RUN_DEFAULT

  const jobStart = new Date().toISOString()
  let rowsProcessed = 0
  const errors: string[] = []

  try {
    // Ventana: visitas entre 23h y 25h desde ahora
    const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
    const windowEnd   = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()

    const { data: visits, error: fetchErr } = await supabase
      .from('visits')
      .select(`
        id,
        scheduled_at,
        address,
        client:clients!visits_client_id_fkey (
          id, name, whatsapp_phone
        ),
        opportunity:opportunities!visits_opportunity_id_fkey (
          id
        )
      `)
      .eq('status', 'scheduled')
      .is('reminder_24h_sent_at', null)
      .gte('scheduled_at', windowStart)
      .lte('scheduled_at', windowEnd)

    if (fetchErr) throw fetchErr

    for (const visit of (visits ?? [])) {
      const client = Array.isArray(visit.client) ? visit.client[0] : visit.client
      if (!client?.whatsapp_phone) {
        errors.push(`visit ${visit.id}: sin whatsapp_phone`)
        continue
      }

      const scheduledAt  = new Date(visit.scheduled_at)
      const fechaTexto   = scheduledAt.toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'America/Bogota'
      })
      const horaTexto = scheduledAt.toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: true,
        timeZone: 'America/Bogota'
      })
      const dedupKey = `reminder-24h:${visit.id}:${scheduledAt.toISOString().slice(0,10)}`

      // Verificar que no existe ya en notification_queue (doble seguridad)
      const { count } = await supabase
        .from('notification_queue')
        .select('id', { count: 'exact', head: true })
        .eq('dedup_key', dedupKey)

      if ((count ?? 0) > 0) continue

      if (!dryRun) {
        // Encolar recordatorio al cliente
        // NOTA: visit_reminder_24h_internal_v1 tiene 5 vars — ajustar según
        // texto real del template en Meta BM. Aquí se usan las 5 posiciones
        // más probables: nombre, fecha, hora, dirección, nombre_empresa
        const { error: qErr } = await supabase
          .from('notification_queue')
          .insert({
            recipient_phone:     client.whatsapp_phone,
            template_name:       'visit_reminder_24h_internal_v1',
            template_language:   'es',
            template_parameters: [
              client.name,
              fechaTexto,
              horaTexto,
              visit.address ?? 'dirección por confirmar',
              'Innovar Cocinas'
            ],
            dedup_key: dedupKey,
            status:    'pending'
          })

        if (qErr) {
          errors.push(`visit ${visit.id}: ${qErr.message}`)
          continue
        }

        // Marcar como enviado para evitar duplicados en próxima ejecución
        await supabase
          .from('visits')
          .update({ reminder_24h_sent_at: new Date().toISOString() })
          .eq('id', visit.id)
      }

      rowsProcessed++
    }

    // Log de ejecución
    await supabase.from('scheduled_job_log').insert({
      job_name:       'visit-reminder-24h',
      started_at:     jobStart,
      finished_at:    new Date().toISOString(),
      rows_processed: rowsProcessed,
      status:         errors.length === 0 ? 'ok' : 'partial_error'
    })

    return new Response(
      JSON.stringify({ ok: true, dry_run: dryRun, rows_processed: rowsProcessed, errors }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    await supabase.from('scheduled_job_log').insert({
      job_name:       'visit-reminder-24h',
      started_at:     jobStart,
      finished_at:    new Date().toISOString(),
      rows_processed: rowsProcessed,
      status:         'error'
    })
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
```

**Criterio de aceptación Slice 1:**
- [ ] Migración aplicada sin errores en prod
- [ ] EF deployada: `supabase functions deploy schedule-visit-reminder`
- [ ] Cron job registrado (verificar con `SELECT * FROM cron.job WHERE jobname = 'visit-reminder-24h'`)
- [ ] Test manual con DRY_RUN=true: response incluye visitas candidatas pero NO inserta en notification_queue
- [ ] Test con visita real de prueba (scheduled_at = mañana 10 AM) con número Robert: cliente recibe WA
- [ ] `reminder_24h_sent_at` se actualiza en la fila de `visits`
- [ ] Segunda ejecución sobre la misma visita: `rows_processed = 0` (dedup funciona)

---

### Slice 2: Confirmación automática al asignar slot desde CRM

**Objetivo:** cuando el comercial elige un slot en el frontend, se bloquea atómicamente y el cliente recibe confirmación por WA en menos de 1 minuto. Elimina el paso manual de enviar WhatsApp después de agendar.

**Qué incluye:**
- Migración SQL: columnas `confirmation_sent_at` en `visits`, `scheduling_status` en `opportunities`
- Edge Function `confirm-visit-booking`
- Integración con el botón de agendamiento en el frontend (un fetch al nuevo endpoint)

**SQL (migración idempotente):**
```sql
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT
    CHECK (scheduling_status IN ('pending_slot','slot_proposed','confirmed','rescheduled'))
    DEFAULT 'pending_slot';

-- Índice para listar opportunities pendientes de slot en el frontend
CREATE INDEX IF NOT EXISTS idx_opportunities_scheduling_status
  ON opportunities (scheduling_status)
  WHERE scheduling_status != 'confirmed';
```

**Edge Function: `confirm-visit-booking`**

Ruta: `D:\Agents-automations\04-Innovar\supabase\functions\confirm-visit-booking\index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Número interno del equipo para notificación visit_assigned_admin_v1
const ADMIN_WA_PHONE = Deno.env.get('ADMIN_WA_PHONE') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: { opportunity_id: string; slot_id: string; address?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { opportunity_id, slot_id, address } = body
  if (!opportunity_id || !slot_id) {
    return new Response(JSON.stringify({ error: 'opportunity_id y slot_id son requeridos' }), { status: 400 })
  }

  // 1. Verificar y bloquear el slot atómicamente usando RPC
  // Si no existe la RPC, implementar con SELECT FOR UPDATE
  const { data: slot, error: slotErr } = await supabase
    .from('availability_slots')
    .select('id, date, time_slot, is_available')
    .eq('id', slot_id)
    .single()

  if (slotErr || !slot) {
    return new Response(JSON.stringify({ error: 'Slot no encontrado' }), { status: 404 })
  }
  if (!slot.is_available) {
    return new Response(JSON.stringify({ error: 'Slot ya ocupado', code: 'SLOT_TAKEN' }), { status: 409 })
  }

  // 2. Obtener datos de la oportunidad y cliente
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select(`
      id, commercial_id,
      client:clients!opportunities_client_id_fkey (
        id, name, whatsapp_phone
      )
    `)
    .eq('id', opportunity_id)
    .single()

  if (oppErr || !opp) {
    return new Response(JSON.stringify({ error: 'Oportunidad no encontrada' }), { status: 404 })
  }

  const client = Array.isArray(opp.client) ? opp.client[0] : opp.client

  // 3. Crear la visita
  const scheduledAt = new Date(`${slot.date}T${slot.time_slot}:00-05:00`).toISOString()
  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .insert({
      opportunity_id,
      client_id:   client.id,
      visitor_id:  opp.commercial_id,
      scheduled_at: scheduledAt,
      status:      'scheduled',
      address:     address ?? null,
      confirmation_sent_at: null
    })
    .select('id')
    .single()

  if (visitErr || !visit) {
    return new Response(JSON.stringify({ error: 'Error creando visita', detail: visitErr?.message }), { status: 500 })
  }

  // 4. Bloquear slot
  await supabase
    .from('availability_slots')
    .update({ is_available: false, visit_id: visit.id })
    .eq('id', slot_id)

  // 5. Actualizar opportunity
  await supabase
    .from('opportunities')
    .update({ status: 'scheduled', scheduling_status: 'confirmed' })
    .eq('id', opportunity_id)

  // 6. Formatear fecha y hora para WA
  const dt = new Date(scheduledAt)
  const fechaTexto = dt.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota'
  })
  const horaTexto = dt.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Bogota'
  })

  const notifications = []

  // 7a. Confirmación al cliente: appointment_booked
  if (client?.whatsapp_phone) {
    notifications.push({
      recipient_phone:     client.whatsapp_phone,
      template_name:       'appointment_booked',
      template_language:   'es',
      template_parameters: [
        client.name,
        'Visita técnica Innovar Cocinas',
        fechaTexto,
        horaTexto
      ],
      dedup_key: `appt-booked:${opportunity_id}:${slot_id}`,
      status:    'pending'
    })
  }

  // 7b. Notificación interna al equipo: visit_assigned_admin_v1
  if (ADMIN_WA_PHONE) {
    notifications.push({
      recipient_phone:     ADMIN_WA_PHONE,
      template_name:       'visit_assigned_admin_v1',
      template_language:   'es',
      template_parameters: [
        client?.name ?? 'Cliente',
        fechaTexto,
        horaTexto,
        address ?? 'por confirmar'
      ],
      dedup_key: `visit-assigned-admin:${visit.id}`,
      status:    'pending'
    })
  }

  // 8. Marcar confirmation_sent_at
  if (notifications.length > 0) {
    await supabase.from('notification_queue').insert(notifications)
    await supabase
      .from('visits')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', visit.id)
  }

  return new Response(
    JSON.stringify({ ok: true, visit_id: visit.id, scheduled_at: scheduledAt }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

**Integración en el frontend (cambio mínimo):**
El botón actual de agendamiento en el CRM (probablemente en `src/pages/` relacionado a visits u opportunities) debe reemplazar su lógica de INSERT directo con un fetch a:
```
POST /functions/v1/confirm-visit-booking
Authorization: Bearer <supabase_anon_key>
{ "opportunity_id": "...", "slot_id": "...", "address": "..." }
```
Manejar el 409 `SLOT_TAKEN` mostrando toast de error y refrescando la lista de slots disponibles.

**Variables de entorno adicionales requeridas en Supabase Vault:**
```
ADMIN_WA_PHONE = +573XXXXXXXXX  (número del coordinador de visitas)
```

**Criterio de aceptación Slice 2:**
- [ ] Migración aplicada sin errores
- [ ] EF deployada: `supabase functions deploy confirm-visit-booking`
- [ ] Test: llamar EF con slot disponible → visita creada, slot bloqueado, WA enviado al número de prueba (Robert `+573183061286`)
- [ ] Test de concurrencia: dos llamadas simultáneas al mismo slot → solo una crea visita, la otra recibe 409
- [ ] Cliente recibe `appointment_booked` con fecha/hora correcta en español
- [ ] `opportunity.status` cambia a `scheduled` y `scheduling_status` a `confirmed`
- [ ] Frontend muestra error claro cuando slot ya fue tomado

---

### Slice 3: Propuesta interactiva vía WhatsApp bidireccional

**Objetivo:** el comercial (o NOVA) puede enviar una propuesta de dos horarios disponibles directamente por WA. El cliente responde "1" o "2" y el slot queda confirmado automáticamente sin abrir el CRM. Requiere webhook de Meta configurado.

**Prerequisito:** templates `visit_proposal_client_v1` y `visit_reschedule_client_v1` aprobados por Meta.

**Qué incluye:**
- Migración SQL: tabla `visit_confirmations`
- Edge Function `propose-visit-slot` — consulta slots libres y envía propuesta WA
- Edge Function `whatsapp-visit-webhook` — recibe respuesta del cliente y confirma slot
- Configuración del webhook en Meta Business Manager (URL de la EF)
- Workflow n8n opcional para orquestación con OpenRouter (clasificación de respuestas ambiguas)

**SQL (migración idempotente):**
```sql
-- Ver sección 7 para el CREATE TABLE completo de visit_confirmations
-- Aplicar directamente desde el script de la sección 7
```

**Edge Function: `propose-visit-slot`**

Ruta: `D:\Agents-automations\04-Innovar\supabase\functions\propose-visit-slot\index.ts`

```typescript
// Lógica central:
// 1. Validar opportunity_id en body
// 2. SELECT availability_slots WHERE is_available=true AND date >= CURRENT_DATE+1
//    ORDER BY date, time_slot LIMIT 2
// 3. Si < 2 slots disponibles → error 503 con mensaje "Sin disponibilidad esta semana"
// 4. INSERT visit_confirmations con los dos slots y status='proposed'
// 5. Formatear fecha/hora de cada slot
// 6. INSERT notification_queue con visit_proposal_client_v1 (5 vars)
//    dedup_key: 'visit-proposal:{opportunity_id}:{today}'
// 7. UPDATE opportunities SET scheduling_status='slot_proposed'
// 8. Retornar { ok: true, proposed_slots: [slot1, slot2] }
```

**Edge Function: `whatsapp-visit-webhook`**

Ruta: `D:\Agents-automations\04-Innovar\supabase\functions\whatsapp-visit-webhook\index.ts`

```typescript
// Este webhook recibe todos los mensajes entrantes de Meta WA.
// IMPORTANTE: verificar el challenge GET de Meta (campo hub.challenge) al configurar el webhook.
//
// Lógica central al recibir mensaje POST:
// 1. Extraer: from (phone), body (texto del mensaje)
// 2. Normalizar phone: quitar +, mantener 57XXXXXXXXXX
// 3. Buscar visit_confirmations JOIN opportunities JOIN clients
//    WHERE clients.whatsapp_phone LIKE '%{phone}%'
//    AND visit_confirmations.status = 'proposed'
//    AND visit_confirmations.expires_at > NOW()
//    ORDER BY proposed_at DESC LIMIT 1
// 4. Si no hay confirmación pendiente → ignorar mensaje (no es parte del flujo)
// 5. Clasificar respuesta:
//    - "1" / "uno" / "primero" / "primera" → chosen_slot = proposed_slot_1
//    - "2" / "dos" / "segundo" / "segunda" → chosen_slot = proposed_slot_2
//    - texto ambiguo → llamar OpenRouter para clasificar intención
//    - rechazo claro ("no puedo", "cancelar", etc.) → status='rejected', encolar visit_reschedule_client_v1
// 6. Si slot elegido:
//    - UPDATE visit_confirmations SET status='confirmed', chosen_slot=X, responded_at=NOW()
//    - Llamar internamente confirm-visit-booking con chosen_slot
// 7. Retornar 200 OK siempre (Meta requiere 200 en < 20 segundos)
```

**Configuración Meta Webhook:**
- URL: `https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/whatsapp-visit-webhook`
- Verify Token: definir en Vault como `WA_WEBHOOK_VERIFY_TOKEN` (string aleatorio de 32 chars)
- Suscripciones: `messages` (mensajes entrantes)
- La EF debe responder al GET de verificación retornando `hub.challenge` cuando el `hub.verify_token` coincida

**Expiración de propuestas (cron adicional — opcional):**
```sql
-- Marcar propuestas vencidas cada hora
SELECT cron.schedule(
  'expire-visit-proposals',
  '0 * * * *',
  $$
  UPDATE visit_confirmations
  SET status = 'expired'
  WHERE status = 'proposed' AND expires_at < NOW()
  $$
);
```

**Criterio de aceptación Slice 3:**
- [ ] Templates `visit_proposal_client_v1` y `visit_reschedule_client_v1` aprobados por Meta
- [ ] Webhook configurado y verificado en Meta Business Manager
- [ ] EF `propose-visit-slot` deployada y testeable con curl
- [ ] EF `whatsapp-visit-webhook` deployada; GET de verificación retorna challenge correctamente
- [ ] Test E2E: número de prueba (Robert) recibe propuesta de 2 horarios, responde "1", slot queda bloqueado en DB
- [ ] Respuesta ambigua → OpenRouter clasifica correctamente en > 90% de casos de prueba
- [ ] Respuesta de rechazo → cliente recibe `visit_reschedule_client_v1`
- [ ] `visit_confirmations.status` refleja el estado correcto en cada paso
- [ ] Segunda respuesta al mismo mensaje de propuesta → ignorada (la confirmación ya está en status=confirmed)

---

## 9. Criterios de aceptación globales

- [ ] **Slice 1 en producción:** todas las visitas con `status=scheduled` y `scheduled_at` en las próximas 24h reciben recordatorio WA automáticamente a las 9 AM
- [ ] **Idempotencia:** ninguna visita recibe el mismo recordatorio dos veces (verificado con dedup_key + columna `reminder_24h_sent_at`)
- [ ] **Sin falsos positivos:** visitas con `status != 'scheduled'` (canceladas, completadas) NO reciben recordatorio
- [ ] **Bloqueo atómico:** imposible crear dos visitas para el mismo slot (verificado con prueba de concurrencia)
- [ ] **Trazabilidad completa:** para cada visita agendada, `scheduled_job_log` muestra la ejecución del cron y `notification_queue` + `whatsapp_message_log` muestran el envío del WA
- [ ] **Manejo de errores:** si `whatsapp_phone` es nulo o inválido, la visita se procesa sin error fatal y el error queda registrado en el response del cron
- [ ] **DRY_RUN funcional:** con `dry_run=true`, cero INSERTs en `notification_queue` pero response incluye la lista de visitas que se procesarían
- [ ] **Log de cron limpio:** `scheduled_job_log` muestra `status=ok` en ejecuciones sin errores, `partial_error` si alguna fila falló, `error` solo si el job no pudo iniciarse
- [ ] **Latencia:** desde que el slot se confirma (Slice 2) hasta que el cliente recibe el WA < 90 segundos

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Variables de `visit_reminder_24h_internal_v1` no coinciden con el mapeo asumido | ALTA | MEDIO | Antes de Slice 1: consultar el texto real del template en Meta Business Manager y ajustar el array de `template_parameters` |
| Doble booking por race condition | MEDIA | ALTO | Slice 2 usa SELECT antes de INSERT; para máxima seguridad agregar constraint UNIQUE en `availability_slots(date, time_slot)` con is_available=false |
| Meta rechaza `visit_proposal_client_v1` por formato de botones interactivos | MEDIA | ALTO (solo Slice 3) | Someter template como texto plano primero (sin quick-reply buttons); la propuesta "responde 1 o 2" funciona con texto libre |
| El webhook de Meta recibe mensajes de otros flujos WA y dispara lógica incorrecta | MEDIA | MEDIO | Filtrar por `visit_confirmations.status='proposed'` antes de actuar; mensajes sin confirmación pendiente se descartan silenciosamente |
| ADMIN_WA_PHONE no configurado en Vault | BAJA | BAJO | La EF verifica si el env var existe antes de encolar; si está vacío omite la notificación interna sin error |
| `availability_slots` no tiene datos futuros cargados | BAJA | ALTO | Verificar que hay slots con `is_available=true` y `date >= hoy` antes de activar en prod; si no hay, cargarlos manualmente |
| Zona horaria incorrecta en formato de fecha WA | BAJA | MEDIO | Todas las fechas se formatean con `timeZone: 'America/Bogota'` explícito en `toLocaleDateString` |

**Dependencias externas:**
- Templates Meta aprobados (Slice 1: ya aprobados; Slice 3: pendientes)
- Webhook Meta configurado (Slice 3)
- Vault secret `ADMIN_WA_PHONE` cargado antes del deploy Slice 2
- Vault secret `WA_WEBHOOK_VERIFY_TOKEN` cargado antes del deploy Slice 3
- `availability_slots` con datos futuros disponibles

---

## 11. Métricas de éxito

| Métrica | Línea base (manual) | Objetivo con agente | Cómo medir |
|---|---|---|---|
| % visitas con recordatorio 24h enviado | ~30% (manual, olvidable) | 100% | `SELECT COUNT(*) FROM visits WHERE status='scheduled' AND reminder_24h_sent_at IS NOT NULL` |
| Tiempo desde confirmación de interés hasta propuesta de horario (Slice 3) | 2-4 horas | < 5 minutos | `visit_confirmations.proposed_at - opportunities.updated_at` |
| Tasa de no-show en visitas | Medir baseline primeras 2 semanas | Reducir 30% en 60 días | Ratio `visits WHERE status='no_show' / total` mensual |
| Slots con doble booking | Cualquiera es inaceptable | 0 | `SELECT COUNT(*) FROM visits v1 JOIN visits v2 ON v1.scheduled_at=v2.scheduled_at AND v1.id!=v2.id` |
| Latencia promedio envío WA post-confirmación | N/A | < 90 segundos | `notification_queue.sent_at - visits.confirmation_sent_at` |
| Errores en cron `visit-reminder-24h` | N/A | < 1% de ejecuciones con status=error | `scheduled_job_log WHERE job_name='visit-reminder-24h' AND status='error'` últimos 30 días |

---

## 12. Notas de seguridad y DRY_RUN

### Números de prueba autorizados
- **Robert (dueño):** `+573183061286` — número principal de prueba para todos los tests
- **Heduin:** `+584127862439` — número secundario de respaldo

**NUNCA enviar a números de clientes reales durante las pruebas.**

### DRY_RUN en Slice 1 (cron)

La EF `schedule-visit-reminder` soporta dos mecanismos de DRY_RUN:

1. **Variable de entorno en Vault:** `VISIT_REMINDER_DRY_RUN=true` → activa DRY_RUN globalmente para todas las ejecuciones del cron
2. **Body en la llamada manual:** `{ "dry_run": true }` → override puntual para pruebas sin modificar el Vault

**Protocolo de activación en producción (Slice 1):**
```
Paso 1: Deploy EF con VISIT_REMINDER_DRY_RUN=true en Vault
Paso 2: Ejecutar manualmente: curl -X POST .../schedule-visit-reminder -d '{"dry_run":true}'
Paso 3: Verificar en response que lista visitas candidatas correctas y ningún INSERT en notification_queue
Paso 4: Ejecutar con dry_run=false apuntando a número Robert:
        Insertar visita de prueba con scheduled_at = NOW() + 24h y client whatsapp=3183061286
Paso 5: Confirmar que Robert recibe el WA y que reminder_24h_sent_at se actualizó
Paso 6: Cambiar VISIT_REMINDER_DRY_RUN=false en Vault → cron activado en producción
```

### DRY_RUN en Slice 2 (confirm-visit-booking)

La EF no tiene DRY_RUN propio porque es invocada por acción explícita del usuario en el CRM. El protocolo de prueba es:
1. Crear un lead y oportunidad de prueba en prod con datos ficticios
2. Asignar un slot real disponible (martes o jueves próximo)
3. Verificar que el WA llega al número de prueba
4. Hacer limpieza: marcar la visita como cancelada y devolver el slot a `is_available=true`

### Seguridad del webhook (Slice 3)

- La EF `whatsapp-visit-webhook` debe validar que cada POST de Meta incluye el header `X-Hub-Signature-256` y verificar el HMAC con el `WHATSAPP_APP_SECRET` del Vault. Rechazar requests sin firma válida con 403.
- El verify token del GET de configuración nunca debe logearse ni exponerse en responses de error.
- Todo mensaje entrante que no corresponda a una `visit_confirmation` pendiente se descarta con `200 OK` y sin acción (Meta requiere 200 para no reintentar).

### Vault secrets requeridos por slice

| Secret | Slice | Vault key sugerida |
|---|---|---|
| Service role key (ya existe) | 1, 2, 3 | `SUPABASE_SERVICE_ROLE_KEY` |
| Número admin interno | 2 | `ADMIN_WA_PHONE` |
| Webhook verify token | 3 | `WA_WEBHOOK_VERIFY_TOKEN` |
| WhatsApp app secret para firma HMAC | 3 | `WHATSAPP_APP_SECRET` |
| OpenRouter API key (ya existe) | 3 | `OPENROUTER_API_KEY` |
