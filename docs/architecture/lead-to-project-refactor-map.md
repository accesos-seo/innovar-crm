# Refactor Map — Flujo Lead → Visita → Presupuesto → Pago → Proyecto

> **Versión**: 1.0 · **Audiencia**: devs y agentes IA ejecutores · **Fase**: 4 (post-PRD, pre-ejecución)
> **Inputs**: [PRD lead-to-project-flow.md](../prd/lead-to-project-flow.md) + migraciones `db/migrations/008–012`
> **Convenciones obligatorias**: [docs/CONVENTIONS.md](../CONVENTIONS.md)

Este documento mapea el rediseño al árbol de carpetas actual: qué se crea, qué se modifica, qué se mueve, qué se elimina. Sigue el orden de los 7 slices del PRD.

---

## 0. Principios de arquitectura para este refactor

Los principios que aplican a cada decisión de abajo:

1. **Módulos profundos sobre módulos finos**. Un hook `useOpportunities` que devuelva `{leads, isLoading, transitions, currentUser}` con la lógica de RLS / state machine adentro es más profundo —y mejor— que diez hooks pequeños que el caller tiene que orquestar.
2. **Una sola fuente de verdad por entidad**. `opportunities` es la fuente de verdad del funnel comercial; `visits` lo es de las visitas; `tasks` queda como espejo automático. Ningún componente lee de dos fuentes y resuelve conflictos.
3. **Validación en escritura, no en lectura**. Toda mutation pasa por Zod schema antes de tocar Supabase. La lectura confía en el contrato del schema de DB (validado por triggers).
4. **Errores explícitos con `mapSupabaseError`**. Nunca silenciar. Nunca `as any` para evadir tipos. Hooks tipan su retorno (`Promise<Opportunity[]>`).
5. **Feature flag granular para el cutover**. La UI vieja y la nueva conviven detrás de un flag por slice. Cutover atómico cuando el flag se quita.
6. **Calculadoras compartibles entre cliente y server**. La lógica vive en `src/lib/calculators/` puro TS, importable tanto desde React hooks como desde Edge Functions Deno.
7. **Rutas públicas separadas de las autenticadas**. `/agendar/:token`, `/medidas/:token`, `/cotizacion/:token/aprobar` viven fuera de `<ProtectedRoute>` y usan RPC `validate_public_token` para resolverse.

---

## 1. Hooks — nuevos y refactorizados

### 1.1 Nuevos hooks

| Hook | Propósito | Slice |
|---|---|---|
| `src/hooks/useOpportunities.ts` | CRUD de oportunidades + filtros + paginación + transiciones de estado. Reemplaza la lógica filtrada de `useLeads`. | 1, 2 |
| `src/hooks/useOpportunity.ts` | Detalle 360° de una oportunidad: cliente + visitas + cotizaciones + pagos + assignment history. | 2 |
| `src/hooks/useOpportunityTransition.ts` | Mutation única para cambiar `status` validando la state machine en cliente antes del trip al servidor. | 2 |
| `src/hooks/useReassignOpportunity.ts` | Reasignar comercial (solo admin). Registra en `opportunity_assignment_history`. | 2 |
| `src/hooks/agenda/useVisits.ts` | CRUD de visitas + queries por comercial/cliente/rango. Reemplaza progresivamente `useAppointments`. | 3 |
| `src/hooks/agenda/useBookVisit.ts` | Mutation: tomar slot. Valida martes/jueves + slot disponible. Soporta `scheduled_via='comercial'\|'public_link'\|'agent_a05'`. | 3 |
| `src/hooks/agenda/useVisitSlots.ts` | Wrapper de la RPC `get_visit_slots(commercial_id, from, to)`. Filtra por `assigned_to` de la oportunidad. | 3 |
| `src/hooks/agenda/useCompleteVisit.ts` | Cierre de visita: valida ≥3 fotos + `measurements` no vacío + dispara espejo a tasks (vía trigger DB) + dispara auto-quotation. | 4 |
| `src/hooks/useMeasurements.ts` | Helper para componer / validar el JSONB `measurements` por servicio. Internamente delega a `src/schemas/measurements/*.ts`. | 4 |
| `src/hooks/useVisitPhotos.ts` | Upload a Supabase Storage + compresión client-side + actualización de `visits.photos[]`. | 4 |
| `src/hooks/useQuotationVersions.ts` | Lista las versiones de una cotización dado el root (parent_quotation_id o id). Para histórico + comparador. | 5 |
| `src/hooks/useQuotationDiff.ts` | Calcula diff entre dos versiones (items agregados/quitados/cambiados). Pure derivation, sin Supabase. | 5 |
| `src/hooks/useCreateQuotationVersion.ts` | Mutation: clona una cotización enviada como v+1 con `change_reason` obligatorio. Marca la previa `is_historical_copy=true` (vía trigger). | 5 |
| `src/hooks/useApproveQuotationPublic.ts` | Mutation pública (sin auth): valida token + cambia status a `client_approved`. Llama a RPC SECURITY DEFINER. | 6 |
| `src/hooks/finanzas/useUploadPaymentProof.ts` | Upload comprobante a Supabase Storage + crea `payments` con `verification_status='pending'`. | 6 |
| `src/hooks/finanzas/useVerifyPayment.ts` | Mutation admin: cambia `verification_status='verified'`. Dispara trigger `convert_quotation_to_project`. | 6 |
| `src/hooks/finanzas/useRejectPayment.ts` | Mutation admin: cambia `verification_status='rejected'` + devuelve oportunidad a `sent_to_client`. | 6 |
| `src/hooks/finanzas/useRefund.ts` | Procesa cancelación post-pago: llama RPC `calculate_refund_percentage` + crea `payments` con `payment_type='refund'`. | 7 |
| `src/hooks/useAgentActions.ts` | Lectura del log `agent_actions_log` (solo admin o propio user). Para auditoría de A-05. | 7 |
| `src/hooks/useSystemSettings.ts` | Lectura + write de `system_settings`. Cacheo agresivo (`staleTime: 1h`). | 5 |

