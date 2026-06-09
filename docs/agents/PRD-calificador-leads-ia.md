# PRD: Calificador de Leads IA
**Capa:** 01 — Adquisición
**Prioridad:** ALTA
**Fecha:** 2026-06-09
**Estado:** En Diseño

---

## 1. Resumen Ejecutivo

El Calificador de Leads IA es un agente conversacional que contacta proactivamente a leads nuevos por WhatsApp cuando el comercial no ha respondido en las primeras 2 horas hábiles. Usando IA (OpenRouter/DeepSeek), conduce una conversación guiada de 3-4 preguntas para capturar producto de interés, medidas aproximadas, presupuesto y urgencia — datos que hoy el comercial tiene que extraer manualmente en la primera llamada, consumiendo 15-20 minutos de tiempo productivo por lead.

Para el negocio de Innovar Cocinas, donde un lead cualificado puede representar un proyecto de $5M-$20M COP, la diferencia entre responder en 2 horas vs 8 horas puede ser la diferencia entre cerrar o perder el cliente. Este agente garantiza que ningún lead se enfríe por falta de contacto inicial, y que cuando el comercial haga la primera llamada ya tenga el perfil completo del cliente frente a él.

El agente resuelve además el problema de información incompleta en el CRM: hoy las oportunidades se crean sin producto, presupuesto ni urgencia, lo que hace imposible priorizar correctamente la agenda del taller y del equipo comercial.

---

## 2. Problema que resuelve

**Pain point principal:** Los leads entran al CRM con status `new` y el comercial los ve hasta que revisa manualmente su bandeja. En horas pico o días con muchas visitas agendadas, un lead puede quedarse sin contacto 4-8 horas. A las 8 horas, la tasa de conversión cae más del 70% (dato industria).

**Pain points secundarios:**
- El comercial no sabe el potencial del lead antes de llamar: pierde tiempo en leads de bajo valor o prioriza mal.
- Las oportunidades se crean con campos `product_type`, `budget_range` y `urgency_level` vacíos — el pipeline no refleja la realidad.
- No hay ningún sistema de seguimiento automático para leads que no respondieron el saludo inicial.
- El comercial hace las mismas 4 preguntas en cada primera llamada — trabajo repetible que puede automatizarse.

---

## 3. Infraestructura existente que se reutiliza

### Tablas Supabase
- `leads` — fuente de verdad del lead, se actualiza con `status = 'qualified'` al finalizar
- `opportunities` — se actualiza con los datos capturados (producto, presupuesto, urgencia)
- `notification_queue` — canal de salida para todos los mensajes WhatsApp
- `whatsapp_message_log` — trazabilidad de mensajes enviados
- `system_settings` — para leer `business_hours_start`, `business_hours_end`, `business_timezone`
- `scheduled_job_log` — para registrar ejecuciones del cron de detección
- `tasks` — para crear tarea de seguimiento al comercial al finalizar calificación

### Edge Functions
- `process-whatsapp-notifications` — ya procesa `notification_queue` cada minuto, cero cambios
- `ask-innovar` — referencia de patrón para llamadas a OpenRouter con DeepSeek

### Templates WhatsApp aprobados que se reutilizan
- `welcome_lead_v1` — para el saludo inicial si el lead ya existe en el sistema como cliente previo (caso raro pero posible)

### Patrones reutilizables
- Patrón `dedup_key` en `notification_queue` — `calificador:{lead_id}:{etapa}:{fecha_iso}`
- Patrón de cron Supabase con `pg_cron` + `net.http_post`
- Patrón OpenRouter con `response_format: { type: "json_object" }` de `ask-innovar`

---

## 4. Gap Analysis — Lo que hay que construir

### Templates WhatsApp (NUEVOS — requieren aprobación Meta)
1. `lead_qualification_start_v1` — template proactivo de apertura de conversación
2. `lead_qualification_followup_v1` — recordatorio si el lead no respondió en 24h (opcional, Slice 3)

### Tablas nuevas
1. `lead_conversations` — estado conversacional por lead (en qué fase está, historial de mensajes)

### Columnas nuevas en tablas existentes
1. `opportunities.product_type` (text) — si no existe
2. `opportunities.budget_range` (text) — si no existe
3. `opportunities.urgency_level` (text) — si no existe
4. `opportunities.qualification_source` (text) — `'ia_whatsapp'` | `'manual'`
5. `leads.last_contacted_at` (timestamptz) — si no existe

### Edge Functions nuevas
1. `lead-qualification-detector` — cron cada 30 min en horas hábiles, detecta leads sin contacto en 2h
2. `lead-qualification-webhook` — recibe respuestas de Meta WhatsApp, llama OpenRouter, envía siguiente pregunta
3. `lead-qualification-finalizer` — cierra conversación, actualiza CRM, alerta al comercial

### n8n
- Workflow nuevo (opcional): como alternativa al cron en Supabase para la detección, o para orquestar el flujo completo si se prefiere visibilidad en n8n. Se documenta en Slice 2 como opción.

