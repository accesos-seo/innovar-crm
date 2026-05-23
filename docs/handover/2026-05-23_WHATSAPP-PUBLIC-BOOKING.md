# Handover — Flujo WhatsApp con Link Público de Agendamiento

**Fecha:** 2026-05-23
**Autor:** sesión de planificación + ejecución dirigida por Claude
**Plan original:** `C:\Users\ceoel\.claude\plans\modular-squishing-globe.md`

---

## 📌 ACTUALIZACIÓN 2026-05-23 (segunda sesión) — UX fixes + Short URLs

Sobre el flujo público funcionando: 3 mejoras visuales + URL corta brandeada.

### UX fixes en `src/pages/PublicBooking.tsx`
- Helpers `cleanName()` + `firstName()` quitan prefijos `[QA-...]`, `(...)` y devuelven solo el primer nombre limpio.
- Cliente label muestra primer nombre limpio.
- Thank-you "¡Listo, X!" usa firstName limpio.
- Botón CTA al sitio web institucional `https://cocinasintegralespereira.co/` (target=_blank) en la SuccessCard con separador "Mientras tanto" + URL en footer.

### Short URLs (`/v/:code` en lugar de `/agendar/<32-char-token>`)
- **Migración 019** aplicada: `opportunities.short_code` (6 chars base62 con alfabeto sin chars confusos), trigger BEFORE INSERT auto-genera, backfill OK.
- RPC pública `resolve_short_code(p_code) → public_token` valida estado de la opp.
- Trigger 014 (`notify_lead_followup_flow`) **actualizado** para enviar `/v/<short_code>` por WhatsApp.
- Frontend: nueva ruta `/v/:code`, hook `useResolveShortCode`, componente wrapper `PublicBookingByCode.tsx` que resuelve y delega al `PublicBooking` existente con prop `token`.

### Subdomain `agenda.cocinasintegralespereira.co` (pendiente DNS del usuario)
Agregado al proyecto Vercel `crm-innovar-app-2026` via API. Estado `verified: false` hasta que el usuario configure 2 records DNS en el provider del dominio:

```
Type: TXT
Name: _vercel
Value: vc-domain-verify=agenda.cocinasintegralespereira.co,472fe8f5d025f5259235

Type: CNAME
Name: agenda
Value: cname.vercel-dns.com
```

Una vez propagado (~5min a 1h), `agenda.cocinasintegralespereira.co/v/<code>` apunta al deployment automáticamente con SSL emitido por Vercel.

### Verificación E2E ejecutada
- Opp QA "Felaipe Diaz Demo" creada → short_code `bGUa6x`.
- Build estático servido en `localhost:4173`, navegación a `/v/bGUa6x`:
  - Página carga, h1 "Agenda tu visita técnica", cliente "Felaipe" (firstName limpio).
  - 24 slots Mar/Jue x 4 horas x 3 semanas.
  - Click slot 09:00 → "Confirmar visita" → success con "¡Listo, Felaipe!".
  - CTA href correcto a `cocinasintegralespereira.co/`, target=_blank.

---

## ⚠️ ACTUALIZACIÓN 2026-05-23 (sesión vespertina) — Decisión arquitectónica

Tras aplicar la migración 014 se descubrió que **el plan original asumía greenfield, pero ya existe un sistema WhatsApp activo en producción**:

- Edge Function `process-whatsapp-notifications` v12 (desde 2026-05-11) procesa la cola con `wamid.*` reales contra Meta. Su código fuente NO está en el repo — vive sólo en Supabase.
- Cron `process-whatsapp-notifications-every-minute` activo, llama al worker cada minuto.
- Edge Function `meta-whatsapp-webhook` v12 ya recibe eventos de Meta.
- Catalog de 12 templates Meta documentado en [reference_innovar_whatsapp_templates.md](../../../../.claude/projects/C--Users-ceoel/memory/reference_innovar_whatsapp_templates.md) — 7 aprobados, 5 en revisión, **2 faltantes** (`welcome_lead_v1` y `booking_link_v1`).

**Decisiones tomadas:**

