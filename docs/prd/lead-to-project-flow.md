# PRD: Rediseño del flujo Lead → Visita → Presupuesto → Pago → Proyecto

> **Versión**: 1.0 · **Estado**: Listo para ejecución · **Audiencia**: devs y agentes de IA ejecutores
> **Fuente**: Plan maestro Fase 1 (grill-me completo) — `C:\Users\ceoel\.claude\plans\s-estoy-de-acuerdo-reactive-sundae.md`
> **Idioma de identificadores**: inglés (código/DB) · **Idioma de UI y este documento**: español

---

## 1. Problem Statement

El CRM Innovar tiene tres problemas estructurales en el funnel comercial que rompen la trazabilidad del negocio y bloquean cualquier automatización seria:

1. **Confusión `clients` / leads** — Una misma tabla `clients` representa lead y cliente. La lista de leads (`src/hooks/useLeads.ts`) se construye excluyendo a todo cliente con proyecto, lo que invisibiliza al **cliente recurrente** que vuelve a pedir algo nuevo.
2. **Duplicidad sin deduplicación** — El mismo prospecto que entra por WhatsApp y luego por la web queda como dos registros distintos. No existe constraint de unicidad por teléfono.
3. **Sin atribución de canal** — `clients.data_origin` siempre cae en `'manual'` (es DEFAULT), así que no hay forma de medir qué canal de adquisición convierte mejor.

A esto se suma que el flujo de negocio que el equipo opera de facto (lead → visita de medición → presupuesto versionado → abono → proyecto) **no está representado explícitamente en el schema**: no hay estados como "visita agendada", "presupuestado" o "abonado". Y la carga manual del admin (agendamiento, recordatorios, registro de pagos) consume tiempo que un agente conversacional puede absorber.

---

## 2. Solution

Rediseñar la estructura de datos, los estados y la UI introduciendo:

- **Separación entidad permanente vs intento de venta**: `clients` queda como identidad estable (contacto, dirección); nueva tabla `opportunities` modela cada intento comercial (1 cliente → N oportunidades).
- **Deduplicación por teléfono**: `clients.whatsapp_phone` con UNIQUE constraint sobre normalización a 10 dígitos.
- **Atribución obligatoria de canal**: `opportunities.data_origin` `NOT NULL` con CHECK sobre lista cerrada (`wordpress` | `referido` | `walk-in` | `whatsapp` | `manual`).
- **Visita como entidad de primera clase**: nueva tabla `visits` con modalidad `presencial` o `foto_remota`, ventanas martes/jueves, slots de 1.5h y self-booking público por token.
- **Presupuesto versionado real**: `quotations` ya soporta `version_number` / `parent_quotation_id` / `is_locked` — formalizamos la regla: solo se versiona DESPUÉS de enviar al cliente.
- **Aprobación = pago verificado**: el cliente clickea aprobar + sube comprobante; el admin verifica contra cuenta bancaria; ese acto dispara la creación del proyecto. Sugerido 30% de abono, sin mínimo bloqueante.
- **State machine global** explícita para `opportunities`, `visits`, `quotations` con triggers que sincronizan estados y crean entidades río abajo.
- **Catálogo de 14 agentes/automatizaciones** que reducen carga manual, con A-05 como pieza estrella: chatbot interno + n8n + Whisper + LLM para que el admin envíe audios/texto y el sistema agende visitas, registre pagos y marque oportunidades.

El resultado: trazabilidad uniforme, atribución medible, automatización del trabajo repetitivo, y un funnel que cualquier comercial, cliente o agente puede recorrer sin huecos.

---

## 3. User Stories

### Comercial
- Como **comercial**, quiero que los leads nuevos se me asignen automáticamente por round-robin justo, para no depender de que el admin reparta manualmente.
- Como **comercial**, quiero ver en mi agenda solo las visitas asignadas a mí, en martes y jueves, con 4 slots/día de 1.5h + 30min de gap entre cada uno.
- Como **comercial**, quiero capturar medidas tipadas por servicio durante la visita, espejando los campos de la calculadora correspondiente, para que el presupuesto se autogenere sin recapturar nada.
- Como **comercial**, quiero ver el histórico completo de versiones de presupuesto con comparador lado-a-lado, para defender el precio frente al cliente.
- Como **comercial**, quiero que un cliente recurrente aparezca otra vez en mis leads cuando vuelve a pedir algo, en lugar de quedar oculto porque ya tuvo un proyecto.