### Webhook Meta
- Registrar una nueva URL de webhook en Meta Business para recibir mensajes entrantes de clientes (distinto al webhook de estado actual que solo recibe delivery receipts)

---

## 5. Arquitectura Técnica

### Stack
- **Trigger:** pg_cron (Supabase) cada 30 min → `lead-qualification-detector` EF
- **Conversación:** Meta Webhook → `lead-qualification-webhook` EF → OpenRouter → `notification_queue`
- **Cierre:** `lead-qualification-webhook` EF → `lead-qualification-finalizer` EF (llamada interna)
- **Modelo LLM:** `deepseek/deepseek-chat` vía OpenRouter

### Data Flow

```
[Lead nuevo entra al CRM]
         |
         | (cada 30 min, horas hábiles)
         v
[pg_cron] ──────────────────────────────────────────────────
    |
    v
[EF: lead-qualification-detector]
    |── Consulta leads WHERE status='new'
    |       AND created_at <= NOW() - INTERVAL '2 hours' (hábiles)
    |       AND last_contacted_at IS NULL
    |── Para cada lead elegible:
    |       INSERT lead_conversations (lead_id, phase='init', started_at)
    |       INSERT notification_queue (template=lead_qualification_start_v1)
    |       UPDATE leads SET last_contacted_at = NOW()
    |
    v
[process-whatsapp-notifications] (cron cada 1 min)
    |── Lee notification_queue
    |── Llama Meta Graph API
    |── Envía template proactivo al lead
    |
    v
[Lead recibe WhatsApp y responde]
    |
    v
[Meta → Webhook entrante] ──────────────────────────────────
    |
    v
[EF: lead-qualification-webhook]
    |── Verifica firma HMAC del webhook Meta
    |── Extrae from_phone + body del mensaje
    |── Busca lead_conversations WHERE phone = from_phone AND status='active'
    |── Si no existe conversación activa → ignorar (mensaje fuera de contexto)
    |── Lee historial de mensajes de lead_conversations
    |── Llama OpenRouter (DeepSeek) con:
    |       - System prompt con datos del lead
    |       - Historial de conversación
    |       - Instrucción: devolver JSON {next_question, data_extracted, is_complete}
    |── Si is_complete = false:
    |       INSERT notification_queue (mensaje de texto libre, no template)
    |       UPDATE lead_conversations (historial, phase actualizada)
    |── Si is_complete = true:
    |       → Llama lead-qualification-finalizer
    |
    v
[EF: lead-qualification-finalizer]
    |── UPDATE opportunities SET product_type, budget_range, urgency_level, qualification_source
    |── UPDATE leads SET status='qualified'
    |── UPDATE lead_conversations SET status='completed', completed_at
    |── INSERT tasks (alerta al comercial con resumen de calificación)
    |── INSERT notification_queue (mensaje de cierre al lead)
```

### Notas de arquitectura
- Los mensajes de respuesta libre (preguntas 2-4) se envían como mensajes de texto normal por Meta API (no templates), lo que es válido porque el lead ya inició la sesión respondiendo al template inicial. La ventana de 24h de Meta aplica desde la primera respuesta del usuario.
- OpenRouter recibe el historial completo de la conversación en cada turno para mantener contexto.
- La tabla `lead_conversations` actúa como máquina de estados finitos: `init → waiting_response → in_progress → completed | abandoned`.

---

## 6. Templates WhatsApp requeridos

### Template 1: `lead_qualification_start_v1` — NUEVO, requiere aprobación Meta

**Categoría Meta:** `MARKETING` (conversación proactiva de negocio)
**Idioma:** `es` (español)
**Variables:** `{{1}}` = nombre_lead

**Header (texto):** `Innovar Cocinas — Tu consulta`

**Cuerpo (body):**
```
Hola {{1}}, soy NOVA, asistente de Innovar Cocinas 🍳

Vi que te interesaste en nuestros proyectos. Para preparar la mejor propuesta para ti, ¿me cuentas qué espacio tienes en mente? (cocina, closet, baño u otro)
```
*(158 caracteres — dentro del límite)*

**Footer:** `Responde en cualquier momento. Innovar Cocinas`

**Botones (opcional, tipo Quick Reply):**
- `Cocina integral`
- `Closet / vestier`
- `Otro espacio`

**Notas para Meta:** Categoría MARKETING. El usuario puede opt-out respondiendo "STOP". Template en idioma es_CO.

---

### Template 2: `lead_qualification_followup_v1` — NUEVO, requiere aprobación Meta (Slice 3, puede diferirse)

**Categoría Meta:** `UTILITY`
**Idioma:** `es`
**Variables:** `{{1}}` = nombre_lead

**Cuerpo:**
```
Hola {{1}}, seguimos disponibles en Innovar Cocinas para ayudarte con tu proyecto. ¿Tienes unos minutos para contarnos qué tienes en mente? 😊
```
*(138 caracteres)*

**Footer:** `Innovar Cocinas · Responde STOP para no recibir mensajes`

---

### Templates existentes que se usan sin cambios
- **`task_assigned`** — para notificar al comercial cuando el lead queda calificado (variables: equipo=nombre_comercial, tarea=resumen calificación, vencimiento=hoy+2h, cliente=nombre_lead)

