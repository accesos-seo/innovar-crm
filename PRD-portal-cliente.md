# PRD: Portal del Cliente "Mi Proyecto"

> **Documento autocontenido.** Otra IA debe poder implementar este módulo leyendo solo este PRD. Toda la información de schema aquí listada fue **validada contra la base de datos de producción el 2026-06-10** (Supabase project_ref `xdzbjptozeqcbnaqhtye`). ⚠️ El archivo `db/supabase_schema.sql` del repo está DESACTUALIZADO — no usarlo como fuente de verdad; la fuente de verdad es producción (consultar vía Management API: `POST https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query`, token en `.env → SUPABASE_ACCESS_TOKEN`).

## Problem Statement

Innovar fabrica cocinas y muebles a medida: proyectos de 6–12 semanas entre la aprobación de la cotización y la instalación. Durante ese período el cliente final no tiene ninguna visibilidad del avance — llama o escribe por WhatsApp para preguntar "¿cómo va mi cocina?", lo que consume tiempo del equipo comercial y genera ansiedad/desconfianza en el cliente. Toda la información ya existe en el CRM (estado del proyecto, hitos con timestamp, fotos, pagos, fecha de instalación) pero solo es visible para el personal interno.

## Solution

Una página pública mobile-first, accesible por link con token (sin login), donde el cliente ve su proyecto avanzar: línea de tiempo de fases con la fase actual destacada, fotos del proceso (diseño / producción / final), resumen de pagos (anticipo, saldo pendiente) y fecha estimada/agendada de instalación. El link se le envía por WhatsApp al convertirse la oportunidad en proyecto, y el equipo puede reenviarlo en cualquier momento desde el detalle del proyecto.

Es el patrón "rastrear mi pedido": el cliente entra cuando quiere, el equipo deja de responder preguntas de estado, e Innovar se diferencia de cualquier competidor artesanal.

## User Stories

- Como **cliente de Innovar**, quiero abrir un link desde WhatsApp y ver en qué fase está mi proyecto, para no tener que llamar a preguntar.
- Como **cliente**, quiero ver fotos del avance de mi mueble en producción, para sentir confianza de que el trabajo avanza.
- Como **cliente**, quiero ver cuánto he pagado y cuánto debo, para planear mi saldo antes de la instalación.
- Como **cliente**, quiero ver la fecha agendada de instalación, para organizar mi casa ese día.
- Como **comercial**, quiero copiar/reenviar el link de seguimiento desde el detalle del proyecto, para compartirlo cuando el cliente lo pida.
- Como **admin**, quiero que el link se envíe automáticamente por WhatsApp al crear el proyecto, para no depender de pasos manuales.

## Contexto del sistema existente (leer antes de implementar)

**Stack:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui, React Query para datos, Zustand para auth, react-router con `lazy()`. Backend: Supabase (Postgres + RLS + Edge Functions Deno + Storage). Deploy frontend: Vercel (`https://crm-innovar-app-2026.vercel.app`). Convención: **DB en inglés, labels de UI en español**.

**Infraestructura pública ya existente (REUTILIZAR, no reinventar):**
- `projects.tracking_token` — columna `uuid` que **ya existe en producción y está dormida** (se genera pero ninguna UI la usa). Es el token de este portal. NO crear columna nueva.
- Patrón de páginas públicas ya implementado en `src/pages/PublicQuotation.tsx`, `src/pages/PublicBooking.tsx`, `src/pages/PublicQuotationByCode.tsx` (resolución de short codes). Copiar su estructura.
- Patrón de RPCs públicas: funciones `SECURITY DEFINER` ejecutables por `anon` que validan el token y devuelven JSONB (ver `validate_public_token(p_token text, p_scope text)` y `get_public_quotation(p_token text)` en migraciones `009` y `035a` de `db/migrations/`). Las tablas NO exponen RLS a anon; todo pasa por RPC.
- `system_settings` (tabla key/value) tiene `public_app_base_url` = `'https://crm-innovar-app-2026.vercel.app'` — usarla para construir links.
- Tabla `project_photos` — **ya existe en producción, vacía, sin UI**: `id uuid, project_id uuid, stage photo_stage, photo_url text, caption text, created_at timestamptz`. Enum `photo_stage` (prod): `'diseno' | 'produccion' | 'final'`.
- Tabla `project_phase_log` — ya existe (log de notificaciones de fase): `id, project_id, phase text, notified_at, queue_id, dry_run, created_at`.