### Cliente
- Como **cliente nuevo**, quiero abrir un link público y agendar yo mismo la visita en un slot libre, sin escribir a nadie por WhatsApp.
- Como **cliente que rechaza visita presencial**, quiero subir fotos y medidas por un link público sin agendar slot, para que igual me coticen.
- Como **cliente con cotización en mano**, quiero ver desde un link público SOLO la versión vigente (no el histórico interno) y aprobarla en dos clics + subida de comprobante.
- Como **cliente que pidió cambios**, quiero recibir una nueva versión y que la anterior quede como histórico claro.

### Admin
- Como **admin**, quiero verificar pagos desde el dashboard interno y que esa verificación cree el proyecto automáticamente, sin pasos extra.
- Como **admin**, quiero un warning visible cuando un abono está por debajo del 30% sugerido, pero poder verificarlo igual si el cliente abonó menos.
- Como **admin**, quiero medir % de presupuestos generados con bypass (sin visita previa) para detectar si el proceso se está erosionando.
- Como **admin**, quiero hablarle al chatbot interno por audio diciendo "agéndame visita con Roberto Virona el jueves a las 11" y que el sistema lo haga.
- Como **admin**, quiero que los leads sin movimiento 30 días se marquen como dormidos y a 60 días pasen a `lost` automáticamente.
- Como **admin**, quiero procesar cancelaciones post-pago con devolución calculada según hitos del proyecto (90% / 50% / 0%).

### Equipo de diseño
- Como **diseñador**, quiero ser notificado automáticamente cuando un proyecto nuevo arranca por aprobación de cotización, para empezar el flujo de diseño sin que nadie me avise a mano.

---

## 4. Implementation Decisions

### 4.1 Módulos involucrados

| Capa | Módulo | Cambio |
|---|---|---|
| **DB schema** | `clients` | UNIQUE constraint sobre `whatsapp_phone` normalizado |
| **DB schema** | `opportunities` (nueva) | Entidad principal del funnel comercial |
| **DB schema** | `opportunity_assignment_history` (nueva) | Auditoría de reasignaciones |
| **DB schema** | `visits` (nueva) | Visita como entidad propia con modalidad |
| **DB schema** | `quotations` (existente) | Campos: `change_reason`, `bypassed_visit`, `bypass_reason`, `is_historical_copy` |
| **DB schema** | `payments` (existente) | Campos: `verification_status`, `verified_by`, `verified_at`, `proof_url`, `below_suggested`, `payment_type` (incl. `refund`) |
| **DB schema** | `projects` (existente) | Campos: `materials_purchased_at`, `fabrication_started_at`, `initial_measurements` (JSONB), `approved_quotation_id` (ya existe) |
| **DB schema** | `tasks` (existente) | Sigue siendo espejo de visitas mantenido por trigger; deja de ser fuente de verdad para visitas |
| **DB schema** | `system_settings` (nueva o entry en config existente) | `suggested_min_advance_pct=30` ajustable |
| **Hooks frontend** | `src/hooks/useLeads.ts` | Refactor: lee de `opportunities`, no de `clients` filtrados |
| **Hooks frontend** | `src/hooks/useOpportunities.ts` (nuevo) | CRUD oportunidades + state machine transitions |
| **Hooks frontend** | `src/hooks/useVisits.ts` (nuevo) | Reemplaza progresivamente `src/hooks/agenda/useAppointments.ts` |
| **Hooks frontend** | `src/hooks/agenda/useAvailableSlots.ts` (existente) | Refactor: filtra por comercial asignado de la oportunidad |
| **Hooks frontend** | `src/hooks/useQuotations.ts` (existente) | Añadir `change_reason` al crear versión; helper `useQuotationVersions(rootId)` |
| **Hooks frontend** | `src/hooks/finanzas/useVerifyPayment.ts` (nuevo) | Verificación con upload de comprobante |
| **Schemas Zod** | `src/schemas/opportunity.ts` (nuevo) | Validación opportunity create/update |
| **Schemas Zod** | `src/schemas/visit.ts` (nuevo) | Validación visit + transitions |
| **Schemas Zod** | `src/schemas/measurements/*.ts` (nuevos, 7 archivos) | Un schema por servicio espejando cada calculadora |
| **Schemas Zod** | `src/schemas/payment.ts` (existente) | Añadir `proof_url`, `verification_status` |
| **Páginas** | `src/pages/Leads.tsx` (existente) | Refactor: consume `useOpportunities` |
| **Páginas** | `src/pages/LeadCreate.tsx` (existente) | Sin cambios visuales; lógica: dedup por teléfono + crear opportunity |
| **Páginas** | `src/pages/OpportunityDetail.tsx` (nueva) | Vista 360 con timeline + visitas + cotizaciones |
| **Páginas** | `src/pages/PublicBookVisit.tsx` (nueva, ruta pública) | Self-booking por `opportunity_token` |
| **Páginas** | `src/pages/PublicSubmitMeasurements.tsx` (nueva, ruta pública) | Subida foto-remota por `visit_token` |
| **Páginas** | `src/pages/PublicApproveQuotation.tsx` (refactor/nueva) | Link público para aprobar + subir comprobante |
| **Edge Functions** | `auto_generate_quotation` | Trigger al cerrar visita |
| **Edge Functions** | `convert_quotation_to_project` | Trigger al verificar primer pago |
| **Edge Functions** | `visit_to_task_mirror` | Sincroniza visit ↔ task |
| **Edge Functions** | `assign_commercial_round_robin` | Asignación automática al crear opportunity |
| **Edge Functions** | `dormancy_watcher` | Cron diario 30/60 días |
| **Edge Functions** | `expiry_watcher` | Cron diario para cotizaciones expiradas |
| **Edge Functions** | `no_show_watcher` | Cron horario para visitas sin asistencia |
| **n8n flows** | A-02 Intake WhatsApp | Bot conversacional crea leads |
| **n8n flows** | A-05 Chatbot interno admin ⭐ | Whisper + LLM + acciones DB |
| **n8n flows** | A-06 Recordatorios visita | Cron + WhatsApp API (24h / 2h antes) |

