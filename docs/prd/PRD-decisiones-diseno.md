# PRD — Decisiones del Cliente · Departamento DISEÑO

> **Autocontenido.** Esquema **verificado contra producción** + código vivo el **19/06/2026**. Re-validar contra prod antes de implementar.
>
> **Origen:** Cuestionario 2, **Preguntas 1, 8 y 11** de [`../decisiones/decisiones-innovar-cuestionarios.md`](../decisiones/decisiones-innovar-cuestionarios.md). (La Pregunta 10 — visita técnica — está en [`PRD-decisiones-visita-tecnica.md`](PRD-decisiones-visita-tecnica.md).) Estado en la [matriz](../decisiones/00-matriz-segmentacion-brechas.md). **Depende de** [`PRD-decisiones-comercial-aprobaciones.md`](PRD-decisiones-comercial-aprobaciones.md) (este PRD publica la versión que aquél hace aprobar).

## Problem Statement

El cliente describe la entrega de diseño así: el equipo sube modelado y renders, los **envía al cliente**, el cliente ve **solo la versión vigente** (no V1/V2/V3), en formatos imagen/PDF de hasta 12MB. Hoy:
- Los archivos de diseño **existen y se versionan** (`design_3d_files` JSONB, contador `length+1`, bucket privado `project-files`), pero **son internos**: no hay botón **"Enviar al cliente"** ni galería que el cliente vea (el portal de tracking muestra fotos de obra, no renders).
- Los **límites** son 50MB (`project-files`) / 10MB (`project-photos`), no 12MB; acepta `.skp/.dwg/.dxf` además de imagen/PDF (archivos internos).
- Los **contadores de revisión no tienen tope** (decisión del dueño pendiente).

## Solution

Separar el **3D interno** (lo que ya existe) de la **entrega al cliente** (renders/imágenes/PDF), agregar la acción **"Enviar versión al cliente"** que publica la versión vigente al portal de aprobación (PRD Comercial) y arranca el temporizador de recordatorios, y exponer al cliente **solo la versión vigente**.

## User Stories
- Como **diseñador**, quiero subir el modelado y luego los renders, y con un botón **enviarlos al cliente** para que los apruebe.
- Como **cliente**, quiero ver **solo el diseño vigente** presentado de forma clara, no el historial de intentos.
- Como **diseñador/admin**, quiero que el equipo sí conserve el historial completo de versiones internamente.

## Contexto del sistema existente (leer antes de implementar)

| Pieza | Ubicación | Estado |
|---|---|---|
| Archivos 3D | `projects.design_3d_files` JSONB `[{path,name,version,uploaded_at,uploaded_by}]`; bucket privado `project-files`; UI `ProjectDetail.tsx:294-351` ("Subir Nueva Versión") | ✅ interno |
| Hook upload + versión | `src/hooks/useProjects.ts:214-280` (`useUpload3DFile`, `version = length+1`, compresión imágenes 1920px/0.85) | ✅ |
| Contadores | `projects.modelado_revision_number`, `render_revision_number` (se incrementan en frontend) | ✅ sin tope |
| Aprobación (timestamps) | `modelado_approved_at`, `renders_approved_at` (solo-lectura; nadie los setea hoy → los setea el PRD Comercial) | 🟡 |
| Portal del cliente | `src/pages/PublicProjectTracking.tsx` (timeline + fotos de obra) — **no muestra renders** | 🔴 para diseño |
| Buckets | `project-files` (50MB, internos), `project-photos` (10MB, img), `project-gallery` (público) | — |
| Token público diseño | `projects.design_review_token` (lo crea el PRD Comercial) | — |

## Implementation Decisions

> Decisiones técnicas tomadas con criterio. Las del dueño van abajo.

### 1. Separar "3D interno" de "entrega al cliente"
El cliente aprueba sobre **imágenes/PDF**, no sobre archivos `.skp/.dwg` (no se ven en un celular). **Decisión:** los `.skp/.dwg/.dxf` quedan internos en `project-files`; lo que se **envía y aprueba** son renders/imágenes/PDF. Agregar a cada entrada de `design_3d_files` un campo `tipo ('modelado' | 'render')` y `cliente_visible (boolean)`; o, más limpio, un array nuevo `projects.client_design_assets JSONB` `[{path,name,tipo,version,sent_at}]` para lo que ve el cliente. **Se usa `client_design_assets`** (no contamina los archivos técnicos).