1. **Las 2 Edge Functions locales fueron archivadas** a [_archive/edge-functions-greenfield-2026-05-23/](../../_archive/edge-functions-greenfield-2026-05-23/) (con README explicativo). Deployarlas hubiera sobrescrito el worker de prod y roto los templates ya aprobados.
2. **La migración 014 quedó aplicada** (RPCs + trigger funcionan). El trigger encola los 2 mensajes con cada lead nuevo; el worker de prod los marca `failed` porque no tiene los templates en su registro y Meta no los aprobó. **Sin daño** (no se envía al cliente).
3. **Las filas existentes que ya fallaron fueron marcadas como `skipped`** con nota de auditoría, para limpiar ruido en `/settings/whatsapp`.
4. **El flujo público de booking (página + RPCs) está funcional end-to-end SIN WhatsApp** — alguien con el token puede abrir el link, ver slots, agendar, y la cita aparece en `/agenda` del comercial. Verificación E2E real ejecutada:
   - Opp QA `531b925c-4033-4579-a848-3cc82d12c6d4` (`[QA-20260523] Cliente 3`), token `8625c688...`
   - Booking confirmado del slot `2026-05-28T09:00:00+00:00` → visit_id `56774855-...` creada
   - Opportunity avanzó a `visit_scheduled` (token quedó inválido — verificado)
   - Task espejo creada por `visit_to_task_mirror` (mismo id que el visit, patrón unified-entity)
5. **Build de frontend pasa** (`npm run build` exitoso, página `/agendar/:token` accesible HTTP 200 desde anon).
6. **`supabase/functions/` está untracked en git** — la fuente de verdad de las funciones de prod vive en Supabase, no en el repo. Antes de extender el worker hay que decidir si versionamos esa carpeta.

**Lo que falta para WhatsApp funcionando (no bloquea el flujo público):**

a) Crear `welcome_lead_v1` y `booking_link_v1` en Meta Business Manager (24-48h aprobación).
b) Descargar el código del `process-whatsapp-notifications` v12 desde el Dashboard de Supabase (Studio → Functions → Source).
c) Committearlo al repo + agregar al `TEMPLATE_REGISTRY` los 2 builders (copiarlos desde `_archive/edge-functions-greenfield-2026-05-23/process-whatsapp-notifications/index.ts`).
d) Redeployar como v13.
e) Reactivar la limpieza: re-marcar como `pending` las filas `skipped` recientes para que el cron las reprocese (o esperar a que se generen nuevas con el próximo lead).

---

## Qué se construyó

End-to-end del flujo que reemplaza el "uno de nuestros asesores se comunicará contigo pronto" por un agendamiento **self-service**: el cliente recibe 2 WhatsApps (bienvenida + link) cuando se crea un lead, y se autoagenda su visita técnica en una página pública brandeada.

### Archivos nuevos

| Path | Propósito |
|---|---|
| [db/migrations/014_whatsapp_lead_followup_flow.sql](db/migrations/014_whatsapp_lead_followup_flow.sql) | Trigger AFTER INSERT en `opportunities` que encola 2 mensajes + RPCs públicas `get_public_booking_context`, `get_public_visit_slots`, `book_public_visit` + ALTER `opportunities.public_token_expires_at` |
| [supabase/functions/process-whatsapp-notifications/index.ts](supabase/functions/process-whatsapp-notifications/index.ts) | Worker que procesa la cola y postea a Meta Graph API |
| [supabase/functions/whatsapp-webhook/index.ts](supabase/functions/whatsapp-webhook/index.ts) | Recibe eventos de delivery (sent/delivered/read/failed) desde Meta |
| [src/pages/PublicBooking.tsx](src/pages/PublicBooking.tsx) | Página pública `/agendar/:token` — UI fullscreen brandeada |
| [src/hooks/agenda/usePublicBooking.ts](src/hooks/agenda/usePublicBooking.ts) | 3 hooks: `useBookingContext`, `usePublicVisitSlots`, `useBookPublicVisit` |

### Archivos modificados

- [src/App.tsx](src/App.tsx) — agrega `<Route path="/agendar/:token" element={<PublicBookingPage />} />` FUERA del wrapper protegido.

---

## Reusa lo que ya estaba