### 4.2 State machine — `opportunities`

| Estado | Quién lo transiciona | Trigger |
|---|---|---|
| `new` | Sistema | Al crear lead |
| `contacted` | Comercial | Manual |
| `visit_scheduled` | Comercial / cliente self-booking / agente A-05 | Insert en `visits` |
| `visit_completed` | Comercial / cliente foto-remota | `visits.status='realizada'` |
| `quoted` | Sistema | Edge function `auto_generate_quotation` |
| `sent_to_client` | Comercial | Manual desde QuotationDetail |
| `client_approved` | Cliente | Click en link público |
| `pending_payment_verification` | Cliente | Upload comprobante |
| `approved` | Admin | Verificar pago |
| `converted_to_project` | Sistema | Edge function `convert_quotation_to_project` |
| `lost` | Comercial / admin / sistema | Manual o cron 60 días |
| `cancelled_after_approval` | Admin | Procesar devolución |

**Flag transversal**: `is_dormant=true` cuando 30 días sin movimiento. NO es estado, es bandera.

**Transiciones permitidas** (definir en edge function `validate_opportunity_transition` o en check constraints):

```
new → contacted, lost
contacted → visit_scheduled, lost
visit_scheduled → visit_completed, lost (no-show repetido)
visit_completed → quoted
quoted → sent_to_client
sent_to_client → client_approved, lost (rechazo), quoted (nueva versión, vuelve a sent_to_client tras revisión)
client_approved → pending_payment_verification, lost (no sube comprobante)
pending_payment_verification → approved, sent_to_client (admin rechaza comprobante)
approved → converted_to_project (automático)
converted_to_project → cancelled_after_approval
cualquiera (no terminal) → lost
```

### 4.3 State machine — `visits`

| Estado | Quién |
|---|---|
| `agendada` | Comercial / cliente self-booking / agente A-05 |
| `confirmada` | Cliente / agente A-05 |
| `realizada` | Comercial (presencial) / cliente (foto_remota) |
| `no_show` | Sistema (cron 2h post-slot) |
| `cancelada` | Cualquiera con motivo |
| `reagendada` | Sistema al cambiar `scheduled_at` (incrementa `reschedule_count`) |

Datos mínimos para `realizada`:
- `measurements` JSONB no vacío (validado contra schema Zod del servicio correspondiente)
- Al menos 3 fotos en `photos[]`

### 4.4 State machine — `quotations`

| Estado | `is_locked` |
|---|---|
| `draft` | false |
| `sent` | true |
| `client_approved` | true |
| `pending_payment_verification` | true |
| `approved` | true (permanente) |
| `expired` | true |
| `rejected` | true |

Regla de versionado: solo se crea nueva versión DESPUÉS de pasar a `sent`. Mientras `draft`, se edita en sitio. Nueva versión: `version_number+1`, `parent_quotation_id` apunta a la previa, la previa pasa a `is_historical_copy=true`.

### 4.5 Schema contracts (alto nivel — el SQL detallado va en Fase 3)

#### Tabla `opportunities`
```
id UUID PK DEFAULT gen_random_uuid()
client_id UUID NOT NULL REFERENCES clients(id)
status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (...))
services TEXT[] NOT NULL CHECK (array_length(services, 1) >= 1)
priority TEXT NOT NULL CHECK (priority IN ('ASAP','SHORT','LON'))
data_origin TEXT NOT NULL CHECK (data_origin IN ('wordpress','referido','walk-in','whatsapp','manual'))
assigned_to UUID REFERENCES profiles(id)
public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex')
notes TEXT
is_dormant BOOLEAN NOT NULL DEFAULT false
last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
lost_reason TEXT
lost_at TIMESTAMPTZ
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at TIMESTAMPTZ
```

