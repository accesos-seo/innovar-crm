# Fase 3 — Visita técnica en sitio (briefing para diseño)

> **Para el próximo agente**: este documento es tu punto de entrada. Léelo entero
> antes de tocar nada. Tu primer movimiento debe ser ejecutar `/grill-me` con
> este briefing como input para diseñar la Fase 3 junto al usuario — **no
> empieces a construir hasta cerrar el grill + PRD + schema review**.

---

## 1 · Contexto operativo (no lo improvises)

| Cosa | Valor |
|---|---|
| Usuario | `accesos@seolabagency.com` (cuenta GitHub `accesos-seo`) |
| Working dir | `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main` |
| Espejo OneDrive | `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main` (mismo repo, mismo branch — usa el de Escritorio) |
| Repo GitHub | `accesos-seo/Innovar-App-main` |
| Branch activo | `ux-fixes` (último commit `d2a1f63`) |
| Producción Vercel | `https://crm-innovar-app-2026.vercel.app` |
| Subdominio brand | `agenda.cocinasintegralespereira.co` (DNS pendiente del usuario) |
| Supabase project | `xdzbjptozeqcbnaqhtye` (Innovar CRM) — **FUERA del scope del MCP nativo** |
| Domain marca | `cocinasintegralespereira.co` (WordPress, mismo dueño) |

### Reglas duras del proyecto
- **OneDrive + path con espacio (`mi proyect`)** rompen `npm run dev` (Vite middleware). Para verificación visual usar `npm run build` + `npx vite preview --port 4173 --strictPort` (config `innovar-preview` en `.claude/launch.json`).
- **No corras `vercel --prod` ni `git push` en background** — el usuario lo ejecuta manual en su PowerShell. Dáselo como bloque listo para pegar.
- **Aplicación de SQL/secrets/cron en Supabase Innovar la hace el agente** (no derivar al usuario). Las credenciales están en el `.env` local:
  - `SUPABASE_ACCESS_TOKEN` (PAT, Management API) → `POST https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query` con body `{"query":"..."}` y `Authorization: Bearer <PAT>`.
  - `SUPABASE_SERVICE_KEY` (service_role) → para cualquier cosa que necesite saltar RLS desde shell.
  - Sólo derivar al usuario cuando se necesite un secreto que **no** está en `.env` (p.ej. tokens de Meta).
- **Diagnóstico de bugs**: primero modo incógnito / Clear Site Data, luego frontend (network/console), luego backend/RLS. Lección del 2026-05-19 con JWT stale.
- **Idioma DB ↔ frontend**: la DB está en inglés (CHECK constraints, enums, valores Zod); los labels en español. Antes de tocar schemas, valida contra producción con Management API — `db/supabase_schema.sql` y `database.types.ts` están desactualizados (postmortem `bug_innovar_db_language_convention.md`).
- **Anti-patrón Supabase**: nunca llames al SDK desde `onAuthStateChange` (deadlock interno confirmado 2026-05-22, `feedback_supabase_no_sdk_in_onauth_callback.md`).
- **Anti-patrón Realtime**: `supabase.channel('<nombre-fijo>')` sólo admite un suscriptor en toda la app. Si necesitas múltiples → `crypto.randomUUID()` en el nombre.

---

## 2 · Lo que ya está construido (Fases 1-2, cerradas y en producción)

**Fase 1 — Lead → mensajes outbound automáticos**
- Tabla `clients`, `opportunities`, `visits`, `tasks`, `availability_slots`, `holidays`, `notification_queue` ya viven en producción.
- Trigger `notify_lead_followup_flow` (migración 014 + reescritura en 019) corre al `INSERT` de un `opportunities` con `data_origin='whatsapp'`: encola 2 mensajes en `notification_queue` (welcome + booking link) con `template_key='welcome_lead_v1'` / `booking_link_v1`.
- Round-robin de asesores comerciales: trigger que setea `opportunities.assigned_to` rotando entre usuarios activos con rol `comercial`. El asesor ya queda asignado antes de que el booking se envíe.
- Trigger `assign_short_code` (BEFORE INSERT) genera `opportunities.short_code` (6 chars base62, sin 0/O/1/l/I) único.
- **Pendiente externo**: los templates `welcome_lead_v1` y `booking_link_v1` no existen en Meta. Sin aprobación, el worker `process-whatsapp-notifications` (deployado v12 en Supabase) marca cada fila como `failed`. Ver `reference_innovar_whatsapp_templates.md` para el catálogo de 7 aprobados + 5 en revisión + 2 faltantes.