- `opportunities.public_token` (TEXT hex 16 bytes, ya existía con `validate_public_token` scope `book_visit`).
- Trigger `trg_opp_round_robin` (BEFORE INSERT) ya asigna `assigned_to` → nuestro trigger AFTER INSERT lo lee directo.
- Tabla `notification_queue` con todos sus campos de outbox + `meta_whatsapp_status_events` para webhook events.
- Función `get_visit_slots(commercial_id, from, to)` para calcular slots Mar/Jue con holidays excluidos.
- Triggers de `visits`: `validate_visit_completion` (avanza opportunity → `visit_scheduled` → token queda inválido) + `visit_to_task_mirror` (espeja a tasks).
- Hook `useWhatsApp.processMessages` (ya existía en `useWhatsApp.ts`) — invoca `process-whatsapp-notifications` que ahora SÍ existe.

---

## Lo que el usuario debe hacer (en orden)

### 1) Meta Business Manager — crear y aprobar templates (24-48h)

Ir a https://business.facebook.com → WhatsApp Manager → Message Templates → **Create**.

**Template A — `welcome_lead_v1`**
- Categoría: **UTILITY**
- Idioma: **Spanish** (es)
- Body (1 variable):
  ```
  Hola {{1}}, recibimos tu solicitud en Innovar Cocinas de Arte. El siguiente paso es agendar tu visita técnica gratuita — te enviamos el link en el próximo mensaje. 🛠️
  ```
- Sample value para `{{1}}`: `Roberto`

**Template B — `booking_link_v1`**
- Categoría: **UTILITY**
- Idioma: **Spanish** (es)
- Body (3 variables, sin botones):
  ```
  {{1}}, agenda tu visita técnica desde acá 👇

  {{2}}

  El link vence en 7 días. Te atenderá {{3}}, tu asesor asignado.
  ```
- Sample values: `Roberto`, `https://crm-innovar-app-2026.vercel.app/agendar/abc123`, `Carlos Pérez`

> **Si Meta categoriza como MARKETING** en vez de UTILITY, reformular el wording (evitar palabras como "gratis", "promoción", "oferta"). UTILITY es ~10x más barato y entrega 24/7.

### 2) Aplicar migración 014 en Supabase (Innovar) ✅ APLICADA 2026-05-23

**Estado:** migración 014 aplicada vía Management API. HTTP 201, transacción committeada.

Validaciones post-aplicación que pasaron:
- Columna `opportunities.public_token_expires_at` creada con default `NOW() + INTERVAL '7 days'`.
- Trigger `trg_notify_lead_followup_flow` enabled (AFTER INSERT).
- 3 RPCs creadas: `get_public_booking_context`, `get_public_visit_slots`, `book_public_visit`.
- Grants `EXECUTE` a `anon` y `authenticated` para las 3 RPCs.
- Fila `public_app_base_url = "https://crm-innovar-app-2026.vercel.app"` en `system_settings`.
- Backfill OK: 1/3 opportunities activas tiene token vigente (las otras 2 están en status > `contacted`).
- Test funcional con opp QA real (`[QA-20260523] Cliente 3`, token `8625c688...`):
  - `get_public_booking_context` devuelve contexto completo (opp/client/staff).
  - `get_public_visit_slots` devuelve slots Mar/Jue correctos con `is_available=true`.

---

El proyecto Innovar (`xdzbjptozeqcbnaqhtye`) NO está en el scope del MCP. Aplicada vía Management API:

```bash
# Con el SUPABASE_ACCESS_TOKEN del .env local
curl -sS -X POST \
  "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data @<(jq -Rs '{query: .}' < db/migrations/014_whatsapp_lead_followup_flow.sql)
```

Alternativa: copiar y pegar el contenido de `014_whatsapp_lead_followup_flow.sql` en el SQL Editor del Dashboard de Supabase.

**Smoke test post-aplicación:**
```sql
-- Debe existir la columna
SELECT column_name FROM information_schema.columns
 WHERE table_name='opportunities' AND column_name='public_token_expires_at';

-- Debe existir el trigger
SELECT tgname FROM pg_trigger WHERE tgname='trg_notify_lead_followup_flow';

-- Las 3 RPCs públicas deben estar grant a anon
SELECT routine_name FROM information_schema.routines
 WHERE routine_name IN ('get_public_booking_context','get_public_visit_slots','book_public_visit');
```