Índices: `(client_id)`, `(assigned_to, status)`, `(public_token)`, `(status, is_dormant)`, `(last_activity_at) WHERE deleted_at IS NULL`.

#### Tabla `opportunity_assignment_history`
```
id UUID PK DEFAULT gen_random_uuid()
opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE
from_user UUID REFERENCES profiles(id)
to_user UUID NOT NULL REFERENCES profiles(id)
changed_by UUID NOT NULL REFERENCES profiles(id)
changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
reason TEXT
```

#### Tabla `visits`
```
id UUID PK DEFAULT gen_random_uuid()
opportunity_id UUID NOT NULL REFERENCES opportunities(id)
scheduled_at TIMESTAMPTZ NOT NULL
duration_minutes INTEGER NOT NULL DEFAULT 90
visited_by UUID REFERENCES profiles(id)
modality TEXT NOT NULL CHECK (modality IN ('presencial','foto_remota'))
status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','confirmada','realizada','no_show','cancelada','reagendada'))
scheduled_via TEXT CHECK (scheduled_via IN ('public_link','comercial','agent_a05'))
measurements JSONB
photos JSONB NOT NULL DEFAULT '[]'::jsonb
client_confirmed_at TIMESTAMPTZ
realized_at TIMESTAMPTZ
reschedule_count INTEGER NOT NULL DEFAULT 0
is_exception BOOLEAN NOT NULL DEFAULT false
exception_reason TEXT
public_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex')
notes TEXT
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at TIMESTAMPTZ
```

Constraint: `CHECK (modality = 'foto_remota' OR EXTRACT(DOW FROM scheduled_at) IN (2,4) OR is_exception=true)`.

Índices: `(opportunity_id)`, `(visited_by, scheduled_at)`, `(status, scheduled_at)`, `(public_token)`.

#### Cambios en `clients`
```
ALTER TABLE clients ADD CONSTRAINT clients_whatsapp_phone_unique UNIQUE (whatsapp_phone);
-- Antes: normalizar la columna a 10 dígitos en un backfill no destructivo.
```
Se ELIMINA la lógica de `data_origin` de `clients` (queda en `opportunities`).

#### Cambios en `quotations`
```
ALTER TABLE quotations
  ADD COLUMN change_reason TEXT,
  ADD COLUMN bypassed_visit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN bypass_reason TEXT,
  ADD COLUMN is_historical_copy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN opportunity_id UUID REFERENCES opportunities(id),
  ADD COLUMN quotation_type TEXT NOT NULL DEFAULT 'initial' CHECK (quotation_type IN ('initial','addendum')),
  ADD COLUMN project_id UUID REFERENCES projects(id),  -- solo para addendums
  ADD COLUMN valid_until TIMESTAMPTZ;
```

#### Cambios en `payments`
```
ALTER TABLE payments
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  ADD COLUMN verified_by UUID REFERENCES profiles(id),
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN proof_url TEXT,  -- NOT NULL solo para verification_status='verified'
  ADD COLUMN below_suggested BOOLEAN,
  ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'advance' CHECK (payment_type IN ('advance','installment','final','refund'));
```

#### Cambios en `projects`
```
ALTER TABLE projects
  ADD COLUMN materials_purchased_at TIMESTAMPTZ,
  ADD COLUMN fabrication_started_at TIMESTAMPTZ,
  ADD COLUMN initial_measurements JSONB;
-- approved_quotation_id ya existe.
```

### 4.6 Edge Functions y triggers críticos