---

## 7. Schema de datos

### Tabla nueva: `lead_conversations`

```sql
CREATE TABLE IF NOT EXISTS public.lead_conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone               text NOT NULL,                        -- número del lead, índice para webhook
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','abandoned','error')),
  phase               text NOT NULL DEFAULT 'init'
                        CHECK (phase IN (
                          'init',             -- template enviado, esperando primera respuesta
                          'asking_product',   -- preguntando qué espacio
                          'asking_dimensions','asking_budget','asking_urgency',
                          'completed','abandoned'
                        )),
  messages            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- array de {role, content, timestamp}
  data_extracted      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {product_type, dimensions, budget_range, urgency_level}
  started_at          timestamptz NOT NULL DEFAULT now(),
  last_message_at     timestamptz,
  completed_at        timestamptz,
  abandoned_at        timestamptz,
  abandonment_reason  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices críticos
CREATE INDEX IF NOT EXISTS idx_lead_conversations_lead_id
  ON public.lead_conversations(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_conversations_phone_status
  ON public.lead_conversations(phone, status)
  WHERE status = 'active';                                  -- partial index: solo activas

CREATE INDEX IF NOT EXISTS idx_lead_conversations_status_phase
  ON public.lead_conversations(status, phase);

-- RLS
ALTER TABLE public.lead_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON public.lead_conversations
  FOR ALL TO service_role USING (true);
```

### Columnas nuevas en `opportunities`

```sql
-- Verificar si existen antes de agregar
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS product_type          text,     -- 'cocina_integral','closet','bano','otro'
  ADD COLUMN IF NOT EXISTS budget_range          text,     -- '$5M-$10M','$10M-$20M','>$20M','sin_definir'
  ADD COLUMN IF NOT EXISTS urgency_level         text,     -- 'urgente_1mes','3meses','6meses','sin_fecha'
  ADD COLUMN IF NOT EXISTS dimensions_approx     text,     -- texto libre, ej. "3x4 metros aprox"
  ADD COLUMN IF NOT EXISTS qualification_source  text      -- 'ia_whatsapp','manual'
    DEFAULT 'manual';
```

### Columnas nuevas en `leads`

```sql
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_contacted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_attempts int NOT NULL DEFAULT 0;
```

### Función auxiliar: verificar ventana hábil

```sql
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT (
    EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/Bogota') BETWEEN 1 AND 5  -- Lun-Vie
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Bogota') BETWEEN 8 AND 17
  );
$$;
```

### Función auxiliar: horas hábiles transcurridas

```sql
CREATE OR REPLACE FUNCTION public.business_hours_elapsed(from_ts timestamptz)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  -- Aproximación: cuenta solo horas entre 8am-6pm Lun-Vie
  -- Para simplicidad en v1: si han pasado más de 2h de reloj y estamos en horas hábiles → elegible
  SELECT EXTRACT(EPOCH FROM (NOW() - from_ts)) / 3600.0;
$$;
```

---

## 8. Implementación paso a paso

### Slice 1: Fundación de datos y template Meta

**Qué incluye:**
- Migración SQL con tabla `lead_conversations` + columnas nuevas en `leads` y `opportunities`
- Función `is_business_hours()`
- Función `business_hours_elapsed()`
- Envío del template `lead_qualification_start_v1` a Meta Business para aprobación
- Script de smoke test que verifica la migración

**SQL completo (idempotente):**

```sql
-- 1. Columnas en leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_contacted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_attempts int NOT NULL DEFAULT 0;

-- 2. Columnas en opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS product_type          text,
  ADD COLUMN IF NOT EXISTS budget_range          text,
  ADD COLUMN IF NOT EXISTS urgency_level         text,
  ADD COLUMN IF NOT EXISTS dimensions_approx     text,
  ADD COLUMN IF NOT EXISTS qualification_source  text DEFAULT 'manual';

-- 3. Tabla lead_conversations (ver sección 7)
-- ... (SQL completo de la sección 7)

-- 4. Funciones auxiliares
-- ... (is_business_hours, business_hours_elapsed)

-- 5. Verificación
SELECT column_name FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('last_contacted_at','qualification_attempts');
-- Debe retornar 2 filas

SELECT column_name FROM information_schema.columns
WHERE table_name = 'opportunities'
  AND column_name IN ('product_type','budget_range','urgency_level','dimensions_approx','qualification_source');
-- Debe retornar 5 filas

SELECT EXISTS (
  SELECT FROM information_schema.tables WHERE table_name = 'lead_conversations'
) AS table_exists;
-- Debe retornar true
```

**Criterio de aceptación del Slice 1:**
- [ ] Migración ejecuta sin errores en prod (`xdzbjptozeqcbnaqhtye`)
- [ ] `SELECT * FROM lead_conversations LIMIT 1` no da error
- [ ] `SELECT is_business_hours()` retorna `true` o `false` según hora actual
- [ ] Template `lead_qualification_start_v1` enviado a Meta (comprobante de envío)
- [ ] BLOQUEANTE: esperar aprobación Meta (1-3 días hábiles) antes de Slice 2

