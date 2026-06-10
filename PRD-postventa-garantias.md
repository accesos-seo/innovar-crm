# PRD: Módulo de Postventa y Garantías

> **Documento autocontenido.** Otra IA debe poder implementar este módulo leyendo solo este PRD. Schema **validado contra producción el 2026-06-10** (Supabase project_ref `xdzbjptozeqcbnaqhtye` — identificador público, no secreto). ⚠️ `db/supabase_schema.sql` del repo está DESACTUALIZADO — la fuente de verdad es producción (Management API: `POST https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query`, token en `.env → SUPABASE_ACCESS_TOKEN`).

## Problem Statement

Para Innovar la relación con el cliente muere el día de la instalación: no hay seguimiento de garantías, ni canal formal de reclamos, ni medición de satisfacción, ni recompra. Lo notable es que **el backend ya tiene las tablas construidas y dormidas en producción**: `warranties` (1 fila), `warranty_claims` (0 filas), `satisfaction_surveys` (1 fila), `project_postventa_log` y `client_reactivation_log` existen sin ninguna UI que las use. Un mueble de cocina genera reclamos naturales (bisagras, ajustes, humedad) y cada reclamo mal canalizado hoy llega por WhatsApp personal y se pierde. La postventa es además la fuente de recompra y referidos — el activo comercial más barato que Innovar no está explotando.

## Solution

Un módulo `/postventa` con tres pestañas — **Garantías**, **Reclamos** y **Encuestas** — construido sobre las tablas existentes. La garantía se crea sola al entregar un proyecto; los reclamos se registran con severidad y responsable y avisan por WhatsApp al admin; al entregar se dispara una encuesta de satisfacción de 4 preguntas que el cliente responde desde una página pública sin login; y un dashboard muestra NPS, reclamos abiertos y garantías por vencer.

## User Stories

- Como **admin**, quiero que al entregar un proyecto se cree automáticamente su garantía de 12 meses, para no depender de registros manuales.
- Como **comercial/admin**, quiero registrar un reclamo de garantía con severidad y foto, asignarlo a alguien y seguirlo hasta resolverlo, para que ningún reclamo se pierda en WhatsApp.
- Como **admin**, quiero recibir un WhatsApp cuando entra un reclamo de severidad alta o crítica, para reaccionar el mismo día.
- Como **cliente**, quiero calificar mi experiencia desde un link de WhatsApp en menos de un minuto y sin login, para dar mi opinión sin fricción.
- Como **dueño**, quiero ver el promedio de satisfacción, % que recomendaría, reclamos abiertos y tiempo medio de resolución, para saber si la operación postventa funciona.
- Como **admin**, quiero ver qué garantías vencen pronto, para ofrecer mantenimiento preventivo (recompra).

## Contexto del sistema existente (leer antes de implementar)

**Stack:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui, React Query, Zustand (auth), react-router con `lazy()`. Supabase (Postgres + RLS + Edge Functions Deno + Storage). **DB en inglés, labels UI en español.**

### Tablas YA EXISTENTES en producción (construir sobre ellas, NO recrearlas)

**`warranties`** — `id uuid, project_id uuid, client_id uuid, warranty_months integer, starts_at timestamptz, expires_at timestamptz, status varchar, notes text, created_at, updated_at`
CHECK de `status`: `'active' | 'expired' | 'claimed' | 'voided'`

**`warranty_claims`** — `id uuid, warranty_id uuid, reported_at timestamptz, description text, severity varchar, status varchar, resolved_at timestamptz, resolution_notes text, assigned_to uuid, created_at, updated_at`
CHECK de `severity`: `'low' | 'medium' | 'high' | 'critical'`
CHECK de `status`: `'open' | 'in_progress' | 'resolved' | 'rejected'`

**`satisfaction_surveys`** — `id uuid, project_id uuid, client_id uuid, sent_at timestamptz, responded_at timestamptz, rating_overall smallint, rating_quality smallint, rating_punctuality smallint, rating_service smallint, comments text, would_recommend boolean, status varchar, created_at`
CHECKs: cada rating entre 1 y 5; `status`: `'pending' | 'sent' | 'responded' | 'expired'`
⚠️ **No tiene columna de token público** — la migración de este PRD la agrega.

