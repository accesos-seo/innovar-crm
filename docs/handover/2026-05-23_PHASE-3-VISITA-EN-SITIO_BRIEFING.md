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

## 3 · Qué es la Fase 3 (modelo mental del usuario — leer entero)

**Punto de partida**: el cliente ya confirmó la fecha (Fase 2 cerrada → `opportunities.status='visit_scheduled'`, `visits` insertada, token invalidado).

**Punto de cierre**: el visitante regresa al CRM con las mediciones cargadas y la opp avanza al siguiente estado (probablemente `measurements_taken` o `quotation_pending`).

### 3.A · Lo que el usuario dijo textual (no inventar, no recortar)

> "Una vez que el usuario haya registrado, viene la visita. Se generan automatizaciones:
> un mensaje para el administrador indicándole que ya se ha creado esa visita.
> Tal vez automáticamente le debe poner ya en la mano a él, en el sistema, la
> posibilidad del flujo de evaluar quién es el que va a visitar. En este caso por
> defecto sale el administrador, que es quien hace siempre la visita, con la opción
> de que vaya un comerciante. Sin embargo el administrador es el que realmente
> visita al cliente con el objetivo de agregarle esto como una tarea, también
> mantenerle informado de esa actividad y subirla en su calendario como fecha
> prevista. Luego cuando se va la visita, se atiende al cliente y se pasa la
> información a través del sistema."

### 3.B · Lectura operativa de lo anterior

Hay **dos roles diferentes** en juego que el modelo actual NO separa bien:

| Rol | Función | Estado actual |
|---|---|---|
| **Asesor comercial** | Atiende el lead por WhatsApp, recibe el booking link asignado por round-robin, queda como `opportunities.assigned_to`. | ✅ Modelado en `profiles` con `role='comercial'` |
| **Administrador (el que visita)** | Es **el que físicamente va a la casa del cliente**. Por defecto va él; ocasionalmente delega en un comercial. | ❓ Posiblemente no separado del `opportunities.assigned_to` |

→ **Riesgo de modelo**: la `tasks` espejo de la visita y el `availability_slot` reservado actualmente apuntan al **comercial** (`opp.assigned_to`) — pero según el usuario, el que va es el **admin**. Hay que validar en la auditoría (sección 3.D) si esto es un bug latente o si los IDs ya coinciden por casualidad.

### 3.C · Automatizaciones que el usuario pide explícitamente

1. **Al confirmar visita** (trigger `AFTER INSERT ON visits` o reuso del que ya espeja a `tasks`):
   - 📲 **WhatsApp al administrador** notificándole la nueva visita (no solo notificación in-app).
   - 🖥️ **UI in-app** que le ponga "en la mano" al admin un panel para decidir **quién va a visitar** (default = admin, dropdown = lista de comerciales).
   - ✅ **Tarea automática** para el admin (o para quien finalmente se asigne) con la visita como contexto.
   - 📅 **Entrada en su calendario** como fecha prevista (debe aparecer en `/agenda` filtrable por el admin).

2. **Día de la visita** (a definir en el grill — el usuario no fue explícito, así que las hipótesis quedan abajo en 3.E):
   - Recordatorios + WhatsApp en camino + check-in + captura de info.

3. **Cierre** (a definir en el grill):
   - WhatsApp resumen al cliente + transición de estado de la opp + tarea de seguimiento.

### 3.D · Auditoría OBLIGATORIA antes de diseñar (entregable previo al grill)

Antes de ejecutar `/grill-me`, el próximo agente DEBE entregar al usuario un documento corto (máx 1 página) que responda con SQL y lectura de código:

**Sobre la estructura actual** (queries listas):