### 3) Cargar secretos en Supabase Vault

En el Dashboard del proyecto Innovar → Project Settings → Vault → **New Secret**:

| Key | Valor |
|---|---|
| `META_WABA_ACCESS_TOKEN` | System User permanent token de Meta (permisos: `whatsapp_business_messaging`, `whatsapp_business_management`) |
| `META_PHONE_NUMBER_ID` | ID del número WhatsApp verificado |
| `META_APP_SECRET` | App Secret de la app Meta (para validar HMAC del webhook) |
| `META_WEBHOOK_VERIFY_TOKEN` | String random largo (>32 chars). Generá uno con `openssl rand -hex 32` o similar. |

Los 4 secretos se inyectan automáticamente al runtime de las Edge Functions.

### 4) Deploy de las Edge Functions

Desde la raíz del repo:

```bash
# process-whatsapp-notifications (verify_jwt true → caller necesita JWT)
supabase functions deploy process-whatsapp-notifications \
  --project-ref xdzbjptozeqcbnaqhtye

# whatsapp-webhook (verify_jwt false → Meta no manda JWT)
supabase functions deploy whatsapp-webhook \
  --project-ref xdzbjptozeqcbnaqhtye \
  --no-verify-jwt
```

> ⚠️ Si `supabase functions deploy` tira `Project not linked`, primero correr:
> `supabase link --project-ref xdzbjptozeqcbnaqhtye`

### 5) Configurar webhook en Meta

En la app de Meta → WhatsApp → Configuration → Webhook → **Edit**:

- **Callback URL:** `https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/whatsapp-webhook`
- **Verify Token:** el mismo string que cargaste como `META_WEBHOOK_VERIFY_TOKEN`.
- **Webhook fields:** suscribir solo `messages` (status updates).

Meta hace handshake con un GET → la Edge Function devuelve `hub.challenge` si el token matchea.

### 6) Configurar cron job para procesar la cola cada minuto

En SQL Editor de Supabase, ejecutar (reemplaza `<SERVICE_ROLE_KEY>` con la real):

```sql
SELECT cron.schedule(
  'process-wa-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xdzbjptozeqcbnaqhtye.supabase.co/functions/v1/process-whatsapp-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('dry_run', false, 'limit', 20)
  );
  $$
);
```

Para verificar que el cron corre:
```sql
SELECT * FROM cron.job WHERE jobname = 'process-wa-queue';
SELECT * FROM cron.job_run_details
 WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='process-wa-queue')
 ORDER BY start_time DESC LIMIT 5;
```

---

## Verificación end-to-end (FASE 5)

Una vez todo lo anterior aplicado:

1. **Smoke test SQL** (Supabase SQL Editor):
   ```sql
   -- Reemplaza <token> con un public_token de opportunities (status 'new' o 'contacted')
   SELECT * FROM public.get_public_booking_context('<token>');
   SELECT * FROM public.get_public_visit_slots('<token>', CURRENT_DATE, CURRENT_DATE + 14);
   ```

2. **Trigger funciona**: crear un lead nuevo desde `/leads/new` con WhatsApp válido. Luego:
   ```sql
   SELECT event_type, recipient_phone, template_name, status, created_at
     FROM notification_queue
     ORDER BY created_at DESC LIMIT 5;
   ```
   Debe haber 2 filas nuevas (`lead_welcome` + `lead_booking_link`) con `status='pending'`.

3. **Edge Function dry_run** desde `/settings/whatsapp` → "Procesar (dry run)". Debe devolver `processed=2, failed=0`.

4. **Envío real**: pasar a real run (o esperar el cron). El cliente debe recibir 2 WhatsApps con orden welcome → booking_link.

5. **Página pública**: copiar el `public_token` de la opportunity y abrir en **incógnito** la URL `https://crm-innovar-app-2026.vercel.app/agendar/<token>`. Debe mostrar el form sin redirigir a `/login`.

6. **Booking exitoso**: seleccionar slot Mar/Jue → Confirmar. Pantalla de éxito. En `/agenda` debe aparecer la nueva visita asignada al comercial.

7. **Token vencido**: forzar `UPDATE opportunities SET public_token_expires_at = NOW() - INTERVAL '1 day' WHERE id = X;` → reabrir el link → debe mostrar tarjeta de "Link no válido".