| Function | Disparador | Acción resumida |
|---|---|---|
| `auto_generate_quotation` | AFTER UPDATE en `visits` cuando `status` cambia a `realizada` | Lee `measurements`, llama a calculadoras compartidas, crea `quotations` v1 draft, notifica al comercial |
| `convert_quotation_to_project` | AFTER UPDATE en `payments` cuando `verification_status='verified'` Y es el primer pago verificado de esa cotización | Crea `projects`, bloquea `quotations.is_locked=true`, `quotations.status='approved'`, `opportunities.status='converted_to_project'` |
| `visit_to_task_mirror` | AFTER INSERT/UPDATE en `visits` | Sincroniza fila espejo en `tasks` con `appointment_type='visita'` |
| `assign_commercial_round_robin` | BEFORE INSERT en `opportunities` cuando `assigned_to IS NULL` | Round-robin entre `profiles WHERE role='comercial' AND is_active=true`, ordenado por menos leads recibidos en últimas 24h, excluyendo quienes tengan `holiday` ese día |
| `dormancy_watcher` | Cron diario 6am | `is_dormant=true` a los 30 días sin cambio; `status='lost'` con `lost_reason='abandono_silencio'` a los 60 días |
| `expiry_watcher` | Cron diario 6am | `quotations.status='expired'` cuando `valid_until < now()` |
| `no_show_watcher` | Cron horario | `visits.status='no_show'` cuando `scheduled_at + 2h < now()` y sigue en `agendada` |
| `validate_opportunity_transition` | BEFORE UPDATE en `opportunities` cuando cambia `status` | Rechaza transiciones no permitidas según la tabla de 4.2 |

### 4.7 Calculadoras compartidas

Extraer la lógica de las 7 calculadoras existentes (`src/hooks/use-{service}-calculator.ts`) a `src/lib/calculators/{service}.ts` para que sea reusable server-side desde la edge function `auto_generate_quotation`. La función edge llama a la lógica TS compilada a JS distribuida con la function.

Los 7 servicios: `kitchen`, `closet`, `tv_center`, `hardware`, `mesones`, `doors`, `special_finishes`.

### 4.8 Capacidad de slots de visita

- Días: solo martes (DOW=2) y jueves (DOW=4)
- Slots por día por comercial: 4 ventanas de 1.5h
  - 09:00–10:30
  - 11:00–12:30
  - 13:30–15:00
  - 15:30–17:00
- Gap entre slots: 30 minutos (incluido en la grilla)
- Capacidad total semanal = `4 × N_comerciales_activos × 2`
- `useAvailableSlots(opportunityId)` filtra por `opportunities.assigned_to` y excluye slots tomados o caídos en `holidays`/vacaciones del comercial.

### 4.9 Política de devolución

Calculada por edge function `calculate_refund_percentage(project_id)`:

| Hito | % devolvible |
|---|---|
| `materials_purchased_at IS NULL` Y `created_at >= now() - interval '7 days'` | 90% |
| `materials_purchased_at IS NOT NULL` Y `fabrication_started_at IS NULL` | 50% |
| `fabrication_started_at IS NOT NULL` | 0% |

Devolución registrada como nueva fila en `payments` con `payment_type='refund'`, `amount` negativo.

### 4.10 Agente A-05 ⭐

**Arquitectura**: chatbot widget embebido en el CRM → webhook a n8n → Whisper transcribe → LLM interpreta intención → ejecuta vía Supabase REST o llama edge functions.

**Acciones que A-05 puede ejecutar**:
- Agendar / reagendar / cancelar visita (`scheduled_via='agent_a05'`)
- Registrar pago / abono (genera fila en `payments`, deja `verification_status='pending'`)
- Enviar recordatorio manual al cliente
- Marcar oportunidad como `lost` con `lost_reason`

**Auth**: el chatbot solo aparece para perfiles `role IN ('admin','super_admin')`. Cada request lleva JWT del usuario y n8n valida antes de ejecutar.

**Audit**: cada acción ejecutada por A-05 deja registro en una tabla `agent_actions_log` (definir en Fase 3) con `user_id`, `intent`, `payload`, `result`, `created_at`.

### 4.11 Catálogo de 14 agentes

| ID | Agente | Tipo | Slice de implementación |
|---|---|---|---|
| A-01 | Webhook WordPress → Lead | Edge Function | 7 |
| A-02 | Intake WhatsApp (bot) | n8n flow | 7 |
| A-03 | Deduplicador por teléfono | DB trigger BEFORE INSERT | 1 |
| A-04 | Notificador de nuevo lead | Edge Function + WhatsApp API | 7 |
| **A-05 ⭐** | **Chatbot interno admin** | Widget + n8n + Whisper + LLM | 7+ |
| A-06 | Recordatorios de visita 24h/2h | Cron + WhatsApp API | 3 |
| A-07 | Detector de no-show | Cron horario | 3 |
| A-08 | `visit_to_task_mirror` | DB trigger | 1 |
| A-09 | `expiry_watcher` quotations | Cron diario | 4 |
| A-10 | `auto_generate_quotation` | DB trigger + Edge Function | 4 |
| A-11 | `convert_quotation_to_project` | DB trigger | 6 |
| A-12 | `dormancy_watcher` | Cron diario | 7 |
| A-13 | Cálculo de % devolvible | Edge Function | 7 |
| A-14 | Round-robin asignación comercial | Edge Function / DB trigger | 1 |

### 4.12 Slices de ejecución (Fase 5)

