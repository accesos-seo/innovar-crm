# Handoff — Innovar CRM · Fase 3 (Visita técnica en sitio) · Plan cerrado, listo para Slice 1

> **Fecha de cierre del ciclo de planeación**: 2026-05-23
> **Branch base**: `ux-fixes` · último commit `f08be2c`
> **Working dir canónico**: `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
> **Sesión origen**: `/grill-me "para ir por lo seguro"` + ciclo automático `to-prd` → `supabase-schema` → `improve-codebase-architecture`
> **Fases 1-4 del ciclo de diseño: COMPLETADAS.** Fase 5 (ejecución de slices) arranca en sesiones futuras.

---

## 0. TL;DR — qué tiene que hacer la próxima sesión

1. **Leer** [`docs/prd/phase-3-on-site-visit.md`](../prd/phase-3-on-site-visit.md) (contrato funcional).
2. **Leer** [`docs/architecture/phase-3-refactor-map.md`](../architecture/phase-3-refactor-map.md) (qué archivos crear/modificar por slice).
3. **Empezar por Slice 1** — migraciones [022](../../db/migrations/022_default_visitor_setting.sql) + [023](../../db/migrations/023_book_public_visit_uses_default.sql).
4. **NO ejecutar nada hasta tener OK del usuario** sobre el slice puntual que va a aplicar.

Todo lo demás (decisiones D1-D20, justificaciones, alternativas descartadas) ya está cerrado. Si surgen dudas: el plan en `C:\Users\ceoel\.claude\plans\para-ir-por-lo-ancient-wigderson.md` es el documento maestro.

---

## 1. Estado de los 4 documentos de planeación

| Documento | Path | Propósito |
|---|---|---|
| **Plan maestro** | `C:\Users\ceoel\.claude\plans\para-ir-por-lo-ancient-wigderson.md` | Decisiones lockeadas D1-D20 con racional. Es la fuente original. |
| **PRD** | [`docs/prd/phase-3-on-site-visit.md`](../prd/phase-3-on-site-visit.md) | Contrato funcional: problem, solution, user stories, contracts, testing. |
| **Refactor map** | [`docs/architecture/phase-3-refactor-map.md`](../architecture/phase-3-refactor-map.md) | Qué archivos nuevos/modificados/eliminados por slice + cutover. |
| **Migraciones SQL** | [`db/migrations/022..028`](../../db/migrations/) + [`ROLLBACK_phase_3.sql`](../../db/migrations/ROLLBACK_phase_3.sql) | 7 migraciones idempotentes, listas para aplicar vía Management API. |

Todas las decisiones convergen en estos 4 docs. **No re-grillar nada que ya esté ahí.**

---

## 2. Decisiones lockeadas (las 20 del grill — referencia rápida)

| # | Decisión | Resumen |
|---|---|---|
| D1 | Visitante default | `system_settings.default_visitor_id` = Alvaro Rios (`09ca8b37-95b8-43dc-9b01-1100519d5ec5`). Configurable sin deploy vía helper SQL `get_default_visitor()`. |
| D2 | Reasignación | Solo admin (RPC `assign_visit_to` + column-level grant que bloquea UPDATE directo de `visited_by`). |
| D3 | Notif al agendar | In-app gratis (cadena existente) + WhatsApp encolado al admin via `fn_wa_enqueue_for_profile`. |
| D4 | Recordatorio 24h | Cliente: ya cubierto por cron existente (`fn_wa_recordatorio_24h_scan` + template `recordatorio24hantes`). Admin: nuevo cron `visit-reminders-24h-internal`. |
| D5 | Recordatorio 2h | Dual cliente + admin. Cron nuevo `visit-reminders-2h` cada 30 min, ventana ±15 min. |
| D6 | Flujo del día | Mínimo: solo "Finalizar visita". Sin `field_phase`, sin "En camino"/"Llegué". |
| D7 | Form de medidas | 6 bloques + `version: 1` en jsonb. Espacio / Conexiones / Estado / Servicios / Notas / Fotos. |
| D8 | Fotos mínimas | 3 (mantener validación existente). UI sugiere 5+. |
| D9 | Foto remota | Out of scope. Solo `modality='presencial'`. |
| D10 | Resumen al cliente | Automático al `realizada`. Template `visit_summary_client_v1`. |
| D11 | Auto-cotización | No tocar. `trg_visit_auto_quotation` permanece intacto. |
| D12 | Geo check-in | Descartado. |
| D13 | Reagendamiento público | No. Cliente escribe por WhatsApp y un humano reprograma. |
| D14 | Watchdog visitas vencidas | Cron horario `visit-overdue-alerts`. Notif in-app a Alvaro. Sin auto-marcar. |
| D15 | Robert Anderson | Sigue activo (usuario asume riesgo). |
| D16 | Filtro `/agenda` | No. `/agenda/hoy` cubre el caso. |
| D17 | Versionado measurements | Implícito en `measurements.version`. |
| D18 | Vista "Mi día" | Ruta `/agenda/hoy`. Filtra `visited_by = auth.uid() AND scheduled_at::DATE = CURRENT_DATE`. |
| D19 | `scheduled_via='admin'` | Agregar al CHECK. |
| D20 | Slices | 5 slices en orden estricto S1 → S2 → S3 → S4 → S5. |

**Ajuste post-auditoría** documentado en el README de migraciones: templates Meta totales pasaron de 6 a **5** porque el cron 24h del cliente ya está cubierto por `recordatorio24hantes`.

---

## 3. Estado actual de producción (no tocar sin razón)

Lo que YA está en producción y se RE-USA:

- `visits` table con todas las columnas necesarias (`visited_by`, `measurements`, `photos`, `notes`, `realized_at`, `client_confirmed_at`, etc.).
- Triggers intactos: `validate_visit_completion`, `trg_visit_auto_quotation`, `trg_visit_to_task_mirror`, `trg_visit_validate_completion`.
- RPCs públicas: `get_public_booking_context`, `get_public_visit_slots`, `book_public_visit` (esta última se modifica en S1).
- Helpers SQL: `enqueue_notification`, `fn_wa_enqueue_for_profile`, `fn_profile_wants_wa`, `get_my_role`.
- Worker: `process-whatsapp-notifications` v12 + cron 1 min.
- Triggers existentes que cubren parte del flujo: `notify_booking_created` (notifica al `tasks.assigned_to` cuando se inserta cita — gratis para nosotros), `fn_wa_recordatorio_24h_scan` (cron 24h cliente).
- 2 admins activos en `profiles`: Alvaro Rios (`09ca8b37-...`) y Robert Anderson (de prueba, decidido mantener activo).

Bug latente confirmado (que S1 arregla): `book_public_visit` setea `visits.visited_by = opportunities.assigned_to` (comercial). Debería ser el admin por default.

---

## 4. Orden estricto de ejecución

### Slice 1 — Default visitor + notif in-app correcta
**Goal**: Toda visita queda a nombre de Alvaro automáticamente. Notif in-app va al admin (gratis).

**Migraciones**: [022](../../db/migrations/022_default_visitor_setting.sql), [023](../../db/migrations/023_book_public_visit_uses_default.sql).
**Frontend**: ninguno.
**Bloqueador externo**: ninguno.
**Verificación**: crear opportunity QA + llamar `book_public_visit` + asserts en `visits.visited_by`, `tasks.assigned_to`, `availability_slots.staff_id`, `notifications`.
**Soak en prod antes de S2**: 24h.

### Slice 2 — Reasignar visita + `scheduled_via='admin'`
**Goal**: Admin puede delegar visita manualmente a un comercial.

**Migraciones**: [024](../../db/migrations/024_visit_scheduled_via_admin.sql), [025](../../db/migrations/025_assign_visit_to_rpc.sql).
**Frontend**: `VisitOwnerPicker.tsx`, `useAssignVisitTo.ts`, `useActiveVisitors.ts`, integración en `AppointmentDetailModal.tsx`.
**Bloqueador externo**: ninguno.
**Verificación**: admin reasigna en UI; comercial intenta UPDATE directo de `visited_by` → permission denied; RPC con rol no-admin → 42501.
**Soak antes de S4**: 48h.

### Slice 3 — WhatsApp al admin + recordatorios + 5 templates Meta
**Goal**: Admin recibe WhatsApp al agendarse + recordatorio 24h interno + cliente y admin 2h antes.

**Migraciones**: [026](../../db/migrations/026_visit_whatsapp_triggers.sql).
**Frontend**: extensión de TEMPLATE_REGISTRY en `process-whatsapp-notifications/index.ts`.
**Bloqueador externo**: Felipe aprueba 4 templates Meta (`visit_assigned_admin_v1`, `visit_reminder_24h_internal_v1`, `visit_reminder_2h_client_v1`, `visit_reminder_2h_internal_v1`).
**Independiente** de S4 — puede ir en paralelo.

### Slice 4 — Vista "Mi día" + form de medidas + photo upload + "Finalizar visita"
**Goal**: Alvaro abre `/agenda/hoy`, carga form, sube fotos, finaliza.

**Migraciones**: [027](../../db/migrations/027_visit_photos_bucket.sql).
**Frontend**: `MyDay.tsx`, `MyDayVisitCard.tsx`, `VisitMeasurementsForm.tsx`, `VisitPhotoUploader.tsx`, `useMyVisitsToday.ts`, `useFinishVisit.ts`, `visit-measurements.ts` (Zod schema), ruta `/agenda/hoy` en `App.tsx`.
**Bloqueador externo**: ninguno.
**Verificación**: E2E real desde mobile — Alvaro abre, carga form, sube 3 fotos, finaliza. Asserts en chain de triggers.
**Soak antes de S5**: 48h.

### Slice 5 — Watchdog + resumen al cliente
**Goal**: Visitas vencidas notifican a Alvaro. Visita finalizada manda resumen al cliente.

**Migraciones**: [028](../../db/migrations/028_visit_summary_and_watchdog.sql).
**Frontend**: mapping `notification_type='visit_overdue'` en `NotificationBell.tsx`.
**Bloqueador externo**: Felipe aprueba `visit_summary_client_v1` en Meta.
**Cierra Fase 3.**

---

## 5. Cómo aplicar las migraciones

```bash
# Working dir
cd "C:/Users/ceoel/OneDrive/Escritorio/mi proyect/Agents-automations/Innovar-App-main"