### 1.2 Hooks refactorizados (cambios significativos)

| Hook | Cambio | Slice |
|---|---|---|
| `src/hooks/useLeads.ts` | **Refactor profundo**. Pasa a ser wrapper delgado sobre `useOpportunities` o se elimina. La lógica de filtrar clients con proyectos (líneas 32-46) desaparece — `opportunities` ya separa lead vs cliente. Compatibilidad: durante feature flag, expone la misma API que hoy (`leads`, `totalCount`, `deleteLeads`, `createLead`) pero internamente lee/escribe en `opportunities`. | 2 |
| `src/hooks/useQuotations.ts` | Agregar `change_reason` al crear nueva versión. Filtrar `is_historical_copy=true` por defecto. Nueva mutation `bypassVisit` (solo admin) que setea `bypassed_visit=true`. | 5 |
| `src/hooks/agenda/useAppointments.ts` | **Deprecar**. Sigue funcionando contra `tasks` durante slices 1-2 (mientras el espejo está activo). En slice 3 se reemplazan los callsites por `useVisits`. Eliminar tras slice 3. | 3 |
| `src/hooks/agenda/useAvailableSlots.ts` | Refactor: ahora llama a RPC `get_visit_slots(opportunity.assigned_to, from, to)` en lugar de calcular client-side. Recibe `opportunityId` y resuelve el comercial. | 3 |
| `src/hooks/agenda/useBookAppointment.ts` | Renombrar / migrar a `useBookVisit`. La firma cambia: ahora exige `opportunityId` y `modality`. | 3 |
| `src/hooks/agenda/useCompleteAppointment.ts` | Migrar lógica a `useCompleteVisit` con validación de ≥3 fotos + `measurements`. | 4 |
| `src/hooks/useClients.ts` | Sin cambios estructurales. Sigue siendo CRUD de la entidad permanente. La pantalla `Clients.tsx` deja de mostrar leads (porque ya tienen su propia ruta). | 2 |
| `src/hooks/useProjects.ts` | Agregar campos nuevos: `materials_purchased_at`, `fabrication_started_at`, `opportunity_id`. Mutation `markMaterialsPurchased`, `markFabricationStarted` para el cálculo de devolución. | 7 |

### 1.3 Hooks que se eliminan tras el cutover

- `src/hooks/agenda/useAppointments.ts` — reemplazado por `useVisits` (mantener temporalmente como wrapper, eliminar tras slice 3 estable).
- `src/hooks/agenda/useClientsWithActiveAppointment.ts` — la fuente de verdad cambia a `opportunities.status='visit_scheduled'`.

---

## 2. Páginas — nuevas y modificadas

### 2.1 Páginas nuevas

| Página | Ruta | Protección | Propósito | Slice |
|---|---|---|---|---|
| `src/pages/OpportunityDetail.tsx` | `/leads/:id` (o `/opportunities/:id`) | Authenticated | Vista 360°: timeline de transiciones, cliente, visitas, cotizaciones, pagos, historial de reasignaciones, acciones contextuales según `status`. | 2 |
| `src/pages/public/BookVisit.tsx` | `/agendar/:token` | **Pública** | Self-booking: lee oportunidad vía RPC `validate_public_token`, muestra slots disponibles del comercial asignado, agenda. | 3 |
| `src/pages/public/SubmitMeasurements.tsx` | `/medidas/:token` | **Pública** | Foto-remota: valida token, formulario por servicio (`measurements` tipado) + uploads, cierra visita. | 4 |
| `src/pages/public/ApproveQuotation.tsx` | `/cotizacion/:token` | **Pública** | Cliente ve la versión vigente, dos acciones: "Pedir cambios" (queda en pending interno) o "Aprobar + subir comprobante". | 6 |
| `src/pages/QuotationCompare.tsx` | `/quotations/compare/:id1/:id2` | Authenticated | Comparador lado-a-lado de dos versiones. Usa `useQuotationDiff`. | 5 |
| `src/pages/admin/PaymentVerification.tsx` | `/admin/payments/verification` | Admin only | Dashboard de pagos pendientes de verificación: comprobante, monto vs sugerido, botones verificar/rechazar. | 6 |
| `src/pages/admin/AgentActionsLog.tsx` | `/admin/agent-log` | Admin only | Lectura del `agent_actions_log`, filtros por agente / usuario / fecha / status. | 7 |
| `src/pages/admin/SystemSettings.tsx` | `/admin/settings/system` | Admin only | Editar entradas de `system_settings` (sugerido %, slots, política devolución). | 5 |