| Slice | Entrega | Criterio de paso |
|---|---|---|
| 1 | Esqueleto de datos: `opportunities`, `opportunity_assignment_history`, deduplicador A-03, round-robin A-14, mirror A-08. Migración NO destructiva. | Migración aplicada en staging sin afectar UI existente. Backfill de `clients` ejecutado. |
| 2 | Refactor de `src/pages/Leads.tsx` para consumir `useOpportunities`. Recurring clients vuelven a aparecer. State machine inicial. | Comerciales validan que ven todos los leads (recurrentes incluidos). |
| 3 | Calendario + visita: `visits`, `useVisits`, `useAvailableSlots` refactor, `PublicBookVisit`, recordatorios A-06, no-show A-07. | Cliente puede agendarse solo, comercial ve agenda filtrada por sí mismo. |
| 4 | Mediciones + fotos: `PublicSubmitMeasurements`, schemas Zod de medidas, upload a Storage, validación mínima para `realizada`. | Visita presencial Y foto-remota cierran con validación; medidas se guardan tipadas. |
| 5 | Versiones de presupuesto: `change_reason`, comparador lado-a-lado, locking estricto, `auto_generate_quotation` A-10, `expiry_watcher` A-09. | Comercial puede crear v2/v3, comparar, expirar y reactivar. |
| 6 | Aprobación + abono + conversión: `PublicApproveQuotation`, upload comprobante, dashboard verificación admin, `convert_quotation_to_project` A-11. | Cliente aprueba, sube comprobante, admin verifica, proyecto se crea solo. |
| 7+ | Agentes restantes uno por uno: A-01, A-02, A-04, A-12, A-13, **A-05 estrella**. | Cada agente con su QA antes del siguiente. |

Cada slice se construye, sube a producción y prueba con clientes reales antes del siguiente.

### 4.13 RLS

Reglas mínimas (definir SQL exacto en Fase 3):

- `opportunities`: SELECT/UPDATE solo si `assigned_to = auth.uid()` OR `role IN ('admin','super_admin')`.
- `visits`: SELECT/UPDATE solo si `visited_by = auth.uid()` OR EXISTS opportunity asignada al usuario OR es admin.
- Rutas públicas (`/agendar/:token`, `/medidas/:token`, `/cotizacion/:token/aprobar`): se accede vía Supabase RPC con SECURITY DEFINER que valida el token y bypass de RLS para esa operación específica.
- `payments`: INSERT permitido al rol `comercial` para su oportunidad; `verification_status='verified'` solo lo cambia `admin`.

### 4.14 UI — convenciones a respetar

Seguir `docs/CONVENTIONS.md`:
- Errores con `mapSupabaseError` + `notifyError`
- Toda escritura validada con Zod
- `retry: 0`, `staleTime` explícito en queries
- Tokens de diseño (`bg-card`, `text-primary`), nunca hex inline
- Mensajes UI en español, identificadores en inglés
- Mínimo privilegio: rol default `'comercial'`

### 4.15 Tokens y links públicos

Generación de tokens públicos: `encode(gen_random_bytes(16),'hex')` (32 chars). No es JWT, es opaco. Se valida vía RPC `validate_public_token(token, scope)` con `scope IN ('book_visit','submit_measurements','approve_quotation')`.

Expiración:
- `opportunity.public_token` para agendar: válido mientras `status IN ('new','contacted')`
- `visit.public_token` para foto-remota: válido mientras `modality='foto_remota' AND status='agendada'`
- `quotation.public_token` para aprobar: válido mientras `status='sent' AND valid_until > now()`

---

## 5. Testing Decisions

### 5.1 Verificación end-to-end (manual con clientes reales)

Cada slice se prueba con 2-3 oportunidades reales antes de pasar al siguiente. Casos críticos:

**Camino feliz** (debe funcionar de extremo a extremo al cerrar Slice 6):
1. Lead entra por WordPress → `client` creado / reutilizado + `opportunity` con `data_origin='wordpress'`, asignado por round-robin.
2. Comercial llama, marca `contacted`.
3. Cliente se agenda solo desde link público → slot tomado martes 11:00.
4. Comercial llega, captura medidas cocina + 5 fotos → `visit.status='realizada'`.
5. Trigger genera `quotation` v1 draft → comercial revisa, ajusta, envía → `status='sent'`.
6. Cliente clickea aprobar + sube comprobante 30%.
7. Admin verifica pago → `payment.verified=true` → trigger crea `project`.
8. `opportunity.status='converted_to_project'`, `quotation.is_locked=true`.