**`project_postventa_log`** — `id, project_id, triggered_at, dry_run boolean, queue_ids array, created_at` (log de automatización postventa; escribir aquí cuando el motor dispare mensajes).

**`client_reactivation_log`** — existe; la usa la EF `reactivate-clients` (cron mensual, template `reactivacion_remodelacion_v1`). No tocarla.

### Resto del contexto

**Enum `project_status` (PROD):** `'contacto' | 'cotizacion_aprobada' | 'en_diseno' | 'aprobacion_final' | 'en_produccion' | 'listo_instalacion' | 'entregado' | 'completado'`. La entrega real se marca con `projects.delivered_at` (timestamptz) y/o paso a `'entregado'`.

**Tabla `projects` (columnas relevantes):** `id, client_id, name, work_type, status, delivered_at, delivery_date, is_archived, deleted_at`. **`clients`:** `id, name, email, whatsapp_phone, address`.

**Roles (prod):** `'admin' | 'comercial' | 'diseno' | 'produccion' | 'super_admin'` en `profiles.role`.

**Notificaciones WhatsApp** — función SQL de prod (firma exacta):
```sql
enqueue_notification(
  p_event_type text, p_event_reference_id text, p_entity_type text,
  p_entity_reference_id text, p_recipient_type text, p_recipient_reference_id text,
  p_recipient_name text, p_recipient_phone text, p_template_name text,
  p_template_language text, p_template_parameters jsonb, p_payload jsonb
)
```
Cola `notification_queue` (tiene `dedup_key`, `scheduled_for` para envío diferido) procesada por la EF `process-whatsapp-notifications` cada minuto (Meta Graph API v21.0). `system_settings.wa_test_phone_override` redirige TODO al número de QA — mantenerlo durante pruebas. Templates existentes de referencia (naming): `welcome_lead_v1`, `quotation_sent_v1`, `payment_request_v1`, `proyecto_completado_v1`, `reactivacion_remodelacion_v1`.

**Patrón público sin login** (copiar de `src/pages/PublicQuotation.tsx` + migraciones `009`/`014`/`035a`): página pública + RPC `SECURITY DEFINER` ejecutable por `anon` que valida un token y lee/escribe lo mínimo. Tokens: `encode(gen_random_bytes(16),'hex')`.

**`system_settings`** — tabla key/value con UI de parámetros existente. Claves relevantes: `public_app_base_url` (= `'https://crm-innovar-app-2026.vercel.app'`), `wa_test_phone_override`.

**Patrón de página tipo** (copiar de `src/pages/Projects.tsx`): hook React Query + `CategoryHeader` → `MetricsGrid` → `StatusSubnav` → `DataTable`, detalle en `DetailModal`/Sheet, filtros en `FilterSheet`. Rutas: `<Route path="..." element={<Protected roles={[...]}><Page /></Protected>} />` (lazy). Feature flags en `src/lib/features.ts` (patrón `VITE_FF_*`). Design system: inputs `h-12 rounded-none border-border/50`, botones `h-14`.

**Migraciones:** `db/migrations/NNN_nombre.sql`, idempotentes + `-- ROLLBACK` comentado. Última en prod: `052`. Lote de PRDs Tier 1: portal=053, producción=054, **postventa=055** (`055_postventa_module.sql`). Independientes en código; solo coordinan numeración.

## Implementation Decisions

### Módulos involucrados

1. **Página `/postventa`** (interna) — tabs Garantías / Reclamos / Encuestas + métricas.
2. **Página pública `/encuesta/:token`** — formulario de satisfacción del cliente.
3. **Migración `055_postventa_module.sql`** — triggers de automatización, token de encuestas, RPCs públicas, bucket de fotos de reclamos.
4. **Edge Function `postventa-engine`** (nueva, cron diario) — expira garantías, envía encuestas pendientes, recuerda reclamos estancados.

### Migración `055_postventa_module.sql`

1. **Columnas nuevas:**
   - `satisfaction_surveys`: `ADD COLUMN IF NOT EXISTS public_token text UNIQUE DEFAULT encode(gen_random_bytes(16),'hex')`, `ADD COLUMN IF NOT EXISTS expires_at timestamptz` (default `now() + interval '30 days'` aplicado por trigger al crear).
   - `warranty_claims`: `ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb`, `ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id)`, `ADD COLUMN IF NOT EXISTS claim_number text UNIQUE` (formato `GAR-{year}-{seq}`, generado por función con secuencia — copiar el patrón atómico de `generate_quotation_number` de la migración `001`).