### 2.2 Páginas modificadas

| Página | Cambio | Slice |
|---|---|---|
| `src/pages/Leads.tsx` | **Cambio profundo**. Lee de `useOpportunities`. Muestra todos (incluido clientes recurrentes con badge "Cliente recurrente · N proyectos"). Columnas nuevas: `data_origin`, `priority`, `assigned_to`, `is_dormant`. Filtros: por canal, urgencia, asignado, dormant. | 2 |
| `src/pages/LeadCreate.tsx` | **Cambio quirúrgico, UI idéntica**. Los 10 campos del formulario quedan exactamente como están. La submission ahora: (1) llama RPC `find_or_create_client_by_phone(phone, name, ...)` que dedupe, (2) crea `opportunities` con `data_origin` + `services` + `priority`. El `assigned_to` lo pone el trigger round-robin. | 2 |
| `src/pages/QuotationDetail.tsx` | Pestaña "Histórico" visible solo a internos (admin/comercial). Botón "Crear nueva versión" exige `change_reason` modal. Botón "Generar sin visita" solo admin, exige `bypass_reason`. Link al comparador. | 5 |
| `src/pages/Quotations.tsx` | Filtros por `quotation_type` (initial/addendum). Indicador visual de cotizaciones expiradas (badge). | 5 |
| `src/pages/Agenda.tsx` | Reemplaza fuente: `useVisits` en lugar de `useAppointments`. Cada celda enlaza al `OpportunityDetail`. | 3 |
| `src/pages/ProjectDetail.tsx` | Botones nuevos: "Marcar materiales comprados", "Marcar fabricación iniciada", "Procesar cancelación con devolución" (muestra % calculado). Vista de addendums asociados con total acumulado real. | 7 |
| `src/pages/Pagos.tsx` | Columna `verification_status` con badges. Para admin, link directo al dashboard de verificación. | 6 |
| `src/pages/Clients.tsx` | Quita confusión lead/cliente. Solo entidades permanentes. Ficha del cliente muestra "Oportunidades históricas" (N) y "Proyectos" (N). | 2 |

### 2.3 Páginas que NO cambian (verificar tras refactor)

- `Dashboard.tsx`, `Login.tsx`, `Profile.tsx`, `Settings.tsx`
- Calculadoras: `QuotationCreate.tsx`, `PricingCreate.tsx`
- Inventario/Gastos/Cierres: solo agregar columnas si aplica, no rediseño

---

## 3. Edge Functions (Supabase) y n8n flows

### 3.1 Edge Functions

Supabase no tiene `supabase/` en este repo todavía — se crea como parte de Slice 1. Estructura propuesta:

```
supabase/
└── functions/
    ├── _shared/
    │   ├── supabase-admin.ts        # cliente con service_role para bypass de RLS
    │   ├── cors.ts                  # headers para preflight
    │   ├── calculators/             # importa de src/lib/calculators/ (vía symlink o copia)
    │   └── webhook-signature.ts     # validación HMAC para webhooks externos
    ├── auto-generate-quotation/
    │   └── index.ts                 # A-10: dispara por Database Webhook al INSERT de quotations
    ├── wp-lead-webhook/
    │   └── index.ts                 # A-01: recibe POST de WordPress, crea client+opportunity
    ├── notify-new-lead/
    │   └── index.ts                 # A-04: encola mensaje en notification_queue
    ├── refund-calculator/
    │   └── index.ts                 # A-13: wrapper sobre RPC calculate_refund_percentage (para que el front llame REST)
    └── agent-a05-callback/
        └── index.ts                 # A-05: recibe respuesta de n8n y registra en agent_actions_log
```

Las que son **puro SQL** (triggers en DB) no necesitan Edge Function:
- A-03 (deduplicador) → trigger BEFORE INSERT en clients (a definir en slice 1)
- A-08 (visit_to_task_mirror) → ya está en `009_lead_to_project_functions.sql`
- A-11 (convert_quotation_to_project) → ya está en `009_lead_to_project_functions.sql`
- A-14 (round-robin) → ya está en `009_lead_to_project_functions.sql`

Las que son **cron jobs** se implementan vía `pg_cron`:
- A-07 (no_show_watcher) → cron horario
- A-09 (expiry_watcher) → cron diario 6am
- A-12 (dormancy_watcher) → cron diario 6am
- A-06 (recordatorios) → cron horario que escribe en `notification_queue`