---

### Slice 2: Edge Function detector + cron

**Qué incluye:**
- Edge Function `lead-qualification-detector`
- pg_cron job que la invoca cada 30 min en horas hábiles
- Modo DRY_RUN para pruebas seguras

**Edge Function: `lead-qualification-detector`**

```typescript
// supabase/functions/lead-qualification-detector/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const DRY_RUN = Deno.env.get('QUALIFIER_DRY_RUN') === 'true'
const MAX_ATTEMPTS = 2          // máx 2 intentos por lead
const WAIT_HOURS = 2            // horas hábiles sin respuesta del comercial
const MAX_LEADS_PER_RUN = 10    // límite de seguridad por ejecución

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const jobStart = new Date()

  try {
    // 1. Verificar ventana hábil
    const { data: inHours } = await supabase.rpc('is_business_hours')
    if (!inHours) {
      return new Response(JSON.stringify({ skipped: 'outside_business_hours' }), { status: 200 })
    }

    // 2. Buscar leads elegibles
    const cutoff = new Date(Date.now() - WAIT_HOURS * 60 * 60 * 1000).toISOString()

    const { data: eligibleLeads, error } = await supabase
      .from('leads')
      .select('id, name, phone, commercial_id, created_at, qualification_attempts')
      .eq('status', 'new')
      .lte('created_at', cutoff)
      .is('last_contacted_at', null)
      .lt('qualification_attempts', MAX_ATTEMPTS)
      .not('phone', 'is', null)
      .limit(MAX_LEADS_PER_RUN)

    if (error) throw error

    const results = []
    const today = new Date().toISOString().split('T')[0]

    for (const lead of eligibleLeads ?? []) {
      // 3. Verificar que no tenga conversación activa ya
      const { data: existingConv } = await supabase
        .from('lead_conversations')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingConv) {
        results.push({ lead_id: lead.id, action: 'skipped_active_conversation' })
        continue
      }

      if (DRY_RUN) {
        results.push({ lead_id: lead.id, action: 'dry_run_would_send', phone: lead.phone })
        continue
      }

      // 4. Crear conversación
      const { data: conv, error: convErr } = await supabase
        .from('lead_conversations')
        .insert({
          lead_id: lead.id,
          phone: lead.phone,
          status: 'active',
          phase: 'init',
          messages: [],
          data_extracted: {}
        })
        .select('id')
        .single()

      if (convErr) {
        results.push({ lead_id: lead.id, action: 'error_creating_conversation', error: convErr.message })
        continue
      }

      // 5. Encolar mensaje WhatsApp
      const dedupKey = `calificador:${lead.id}:init:${today}`
      const { error: qErr } = await supabase
        .from('notification_queue')
        .insert({
          recipient_phone: lead.phone,
          template_name: 'lead_qualification_start_v1',
          template_language: 'es',
          template_parameters: JSON.stringify([lead.name ?? 'cliente']),
          status: 'pending',
          dedup_key: dedupKey
        })

      if (qErr && !qErr.message.includes('duplicate')) {
        results.push({ lead_id: lead.id, action: 'error_enqueue', error: qErr.message })
        continue
      }

      // 6. Actualizar lead
      await supabase
        .from('leads')
        .update({
          last_contacted_at: new Date().toISOString(),
          qualification_attempts: lead.qualification_attempts + 1
        })
        .eq('id', lead.id)

      results.push({ lead_id: lead.id, action: 'queued', phone: lead.phone, conv_id: conv.id })
    }

    // 7. Log de ejecución
    await supabase.from('scheduled_job_log').insert({
      job_name: 'lead-qualification-detector',
      started_at: jobStart.toISOString(),
      finished_at: new Date().toISOString(),
      rows_processed: results.filter(r => r.action === 'queued').length,
      status: 'success'
    })

    return new Response(JSON.stringify({ dry_run: DRY_RUN, results }), { status: 200 })

  } catch (err) {
    await supabase.from('scheduled_job_log').insert({
      job_name: 'lead-qualification-detector',
      started_at: jobStart.toISOString(),
      finished_at: new Date().toISOString(),
      rows_processed: 0,
      status: 'error'
    })
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
```

**Cron Supabase (ejecutar en SQL editor):**

```sql
-- Ejecutar cada 30 min, L-V (el detector ya verifica horas hábiles internamente)
SELECT cron.schedule(
  'lead-qualification-detector',
  '*/30 * * * 1-5',
  $$SELECT net.http_post(
    url := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/lead-qualification-detector',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )$$
);
```

**Criterio de aceptación del Slice 2:**
- [ ] EF desplegada: `supabase functions deploy lead-qualification-detector`
- [ ] Con `QUALIFIER_DRY_RUN=true`: logs muestran `dry_run_would_send` para leads elegibles
- [ ] Con DRY_RUN, `leads.last_contacted_at` NO se actualiza
- [ ] `scheduled_job_log` registra cada ejecución
- [ ] Cron creado y visible en `select * from cron.job where jobname = 'lead-qualification-detector'`
- [ ] Ejecutar manualmente con `curl -X POST` y verificar respuesta 200

