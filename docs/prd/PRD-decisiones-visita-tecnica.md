# PRD — Decisiones del Cliente · Departamento VISITA TÉCNICA (Levantamiento → Diseño)

> **Autocontenido.** Otra IA debe poder implementar esto leyendo solo este documento + el código. Esquema **verificado contra producción** (Supabase Innovar, Management API) y código vivo el **19/06/2026**. Re-validar contra prod antes de implementar (`db/supabase_schema.sql` está desactualizado).
>
> **Origen:** Cuestionario 2 ("Ciclo de Diseño y Aprobaciones"), **Pregunta 10** de [`../decisiones/decisiones-innovar-cuestionarios.md`](../decisiones/decisiones-innovar-cuestionarios.md). Estado en [`../decisiones/00-matriz-segmentacion-brechas.md`](../decisiones/00-matriz-segmentacion-brechas.md) (filas Q10a–Q10d).

## Problem Statement

El cliente describe un flujo donde el técnico de medidas captura medidas + fotos + plano en la visita, y al presionar **"Enviar al equipo"** todo aparece **automáticamente** en la ficha del proyecto, en una sección **"Levantamiento técnico"** que el **diseñador** consulta sin perseguir a nadie por WhatsApp.

La verificación muestra que **la captura ya existe y es sólida**, pero el resultado **no llega a la ficha del proyecto** ni notifica al equipo:
- Las **medidas** ya se heredan a `projects.initial_measurements` al crear el proyecto (009), pero **nadie las renderiza** en la UI.
- Las **fotos** quedan en `visits.photos` y **no se traen** al proyecto.
- Al finalizar la visita **solo se notifica al cliente** (WhatsApp `notify_visit_summary_client`); **no hay aviso al equipo** (admin/comercial/diseñadores).
- **No existe** carga de plano/PDF en la visita (ni compresión Ghostscript).

Es, en su mayor parte, una brecha de **superficie (frontend) + un aviso**, no de captura. De los 5 PRD es el más autocontenido y de menor riesgo.

## Solution

Surfacing del levantamiento en la ficha del proyecto + el evento "Enviar al equipo". Reutilizar lo que ya existe: el JSONB `initial_measurements` (ya poblado), el bucket `visit_photos`, el patrón de notificación in-app por `INSERT` directo, y la función `convert_quotation_to_project` (donde ya se heredan las medidas).

## User Stories

- Como **diseñador**, al abrir la ficha del proyecto quiero ver una sección **"Levantamiento técnico"** con las medidas, las fotos y las notas del técnico, para empezar a modelar sin pedir nada.
- Como **técnico de medidas**, al terminar y **"Enviar al equipo"** quiero que admin, comercial y diseñadores reciban un aviso con el cliente, el tipo de trabajo y la dirección.
- Como **admin**, quiero que ese aviso quede in-app (y opcionalmente WhatsApp) sin tener que revisar la agenda manualmente.

## Contexto del sistema existente (leer antes de implementar)

**Stack:** React 19 + Vite + TS + Tailwind + shadcn/ui · Supabase. DB en inglés, labels español. Migraciones en `db/migrations/` (última **060**; usar la siguiente disponible). Funciones: `CREATE OR REPLACE` + snapshot versionado.

| Pieza | Ubicación | Estado |
|---|---|---|
| Captura de medidas | `src/components/agenda/VisitMeasurementsForm.tsx` (espacio: largo/ancho/alto/forma · conexiones: agua/gas/voltaje/desagüe · estado · 6 servicios · notas) | ✅ |
| Schema medidas (v1) | `src/lib/schemas/visit-measurements.ts:53-104` (`visitMeasurementsV1Schema`) | ✅ |
| Captura de fotos | `src/components/agenda/VisitPhotoUploader.tsx` (compresión client-side 1920px/0.85, bucket **`visit_photos`**, ≥3 fotos, paths en `visits.photos` jsonb) | ✅ |
| Finalizar visita | `src/hooks/agenda/useFinishVisit.ts:34-58` → `status='realizada'`; dispara `notify_visit_summary_client` (**solo cliente**) | ✅ (falta aviso equipo) |
| Tabla `visits` (prod) | `...measurements (jsonb), photos (jsonb NOT NULL), notes (text), address (text), visited_by (técnico), opportunity_id, status, realized_at...` | ✅ |
| Herencia de medidas | `convert_quotation_to_project` en `db/migrations/009_lead_to_project_functions.sql:434-442` copia las medidas de la última visita `realizada` a `projects.initial_measurements` | ✅ (no las fotos) |
| Enlace visita↔proyecto | **Indirecto** vía `opportunity_id` (NO hay `visits.project_id` ni `projects.visit_id`). Recuperación: `visits JOIN opportunities JOIN projects WHERE projects.id=? ORDER BY realized_at DESC LIMIT 1` | ⚠️ |
| Ficha del proyecto (vista diseñador) | `src/pages/ProjectDetail.tsx` — secciones: Timeline, Info General, Modelado 3D, Fechas, Notas, Auditoría. **No renderiza `initial_measurements` ni fotos** | 🔴 |
| Patrón notificación in-app | `INSERT INTO notifications (user_id,title,body,notification_type,related_table,related_id,action_url) SELECT p.id,... FROM profiles p WHERE p.role IN (...) AND p.is_active` — ej. `009_...:490-501`, `028_...:113-127` | ✅ reusar |
| `enqueue_notification(...)` | existe pero es **WhatsApp-only** (12 args). Para in-app → INSERT directo (arriba) | — |
| Roles | diseñador = `diseno` (algunos checks aceptan `diseñador`/`disenador`); `projects.designer_id` (FK) asignado vía RPC `update_project_designer` | — |

## Implementation Decisions