8. **Webhook**: verificar que `meta_whatsapp_status_events` recibe filas con `status` evolucionando `sent` → `delivered` → `read`.

---

## Rollback

Si algo se rompe en producción:

```sql
-- Desactivar trigger sin tocar código
ALTER TABLE public.opportunities DISABLE TRIGGER trg_notify_lead_followup_flow;

-- Parar el envío masivo
SELECT cron.unschedule('process-wa-queue');
```

Para deshacer completamente la migración, ver el bloque comentado al pie de `014_whatsapp_lead_followup_flow.sql`.

---

## Decisiones de diseño relevantes

- **`opportunities.public_token`**, no `clients.public_token`. La columna ya existía con UNIQUE NOT NULL DEFAULT.
- **Insertar en `visits`**, NO en `tasks`. El trigger `visit_to_task_mirror` espeja a tasks automáticamente. Hacer dual-write rompería consistencia.
- **Token se auto-invalida** al avanzar la opportunity a `visit_scheduled` (lo hace `validate_visit_completion`). No necesitamos lógica extra de invalidación.
- **Slots Mar/Jue 09:00, 11:00, 13:30, 15:30** vienen de `get_visit_slots()` ya existente. NOTA: el frontend autenticado (`useAvailableSlots`) tiene slots distintos hardcoded `['08:30','10:00','14:00','15:30']`. Eso es deuda técnica conocida — el flujo público usa la fuente de verdad correcta.
- **URL pública configurable** vía `system_settings.public_app_base_url` (no hardcoded en SQL). Cambiar el dominio NO requiere migración.
- **Idempotencia del worker**: lockea filas con `status='processing'` antes de mandar; race condition entre cron y UI manual mitigada.
- **Retries**: `attempt_count < 3` antes de que el worker tome la fila. Falla a la 3ra → queda `failed`; admin la reactiva manualmente desde `/settings/whatsapp` (resetear status a `pending`).
- **Idioma DB-frontend**: enum values en inglés (`lead_welcome`, `lead_booking_link`, `public_link`), labels en español. Convención del proyecto, ver memoria global.

---

## Riesgos conocidos / deuda

- **Templates Meta no aprobados al deploy**: la Edge Function va a marcar `failed` con mensaje claro. No es crítico — admin lo ve en `/settings/whatsapp` y reprocesa cuando Meta apruebe.
- **Cliente sin WhatsApp**: el trigger hace skip silencioso si `whatsapp_phone` es NULL o < 10 dígitos. Si querés un fallback (ej. email), agregarlo es otro ticket.
- **Round-robin sin comerciales activos**: si `assign_commercial_round_robin` no encuentra nadie (todos `is_active=false`), `NEW.assigned_to` queda NULL → el template usa "tu asesor asignado". El cliente NO podrá agendar porque la RPC exige staff_id.
- **`book_appointment` RPC huérfana**: existe en producción pero el flujo nuevo no la usa. No la tocamos. Si en el futuro queremos unificar (y resolver "No existe un bloque de disponibilidad"), es otro ticket.
- **Costo Meta WhatsApp**: ~$0.05 USD por conversación UTILITY (Colombia). 2 mensajes back-to-back cuentan como 1 conversación. Económicamente sostenible incluso a 500+ leads/mes.

---

## Commit + deploy del frontend

El frontend (App.tsx + PublicBooking + usePublicBooking) está listo en master pero **no committeado**. Cuando el usuario valide visualmente, los comandos son:

```bash
git add src/App.tsx src/pages/PublicBooking.tsx src/hooks/agenda/usePublicBooking.ts \
        supabase/functions/process-whatsapp-notifications supabase/functions/whatsapp-webhook \
        db/migrations/014_whatsapp_lead_followup_flow.sql \
        docs/handover/2026-05-23_WHATSAPP-PUBLIC-BOOKING.md

git commit -m "feat(whatsapp): public booking link flow + Meta WhatsApp Cloud API"

# Deploy a Vercel se hace manualmente — verificar primero que la build local pasa
npm run build
```

El usuario corre git/deploy manualmente desde su shell (no en background — OneDrive).