2. **Trigger `trg_create_warranty_on_delivery`** — `AFTER UPDATE ON projects`, cuando `NEW.delivered_at IS NOT NULL AND OLD.delivered_at IS NULL` (o status pasa a `'entregado'` — cubrir ambos con OR, con guard de idempotencia): si no existe ya `warranties` para ese `project_id`, INSERT con `warranty_months` desde `system_settings.warranty_default_months` (seed `'12'`), `starts_at = NEW.delivered_at`, `expires_at = starts_at + (warranty_months || ' months')::interval`, `status 'active'`.
3. **Trigger `trg_create_survey_on_delivery`** — mismo evento: si no existe `satisfaction_surveys` para ese `project_id`, INSERT con `status 'pending'` (el envío real lo hace `postventa-engine`, no el trigger — separación captura/envío).
4. **RPCs públicas (`SECURITY DEFINER`, `GRANT EXECUTE TO anon`):**
   - `get_public_survey(p_token text) RETURNS jsonb` — valida token vigente (`status IN ('pending','sent')`, `expires_at > now()`); devuelve `{ project_name, client_first_name, work_type, already_responded }`. Token inválido → `{"error":"not_found"}`.
   - `submit_public_survey(p_token text, p_overall int, p_quality int, p_punctuality int, p_service int, p_would_recommend boolean, p_comments text) RETURNS jsonb` — valida token + rangos 1–5 + `status <> 'responded'`; UPDATE con `responded_at = now()`, `status 'responded'`. Idempotente: segunda llamada devuelve `{"error":"already_responded"}`.
5. **Trigger `trg_notify_claim_created`** — `AFTER INSERT ON warranty_claims`: si `severity IN ('high','critical')`, `enqueue_notification('warranty.claim_created', NEW.id::text, 'warranty_claim', NEW.id::text, 'staff', <admin profile id>, <admin name>, <teléfono desde system_settings.postventa_alert_phone>, 'garantia_reclamo_admin_v1', 'es', jsonb_build_array(<claim_number>, <project name>, <severity label>), '{}')`. Seed `postventa_alert_phone` en `system_settings` (vacío = no enviar).
6. **Bucket `claim-photos`** (privado, 10 MB, MIME `image/jpeg,image/jpg,image/png,image/webp`): policies para `authenticated` (cualquier rol interno) — mismo patrón que `visit_photos` (migración `027`). Path: `<claim_id>/<uuid>.<ext>`.
7. **Vista `v_postventa_metrics`** (para el dashboard): garantías activas, garantías que vencen en 60 días, reclamos por status, tiempo medio de resolución en días (`avg(resolved_at - reported_at)` de resueltos últimos 90 días), promedio de cada rating y % `would_recommend` de encuestas respondidas.
8. **ROLLBACK** comentado al pie.

### Edge Function `postventa-engine` (cron diario 8:00 AM Bogotá, `verify_jwt = false` — patrón interno del repo para funciones de cron; ver `conventions`/EFs existentes como `reactivate-clients`)

Pasos, todos idempotentes:
1. **Expirar garantías:** `UPDATE warranties SET status='expired' WHERE status='active' AND expires_at < now()`.
2. **Enviar encuestas pendientes:** `satisfaction_surveys` con `status='pending'` y `projects.delivered_at < now() - interval '2 days'` (esperar 2 días post-entrega): encolar `enqueue_notification('survey.request', survey.id::text, ..., 'encuesta_satisfaccion_v1', 'es', jsonb_build_array(<first_name>, <link /encuesta/:token>), ...)` usando `dedup_key = 'survey:'||survey.id`; marcar `status='sent'`, `sent_at=now()`. Registrar en `project_postventa_log` (`queue_ids` con los ids encolados, `dry_run` según corresponda).
3. **Expirar encuestas:** `status='sent' AND expires_at < now()` → `'expired'`.
4. **Recordar reclamos estancados:** reclamos `open|in_progress` sin update hace > 5 días → encolar aviso interno al `postventa_alert_phone` con `dedup_key='claim-stale:'||id||':'||date_trunc('week',now())` (máx. 1 por semana por reclamo).
5. **Respetar DRY_RUN:** leer `system_settings.postventa_dry_run` (seed `'true'`); si es true, escribir el log con `dry_run=true` y NO encolar. **El módulo nace en DRY_RUN y solo se activa con aprobación explícita del usuario.**