# Helper inline (usa el SUPABASE_ACCESS_TOKEN del .env)
PAT=$(grep '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2- | tr -d '\r"')
URL="https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query"

# Aplicar una migración
node -e "process.stdout.write(JSON.stringify({query: require('fs').readFileSync(process.argv[1],'utf8')}))" \
  db/migrations/022_default_visitor_setting.sql > /tmp/q.json
curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  --data-binary "@/tmp/q.json"
```

Tras cada migración exitosa: editar `db/migrations/README.md` y cambiar `⏳ Pending` por `✅ Applied YYYY-MM-DD`.

---

## 6. Templates Meta — qué crear y aprobar

5 templates UTILITY/ES nuevos. Cada uno se crea en Meta Business Manager → WhatsApp Manager → Message Templates.

| Key Meta | Vars | Wording sugerido (ajustable al criterio de Meta) |
|---|---|---|
| `visit_assigned_admin_v1` | {{1=cliente_nombre}} {{2=fecha}} {{3=hora}} {{4=direccion}} | "📍 Nueva visita técnica: {{1}} el {{2}} a las {{3}} en {{4}}. Confirma en el CRM." |
| `visit_reminder_24h_internal_v1` | {{1=hora}} {{2=cliente_nombre}} {{3=direccion}} {{4=cliente_tel}} {{5=servicios}} | "Recordatorio: mañana {{1}} visita a {{2}} en {{3}} (tel: {{4}}). Servicios: {{5}}." |
| `visit_reminder_2h_client_v1` | {{1=nombre}} {{2=hora}} | "Hola {{1}}, te recordamos que hoy a las {{2}} pasamos por tu casa para la visita técnica. ¡Te esperamos!" |
| `visit_reminder_2h_internal_v1` | {{1=hora}} {{2=cliente_nombre}} {{3=direccion}} {{4=cliente_tel}} | "En {{1}} visita a {{2}} en {{3}}. Tel cliente: {{4}}." |
| `visit_summary_client_v1` | {{1=nombre}} {{2=plazo_horas}} | "Hola {{1}}, gracias por recibirnos. Estamos preparando tu cotización personalizada — la recibirás en las próximas {{2}} horas. 🛠️" |

**Mientras no estén aprobados**, los rows en `notification_queue` quedan `failed`. Cero rotura: cuando se aprueben, los nuevos mensajes fluyen automáticamente.

---

## 7. Comandos útiles que la próxima sesión va a usar

**Verificar estado prod**:
```bash
curl -sS -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  --data-binary '{"query":"SELECT public.get_default_visitor();"}'
```

**Crear opportunity QA para testing E2E**:
```sql
WITH new_client AS (
  INSERT INTO clients (name, whatsapp_phone)
  VALUES ('[QA-PHASE3] Cliente Test', '3001234567')
  RETURNING id
),
new_opp AS (
  INSERT INTO opportunities (client_id, status, services, data_origin)
  SELECT id, 'new', ARRAY['cocina_integral']::text[], 'whatsapp'
  FROM new_client
  RETURNING id, short_code, public_token
)
SELECT * FROM new_opp;
```

**Confirmar booking QA**:
```sql
SELECT * FROM public.book_public_visit(
  '<public_token>',
  '2026-05-28T09:00:00+00:00'
);
```

**Smoke S1**:
```sql
SELECT v.id, v.visited_by, p.full_name AS visitor_name
FROM visits v JOIN profiles p ON p.id = v.visited_by
WHERE v.opportunity_id = '<opp_id>';
-- Debe devolver Alvaro, NO el comercial.
```

**Verificar UI sin deploy** (vite preview):
```bash
npm run build
# Luego usar mcp__Claude_Preview__preview_start con name="innovar-preview"
```

---

## 8. Restricciones operativas (no las olvides)

- **OneDrive + path con espacios** (`mi proyect`) rompe `npm run dev`. Usar siempre `npm run build` + `vite preview` para verificación visual local.
- **No correr `vercel --prod` ni `git push` en background** — el usuario los corre manualmente en su PowerShell.
- **SQL/secrets/cron en Supabase Innovar los aplica el agente** vía Management API (PAT en `.env`). Solo derivar al usuario cuando se necesita un secreto que no está en `.env` (ej. tokens de Meta).
- **Antes de teorizar bugs**: pedir reproducción en incógnito / Clear Site Data. Lección JWT stale del 2026-05-19.
- **Antes de tocar schemas**: validar contra producción vía Management API. `db/supabase_schema.sql` y `database.types.ts` están desactualizados.
- **Idioma DB↔Frontend**: DB en inglés, UI en español. Sin excepción.
- **Nunca llamar SDK desde `onAuthStateChange`** — deadlock confirmado 2026-05-22.
- **`supabase.channel('<nombre-fijo>')` es singleton global** — solo un suscriptor; usar `crypto.randomUUID()` si necesitas múltiples.

---

## 9. Riesgos conocidos al ejecutar

1. **Robert Anderson activo** (D15): bajo la nueva regla, puede usar `assign_visit_to` si alguien accede con su cuenta. Mitigación pospuesta a tarea aparte.
2. **RLS column-level grant**: la estrategia preferida (REVOKE/GRANT por columna) puede entrar en conflicto con policies actuales de `visits`. Si surge en QA, fallback documentado en migración 025 (RPC como única vía válida).
3. **Compresión de fotos**: si el helper `browser-image-compression` no se quiere agregar como dep, fallback nativo con canvas. Documentado en refactor map §7.
4. **`fn_wa_recordatorio_24h_scan` cubre demasiado**: hoy manda template `recordatorio24hantes` a CUALQUIER cita (visita técnica + cita de diseño). Si se quisiera mensaje diferenciado por `appointment_type`, hay que tocar esa función (out of scope; futuro).
5. **Slot leak en reasignaciones manuales legacy**: `visit_to_task_mirror` UPDATE branch SOLO crea el nuevo slot, no libera el viejo. La RPC `assign_visit_to` (S2) sí lo libera. Pero si en producción quedan visitas reasignadas vía SQL directo o por la versión vieja del código, hay slots fantasma. Verificar en QA pre-S2.

---

## 10. Memoria personal del usuario (próxima sesión)

Para alinearse con preferencias documentadas:

- Usuario **aplica acciones él mismo** (git, deploy) — agente entrega comandos copy-pasteables.
- Agente **aplica DB directamente** vía Management API + PAT del `.env`.
- Tone: **respuestas cortas, técnicas, español**.
- Antes de cada bash con SQL/curl: 1 frase de intención.
- Al cerrar slice: commit + handoff en `docs/handover/` + entry en MEMORY.md.
- Usuario sabe leer diffs — no resumir lo que ya está en el commit.

---

## 11. Entry point recomendado para la próxima sesión

```
/retomar
# o
"Continuemos con Fase 3 — arranquemos Slice 1"
```

Ambos disparan la lectura automática de este documento vía la entry en MEMORY.md.