**Tabla `projects` — columnas relevantes (validadas en prod):**
`id uuid, client_id uuid, name text, work_type work_type, status project_status, tracking_token uuid, total_amount numeric, advance_amount numeric, balance_due numeric, is_fully_paid boolean, fully_paid_at timestamptz, client_approved_at timestamptz, design_deadline timestamptz, design_delivered_at timestamptz, modelado_approved_at timestamptz, renders_approved_at timestamptz, materials_purchased_at timestamptz, fabrication_started_at timestamptz, estimated_fabrication_days integer, estimated_install_date timestamptz, scheduled_install_date timestamptz, installation_scheduled_at timestamptz, install_duration_days integer, delivered_at timestamptz, delivery_date date, is_archived boolean, deleted_at timestamptz, designer_id uuid (FK profiles), created_by uuid`

**Enum `project_status` (PROD — esta es la lista real, el repo lista otra):**
`'contacto' | 'cotizacion_aprobada' | 'en_diseno' | 'aprobacion_final' | 'en_produccion' | 'listo_instalacion' | 'entregado' | 'completado'`

**Enum `work_type` (prod):** `'cocina' | 'closet' | 'puertas' | 'centro_tv' | 'otro'`

**Tabla `clients`:** `id, name, email, whatsapp_phone, address, notes, data_origin, created_by, created_at, updated_at, deleted_at`.

**Notificaciones WhatsApp:** se encolan con la función SQL (firma exacta de prod):
```sql
enqueue_notification(
  p_event_type text, p_event_reference_id text, p_entity_type text,
  p_entity_reference_id text, p_recipient_type text, p_recipient_reference_id text,
  p_recipient_name text, p_recipient_phone text, p_template_name text,
  p_template_language text, p_template_parameters jsonb, p_payload jsonb
)
```
La cola `notification_queue` la procesa la Edge Function `process-whatsapp-notifications` (cron cada minuto, Meta Graph API v21.0). `system_settings.wa_test_phone_override` redirige TODO a un número de prueba durante QA — **no tocar ese override**.

**Feature flags:** `src/lib/features.ts` exporta `FEATURES = { xxxEnabled: import.meta.env.VITE_FF_XXX === 'true', ... }`. Agregar el flag de este módulo ahí.