### Página interna `/postventa`

- Ruta: `<Route path="/postventa" element={<Protected roles={["admin","super_admin","comercial"]}><PostventaPage /></Protected>} />` (lazy) + ítem "Postventa" en sidebar (ícono `ShieldCheck` de lucide-react). Feature flag `VITE_FF_POSTVENTA` (`FEATURES.postventaEnabled`).
- **Header:** `CategoryHeader` + `MetricsGrid` leyendo `v_postventa_metrics`: "Garantías activas", "Vencen en 60 días", "Reclamos abiertos", "Satisfacción promedio" (estrella + n encuestas), "% recomendaría".
- **Tab Garantías:** `DataTable` — proyecto, cliente, inicio, vence (badge ámbar si < 60 días, rojo si vencida), status (labels: active="Activa", expired="Vencida", claimed="Con reclamo", voided="Anulada"), nº de reclamos. Acciones: ver detalle (Sheet con datos + reclamos asociados + botón "Nuevo reclamo"), anular garantía con motivo (solo admin; escribe `notes`). Filtro por status (`StatusSubnav`).
- **Tab Reclamos:** `DataTable` — `claim_number`, proyecto/cliente (join vía warranty), severidad (badge: low="Baja" gris, medium="Media" azul, high="Alta" ámbar, critical="Crítica" rojo), status (open="Abierto", in_progress="En proceso", resolved="Resuelto", rejected="Rechazado"), asignado, días abierto. **Crear reclamo** (modal): seleccionar garantía activa (combobox por cliente/proyecto), descripción, severidad, asignado (`profiles` activos), fotos (sube a `claim-photos`, guarda paths en `photos` JSONB). Al crear, si la garantía estaba `active` → pasarla a `claimed`. **Detalle/resolución** (Sheet): cambiar status, `resolution_notes` obligatorio al resolver/rechazar, `resolved_at` automático; galería de fotos con signed URLs.
- **Tab Encuestas:** `DataTable` — proyecto, cliente, status (pending="Pendiente", sent="Enviada", responded="Respondida", expired="Expirada"), enviada el, respondida el, rating general (estrellas), recomendaría (sí/no). Acciones: copiar link público, reenviar (re-encola con dedup), ver respuesta completa (Sheet con los 4 ratings + comentario). Botón "Enviar ahora" por fila (bypassa la espera de 2 días; respeta DRY_RUN).
- Hooks nuevos React Query: `useWarranties()`, `useWarrantyClaims()`, `useSurveys()`, `usePostventaMetrics()` + mutaciones correspondientes, siguiendo el patrón de `useProjects`/`useUpdateProject`.

### Página pública `/encuesta/:token` — `src/pages/PublicSurvey.tsx`

- Ruta pública sin `Protected`, junto a `/cotizacion/:token` en `App.tsx`. Mobile-first (llega por WhatsApp).
- Flujo: carga `get_public_survey(token)` → saludo con nombre ("¿Cómo fue tu experiencia con tu {work_type label}, {nombre}?") → 4 preguntas con 5 estrellas táctiles grandes (General, Calidad del producto, Puntualidad, Atención del equipo) → toggle "¿Nos recomendarías?" (Sí/No) → comentario opcional (textarea) → botón enviar (`h-14`).
- Submit → `submit_public_survey(...)` → pantalla de gracias (si rating_overall ≥ 4, mostrar CTA "¿Nos dejas una reseña en Google?" con link leído de `system_settings.google_review_url` — seed vacío, ocultar si vacío).
- Token inválido/expirado/ya respondida → mensaje amable, sin detalles técnicos.

### Template WhatsApp nuevos (registrar en Meta — proceso externo, bloqueante solo del envío)