### 2. Acción "Enviar versión al cliente"
Botón en `ProjectDetail` (sección diseño) → RPC `send_design_to_client(p_project_id, p_stage)`:
- Marca la versión vigente de `client_design_assets` para ese `stage`.
- Setea `projects.design_sent_at = now()` (reinicia el temporizador de recordatorios del PRD Comercial), `design_stage = p_stage`.
- Asegura `design_review_token` (genera si falta).
- Encola WhatsApp al cliente (plantilla Meta `design_version_ready_client_v1`) con el link `/diseno/:token`.
- Si es re-envío (revisión ≥ 1), incrementa el contador correspondiente.

### 3. El cliente ve SOLO la versión vigente (Q11)
La RPC pública `get_public_design(p_token)` (definida en PRD Comercial) devuelve únicamente los `client_design_assets` del `design_stage` vigente, **no** el historial. Internamente, `ProjectDetail` muestra todas las versiones (galería interna con `version`, fechas, quién subió). El historial completo queda del lado del equipo.

### 4. Formatos y límites (Q8)
- **Entrega al cliente:** JPG/PNG/PDF, **límite 12MB** por archivo (subir `project-photos`/un bucket `design-renders` de 12MB; las imágenes pasan por la compresión existente 1920px/0.85; PDF sin comprimir). Rechazo de tipos inválidos (validación ya existe).
- **Interno:** `project-files` sigue aceptando `.skp/.dwg/.dxf` (sin cambio).
- El portal distingue galería de imágenes vs ícono de PDF (reusar el patrón del portal de cotización).

### 5. Contadores con/sin tope
Hoy sin tope. **Si** el dueño define un tope (ver Decisiones del dueño), agregar al `send_design_to_client` un chequeo que, al superar N, marque el proyecto con un aviso ("rondas incluidas superadas") visible para comercial/admin — **sin frenar** el flujo (solo señal para cobrar ajustes). Si el dueño elige "sin tope", el contador queda solo para visibilidad (estado actual).

## Testing Decisions
1. **Enviar al cliente:** subir render → "Enviar versión al cliente" → `client_design_assets` marcado, `design_sent_at` seteado, WhatsApp encolado, link `/diseno/:token` abre la versión.
2. **Solo vigente:** `get_public_design` devuelve solo la versión actual; subir y enviar una V2 → el cliente ve V2, no V1; internamente se ven ambas.
3. **Formatos:** subir >12MB o tipo inválido al set del cliente → rechazo claro; imagen válida → comprimida; PDF → tal cual.
4. **Re-envío:** segundo envío incrementa el contador; si hay tope, al superarlo aparece el aviso sin frenar.

## Out of Scope
- El portal de aprobación, los botones Aprobar/Solicitar cambios y los recordatorios → **PRD Comercial/Aprobaciones**.
- La sección "Levantamiento técnico" (medidas/fotos de visita en la ficha) → **PRD Visita Técnica**.

## Decisiones del dueño (pendientes — para el documento a enviar)
1. **C2-Q1 — Tope de rondas de cambios:** ¿ilimitadas (hoy) o un tope antes de cobrar ajustes adicionales? Si hay tope: **¿cuántas rondas incluye el contrato, y se cuentan por etapa (modelado y render por separado) o sobre el diseño completo?** Es política comercial pura — solo el dueño la define.
2. **¿Qué ve el cliente como "modelado" para aprobarlo?** El modelado 3D real (`.skp`) no se ve en el celular. Asumimos que se le envían **renders/imágenes del modelado** (no un visor 3D). Confirmar si el dueño espera que el cliente navegue un 3D interactivo (sería un alcance mayor) o si imágenes del modelado bastan.

## Further Notes
- **No reinventar:** reusar `useUpload3DFile` (compresión), el patrón de galería del portal de cotización, `notification_queue` para el envío.
- **Plantilla Meta nueva (agencia):** `design_version_ready_client_v1`.
- **Conformidad ✅ (informar al cliente):** versionado interno de archivos + compresión de imágenes ya existen; lo que falta es la entrega al cliente.
- **Commits:** `feat(diseno): ...`, push tras OK.
