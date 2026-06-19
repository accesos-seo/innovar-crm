# PRD — Decisiones del Cliente · Departamento COMERCIAL / APROBACIONES

> **Autocontenido.** Esquema **verificado contra producción** (Supabase Innovar, Management API) + código vivo el **19/06/2026**. Re-validar contra prod antes de implementar (`db/supabase_schema.sql` está desactualizado).
>
> **Origen:** Cuestionario 2 ("Ciclo de Diseño y Aprobaciones"), **Preguntas 2–6** de [`../decisiones/decisiones-innovar-cuestionarios.md`](../decisiones/decisiones-innovar-cuestionarios.md). Estado en [`../decisiones/00-matriz-segmentacion-brechas.md`](../decisiones/00-matriz-segmentacion-brechas.md) (filas Q2–Q6 de Comercial). **Es el PRD más grande: casi todo el ciclo está sin construir.**

## Problem Statement

El cliente describe, como existente, un ciclo de aprobación de diseño completo: el cliente aprueba o pide cambios desde un **link público**; el comercial puede registrar aprobaciones **delegadas** (clientes mayores, por teléfono/WhatsApp) con **evidencia** y **datos del familiar**; las solicitudes de cambio generan **tarea al diseñador (48h)** y notifican a gerencia; y hay **recordatorios automáticos** (T+5h/48h/96h) si el cliente no responde.

La verificación muestra que **nada de ese ciclo está construido**: no hay portal de aprobación de diseño, no hay modal "Solicitar Cambios", no existen `modelado_approved_by` ni `changes_requested_at`, no hay aprobación delegada ni evidencia ni recordatorios. Solo existen los timestamps `modelado_approved_at` / `renders_approved_at` (solo-lectura, nadie los setea) y un `client_approval_notes` genérico.

**La buena noticia:** toda la infraestructura para construirlo **ya existe y es reutilizable** (portal público, cola de WhatsApp + cron, tareas, historial, buckets). Esto es ensamblar piezas probadas, no inventar.

## Solution

Construir el ciclo de aprobación reutilizando el patrón del **portal público de cotizaciones** (`PublicQuotation` + RPCs anon `SECURITY DEFINER`), la **cola `notification_queue` + `pg_cron`** para recordatorios, la tabla **`tasks`** para la tarea al diseñador, **`project_status_history`** + una tabla nueva de eventos de aprobación para el historial inmutable, y los **buckets** existentes para la evidencia.

## User Stories

- Como **cliente**, desde un link sin login quiero **Aprobar** o **Solicitar cambios** del modelado y del render, escribiendo mi nombre o el detalle del cambio.
- Como **comercial**, quiero registrar una aprobación **en nombre del cliente** (delegada) eligiendo el motivo (presencial/WhatsApp/teléfono), con nota, **evidencia adjunta** y **datos del familiar** que aprobó.
- Como **diseñador**, cuando el cliente pide cambios quiero una **tarea de prioridad alta a 48h** con el detalle, y aviso por WhatsApp.
- Como **gerencia (admin/super_admin)**, quiero enterarme de cada cambio solicitado sin revisar proyecto por proyecto.
- Como **comercial/admin**, quiero que el sistema le recuerde al cliente automáticamente si no aprueba, y me alerte si pasa demasiado tiempo.

## Contexto del sistema existente (leer antes de implementar)

**Stack:** React 19 + Vite + TS + Tailwind + shadcn/ui · Supabase. DB inglés, labels español. Migraciones `db/migrations/` (última **060**; usar siguiente disponible). `CREATE OR REPLACE` + snapshot versionado.