> **Nota cron**: extender migración 010 o crear `013_lead_to_project_cron.sql` con `SELECT cron.schedule(...)`. Pendiente confirmar si `pg_cron` está habilitado en este proyecto Supabase. Si no, se hace vía Edge Function disparada por Vercel Cron Jobs o GitHub Actions schedule.

### 3.2 n8n flows

n8n vive fuera de este repo. Las **definiciones** (JSON exports) sí entran al repo, en `automations/n8n/`:

```
automations/
├── README.md                        # cómo importar workflows en n8n
└── n8n/
    ├── A-02-intake-whatsapp.json
    ├── A-05-admin-chatbot.json      # estrella ⭐
    └── A-06-visit-reminders.json    # si se decide n8n en lugar de pg_cron
```

Cada workflow llama webhooks de Supabase Edge Functions con un secret en header `X-Innovar-Webhook-Secret`. Validar en cada Edge Function vía `_shared/webhook-signature.ts`.

---

## 4. Calculadoras compartidas — extracción a `src/lib/calculators/`

### 4.1 Estado actual

Cada servicio tiene su lógica acoplada a un hook React:
- `src/hooks/use-kitchen-calculator.ts`
- `src/hooks/use-closet-calculator.ts`
- `src/hooks/use-tv-center-calculator.ts`
- `src/hooks/use-hardware-calculator.ts`
- `src/hooks/use-mesones-calculator.ts`
- `src/hooks/use-doors-calculator.ts`
- `src/hooks/use-special-finishes-calculator.ts`

Cada feature tiene además `src/features/{service}/logic.ts` (verificar si está alineado o duplicado).

### 4.2 Objetivo

Una sola fuente de cálculo, importable tanto desde React (front) como Deno (Edge Function `auto-generate-quotation`).

### 4.3 Estructura propuesta

```
src/lib/calculators/
├── types.ts                         # tipos compartidos (ItemResult, CalculatorInput, etc.)
├── kitchen.ts                       # función pura: (measurements, pricing) => items[]
├── closet.ts
├── tv-center.ts
├── hardware.ts
├── mesones.ts
├── doors.ts
├── special-finishes.ts
├── index.ts                         # registry: { kitchen, closet, ... }
└── index.test.ts                    # tests de regresión por servicio
```

Reglas:
- **Cero dependencias de React, supabase, o tanstack-query** dentro de `src/lib/calculators/`.
- Recibe `measurements: T` (tipado por servicio) + `pricing: PricingCatalog` y devuelve `QuotationItem[]`.
- Los hooks `use-{service}-calculator.ts` pasan a ser wrappers delgados que llaman a la función pura + cargan pricing.
- La Edge Function `auto-generate-quotation` importa estas funciones directamente desde el bundle compartido.

### 4.4 Plan de migración

1. **Slice 4 (early)**: crear `src/lib/calculators/types.ts` y migrar `kitchen.ts` primero (servicio principal).
2. Refactor `use-kitchen-calculator.ts` a wrapper.
3. Verificar tests pasan y la UI de cotización sigue funcionando idéntica.
4. Repetir para los otros 6 servicios.
5. **Slice 5**: `auto-generate-quotation` importa los 7 calculators y los corre sobre `visits.measurements` JSONB.

> **Estrategia de compartir entre Vite (browser) y Deno (Edge Function)**: el repo de Edge Functions copia `src/lib/calculators/` al build, O usa `import_map.json` apuntando al raw GitHub. Decisión final: copia automática via script `scripts/sync-calculators-to-edge.ts` que corre pre-deploy.

---

## 5. Chatbot A-05 — encaje en el frontend

### 5.1 Componente UI

```
src/components/agent-a05/
├── ChatWidget.tsx                   # botón flotante + panel deslizable
├── ChatTranscript.tsx               # historial de la sesión actual
├── ChatInput.tsx                    # texto + botón de grabar audio
├── AudioRecorder.tsx                # Web Audio API, devuelve Blob
└── useA05Chat.ts                    # hook: estado de la sesión + envío al webhook
```

### 5.2 Visibilidad

- Solo monta cuando `useAuthStore().user.role IN ('admin','super_admin')`.
- Layout: portal en `App.tsx`, fuera del flujo principal.
- Persiste sesión en `sessionStorage` (no `localStorage` — limpiar al logout).

### 5.3 Flujo de datos

```
[ChatWidget] → POST /functions/v1/agent-a05-webhook
              (auth header: JWT del admin)
              ↓
       [n8n via webhook]
              ↓
       [Whisper (audio→text)]
              ↓
       [LLM intent parsing]
              ↓
       [Supabase RPC / REST con service_role bounded]
              ↓
       [insert en agent_actions_log]
              ↓
       [respuesta a ChatWidget]
```

El **secret** del webhook vive en variables de entorno; el chat NUNCA lo expone al cliente — el backend (`agent-a05-webhook` Edge Function) hace de proxy.