---

### Slice 3: Webhook de conversación bidireccional + OpenRouter

**Qué incluye:**
- Edge Function `lead-qualification-webhook` (recibe mensajes entrantes de Meta)
- Prompt de sistema para OpenRouter
- Lógica de extracción de datos estructurados
- Envío de respuestas de texto libre por Meta API directamente (no templates)

**Configuración Meta Webhook:**
- En Meta Business Manager → WhatsApp → Configuración → Webhook
- URL: `https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/lead-qualification-webhook`
- Token de verificación: definir `WHATSAPP_WEBHOOK_VERIFY_TOKEN` en Vault de Supabase
- Suscribir al evento: `messages` (además de los eventos de estado que ya estén suscritos)

**Edge Function: `lead-qualification-webhook`**

```typescript
// supabase/functions/lead-qualification-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')!
const WA_TOKEN    = Deno.env.get('WHATSAPP_TOKEN')!
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const OR_KEY      = Deno.env.get('OPENROUTER_API_KEY')!
const DRY_RUN     = Deno.env.get('QUALIFIER_DRY_RUN') === 'true'

const SYSTEM_PROMPT = `Eres el asistente de Innovar Cocinas, empresa colombiana de cocinas y closets a medida. 
Tu objetivo es recopilar exactamente 4 datos del cliente de forma conversacional y amable:
1. product_type: qué espacio quiere (cocina_integral, closet, bano, mueble_tv, otro)
2. dimensions_approx: medidas aproximadas del espacio en metros
3. budget_range: presupuesto aproximado en pesos colombianos
4. urgency_level: cuándo necesita el proyecto (urgente_1mes, 3meses, 6meses, sin_fecha)

Reglas:
- Máximo 1 pregunta por turno. No hagas 2 preguntas a la vez.
- Tono: cálido, profesional, colombiano. Puedes usar emojis con moderación (máx 1 por mensaje).
- Si el cliente responde algo ambiguo, pide clarificación gentilmente antes de avanzar.
- Cuando tengas los 4 datos, muestra un resumen y confirma con el cliente.
- Mensajes cortos: máximo 160 caracteres por respuesta.
- NUNCA menciones precios específicos ni hagas promesas de entrega.