| Pieza reutilizable | Ubicación | Cómo se reusa |
|---|---|---|
| **Portal público (patrón)** | `src/pages/PublicQuotation.tsx`, `usePublicQuotation.ts`; RPCs `get_public_quotation`, `accept_public_quotation`, `reject_public_quotation` (`db/migrations/034_phase4_public_quotation_rpcs.sql`, `SECURITY DEFINER`, `GRANT EXECUTE TO anon`) | Clonar para el portal de aprobación de diseño |
| **UI portal** | `src/components/quotations/public/QuotationActionButtons.tsx` (modal shell), status cards, `PaymentProofUploader.tsx` (drag-drop, validación) | Botones Aprobar/Solicitar cambios + uploader de evidencia |
| **Cola WhatsApp + cron** | `notification_queue` + `enqueue_notification(...)` + `pg_cron`; patrón `enqueue_quotation_reminders_3d` + `cron.schedule` en `db/migrations/037_phase4_quotation_expiry_and_reminders.sql:78-179` | Recordatorios T+5h/48h/96h |
| **Tareas** | tabla `tasks` (`priority` 1=alta, `due_date`, `task_category`, `assigned_to`) + trigger `notify_task_assigned` | Tarea diseñador 48h |
| **Historial inmutable** | `project_status_history` (trigger `trg_log_project_status`, columna `note`) | Cambios de estado; los eventos ricos van a tabla nueva (abajo) |
| **Evidencia/archivos** | buckets `project-files` (privado), `project-photos` (10MB) + uploader | Adjunto de aprobación delegada (JPG/PNG/PDF) |
| **Estados** `project_status` | `contacto, cotizacion_aprobada, en_diseno, aprobacion_final, en_produccion, listo_instalacion, entregado, completado` | **NO existen** `pendiente_modelado`/`pendiente_render` |
| **Columnas en `projects`** | ✅ `client_approval_notes, client_approved_at, modelado_approved_at, renders_approved_at, designer_id, design_3d_files`. ❌ `modelado_approved_by, renders_approved_by, changes_requested_at, design_sent_at` | Se agregan las faltantes |
| **Roles** | con usuarios: `admin, comercial, diseno`. En el tipo además: `super_admin, produccion, gerente, administradora, jefe_taller` | — |

## Implementation Decisions

> Decisiones técnicas tomadas con criterio (no requieren al dueño). Las **Decisiones del dueño** van en su sección al final.

### 1. Modelar modelado/render SIN tocar el enum de estados
El cliente habla de sub-estados `pendiente_modelado`/`pendiente_render`. **Decisión:** no agregar valores al enum `project_status` (riesgoso, hay datos). El proyecto permanece en `en_diseno` durante todo el ciclo de diseño; la **etapa** (modelado vs render) se infiere de los timestamps existentes + un campo nuevo `projects.design_stage` (`'modelado' | 'render' | 'aprobado'`). La transición `en_diseno → aprobacion_final` (ya existente en `move_project_status`) ocurre cuando el render queda aprobado.

### 2. Columnas nuevas en `projects` (migración)
`modelado_approved_by uuid`, `renders_approved_by uuid` (FK profiles), `changes_requested_at timestamptz`, `design_sent_at timestamptz` (cuándo se envió la versión vigente al cliente — base del temporizador de recordatorios), `design_stage text`, `design_review_token text UNIQUE` (token del portal de aprobación, generado como los otros `public_token`).

### 3. Tabla nueva de eventos de aprobación (historial inmutable rico)
`design_approval_events` — captura lo que `project_status_history.note` no alcanza:
```
id, project_id (FK), stage ('modelado'|'render'),
action ('approved'|'changes_requested'),
source ('cliente_portal'|'comercial_presencial'|'comercial_whatsapp'|'comercial_telefono'),
is_delegated boolean, performed_by uuid (interno que registró),
approver_name text (nombre que escribió el cliente/familiar),
motivo text, nota text, evidence_url text,
familiar_nombre text, familiar_parentesco text,
changes_description text, created_at timestamptz default now()
```
INSERT-only (sin UPDATE/DELETE por RLS). Es el "registro inamovible" que pide el cliente (Q4/Q5).

### 4. Portal público de aprobación (clonar el de cotizaciones)
- Ruta `/diseno/:token` (`PublicDesignApproval.tsx`), mobile-first, reusando el modal shell y status cards.
- RPCs `SECURITY DEFINER` anon: `get_public_design(p_token)` (devuelve la versión vigente — solo la actual, ver PRD Diseño Q11), `approve_design_public(p_token, p_stage, p_approver_name)`, `request_design_changes_public(p_token, p_stage, p_description)`. Mismo patrón de validación de token que `accept_public_quotation`.
- Aprobar setea `modelado_approved_at/by` o `renders_approved_at/by`, avanza `design_stage`, inserta `design_approval_events` (source `cliente_portal`); render aprobado → `move_project_status` a `aprobacion_final` + dispara la cadena de Producción (ver PRD Producción).
- Solicitar cambios setea `changes_requested_at`, `client_approval_notes`, mantiene `en_diseno`, crea la tarea diseñador + notifica (punto 6).

### 5. Aprobación delegada + evidencia + familiar (panel interno)
- Modal "Aprobar Diseño" (panel) → RPC `approve_design_delegated(p_project_id, p_stage, p_source, p_nota, p_evidence_path, p_familiar_nombre, p_familiar_parentesco)`.
- `source` obligatorio (presencial / WhatsApp familiar / teléfono / WhatsApp cliente); graba `*_approved_by` como `"[nombre] (delegado — source)"`, e inserta `design_approval_events` con `is_delegated=true`, nota, `evidence_url` (subida a `project-files`), y datos del familiar. Sin teléfono del familiar (Q5).