### 5.4 Intent set inicial (mínimo viable)

- `schedule_visit(client_name, date, time)`
- `reschedule_visit(visit_ref, new_date, new_time)`
- `cancel_visit(visit_ref, reason)`
- `register_payment(client_name, amount, method)`
- `send_reminder(client_name)`
- `mark_lost(opportunity_ref, reason)`

Cada intent se resuelve a una acción concreta en DB y se loguea.

---

## 6. Feature flags y estrategia de cutover

### 6.1 Sistema de feature flags

Crear `src/lib/features.ts`:

```ts
// src/lib/features.ts
export const FEATURES = {
  opportunitiesEnabled:   import.meta.env.VITE_FF_OPPORTUNITIES === 'true',
  visitsEnabled:          import.meta.env.VITE_FF_VISITS === 'true',
  publicBookingEnabled:   import.meta.env.VITE_FF_PUBLIC_BOOKING === 'true',
  quotationVersionsEnabled: import.meta.env.VITE_FF_QUOTATION_VERSIONS === 'true',
  paymentVerificationEnabled: import.meta.env.VITE_FF_PAYMENT_VERIFICATION === 'true',
  agentA05Enabled:        import.meta.env.VITE_FF_AGENT_A05 === 'true',
} as const;
```

En cada slice se activa solo el flag correspondiente. El cutover por slice es:

| Slice | Flag se enciende | Cuándo se quita el flag (junto con código viejo) |
|---|---|---|
| 1 | — (slice silencioso, solo DB) | N/A |
| 2 | `VITE_FF_OPPORTUNITIES=true` | Tras 2 semanas con UI nueva sin bugs → quitar `useLeads` viejo |
| 3 | `VITE_FF_VISITS=true`, `VITE_FF_PUBLIC_BOOKING=true` | Tras 2 semanas → quitar `useAppointments` viejo |
| 4 | (extiende `VITE_FF_VISITS`) | — |
| 5 | `VITE_FF_QUOTATION_VERSIONS=true` | Tras 1 mes con versiones funcionando |
| 6 | `VITE_FF_PAYMENT_VERIFICATION=true` | Tras 1 mes |
| 7 | `VITE_FF_AGENT_A05=true` | El chatbot puede convivir indefinidamente como feature opcional |

### 6.2 Cutover de la página Leads (Slice 2 — el más crítico)

```tsx
// src/pages/Leads.tsx (durante el cutover)
import { FEATURES } from '@/lib/features';
import LeadsLegacy from './leads/LeadsLegacy';
import LeadsOpportunities from './leads/LeadsOpportunities';

export default function Leads() {
  return FEATURES.opportunitiesEnabled
    ? <LeadsOpportunities />
    : <LeadsLegacy />;
}
```

Esto permite:
1. Mergear el código nuevo a `main` sin afectar producción.
2. Activar `VITE_FF_OPPORTUNITIES=true` en staging para QA con clientes reales.
3. Activar en producción cuando esté validado.
4. Tras 2 semanas estables: borrar `LeadsLegacy` y `useLeads` viejo en un PR de cleanup.

### 6.3 Coexistencia DB durante el cutover

Las migraciones 008-012 son **NO destructivas**:
- `clients` sigue intacta con su `data_origin` viejo (que el código nuevo ignora).
- `tasks` sigue siendo escribible por la UI vieja, y por trigger desde `visits` (UI nueva).
- Si un usuario ve la UI vieja, ve `tasks`; si ve la nueva, ve `visits`. Ambos están en sincronía por el trigger `visit_to_task_mirror`.

---

## 7. Árbol de directorios resultante (post-Slice 7)

Mostrando solo lo que cambia respecto al estado actual:

```
Innovar-App-main/
├── automations/                           # NUEVA carpeta a nivel raíz
│   ├── README.md
│   └── n8n/
│       ├── A-02-intake-whatsapp.json
│       ├── A-05-admin-chatbot.json        # ⭐
│       └── A-06-visit-reminders.json
│
├── db/
│   ├── supabase_schema.sql                # actualizar tras aplicar 008-012
│   └── migrations/
│       ├── 001..007_*.sql                 # existentes, sin cambios
│       ├── 008_lead_to_project_schema.sql       # NUEVO
│       ├── 009_lead_to_project_functions.sql    # NUEVO
│       ├── 010_lead_to_project_triggers.sql     # NUEVO
│       ├── 011_lead_to_project_rls.sql          # NUEVO
│       ├── 012_lead_to_project_seed.sql         # NUEVO
│       ├── 013_lead_to_project_cron.sql         # NUEVO (Slice 3+, si pg_cron disponible)
│       └── ROLLBACK_lead_to_project.sql         # NUEVO
│
├── docs/
│   ├── architecture/
│   │   └── lead-to-project-refactor-map.md      # este archivo
│   └── prd/
│       └── lead-to-project-flow.md              # PRD Fase 2
│
├── supabase/                              # NUEVA carpeta (Edge Functions)
│   ├── config.toml
│   └── functions/
│       ├── _shared/
│       │   ├── supabase-admin.ts
│       │   ├── cors.ts
│       │   ├── calculators/               # copia auto-sincronizada de src/lib/calculators
│       │   └── webhook-signature.ts
│       ├── auto-generate-quotation/index.ts
│       ├── wp-lead-webhook/index.ts
│       ├── notify-new-lead/index.ts
│       ├── refund-calculator/index.ts
│       └── agent-a05-callback/index.ts
│
├── scripts/
│   └── sync-calculators-to-edge.ts        # NUEVO: copia src/lib/calculators → supabase/functions/_shared/calculators
│
└── src/
    ├── lib/
    │   ├── calculators/                   # NUEVA — Slice 4
    │   │   ├── types.ts
    │   │   ├── kitchen.ts
    │   │   ├── closet.ts
    │   │   ├── tv-center.ts
    │   │   ├── hardware.ts
    │   │   ├── mesones.ts
    │   │   ├── doors.ts
    │   │   ├── special-finishes.ts
    │   │   ├── index.ts
    │   │   └── index.test.ts
    │   └── features.ts                    # NUEVA — feature flags
    │
    ├── schemas/
    │   ├── opportunity.ts                 # NUEVA
    │   ├── visit.ts                       # NUEVA
    │   ├── measurements/                  # NUEVA carpeta
    │   │   ├── kitchen.ts
    │   │   ├── closet.ts
    │   │   ├── tv-center.ts
    │   │   ├── hardware.ts
    │   │   ├── mesones.ts
    │   │   ├── doors.ts
    │   │   └── special-finishes.ts
    │   ├── payment.ts                     # AMPLIADA: proof_url, verification_status
    │   └── ...existing
    │
    ├── hooks/
    │   ├── useOpportunities.ts            # NUEVA
    │   ├── useOpportunity.ts              # NUEVA
    │   ├── useOpportunityTransition.ts    # NUEVA
    │   ├── useReassignOpportunity.ts      # NUEVA
    │   ├── useLeads.ts                    # REFACTORIZADO (wrapper → eliminado tras cutover)
    │   ├── useQuotationVersions.ts        # NUEVA
    │   ├── useQuotationDiff.ts            # NUEVA
    │   ├── useCreateQuotationVersion.ts   # NUEVA
    │   ├── useApproveQuotationPublic.ts   # NUEVA
    │   ├── useAgentActions.ts             # NUEVA
    │   ├── useSystemSettings.ts           # NUEVA
    │   ├── agenda/
    │   │   ├── useVisits.ts               # NUEVA
    │   │   ├── useBookVisit.ts            # NUEVA (reemplaza useBookAppointment)
    │   │   ├── useVisitSlots.ts           # NUEVA (reemplaza useAvailableSlots)
    │   │   ├── useCompleteVisit.ts        # NUEVA (reemplaza useCompleteAppointment)
    │   │   └── ... (legacy hooks deprecated tras Slice 3)
    │   └── finanzas/
    │       ├── useUploadPaymentProof.ts   # NUEVA
    │       ├── useVerifyPayment.ts        # NUEVA
    │       ├── useRejectPayment.ts        # NUEVA
    │       └── useRefund.ts               # NUEVA
    │
    ├── pages/
    │   ├── Leads.tsx                      # MODIFICADO (router entre legacy/new por flag)
    │   ├── leads/
    │   │   ├── LeadsLegacy.tsx            # NUEVA temporal (el código actual de Leads)
    │   │   └── LeadsOpportunities.tsx     # NUEVA (UI nueva)
    │   ├── LeadCreate.tsx                 # MODIFICADO (submission, UI igual)
    │   ├── OpportunityDetail.tsx          # NUEVA
    │   ├── QuotationCompare.tsx           # NUEVA
    │   ├── public/                        # NUEVA carpeta
    │   │   ├── BookVisit.tsx
    │   │   ├── SubmitMeasurements.tsx
    │   │   └── ApproveQuotation.tsx
    │   └── admin/                         # NUEVA carpeta
    │       ├── PaymentVerification.tsx
    │       ├── AgentActionsLog.tsx
    │       └── SystemSettings.tsx
    │
    ├── components/
    │   ├── agent-a05/                     # NUEVA carpeta — Slice 7
    │   │   ├── ChatWidget.tsx
    │   │   ├── ChatTranscript.tsx
    │   │   ├── ChatInput.tsx
    │   │   └── AudioRecorder.tsx
    │   ├── opportunities/                 # NUEVA carpeta
    │   │   ├── OpportunityTimeline.tsx
    │   │   ├── OpportunityStatusBadge.tsx
    │   │   ├── OpportunityActions.tsx     # botones contextuales según status
    │   │   └── ReassignDialog.tsx
    │   ├── visits/                        # NUEVA carpeta
    │   │   ├── VisitCard.tsx
    │   │   ├── VisitSlotPicker.tsx
    │   │   ├── MeasurementsForm.tsx       # form genérico que delega al schema del servicio
    │   │   └── PhotoUploader.tsx
    │   ├── quotations/                    # AMPLIADA
    │   │   ├── QuotationVersionList.tsx
    │   │   ├── QuotationDiffViewer.tsx
    │   │   └── ChangeReasonDialog.tsx
    │   └── payments/                      # NUEVA carpeta
    │       ├── PaymentProofUploader.tsx
    │       ├── PaymentVerificationCard.tsx
    │       └── RefundCalculator.tsx
    │
    ├── store/
    │   └── ... (sin cambios)
    │
    ├── types/
    │   ├── database.types.ts              # REGENERAR tras aplicar 008-012
    │   └── ... (sin cambios estructurales)
    │
    ├── App.tsx                            # MODIFICADO: nuevas rutas públicas + admin + chat widget portal
    └── main.tsx                           # sin cambios
```