**Caminos alternativos** (deben todos cubrirse antes de cerrar Fase 5):
- Lead duplicado por teléfono → NO crea `client` nuevo, crea segunda `opportunity` ligada al existente.
- Cliente recurrente (ya tuvo proyecto, vuelve a pedir) → aparece en `Leads.tsx` como oportunidad nueva.
- Cliente rechaza visita presencial → `visit.modality='foto_remota'`, link público al cliente, cierre cuando suba todo.
- Cliente pide cambios tras recibir presupuesto → se crea v2 con `change_reason`, v1 queda histórica.
- Presupuesto vence 30 días sin respuesta → `expired` automático, comercial reactiva con nueva versión.
- Cliente paga 15% (debajo del 30% sugerido) → admin ve warning, verifica igual, proyecto se crea con `below_suggested=true`.
- Cliente cancela 5 días después del proyecto (sin materiales) → devolución 90% calculada por A-13.
- Lead sin movimiento 35 días → `is_dormant=true` + notificación. Día 65 → `status='lost'`.
- Admin override para presupuesto sin visita (caso VIP) → `quotation.bypassed_visit=true` con motivo.
- Agente A-05: admin manda audio "agéndame visita con Roberto Virona el jueves a las 11" → n8n transcribe, crea visit con `scheduled_via='agent_a05'`.
- Reasignación manual de comercial → fila en `opportunity_assignment_history`.

### 5.2 Tests automatizados mínimos

No se exige cobertura completa, pero antes de mergear cada slice:

- **Tests de schemas Zod** (Jest/Vitest): validar que cada schema rechaza inputs malformados y acepta inputs válidos.
- **Tests de transitions** (Jest/Vitest): tabla de `(estado_actual, intento) → (válido | rechazado)` para `opportunities`, `visits`, `quotations`.
- **Tests de edge functions** (Deno test runner de Supabase): mocks de DB, validar branches críticos de `auto_generate_quotation` y `convert_quotation_to_project`.
- **Tests de round-robin** (`assign_commercial_round_robin`): inputs sintéticos con 3 comerciales y verificar distribución uniforme bajo carga.

### 5.3 QA pre-deploy (Fase 6 — `deploy-check`)

Antes de cada deploy de slice:
- [ ] Migración SQL probada en staging
- [ ] Backfill no destructivo verificado
- [ ] RLS revisada (intentar acceso cruzado entre comerciales)
- [ ] Tokens públicos no expuestos en logs
- [ ] Build pasa (`npm run build`)
- [ ] Tipos de DB regenerados (`supabase gen types`)
- [ ] Variables de entorno en Vercel actualizadas si aplica
- [ ] Plan de rollback documentado (cómo revertir migración)

---

## 6. Out of Scope

Explícitamente NO entra en este flujo:

- **Flujo de diseño** post-conversión a proyecto (entrega de planos, revisiones del diseñador) — se aborda en un PRD futuro.
- **Flujo de producción / fabricación** (control de inventario por proyecto, partes de obra) — futuro.
- **Flujo de entrega / instalación / postventa** — futuro.
- **Migración masiva de leads históricos** de fuentes externas a la nueva estructura — se hará un script puntual cuando aplique, fuera de los slices.
- **Reportes / dashboards de conversión por canal** — se pueden montar después con los datos que este PRD ya estructura (`data_origin`, estados terminales).
- **Integración con Telegram** para el agente A-05 — descartada en grill; A-05 vive dentro del CRM como chatbot interno.
- **App móvil nativa** para comerciales en visita — se sigue usando la PWA actual.
- **Pagos en línea** (pasarela tipo PSE, Wompi) — el cliente sigue subiendo comprobante manual; integración con pasarela queda fuera.
- **Firma digital del cliente** sobre la cotización aprobada — no se exige; el comprobante de pago verificado es el commitment.
- **Multi-tenant / multi-empresa** — Innovar opera como una sola empresa.

---

## 7. Further Notes

### 7.1 Open questions (resolver en Fase 3 — `supabase-schema`)

- **Normalización del teléfono**: ¿strip de espacios y guiones se hace en trigger BEFORE INSERT o en aplicación? Recomendado: ambos (defense in depth), pero el constraint UNIQUE vive sobre la columna normalizada.
- **Tabla `agent_actions_log`**: definir columnas exactas (¿`intent` enum o text libre?), retención (¿90 días?).
- **`system_settings` vs config en código**: el `suggested_min_advance_pct` puede vivir en una tabla `system_settings(key, value)` o en una constante. Recomendado: tabla, para que el admin la edite sin deploy.
- **Capacidad horaria del Storage** para fotos: cuántas fotos máximo por visita (recomendado 20), tamaño máx por foto (recomendado 5MB), compresión client-side antes de upload.