Devuelve SIEMPRE un JSON con este formato exacto:
{
  "next_message": "texto del próximo mensaje a enviar",
  "data_extracted": {
    "product_type": null | "string",
    "dimensions_approx": null | "string",
    "budget_range": null | "string",
    "urgency_level": null | "string"
  },
  "current_phase": "asking_product|asking_dimensions|asking_budget|asking_urgency|confirming|completed",
  "is_complete": false | true
}`

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verificación de webhook (GET de Meta al registrar)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode      = url.searchParams.get('hub.mode')
    const token     = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // Recepción de mensajes (POST de Meta)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.json()

  // Meta envía también eventos de estado (delivered, read) — ignorarlos
  const entry    = body?.entry?.[0]
  const changes  = entry?.changes?.[0]
  const value    = changes?.value
  const messages = value?.messages

  if (!messages || messages.length === 0) {
    return new Response('OK', { status: 200 }) // evento de estado, ignorar
  }

  const incomingMsg  = messages[0]
  const fromPhone    = incomingMsg.from           // número en formato internacional sin +
  const msgText      = incomingMsg.text?.body ?? incomingMsg.button?.text ?? ''
  const msgTimestamp = new Date(parseInt(incomingMsg.timestamp) * 1000).toISOString()

  if (!msgText.trim()) {
    return new Response('OK', { status: 200 })
  }

  // Buscar conversación activa para este número
  const { data: conv, error: convErr } = await supabase
    .from('lead_conversations')
    .select('*')
    .eq('phone', fromPhone)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (convErr || !conv) {
    // No hay conversación activa — puede ser un cliente existente respondiendo otro mensaje
    // No responder para no generar ruido
    return new Response('OK', { status: 200 })
  }

  // Agregar mensaje entrante al historial
  const updatedMessages = [
    ...(conv.messages as any[]),
    { role: 'user', content: msgText, timestamp: msgTimestamp }
  ]

  // Llamar a OpenRouter
  const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://innovarcocinas.com',
      'X-Title': 'Innovar Lead Qualifier'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.3,       // baja temperatura para respuestas más consistentes
      max_tokens: 300
    })
  })

  if (!orResponse.ok) {
    console.error('OpenRouter error:', await orResponse.text())
    return new Response('OK', { status: 200 })
  }

  const orData = await orResponse.json()
  let aiResult: any

  try {
    aiResult = JSON.parse(orData.choices[0].message.content)
  } catch {
    console.error('Failed to parse OpenRouter JSON response')
    return new Response('OK', { status: 200 })
  }

  // Agregar respuesta IA al historial
  const finalMessages = [
    ...updatedMessages,
    { role: 'assistant', content: aiResult.next_message, timestamp: new Date().toISOString() }
  ]

  // Actualizar conversación en DB
  await supabase
    .from('lead_conversations')
    .update({
      messages: finalMessages,
      phase: aiResult.current_phase,
      data_extracted: aiResult.data_extracted,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: aiResult.is_complete ? 'completed' : 'active',
      completed_at: aiResult.is_complete ? new Date().toISOString() : null
    })
    .eq('id', conv.id)

  if (!DRY_RUN) {
    // Enviar respuesta por Meta API directamente (mensaje de texto libre, dentro de ventana 24h)
    await fetch(
      `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fromPhone,
          type: 'text',
          text: { body: aiResult.next_message, preview_url: false }
        })
      }
    )

    // Si la conversación está completa, disparar finalizador
    if (aiResult.is_complete) {
      const finalizerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/lead-qualification-finalizer`
      await fetch(finalizerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation_id: conv.id,
          lead_id: conv.lead_id,
          data_extracted: aiResult.data_extracted
        })
      })
    }
  }

  return new Response('OK', { status: 200 })
})
```

**Criterio de aceptación del Slice 3:**
- [ ] EF desplegada: `supabase functions deploy lead-qualification-webhook`
- [ ] Verificación de webhook Meta responde 200 con el challenge
- [ ] Enviar mensaje de prueba desde número de test (Robert: `+573183061286`) → respuesta de OpenRouter aparece en `lead_conversations.messages`
- [ ] Con DRY_RUN=true: historial se actualiza pero NO se envía mensaje a Meta
- [ ] OpenRouter retorna JSON válido con los 4 campos esperados
- [ ] Flujo completo de 4 preguntas funciona sin errores

---

### Slice 4: Finalizador + alertas al comercial + cierre conversación

**Qué incluye:**
- Edge Function `lead-qualification-finalizer`
- Actualización de `opportunities` con datos capturados
- Creación de tarea para el comercial
- Mensaje de cierre al lead

**Edge Function: `lead-qualification-finalizer`**

```typescript
// supabase/functions/lead-qualification-finalizer/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { conversation_id, lead_id, data_extracted } = await req.json()

  // 1. Cargar el lead con su oportunidad asociada y el comercial
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, phone, commercial_id')
    .eq('id', lead_id)
    .single()

  if (!lead) {
    return new Response(JSON.stringify({ error: 'lead not found' }), { status: 404 })
  }

  // 2. Actualizar lead a 'qualified'
  await supabase
    .from('leads')
    .update({ status: 'qualified' })
    .eq('id', lead_id)

  // 3. Buscar o crear opportunity asociada al lead
  const { data: opp } = await supabase
    .from('opportunities')
    .select('id')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let oppId = opp?.id

  if (!oppId) {
    // Si no existe oportunidad, crear una
    const { data: newOpp } = await supabase
      .from('opportunities')
      .insert({
        lead_id: lead_id,
        commercial_id: lead.commercial_id,
        status: 'new',
        qualification_source: 'ia_whatsapp'
      })
      .select('id')
      .single()
    oppId = newOpp?.id
  }

  // 4. Actualizar opportunity con datos capturados
  if (oppId) {
    await supabase
      .from('opportunities')
      .update({
        product_type:         data_extracted.product_type,
        dimensions_approx:    data_extracted.dimensions_approx,
        budget_range:         data_extracted.budget_range,
        urgency_level:        data_extracted.urgency_level,
        qualification_source: 'ia_whatsapp'
      })
      .eq('id', oppId)
  }

  // 5. Crear resumen legible para el comercial
  const resumen = [
    data_extracted.product_type    ? `Producto: ${data_extracted.product_type}` : null,
    data_extracted.dimensions_approx ? `Medidas: ${data_extracted.dimensions_approx}` : null,
    data_extracted.budget_range    ? `Presupuesto: ${data_extracted.budget_range}` : null,
    data_extracted.urgency_level   ? `Urgencia: ${data_extracted.urgency_level}` : null,
  ].filter(Boolean).join(' | ')

  // 6. Crear tarea para el comercial (usando template task_assigned)
  if (lead.commercial_id) {
    // Obtener teléfono del comercial
    const { data: comercialUser } = await supabase
      .from('users')
      .select('whatsapp_phone, name')
      .eq('id', lead.commercial_id)
      .maybeSingle()

    if (comercialUser?.whatsapp_phone) {
      const vencimiento = new Date(Date.now() + 2 * 60 * 60 * 1000)
        .toLocaleDateString('es-CO', { weekday: 'long', hour: '2-digit', minute: '2-digit' })

      const dedupKeyComercial = `calificador:${lead_id}:alerta_comercial:${new Date().toISOString().split('T')[0]}`
      await supabase.from('notification_queue').insert({
        recipient_phone: comercialUser.whatsapp_phone,
        template_name: 'task_assigned',
        template_language: 'es',
        template_parameters: JSON.stringify([
          comercialUser.name ?? 'Equipo',
          `Lead calificado: ${lead.name} — ${resumen}`,
          vencimiento,
          lead.name
        ]),
        status: 'pending',
        dedup_key: dedupKeyComercial
      })
    }
  }

  // 7. Crear tarea interna en tabla tasks
  await supabase.from('tasks').insert({
    title: `Contactar lead calificado: ${lead.name}`,
    description: `Lead calificado por IA. Datos: ${resumen}`,
    assigned_to: lead.commercial_id,
    related_entity: 'lead',
    related_entity_id: lead_id,
    due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    priority: 'high'
  })

  // 8. Mensaje de cierre al lead
  const dedupKeyCierre = `calificador:${lead_id}:cierre:${new Date().toISOString().split('T')[0]}`
  await supabase.from('notification_queue').insert({
    recipient_phone: lead.phone,
    template_name: 'lead_qualification_start_v1', // SOLO si se aprueba un template de cierre
    // Por ahora el mensaje de cierre se envía como texto libre desde el webhook (última respuesta de OpenRouter)
    // Este INSERT es un placeholder — activar cuando exista template de cierre
    status: 'skipped',
    dedup_key: dedupKeyCierre
  })

  // 9. Marcar conversación como completada (ya se hizo en el webhook, esto es doble seguro)
  await supabase
    .from('lead_conversations')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', conversation_id)
    .eq('status', 'active')  // solo si aún está activa (idempotente)

  return new Response(
    JSON.stringify({ success: true, lead_id, opportunity_id: oppId, resumen }),
    { status: 200 }
  )
})
```

**Criterio de aceptación del Slice 4:**
- [ ] EF desplegada: `supabase functions deploy lead-qualification-finalizer`
- [ ] Después de conversación completa: `opportunities` tiene `product_type`, `budget_range`, `urgency_level` y `qualification_source='ia_whatsapp'`
- [ ] `leads.status = 'qualified'` después de finalizar
- [ ] `lead_conversations.status = 'completed'`
- [ ] Comercial recibe WA con resumen del lead en menos de 2 minutos
- [ ] Tarea creada en `tasks` con `priority='high'` y vencimiento 2h
- [ ] Probar con lead de prueba usando teléfono de test (Robert: `3183061286`)

---

## 9. Criterios de aceptación globales

- [ ] **E2E completo:** Lead nuevo creado → 2h sin contacto → WA proactivo enviado → 4 preguntas respondidas → `opportunities` actualizada → Comercial notificado. Todo en menos de 5 minutos desde la última respuesta del lead.
- [ ] **Ventana hábil respetada:** Fuera de L-V 8am-6pm Bogotá, el cron no envía mensajes.
- [ ] **Idempotencia:** Ejecutar el detector 10 veces sobre el mismo lead solo genera 1 mensaje (dedup_key).
- [ ] **DRY_RUN funcional:** Con `QUALIFIER_DRY_RUN=true`, cero mensajes reales a Meta, pero toda la lógica de DB se ejecuta.
- [ ] **Límite de intentos:** Un lead con `qualification_attempts >= 2` nunca vuelve a recibir el template proactivo.
- [ ] **Sin conversaciones huérfanas:** Leads que no respondieron en 48h tienen `lead_conversations.status = 'abandoned'` (job de limpieza, puede ser Slice 5 futuro).
- [ ] **Trazabilidad completa:** `scheduled_job_log` tiene registro de cada ejecución del detector con `rows_processed` correcto.
- [ ] **Error handling:** Si OpenRouter falla, la conversación no queda bloqueada — `lead_conversations` mantiene el historial y puede reintentarse en el próximo mensaje del usuario.
- [ ] **Template Meta aprobado:** `lead_qualification_start_v1` visible en Meta Business Manager con estado `APPROVED` antes de activar en producción.

---

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Meta rechaza el template | Media | Alto | Tener texto alternativo listo. Si se rechaza, replantear categoría (UTILITY en lugar de MARKETING). |
| Lead responde fuera de ventana 24h de Meta | Alta | Medio | OpenRouter detecta en `current_phase` si la conversación quedó a medias. El detector puede reenviar template si pasaron más de 24h y la conv no está completa (Slice 3+). |
| OpenRouter devuelve JSON malformado | Baja | Medio | `try/catch` en el parse. Si falla, log de error y retornar 200 a Meta (para que no reintente). |
| Número de lead no es WhatsApp | Media | Medio | Meta retorna error 131026 ("phone number not on WhatsApp"). Capturar en `whatsapp_message_log`, marcar lead con `qualification_attempts = MAX_ATTEMPTS` para no reintentar. |
| Comercial no tiene `whatsapp_phone` en tabla `users` | Media | Bajo | Fallar silenciosamente en el envío al comercial. Tarea en `tasks` se crea de todas formas. |
| Costo OpenRouter se dispara con muchos leads | Baja | Bajo | DeepSeek cuesta ~$0.001/conversación (4 turnos × ~200 tokens). Con 100 leads/día: ~$0.10/día. Monitorear con `openrouter_per_article_costs` view. |
| Webhook Meta recibe mensajes de otros clientes (no leads) | Alta | Bajo | El webhook busca `lead_conversations` activa por número. Si no existe, retorna 200 silenciosamente — sin efecto secundario. |
| `SUPABASE_SERVICE_ROLE_KEY` no disponible en cron de pg_cron | Media | Alto | Usar `current_setting('app.service_role_key')` en lugar de hardcodear. Verificar que el setting esté configurado en el proyecto Supabase. |

---

## 11. Métricas de éxito

| Métrica | Objetivo | Cómo medirla |
|---------|----------|-------------|
| Tasa de respuesta al primer WA | ≥ 40% | `COUNT(*) WHERE lead_conversations.phase != 'init' / COUNT(*) WHERE phase = 'init'` |
| Tasa de calificación completa | ≥ 60% de los que responden | `COUNT(*) WHERE status='completed' / COUNT(*) WHERE last_message_at IS NOT NULL` |
| Tiempo promedio de calificación | < 15 minutos | `AVG(completed_at - started_at) WHERE status='completed'` |
| Leads calificados con los 4 campos | ≥ 80% de completados | `COUNT(*) WHERE product_type IS NOT NULL AND budget_range IS NOT NULL AND urgency_level IS NOT NULL` en opportunities |
| Tiempo hasta primera llamada del comercial | < 30 min post-calificación | Comparar `lead_conversations.completed_at` vs primera `visits.scheduled_at` |
| Falsos positivos (leads ya contactados que se disparan) | 0 | Monitorear con `leads WHERE last_contacted_at IS NOT NULL AND qualification_attempts > 1` |
| Costo por lead calificado (OpenRouter) | < $0.005 USD | Consultar `openrouter_per_article_costs` filtrando por `model = 'deepseek/deepseek-chat'` y timestamp del agente |

**Query de dashboard para monitoreo semanal:**
```sql
SELECT
  DATE_TRUNC('week', started_at) AS semana,
  COUNT(*) AS conversaciones_iniciadas,
  COUNT(*) FILTER (WHERE status = 'completed') AS calificaciones_completas,
  COUNT(*) FILTER (WHERE status = 'abandoned') AS abandonadas,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) FILTER (WHERE status = 'completed'), 1) AS minutos_promedio,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 1) AS tasa_completado_pct
FROM lead_conversations
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 12. Notas de seguridad y DRY_RUN

### Variables de entorno requeridas en Supabase Vault

```
QUALIFIER_DRY_RUN              = "true"   ← cambiar a "false" solo al activar en producción
WHATSAPP_WEBHOOK_VERIFY_TOKEN  = "<token aleatorio generado con openssl rand -hex 20>"
WHATSAPP_TOKEN                 = "<ya configurado en EFs existentes>"
WHATSAPP_PHONE_NUMBER_ID       = "<ya configurado en EFs existentes>"
OPENROUTER_API_KEY             = "<ya configurado en EFs existentes>"
```

### Protocolo de prueba antes de ir a producción

1. **Smoke test Slice 1:** Ejecutar SQL de migración, verificar tablas y columnas.
2. **Smoke test Slice 2 (DRY_RUN=true):** Crear lead de prueba con `created_at = NOW() - INTERVAL '3 hours'`, invocar EF manualmente. Verificar log de `dry_run_would_send` y que `last_contacted_at` NO se actualiza.
3. **Smoke test Slice 3 (DRY_RUN=true):** Enviar POST simulado al webhook con payload de Meta (usar payload de ejemplo de la documentación de Meta). Verificar que `lead_conversations.messages` se actualiza con respuesta de OpenRouter.
4. **Smoke test E2E con número de test:** Con `QUALIFIER_DRY_RUN=false`, crear lead con teléfono de Robert (`3183061286`). Confirmar recepción del template → responder 4 preguntas → confirmar que `opportunities` queda actualizada.
5. **Activación gradual:** Primer semana, activar solo para leads de una fuente (ej. `source = 'website'`). Expandir a todas las fuentes en semana 2 si métricas son positivas.

### Números de test autorizados
- Robert (dueño): `+573183061286`
- Heduin (QA): `+584127862439`
- NUNCA enviar a leads reales hasta completar los 5 pasos del protocolo de prueba.

### Cómo activar en producción
1. Confirmar que `lead_qualification_start_v1` está en estado `APPROVED` en Meta Business Manager
2. Ejecutar smoke test E2E completo con números de test
3. Cambiar `QUALIFIER_DRY_RUN` de `"true"` a `"false"` en Supabase Vault
4. Monitorear `scheduled_job_log` y `lead_conversations` durante las primeras 4 horas
5. Si hay errores, revertir a `QUALIFIER_DRY_RUN=true` inmediatamente y revisar logs

### Seguridad del webhook
- El webhook de Meta no incluye firma HMAC en todos los tipos de eventos. Verificar si el plan actual de Meta lo incluye y en ese caso validar con `X-Hub-Signature-256`.
- El `VERIFY_TOKEN` es secreto — nunca commitearlo. Vive únicamente en Supabase Vault.
- El endpoint del webhook no requiere autenticación adicional (Meta lo llama directamente), pero sí debe verificar que el `entry[0].id` corresponde al phone_id configurado antes de procesar.