---

## 8. Rutas a registrar en `App.tsx`

```tsx
// Públicas (fuera de <ProtectedRoute>)
<Route path="/agendar/:token"            element={<BookVisit />} />
<Route path="/medidas/:token"            element={<SubmitMeasurements />} />
<Route path="/cotizacion/:token"         element={<ApproveQuotation />} />

// Autenticadas
<Route path="/leads/:id"                 element={<Protected><OpportunityDetail /></Protected>} />
<Route path="/quotations/compare/:id1/:id2" element={<Protected><QuotationCompare /></Protected>} />

// Admin only
<Route path="/admin/payments/verification" element={<Protected roles={['admin','super_admin']}><PaymentVerification /></Protected>} />
<Route path="/admin/agent-log"             element={<Protected roles={['admin','super_admin']}><AgentActionsLog /></Protected>} />
<Route path="/admin/settings/system"       element={<Protected roles={['admin','super_admin']}><SystemSettings /></Protected>} />
```

Y dentro del provider raíz montar el chat widget detrás del flag:

```tsx
{FEATURES.agentA05Enabled && <ChatWidget />}
```

---

## 9. Checklist por slice (orden obligatorio)

### Slice 1 — Esqueleto de datos
- [ ] Aplicar `008_lead_to_project_schema.sql` en staging
- [ ] Aplicar `009`, `010`, `011`, `012` en orden
- [ ] Verificar duplicados de teléfono pre-migración
- [ ] Regenerar `src/types/database.types.ts`
- [ ] **Sin tocar UI todavía** — solo crear `src/lib/features.ts` con todos los flags en `false`
- [ ] QA: insertar un opportunity manual desde dashboard, verificar trigger round-robin asigna comercial

### Slice 2 — Leads como opportunities
- [ ] Crear `useOpportunities`, `useOpportunity`, `useOpportunityTransition`, `useReassignOpportunity`
- [ ] Crear `src/schemas/opportunity.ts`
- [ ] Refactor `LeadCreate.tsx` (UI igual, submission diferente)
- [ ] Crear `LeadsOpportunities.tsx`
- [ ] Crear `OpportunityDetail.tsx`
- [ ] Crear `OpportunityTimeline`, `OpportunityStatusBadge`, `OpportunityActions`, `ReassignDialog`
- [ ] Switch en `Leads.tsx` por `FEATURES.opportunitiesEnabled`
- [ ] QA con `VITE_FF_OPPORTUNITIES=true` en staging
- [ ] Deploy a producción con flag OFF inicialmente
- [ ] Activar flag, monitorear 2 semanas
- [ ] Cleanup: eliminar `LeadsLegacy.tsx` y `useLeads` viejo

### Slice 3 — Calendario + visita
- [ ] Crear `useVisits`, `useBookVisit`, `useVisitSlots`
- [ ] Crear `src/schemas/visit.ts`
- [ ] Crear `BookVisit.tsx` (ruta pública)
- [ ] Crear `VisitSlotPicker`, `VisitCard`
- [ ] Refactor `Agenda.tsx` para leer de `useVisits`
- [ ] Edge function `notify-new-lead` (A-04)
- [ ] `pg_cron` o Vercel cron para A-06, A-07
- [ ] QA flujo: cliente agenda desde link público, comercial ve en agenda, recordatorio 24h llega

### Slice 4 — Mediciones + fotos
- [ ] Crear `src/schemas/measurements/*.ts` (7 servicios)
- [ ] Migrar 1er calculator a `src/lib/calculators/kitchen.ts`
- [ ] Refactor `use-kitchen-calculator.ts` a wrapper
- [ ] Validar idempotencia: misma `measurements` → mismos items
- [ ] Migrar los 6 calculators restantes
- [ ] Crear `MeasurementsForm`, `PhotoUploader`
- [ ] Crear `SubmitMeasurements.tsx` (ruta pública)
- [ ] Crear `useCompleteVisit`
- [ ] QA: visita presencial cierra con 3 fotos + medidas. Visita foto-remota cierra desde link público.