**Fase 2 — Booking público auto-servicio**
- Ruta `/agendar/:token` (`src/pages/PublicBooking.tsx`) + ruta corta `/v/:code` (`src/pages/PublicBookingByCode.tsx`).
- 4 RPCs `SECURITY DEFINER` para anon:
  - `resolve_short_code(p_code text)` → token o NULL
  - `get_public_booking_context(p_token text)` → cliente + asesor + expiración
  - `get_public_visit_slots(p_token, p_from, p_to)` → slots disponibles ya filtrados por holidays + visitas del asesor
  - `book_public_visit(p_token, p_scheduled_at)` → crea `visits` + invalida token + marca opp `visit_scheduled`
- Slots fijos Mar/Jue, 4 horarios por día: 09:00, 11:00, 13:30, 15:30 (hora Colombia) — definidos en migración 019.
- Trigger `mirror_visit_to_task` espeja cada `visits` insertada como `tasks` con el mismo UUID + reserva `availability_slots` del asesor.
- Helper `formatColombianTime()` en `PublicBooking.tsx:48` muestra slots como "9:00 AM / 1:30 PM" (no 24h).
- **Open Graph configurado** en `index.html` con foto `cocina-lujosa-1024x768.jpg` del dominio brand — WhatsApp previsualiza el link con tarjeta visual atractiva.

**Migraciones aplicadas en producción** (sólo las relevantes a Fases 1-2):
- `009` … `013` (legacy + notification action_urls)
- `014` whatsapp_lead_followup_flow
- `014a` …`019` (slots, short_code, round-robin, fixes E2E)
- `020` consolidate_payments_rls (otro feature, no toca este flujo)
- `021` disable_legacy_welcome_trigger

**Bug abierto pendiente**: las migraciones `009` y `010` no fueron testeadas E2E antes de aplicar (`bug_innovar_migration_009_010_never_tested.md`).

---

## 3 · Qué es la Fase 3 (alcance a ratificar con el usuario en el grill)

**Definición operativa**: el período entre que la visita queda agendada (`visit_scheduled`) y el momento en que el asesor regresa al CRM con las mediciones tomadas. Esto es el **día de la visita técnica**.

**Hipótesis de sub-fases** (úsalas como punto de partida en `/grill-me`, no como diseño final):

### 3.1 · Día anterior — Recordatorios
- WhatsApp al cliente: recordatorio 24h antes ("Mañana te visita Leo a las 9:00 AM en …")
- Notificación in-app al asesor: "Mañana tienes visita: Carolina, dirección X, 9:00 AM"
- ¿También recordatorio 2h antes?
- ¿El cliente puede reprogramar desde el recordatorio o no?

### 3.2 · Día de la visita — Asesor en movimiento
- Vista del asesor: "Mi agenda de hoy" con lista de visitas + ruta sugerida
- Botón "En camino" → WhatsApp al cliente ("Salí hacia tu casa, llego en ~X min") + opp `in_transit`
- Botón "Llegué" → check-in + opp `in_visit` + (opcional) geo-validación
- Durante la visita: panel para capturar medidas, fotos, notas estructuradas
  - ¿Qué medidas exactamente? (largo × ancho × alto del espacio, tipo de pared, presencia de gas, voltaje, etc. — el usuario tiene que dictar el formulario)
  - ¿Fotos obligatorias? ¿cuántas mínimo?
- Botón "Visita finalizada" → opp `measurements_taken` + WhatsApp resumen al cliente ("Gracias Carolina, en 48h te enviamos cotización") + tarea automática "Generar cotización" asignada al asesor

### 3.3 · Sincronización / fallos
- ¿Qué pasa si el asesor está sin internet en la visita? (offline-first del formulario de medidas?)
- ¿Qué pasa si el cliente cancela 30min antes? (workflow de cancelación)
- ¿Qué pasa si el asesor no llega? (alerta admin tras X min de tolerancia)

### 3.4 · Cierre — preparar Fase 4
- ¿La generación de quotation es Fase 3 o Fase 4? (Felipe lo decide en el grill)
- Si es Fase 4: cerrar Fase 3 dejando una tarea limpia "Generar cotización" que el asesor abre en otro flujo.

**Open questions críticas que el usuario debe responder en el grill**:
1. ¿Los asesores tienen smartphone propio o tablet de la empresa? (impacta el diseño mobile-first)
2. ¿Cuál es la fricción aceptable para el asesor? (¿formulario de 30 campos o flow rápido de 5 pasos?)
3. ¿Hay rol "supervisor de visitas" que ve a todos los asesores en tiempo real, o cada asesor sólo ve la suya?
4. ¿El cliente firma algo en sitio (presupuesto preliminar, autorización de toma de medidas)?
5. ¿Los precios/cotización los puede dar el asesor en sitio o siempre vienen de oficina?

---

## 4 · Cómo arrancar (orden estricto)