### 7.2 Riesgos

| Riesgo | Mitigación |
|---|---|
| Refactor de `useLeads` rompe la UI existente durante Slice 2 | Slice 1 deja datos en `opportunities` sin tocar UI; Slice 2 hace cutover atómico con feature flag. |
| Triggers de DB cascada (visit → quotation → project) generan bucles | Cada trigger valida idempotencia (`IF NOT EXISTS` antes de crear). Tests específicos en Fase 3. |
| Cliente sube fotos pesadas, Storage se llena | Compresión client-side + límite duro por visita en validación Zod. |
| Tokens públicos filtrados (por captura de pantalla, etc.) | Tokens scoped + revocables (`opportunity.public_token` se regenera si el comercial detecta abuso). |
| n8n down → A-05 no responde | Chatbot UI muestra "agente temporalmente offline, usa el formulario manual"; n8n con health-check en `mcp__n8n-mcp__n8n_health_check`. |
| Cliente recurrente confuso ("¿por qué aparezco como lead?") | UI muestra badge "Cliente recurrente — N proyectos anteriores" en la vista de oportunidad. |

### 7.3 Dependencias

- **Supabase MCP**: NO tiene acceso a Innovar (`xdzbjptozeqcbnaqhtye`). Todas las migraciones SQL se aplican vía dashboard o vía Management API con el PAT del `.env`. Patrón documentado en memoria `reference-innovar-management-api`.
- **WhatsApp Business API**: requerida para A-06 (recordatorios) y A-04 (notificación nuevo lead). Confirmar cuenta y plantillas aprobadas antes de Slice 3.
- **n8n self-hosted o cloud**: requerido para A-02 (intake WhatsApp) y A-05 (chatbot admin). MCP `mcp__n8n-mcp` disponible.
- **Whisper API** (OpenAI o local): requerido para A-05. Definir proveedor antes de Slice 7+.
- **WordPress form**: el sitio web actual de Innovar debe modificarse para hacer POST al webhook A-01. Coordinar con quien mantiene el sitio.

### 7.4 Métricas de éxito

Medibles a partir de Slice 2 en adelante:

- **Tasa de duplicados detectados** (`opportunities` ligadas a `client_id` con >1 oportunidad histórica) — esperado: >5% inicial, valida que A-03 funciona.
- **Distribución por `data_origin`** — esperado: ya no >95% en `manual`, sino reparto real entre los 5 canales.
- **% leads asignados automáticamente** vs reasignados manualmente — esperado: >80% sin intervención.
- **Tiempo medio de `new` → `visit_scheduled`** — base actual desconocida, medir y reducir.
- **% visitas con `modality='foto_remota'`** — esperado: 10-20% (depende del segmento).
- **% presupuestos generados con bypass de visita** — alarma si >5%.
- **Tiempo medio de `sent_to_client` → `approved`** — base actual desconocida.
- **% pagos verificados `below_suggested=true`** — visibilidad sobre flexibilidad real del negocio.
- **% leads `lost` por dormancy** (vs lost por motivo explícito) — alarma si >40%, indica seguimiento débil.
- **Uso de A-05** (acciones/semana ejecutadas por chatbot) — KPI de adopción del agente estrella.

### 7.5 Próximos pasos (transición a Fase 3)

Al aprobarse este PRD:

1. **Fase 3 — `supabase-schema`**: producir migración SQL completa en `db/migrations/008_lead_to_project_flow.sql` (o múltiples archivos numerados secuencialmente) con tablas, constraints, índices, RLS, edge functions y triggers.
2. **Fase 4 — `improve-codebase-architecture`**: mapear refactor de frontend (qué hooks, qué páginas, qué carpetas nuevas), donde encajan los Edge Functions, decidir si extraer calculadoras a `src/lib/calculators/`.
3. **Fase 5 — Ejecución de 7 slices**: PR por slice, deploy independiente, prueba con clientes reales.
4. **Fase 6 — `deploy-check`** antes de cada release de slice.

---

## 8. Apéndice: referencias rápidas

- **Plan maestro Fase 1**: `C:\Users\ceoel\.claude\plans\s-estoy-de-acuerdo-reactive-sundae.md`
- **Convenciones de código**: `docs/CONVENTIONS.md`
- **Arquitectura actual**: `docs/ARCHITECTURE.md`
- **Schema actual**: `db/supabase_schema.sql`
- **Patrón Management API para SQL en Innovar**: memoria `reference-innovar-management-api`
- **Convenciones de agencia (proyectos agénticos)**: `C:\Users\ceoel\.claude\conventions\agentic-automations.md`

**Fin del PRD v1.0** — Listo para Fase 3.