### Slice 5 — Versiones de presupuesto
- [ ] Crear `useQuotationVersions`, `useQuotationDiff`, `useCreateQuotationVersion`
- [ ] Crear `QuotationVersionList`, `QuotationDiffViewer`, `ChangeReasonDialog`
- [ ] Crear `QuotationCompare.tsx`
- [ ] Modificar `QuotationDetail.tsx`: pestaña histórico + bypass dialog
- [ ] Edge function `auto-generate-quotation` (A-10) usando calculadoras compartidas
- [ ] Configurar Database Webhook para disparar `auto-generate-quotation`
- [ ] `expiry_watcher` cron (A-09)
- [ ] QA: visita cierra → quotation v1 draft generada → comercial envía → cliente pide cambios → v2 → comparador funciona

### Slice 6 — Aprobación + abono + conversión
- [ ] Crear `ApproveQuotation.tsx` (ruta pública)
- [ ] Crear `useApproveQuotationPublic`, `useUploadPaymentProof`, `useVerifyPayment`, `useRejectPayment`
- [ ] Crear `PaymentProofUploader`, `PaymentVerificationCard`
- [ ] Crear `PaymentVerification.tsx` (admin)
- [ ] QA flujo completo end-to-end: lead nuevo → visita → presupuesto → aprobación cliente → comprobante → admin verifica → proyecto creado

### Slice 7+ — Agentes restantes
- [ ] A-01 webhook WordPress (Edge Function + ajuste en sitio web)
- [ ] A-02 intake WhatsApp (n8n)
- [ ] A-12 dormancy_watcher (cron)
- [ ] A-13 refund-calculator (Edge Function wrapper)
- [ ] **A-05 chatbot interno ⭐**:
  - [ ] Crear `src/components/agent-a05/*`
  - [ ] Crear Edge Function `agent-a05-callback`
  - [ ] Crear n8n workflow `A-05-admin-chatbot.json`
  - [ ] Variables de entorno: `N8N_A05_WEBHOOK_URL`, `N8N_A05_SHARED_SECRET`
  - [ ] QA: admin envía audio "agéndame visita con Roberto el jueves a las 11" → visita aparece en agenda

---

## 10. Riesgos arquitectónicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cutover de `useLeads` rompe alguna pantalla no obvia | Buscar usos con `grep "useLeads" src/` antes de mergear cada slice |
| Edge Function `auto-generate-quotation` no logra importar calculadoras compartidas (resolución de paths Deno vs Vite) | Script `sync-calculators-to-edge.ts` que copia, no symlink. Build deterministic. |
| Tokens públicos largos rompen URLs en SMS de WhatsApp | 32 chars hex (16 bytes) cabe holgado en 200 chars de WhatsApp template |
| `system_settings` se vuelve fuente de bugs (cambio sin deploy) | Validar cada `value` JSONB con Zod schema en el hook `useSystemSettings` antes de mostrar al admin |
| Migración inicial detecta duplicados de teléfono → falla | README pre-condición explícita; query de diagnóstico provista; merge tool a mano (consolidar manualmente antes de aplicar) |
| Frontend deja de compilar tras regenerar `database.types.ts` | Regenerar tipos PRIMERO, ver errores TS, ajustar hooks, luego mergear |
| `tasks` y `visits` se desincronizan si alguien edita `tasks` directamente | Slice 3 deshabilita escritura directa a `tasks` para `appointment_type='visita'` (RLS o trigger BEFORE UPDATE que valida) |

---

## 11. Definition of Done — fin del refactor (post-Slice 7)

El refactor está completo cuando:

- [ ] Los 7 slices están en producción con sus flags ON
- [ ] Los flags `VITE_FF_OPPORTUNITIES`, `VITE_FF_VISITS`, `VITE_FF_QUOTATION_VERSIONS`, `VITE_FF_PAYMENT_VERIFICATION` están **eliminados del código** (cleanup post-cutover)
- [ ] `useLeads`, `useAppointments`, `useAvailableSlots`, `useBookAppointment`, `useCompleteAppointment`, `LeadsLegacy.tsx` están **eliminados** del repo
- [ ] `db/supabase_schema.sql` refleja el estado final post-migraciones
- [ ] `docs/DATABASE.md` actualizado con las nuevas tablas
- [ ] `docs/ARCHITECTURE.md` actualizado con el nuevo flujo
- [ ] Las 7 calculadoras viven en `src/lib/calculators/` y se sincronizan a Edge Functions
- [ ] `automations/n8n/A-05-admin-chatbot.json` está versionado en el repo
- [ ] Las métricas del PRD §7.4 son consultables (queries documentadas en `docs/METRICS.md`)

---

## 12. Próximo paso

**Fase 5 — Ejecución de Slices**, comenzando por Slice 1 (esqueleto de datos). Aplicar migraciones 008-012 en staging Supabase, regenerar tipos TS, y dejar la UI tocando.

Antes de cada slice: leer el checklist de la §9 y `docs/CONVENTIONS.md`. Después de cada slice: pasar por `deploy-check` (Fase 6).

**Fin del Refactor Map v1.0**