### 1. Sección "Levantamiento técnico" en `ProjectDetail.tsx` (frontend, principal)
Nueva sección **después de "Información General", antes de "Modelado 3D"**, de solo lectura, que renderiza:
- **Medidas:** parsear `projects.initial_measurements` (JSONB v1) como tabla legible (Espacio, Conexiones, Estado, Servicios a cotizar). Reusar las etiquetas de `VisitMeasurementsForm`. Si `initial_measurements` es `null` (proyectos viejos o sin visita), mostrar estado vacío con CTA "sin levantamiento".
- **Fotos:** galería desde el bucket `visit_photos` con signed URLs (mismo patrón de `VisitPhotoUploader`).
- **Notas técnicas:** `visits.notes`.
- Componente nuevo `src/components/projects/LevantamientoTecnico.tsx` + hook `useProjectLevantamiento(projectId)`.

### 2. Traer las fotos al proyecto (las medidas ya están)
Las medidas ya se heredan, las fotos no. Recomendación: **espejar las fotos igual que las medidas** — agregar `projects.initial_photos jsonb` (default `'[]'`) y poblarlo en `convert_quotation_to_project` junto a `initial_measurements` (misma `SELECT ... FROM visits ... ORDER BY realized_at DESC LIMIT 1`). Evita joins cross-tabla en la UI y es consistente.
- **Backfill** (migración): poblar `initial_measurements`/`initial_photos` de proyectos existentes vía el enlace indirecto por `opportunity_id`, para que los proyectos vivos también muestren su levantamiento.
- *Alternativa* (si no se quiere tocar el schema): el hook resuelve la visita on-demand con el JOIN por `opportunity_id`. Menos limpio; preferir el espejo.

### 3. Evento "Enviar al equipo" (notificación al equipo)
Hoy finalizar la visita notifica solo al cliente. Agregar la notificación al **equipo** en el mismo momento (`status → 'realizada'`):
- **Trigger nuevo** `fn_notify_visit_team_on_realized()` (BEFORE/AFTER UPDATE de `visits.status` a `realizada`), que hace el `INSERT` in-app (patrón reusable) a todos los `profiles` con rol `admin`, `comercial`, `diseno` activos, con título "Nuevo levantamiento listo" y body con **nombre de cliente + tipo de trabajo + dirección** (`visits.address`), `action_url` a la ficha/visita.
- **WhatsApp opcional:** si se quiere, encolar vía `fn_wa_enqueue_for_profile` por cada miembro (decisión: el doc dice "notificación push"; in-app + push del navegador alcanza; WhatsApp al equipo es opcional).
- Reutilizar, no duplicar, el patrón de `notify_visit_summary_client`.

### 4. Plano PDF + Ghostscript (decisión — probablemente fuera de alcance)
El doc menciona que el técnico exporta el plano de GoodNotes a PDF y se comprime con Ghostscript. Hoy **no hay** carga de plano en la visita ni Ghostscript.
- **Recomendación:** permitir **subir un plano PDF** en la visita (campo `visits.plan_pdf_url` + uploader, reusando el bucket de archivos) y mostrarlo en la sección "Levantamiento técnico". **Dejar la compresión Ghostscript fuera de alcance** (las Edge Functions de Supabase corren Deno y no traen `gs`; montar eso es desproporcionado). Si pesa, comprimir client-side o aceptar el PDF tal cual.
- Confirmar con el cliente si el plano en la visita es realmente necesario o si el modelado 3D del proyecto ya lo cubre.

## Testing Decisions
1. **Render:** abrir un proyecto con `initial_measurements` poblado → la sección "Levantamiento técnico" muestra medidas legibles, galería de fotos y notas. Proyecto sin levantamiento → estado vacío sin romper.
2. **Espejo de fotos:** crear un proyecto nuevo desde una visita con ≥3 fotos → `projects.initial_photos` queda poblado y la galería las muestra. Verificar backfill en un proyecto viejo.
3. **Aviso al equipo:** finalizar una visita → admin, comercial y diseñadores reciben notificación in-app con cliente + tipo + dirección; el cliente sigue recibiendo su WhatsApp; quien ejecuta no se auto-notifica si aplica.
4. **Permisos/roles:** la notificación llega solo a `admin`/`comercial`/`diseno` activos.
5. **Plano (si se implementa):** subir PDF en la visita → visible en la sección del proyecto.

## Out of Scope
- Compresión de PDF con Ghostscript (desproporcionado para EFs Deno).
- Cambiar el modelo de captura de la visita (medidas/fotos ya funcionan).
- Categorización de fotos por tipo (ventana/hidráulico/...) — ver Further Notes.

## Further Notes (riesgos y decisiones conscientes)
- **Diferencia de campos (informar al cliente):** el doc describe medidas "ancho total / alto del cielo / profundidad / ventana"; el sistema captura "largo / ancho / alto / forma + conexiones + estado + servicios". La sección renderiza el esquema **real** (v1). Si el cliente quiere exactamente sus campos, es un cambio aparte al `visitMeasurementsV1Schema` (versionar a v2).
- **Fotos no categorizadas:** hoy `visits.photos` es un array plano. El doc las describe "categorizadas" (general/ventana/hidráulico/tomacorrientes). Recomendación: galería plana primero; si el cliente lo valora, agregar un `tag` por foto en `VisitPhotoUploader` (cambio menor) en una iteración.
- **Conformidad ✅ ya cumplida (informar al cliente):** captura de medidas por tipo + fotos con compresión client-side + validación ≥3 fotos + herencia de medidas al proyecto.
- **No reinventar:** reusar `initial_measurements` (009), bucket `visit_photos`, patrón `INSERT` a `notifications`, `convert_quotation_to_project`.
- **Commits:** `feat(visita-tecnica): ...` en español, `git add` por archivo, push tras OK.