1. ¿`visits` tiene algún campo "asignado a la visita" distinto de `opportunities.assigned_to`?
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='visits' ORDER BY ordinal_position;
   ```

2. ¿La `task` espejo a la visita se asigna a quién? (Leer trigger `mirror_visit_to_task` aplicado en alguna de las migraciones 014-019)
   ```sql
   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname LIKE '%mirror_visit%' OR proname LIKE '%visit_to_task%';
   ```

3. ¿Qué roles existen en `profiles` y cuántos usuarios hay por rol?
   ```sql
   SELECT role, COUNT(*) FROM profiles WHERE deleted_at IS NULL GROUP BY role;
   ```

4. ¿`opportunities.status` qué valores acepta? ¿Hay un `in_transit` / `in_visit` / `measurements_taken` previsto?
   ```sql
   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE '%opportunities_status%';
   ```

5. ¿`/agenda` muestra `tasks` o `visits` o ambos? Buscar el hook que pinta el calendario:
   ```
   src/hooks/agenda/useAppointments.ts
   src/pages/Agenda.tsx
   ```

6. ¿`notification_queue` ya soporta templates con destinatario interno (admin), o sólo cliente?
   ```sql
   SELECT column_name FROM information_schema.columns WHERE table_name='notification_queue' ORDER BY ordinal_position;
   ```

**Sobre los handoffs anteriores**: leer los relevantes y reportar si ya hay decisiones tomadas sobre Fase 3 que no estén en este briefing.

**Sobre las oportunidades de automatización adicional**: el usuario pidió analizar **qué más se puede automatizar para optimizar**. Ejemplos a evaluar:
- Auto-asignación admin/comercial basada en zona geográfica.
- Cancelación automática + reprogramación si el cliente no responde al recordatorio.
- Alerta al supervisor si una visita está en estado `in_transit` por más de 2h sin pasar a `in_visit`.
- Pre-llenar el formulario de medición con datos del lead (servicios marcados, ubicación, presupuesto aproximado).
- Sugerencia automática de slot alternativo si el admin no puede asistir.

### 3.E · Hipótesis de sub-fases del día de la visita (para el grill, NO para construir)

1. **Día anterior — Recordatorios**
   - WhatsApp al cliente 24h antes ("Mañana te visita Leo a las 9:00 AM en …").
   - Notif in-app al visitante ("Mañana tienes visita: Carolina, dirección X, 9:00 AM").
   - ¿Recordatorio 2h antes? ¿El cliente puede reprogramar desde ahí?

2. **Día de la visita — En movimiento**
   - Vista "Mi agenda de hoy" del visitante con lista + ruta sugerida.
   - Botón "En camino" → WhatsApp al cliente + opp `in_transit`.
   - Botón "Llegué" → check-in + opp `in_visit` + (opcional) geo-validación.
   - Panel de captura: medidas, fotos, notas. **¿Qué medidas exactamente?** (Felipe debe dictar el formulario en el grill: largo × ancho × alto, tipo de pared, gas, voltaje, etc.)
   - Botón "Visita finalizada" → opp `measurements_taken` + WhatsApp resumen al cliente + tarea automática "Generar cotización".

3. **Sincronización / fallos**
   - Offline-first del form de medidas (smartphone sin señal en casa del cliente).
   - Cancelación 30min antes — workflow.
   - Visitante no llega — alerta al admin tras X min.

4. **Cierre — preparar Fase 4**
   - ¿Generación de quotation es Fase 3 o Fase 4? Decisión del usuario en el grill.

### 3.F · Open questions críticas que el grill debe sacar

1. ¿El admin y el comercial son **usuarios distintos en `profiles`** o el admin tiene rol `super_admin`/`admin` y el comercial tiene rol `comercial`? ¿Cómo los distingue el sistema hoy?
2. ¿Cuántos admins hay activos en producción? ¿Sólo Felipe o hay más?
3. ¿Los visitantes (admin + comerciales) tienen smartphone propio o tablet de la empresa? Mobile-first vs tablet-first.
4. ¿Fricción aceptable del form de medidas? (5 pasos rápidos vs 30 campos exhaustivos)
5. ¿Hay rol "supervisor de visitas" que ve a todos en tiempo real, o cada visitante sólo ve la suya?
6. ¿El cliente firma algo en sitio (presupuesto preliminar, autorización)?
7. ¿Los precios/cotización los puede dar el visitante en sitio o siempre vienen de oficina?
8. ¿La opción "quién va" (admin vs comercial) se decide automáticamente o el admin la confirma manualmente cada visita?

---

## 4 · Cómo arrancar (orden estricto — no saltar pasos)

1. **Leé este documento entero**, sin saltarte secciones.
2. **Leé `MEMORY.md`** en `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\`.
3. **Leé los handoffs anteriores relevantes**:
   - `2026-05-23_WHATSAPP-PUBLIC-BOOKING.md` (Fases 1-2 completas)
   - `2026-05-23_NOTIFICATIONS-PAGE.md` (patrón de página con sidebar + búsqueda + realtime, útil de referencia)
4. **Ejecutá la auditoría de la sección 3.D**: corré las 6 queries, leé los 2 archivos de código del calendario, y entregá al usuario un documento corto (máx 1 página) que responda:
   - ✅ Qué del flujo ya está cubierto por el modelo actual.
   - ⚠️ Qué hay que agregar (columnas nuevas, triggers nuevos, RPCs, UI).
   - 🚨 Qué inconsistencias o bugs latentes encontraste (ej. quién es realmente el dueño de la `task` espejo).
   - 💡 Qué oportunidades de automatización adicional detectaste.
5. **Esperá feedback del usuario sobre la auditoría**. Felipe debe ratificar o corregir tu lectura del modelo antes de avanzar.
6. **Ejecutá `/grill-me`** con este documento + tu auditoría como input. La skill auto-orquesta: grill → PRD → schema review → architecture → handoff + entrada en MEMORY.md. No saltes pasos del ciclo.
7. **Cerrá el grill con una lista de tareas planificadas y validadas** (slices en orden) que Felipe apruebe antes de codear nada.
8. **Sólo entonces empezás a construir**. Si dudás sobre el orden de un slice, preguntale a Felipe.

---

## 4.5 · URLs y dashboards a tener a mano

- **Producción Vercel**: https://crm-innovar-app-2026.vercel.app
- **QA viva (Carolina Pruebas Demo)**: https://crm-innovar-app-2026.vercel.app/v/W3Aszv
- **Subdominio brand (pendiente DNS)**: https://agenda.cocinasintegralespereira.co
- **Dashboard Supabase Innovar**: https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye
- **Dashboard Vercel proyecto**: https://vercel.com/rvironas-projects/crm-innovar-app-2026
- **Sitio web del cliente** (también dueño del subdominio brand): https://cocinasintegralespereira.co
- **Repo GitHub**: https://github.com/accesos-seo/Innovar-App-main

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