1. `encuesta_satisfaccion_v1` (UTILITY, es): `Hola {{1}} 👋 ¡Gracias por confiar en Innovar! Nos encantaría saber cómo fue tu experiencia. Respóndenos en 1 minuto: {{2}}`
2. `garantia_reclamo_admin_v1` (UTILITY, es): `⚠️ Nuevo reclamo de garantía {{1}} — Proyecto: {{2}}. Severidad: {{3}}. Revisa el CRM para asignarlo.`

## Testing Decisions

- **Migración 055:** aplicar vía Management API; verificar columnas/función/triggers/vista con queries de `information_schema` y `pg_trigger`. Las tablas ya tienen 1 garantía y 1 encuesta de prueba en prod — verificar que la migración no las rompe (la encuesta existente recibirá token por el DEFAULT solo en filas nuevas: hacer `UPDATE satisfaction_surveys SET public_token = encode(gen_random_bytes(16),'hex') WHERE public_token IS NULL` como backfill dentro de la migración).
- **Trigger de garantía:** marcar `delivered_at` en un proyecto de prueba → fila en `warranties` con `expires_at` = +12 meses y fila `pending` en `satisfaction_surveys`; repetir el UPDATE → no duplica.
- **RPCs públicas (como `anon`, con la anon key):** `get_public_survey` con token válido/inválido/expirado; `submit_public_survey` feliz, con rating fuera de rango (rechaza), doble submit (rechaza el segundo).
- **postventa-engine:** ejecutar manualmente con `postventa_dry_run='true'` → escribe `project_postventa_log` con `dry_run=true` y `notification_queue` queda intacta. Luego con dry_run off y `wa_test_phone_override` activo (redirige al número de QA del equipo — **nunca a clientes reales**) → fila en cola con `dedup_key`; segunda ejecución no duplica.
- **UI:** crear reclamo high → garantía pasa a `claimed` + (dry_run off) notificación admin encolada; resolver reclamo exige `resolution_notes`. Encuesta pública en viewport 390px.
- **Build:** `npx tsc --noEmit` + `npm run build` limpios en `D:\Agents-automations\04-Innovar`; smoke con `vite preview`.

## Out of Scope

- Mantenimientos preventivos programados (recordatorio anual de mantenimiento) — V2 natural de este módulo; las garantías por vencer del dashboard ya dan la señal comercial.
- Portal del cliente para crear reclamos él mismo (V2; en V1 los registra el equipo).
- Integración con `reactivate-clients` / reactivación de dormidos (ya existe como EF separada).
- Costeo de reclamos (mano de obra/materiales del arreglo) — se anota en `resolution_notes` en V1.
- NPS formal (pregunta 0–10); V1 usa CSAT 1–5 + would_recommend, que ya están en la tabla.
- Modificar el flujo de `proyecto_completado_v1` existente.

## Further Notes

- **La ventaja de este módulo:** el schema ya está en producción — el costo es UI + 1 migración liviana + 1 EF. No rediseñar las tablas; los CHECK constraints listados arriba son los reales de prod.
- **Dependencia externa:** aprobación Meta de las 2 templates (días/semanas). Todo lo demás funciona sin ellas: encuestas pueden compartirse con "copiar link" y los reclamos viven completos en el CRM. Dejar `postventa_dry_run='true'` hasta que el usuario apruebe el switch.
- **Cron:** programar `postventa-engine` en el orquestador n8n existente del proyecto (instancia EasyPanel) o `pg_cron` si el proyecto ya lo usa — verificar cómo están programados los crons de `reactivate-clients`/`vigia-pagos` y replicar el mismo mecanismo.
- **Decisión consciente:** la encuesta se dispara a los 2 días de la entrega (no inmediato) para que el cliente ya haya usado su cocina; valor configurable si se desea (`system_settings.survey_delay_days`, seed `'2'`).
- Si al implementar se detecta que `warranties`/`satisfaction_surveys` tienen triggers o RLS previos (fueron creadas por una automatización anterior), inventariarlos antes de agregar los nuevos: `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid IN ('public.warranties'::regclass, 'public.satisfaction_surveys'::regclass, 'public.warranty_claims'::regclass) AND NOT tgisinternal;`
- Commits en español (`feat(postventa): ...`), `git add` por archivo, push solo con autorización del usuario.