### 6. Solicitar Cambios — efectos (cliente o comercial)
Al confirmar: estado vuelve/permanece `en_diseno`; `changes_requested_at = now()`; `client_approval_notes` guarda el detalle (banner naranja en la ficha); se crea `tasks` (priority 1, due_date +2 días, task_category `diseno`, assigned_to = `designer_id`, fallback al número fijo de INNOVAR vía `system_settings` si no hay diseñador); notifica in-app + push a `admin`/`super_admin` ("Informado por [source]"), sin auto-notificar al ejecutor.

### 7. Recordatorios automáticos T+5h / T+48h / T+96h
`enqueue_design_approval_reminders()` (SECURITY DEFINER) + `pg_cron` **cada hora** (no diario — los umbrales son sub-día). Escanea proyectos `en_diseno` con `design_sent_at` no nulo, sin aprobar ni cambios pendientes, y encola según horas transcurridas con `dedup_key` por `proyecto+stage+umbral`:
- **T+5h:** WhatsApp al cliente (template Meta nueva `design_reminder_5h_client_v1`) con el link `/diseno/:token`.
- **T+48h:** WhatsApp al cliente (`design_reminder_48h_client_v1`).
- **T+96h:** notificación interna (in-app) a comerciales+admins ("[cliente] lleva +4 días sin aprobar"). Sin más WhatsApp al cliente.
- `design_sent_at` se **reinicia** al enviar nueva versión (PRD Diseño), deteniendo/reiniciando la cuenta; aprobar o pedir cambios saca al proyecto del estado y detiene los recordatorios.

## Testing Decisions
1. **Portal:** abrir `/diseno/:token` válido → ver versión vigente + 2 botones. Token inválido/expirado → estado de error.
2. **Aprobar (cliente):** aprobar modelado → `modelado_approved_at/by` seteados, `design_stage='render'`, fila en `design_approval_events` source `cliente_portal`. Aprobar render → `renders_approved_at/by`, `aprobacion_final`, cadena de Producción.
3. **Solicitar cambios:** desde portal y desde panel → `changes_requested_at`, banner naranja, tarea diseñador priority 1 due +2d, notif a admin/CEO (no al ejecutor).
4. **Delegada:** `approve_design_delegated` con source + evidencia + familiar → `*_approved_by` con sufijo "(delegado — …)", `design_approval_events.is_delegated=true`, `evidence_url` accesible.
5. **Recordatorios:** simular `design_sent_at` a −6h/−49h/−97h → cron encola 5h, 48h (cliente) y 96h (interno) sin duplicar (dedup). Enviar nueva versión resetea.
6. **RLS:** `design_approval_events` no editable/borrable; RPCs públicas solo via token válido.

## Out of Scope
- Gestión/versionado de los archivos de diseño y el botón "Enviar al cliente" → **PRD Diseño** (este PRD consume la versión vigente que aquél publica).
- La cadena de avisos al aprobar el render hacia taller/comercial → **PRD Producción**.
- Sub-estados nuevos en el enum `project_status` (se evita a propósito).

## Decisiones del dueño (pendientes — para el documento a enviar)
1. **C2-Q9 — Disparo del aviso al diseñador para iniciar diseño:** hoy sale al verificar el pago (`adelanto_recibido`); el dueño había pedido que salga al **aprobar la cotización**. Dejó la respuesta en blanco. Define el momento exacto. *(Bloquea el arranque del ciclo.)*
2. **C2-Q1 — Tope de rondas de cambios** (también afecta el botón "Solicitar Cambios" del portal): ¿ilimitadas (estado actual) o un tope antes de cobrar ajustes? Si hay tope, **¿cuántas y aplica por etapa (modelado/render por separado) o al diseño completo?**
3. **Política tras T+96h sin aprobación:** el documento define el recordatorio (alerta interna "contacto manual"), pero **no dice qué pasa si aun así el cliente no responde**. ¿El proyecto se pausa, se archiva, se mantiene activo indefinidamente? Es una regla de negocio que solo el dueño define.

## Further Notes
- **No reinventar:** clonar `PublicQuotation` + `accept_public_quotation`; reusar `notification_queue`/`pg_cron` (037), `tasks`/`notify_task_assigned`, `project-files`.
- **Plantillas Meta nuevas a aprobar (lado agencia):** `design_reminder_5h_client_v1`, `design_reminder_48h_client_v1`, y la de "nueva versión lista" (PRD Diseño). HTTP 200 ≠ entrega; requieren aprobación Meta.
- **Conformidad ✅ (informar al cliente):** ninguna pieza de este ciclo está hoy operativa — es construcción.
- **Commits:** `feat(aprobaciones): ...`, `git add` por archivo, push tras OK.