**Migraciones:** `db/migrations/NNN_nombre.sql`. Última en prod: `052`. **Esta feature usa `053_client_portal.sql`.** Convención: idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`) + bloque `-- ROLLBACK` comentado al pie.

**Design system:** inputs de formulario `h-12 rounded-none border-border/50`; botones primarios `h-14`. Componentes compartidos disponibles: `PremiumLoader`, `EmptyState`.

## Implementation Decisions

### Módulos involucrados

1. **Página pública `/proyecto/:token`** (nueva) — el portal en sí.
2. **Edge Function `public-project-tracking`** (nueva) — resuelve token → datos + signed URLs de fotos.
3. **Migración `053_client_portal.sql`** — RPC de validación, trigger de envío de link, bucket de fotos.
4. **UI interna: bloque "Portal del cliente" en `ProjectDetail`** — copiar link, reenviar por WhatsApp, subir fotos a `project_photos`.

### Decisión arquitectónica clave: Edge Function, no RPC directa

Las fotos viven en un bucket **privado** y necesitan signed URLs, que una RPC SQL no puede generar. Por eso el portal NO llama RPCs directamente (a diferencia de `PublicQuotation.tsx`): llama a una única Edge Function `public-project-tracking` con `verify_jwt = false` que:

1. Recibe `GET ?token=<uuid>`. Valida formato UUID (regex) antes de tocar la DB.
2. Con `service_role`, busca `projects` por `tracking_token` donde `deleted_at IS NULL AND is_archived = false`. Si no existe → `404 {"error":"not_found"}` (mensaje genérico, anti-enumeración).
3. Arma el payload (contrato abajo).
4. Genera signed URLs (TTL 3600s) para cada fila de `project_photos` del proyecto, bucket `project-photos`.
5. Responde con `Cache-Control: no-store` y CORS abierto a `public_app_base_url`.

**Rate limiting:** máx. 30 requests/min por IP (en memoria de la EF es suficiente para V1; documentar como límite blando).

### Contrato de respuesta de la Edge Function

```json
{
  "project": {
    "name": "Cocina familia Ramírez",
    "work_type": "cocina",
    "status": "en_produccion",
    "client_first_name": "Carlos"
  },
  "timeline": [
    { "key": "cotizacion_aprobada", "label": "Cotización aprobada", "reached_at": "2026-05-01T...", "state": "done" },
    { "key": "en_diseno",          "label": "Diseño en progreso",  "reached_at": "2026-05-03T...", "state": "done" },
    { "key": "aprobacion_final",   "label": "Diseño aprobado",     "reached_at": "2026-05-20T...", "state": "done" },
    { "key": "en_produccion",      "label": "En fabricación",      "reached_at": "2026-05-25T...", "state": "current" },
    { "key": "listo_instalacion",  "label": "Listo para instalar", "reached_at": null, "state": "pending" },
    { "key": "entregado",          "label": "Instalado y entregado","reached_at": null, "state": "pending" }
  ],
  "photos": [ { "stage": "produccion", "url": "<signed-url>", "caption": "Módulos inferiores armados", "created_at": "..." } ],
  "payments": { "total": 18500000, "advance_paid": 9250000, "balance_due": 9250000, "is_fully_paid": false },
  "installation": { "scheduled_at": "2026-06-20T09:00:00-05:00", "estimated_date": null, "duration_days": 2 },
  "contact": { "label": "¿Dudas? Escríbenos", "whatsapp_url": "https://wa.me/57XXXXXXXXXX" }
}
```

**Mapeo de timestamps por fase** (para `reached_at`): `cotizacion_aprobada` → `client_approved_at`; `en_diseno` → `design_deadline`/`created_at` del primer registro o `design_delivered_at` si pasó; `aprobacion_final` → `renders_approved_at` (fallback `modelado_approved_at`); `en_produccion` → `fabrication_started_at`; `listo_instalacion` → `installation_scheduled_at` (fallback `scheduled_install_date`); `entregado` → `delivered_at`. Si el timestamp es NULL pero el status actual ya superó la fase, marcar `state: "done"` con `reached_at: null` (la UI muestra el check sin fecha). Los estados `contacto` y `completado` NO aparecen en la timeline del cliente (`contacto` es pre-proyecto; `completado` es cierre administrativo — mostrar `entregado` como fase final).

**Privacidad:** exponer SOLO `client_first_name` (primer token de `clients.name`), nunca email/teléfono/dirección del cliente. Montos en COP formateados en el frontend (`Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`).

**Número de contacto:** leer de `system_settings` la clave nueva `portal_contact_phone` (seed en la migración con el número comercial de Innovar; editable desde la UI de settings existente de parámetros).

### Migración `053_client_portal.sql`

1. **Backfill de tokens:** `UPDATE projects SET tracking_token = gen_random_uuid() WHERE tracking_token IS NULL;` y `ALTER COLUMN tracking_token SET DEFAULT gen_random_uuid()` + `SET NOT NULL` (verificar primero que el default no exista ya).
2. **Índice:** `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tracking_token ON projects(tracking_token);`
3. **Bucket Storage `project-photos`:** privado, límite 10 MB, MIME `image/jpeg,image/jpg,image/png,image/webp`. Policies: INSERT/SELECT/DELETE para `authenticated` con rol admin/super_admin/diseno/produccion (mismo patrón que el bucket `visit_photos` de la migración `027`); sin acceso anon (las signed URLs no lo necesitan).
4. **Seed `system_settings`:** `portal_contact_phone` y `portal_link_autosend` (`'true'`/`'false'`, default `'false'` hasta que la template Meta esté aprobada).
5. **Trigger de envío automático del link** (`trg_send_tracking_link`): `AFTER UPDATE OF status ON projects`, cuando `NEW.status = 'cotizacion_aprobada' AND OLD.status IS DISTINCT FROM NEW.status` y `system_settings.portal_link_autosend = 'true'`: llamar `enqueue_notification('project.tracking_link', NEW.id::text, 'project', NEW.id::text, 'client', NEW.client_id::text, <client name>, <client whatsapp_phone>, 'tracking_link_v1', 'es', jsonb_build_array(<first_name>, <short_url>), '{}'::jsonb)`. Dedup: no encolar si ya existe fila en `notification_queue` con `event_type='project.tracking_link'` y el mismo `event_reference_id`.
6. **ROLLBACK** comentado al pie.

### Frontend público — `src/pages/PublicProjectTracking.tsx`

- Ruta en `App.tsx`: `<Route path="/proyecto/:token" element={<PublicProjectTrackingPage />} />` (lazy, SIN `Protected`, junto a las otras rutas públicas).
- **Mobile-first** (el cliente llega desde WhatsApp): una columna, tipografía generosa, sin sidebar ni chrome del CRM. Header con logo Innovar + nombre del proyecto.
- Secciones en orden: (1) hero con fase actual y % de avance (fases completadas / 6), (2) timeline vertical con checks, (3) galería de fotos agrupada por etapa con lightbox simple, (4) card de pagos (mostrar solo si `total > 0`), (5) card de instalación (solo si hay fecha), (6) botón flotante de WhatsApp.
- Estados: loading (`PremiumLoader`), token inválido/404 (pantalla amable "Este enlace no es válido o el proyecto ya no está disponible" + botón WhatsApp), error de red (retry).
- Polling no necesario; botón "Actualizar" opcional.
- Feature flag `VITE_FF_CLIENT_PORTAL` (`FEATURES.clientPortalEnabled`): si está OFF, la ruta renderiza el 404 amable.

### UI interna — bloque en ProjectDetail

En la página de detalle de proyecto existente (`/projects/:id`), agregar card "Portal del cliente" visible para todos los roles:
- URL completa `<public_app_base_url>/proyecto/<tracking_token>` con botón **Copiar**.
- Botón **Enviar por WhatsApp** → inserta en `notification_queue` vía `enqueue_notification` con template `tracking_link_v1` (deshabilitado con tooltip "Template pendiente de aprobación Meta" mientras no exista).
- Subcomponente **Fotos del proyecto**: subir foto → bucket `project-photos` path `<project_id>/<uuid>.<ext>` → INSERT en `project_photos` con `stage` seleccionable (`diseno|produccion|final` con labels "Diseño", "Producción", "Final") y `caption` opcional. Listar/eliminar fotos existentes. Inputs según design system (`h-12 rounded-none border-border/50`).

### Template WhatsApp `tracking_link_v1` (registrar en Meta — proceso externo)

- Idioma `es`, categoría UTILITY. Body sugerido: `Hola {{1}} 👋 Tu proyecto con Innovar ya está en marcha. Sigue su avance paso a paso aquí: {{2}}. Te avisaremos en cada etapa.`
- Hasta su aprobación, el portal funciona igual (link copiable manualmente).

## Testing Decisions

- **EF `public-project-tracking`:** probar con curl — token válido (200 + payload completo), token UUID inexistente (404 genérico), token malformado (400 sin tocar DB), proyecto archivado/eliminado (404). Verificar que el payload NO contenga email/teléfono/dirección del cliente.
- **Signed URLs:** subir una foto de prueba, verificar que la URL firmada abre la imagen y que la URL directa del bucket (sin firma) da 403.
- **Trigger:** en un proyecto de prueba, pasar status a `cotizacion_aprobada` con `portal_link_autosend='true'` y verificar fila en `notification_queue` con template `tracking_link_v1`; repetir el cambio de estado y verificar que NO se duplica. ⚠️ Mensajería: mantener `wa_test_phone_override` activo (en `system_settings`; redirige todo envío al número de QA autorizado del equipo — los números de prueba están documentados en las convenciones internas de notificaciones, no en este PRD). **Nunca probar contra clientes reales.**
- **Frontend:** `npx tsc --noEmit` + `npm run build` limpios (el repo está en OneDrive en una copia y en D: la canónica — trabajar SIEMPRE en `D:\Agents-automations\04-Innovar`; para smoke test usar `vite preview` sobre el build, no `npm run dev`). Probar la página en viewport 390px (móvil) y desktop.
- **Timeline:** caso proyecto recién aprobado (1 fase done), caso en producción (4 done, 1 current), caso entregado (todas done). Caso timestamps NULL con status avanzado (checks sin fecha).

## Out of Scope

- Aprobación de renders/diseños por el cliente desde el portal (interactividad de escritura) — V2.
- Ver/descargar la cotización desde el portal (ya existe `/cotizacion/:token` separado, Fase 4).
- Subir comprobantes de pago desde el portal (existe flujo Slice 3 separado).
- Chat embebido o comentarios del cliente.
- Notificación automática al cliente en CADA cambio de fase (ya existe parcialmente vía triggers de WhatsApp; este PRD solo agrega el envío del link).
- Login de clientes / cuentas de cliente. El acceso es solo por token.
- i18n — solo español.

## Further Notes

- **Riesgo principal:** el enum `project_status` real de prod (8 valores, listado arriba) difiere del que está en `db/supabase_schema.sql` y en types del repo. Antes de codificar el mapeo de timeline, re-validar contra prod con: `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='project_status' ORDER BY enumsortorder;`
- **Dependencia externa:** aprobación de la template `tracking_link_v1` en Meta Business (días/semanas). No bloquea el resto del módulo; dejar `portal_link_autosend='false'` hasta entonces.
- **Dato actual:** hay 12 proyectos en prod — el backfill de tokens es trivial.
- `project_phase_log` está vacía y pensada para otra cosa (log de notificaciones); no usarla para la timeline. La timeline se deriva de las columnas timestamp de `projects`.
- Decisión de expiración: el token NO expira (el portal vive lo que vive el proyecto). Si el proyecto pasa a `is_archived` o `deleted_at`, el portal devuelve 404 — eso es el "apagado".
- Commits: convención del repo en español, tipo `feat(portal): ...`. El agente implementador hace `git add <archivos>` + commit (nunca `git add .`); `git push` solo lo autoriza el usuario.