1. **Lee este documento entero** (sin saltarte secciones).
2. **Lee `MEMORY.md`** en `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\` para contexto cross-sesión.
3. **Lee los 3 handoffs más recientes** de `docs/handover/`:
   - `2026-05-23_PHASE-3-VISITA-EN-SITIO_BRIEFING.md` (este)
   - `2026-05-23_WHATSAPP-PUBLIC-BOOKING.md` (Fases 1-2 completas)
   - `2026-05-23_NOTIFICATIONS-PAGE.md` (cómo se construyó `/notifications`, útil de plantilla)
4. **Inspecciona el schema en producción** con Management API:
   ```
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name IN
   ('opportunities','visits','tasks','clients','notification_queue','availability_slots','holidays')
   ORDER BY table_name, ordinal_position;
   ```
   Especialmente revisa los CHECK constraints en `opportunities.status` y `tasks.status` para saber qué valores son válidos.
5. **Listá triggers vivos** en producción:
   ```
   SELECT trigger_name, event_object_table, action_timing, event_manipulation
   FROM information_schema.triggers
   WHERE trigger_schema='public' ORDER BY event_object_table;
   ```
6. **Ejecuta `/grill-me`** con este documento como input. La skill auto-orquesta: grill → PRD → schema review (si aplica) → architecture → handoff + entrada en MEMORY.md. **No saltes pasos**. Si el usuario dice "para ahí", paras; si no, completas el ciclo.
7. **No escribas código de Fase 3 hasta cerrar el grill + PRD**. El grill saca decisiones que pueden cambiar todo el alcance.

---

## 5 · Memorias relevantes (en `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\`)

Leer primero:
- `MEMORY.md` (índice maestro)
- `project_innovar.md` (estado general)
- `project_innovar_lead_to_project_refactor.md` (refactor Lead→Project en curso, contexto de slices)
- `feedback_innovar_db_language_convention.md` (idioma DB↔frontend)
- `feedback_innovar_check_prod_vs_master_first.md` (verificar prod antes de diagnosticar)
- `feedback_innovar_apply_actions_self.md` (el agente aplica SQL/cron/secrets, no deriva)
- `reference_innovar_management_api.md` (patrón curl + PAT)
- `reference_innovar_whatsapp_templates.md` (catálogo Meta)
- `feedback_supabase_no_sdk_in_onauth_callback.md`
- `feedback_supabase_realtime_channel_singleton.md`
- `feedback_diagnose_browser_state_first.md`

---

## 6 · Estado de Vercel + DNS (sin cambios desde Fase 2)

- Deploy actual: `crm-innovar-app-2026` en `rvironas-projects` (token en `.env` como `VERCEL_TOKEN`).
- Subdominio `agenda.cocinasintegralespereira.co` **registrado** en el proyecto Vercel pero **DNS sin propagar** (usuario tiene que setear 2 records en su registrador):
  - TXT `_vercel` → `vc-domain-verify=agenda.cocinasintegralespereira.co,472fe8f5d025f5259235`
  - CNAME `agenda` → `cname.vercel-dns.com`
- Hasta que DNS resuelva, el link funcional es el de Vercel directo.

---

## 7 · Comandos útiles que probablemente vas a usar

**Inspeccionar prod**:
```bash
SUPABASE_ACCESS_TOKEN=$(grep ^SUPABASE_ACCESS_TOKEN= .env | cut -d= -f2-) && \
curl -sS -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @<archivo.json>
```
El JSON debe ser `{"query":"..."}`. Usar `--data-binary @file.json` para evitar problemas con quotes anidadas en bash de Windows.

**Verificar UI cambios sin deploy**:
```bash
cd "C:/Users/ceoel/OneDrive/Escritorio/mi proyect/Agents-automations/Innovar-App-main"
npm run build
# Luego, usa la herramienta mcp__Claude_Preview__preview_start con name="innovar-preview"
```

**Crear QA opportunity** (para probar flujos):
```json
{"query":"WITH new_client AS (INSERT INTO clients (name, whatsapp_phone) VALUES ('<Nombre> Demo', '<10 dígitos>') RETURNING id), new_opp AS (INSERT INTO opportunities (client_id, status, services, data_origin) SELECT id, 'new', ARRAY['cocina_integral']::text[], 'whatsapp' FROM new_client RETURNING id, short_code, public_token) SELECT * FROM new_opp;"}
```
Recordá: `data_origin` válidos son `wordpress | referido | walk-in | whatsapp | manual` (el inglés `whatsapp_inbound` NO pasa el CHECK).

---

## 8 · Tono y forma de respuesta

- Respuestas cortas, técnicas, español.
- Antes de cada bash con SQL/curl: 1 frase breve de intención.
- Al cerrar cualquier slice: actualizar `MEMORY.md` + crear handoff en `docs/handover/`.
- El usuario sabe leer diffs. No resumas lo que ya está en el commit.

---

**Última actualización**: 2026-05-23, sesión tras commit `d2a1f63` (Fase 2 cerrada con horario CO + OG).
