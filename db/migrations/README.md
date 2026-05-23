# Database Migrations

SQL migrations for the Innovar CRM Supabase database.

## How to apply

1. Open the Supabase dashboard for the Innovar CRM project (`xdzbjptozeqcbnaqhtye`).
2. Go to **SQL Editor → New query**.
3. Paste the migration file contents.
4. Click **Run**.

Migrations are written to be idempotent — safe to re-run if you're not sure whether they've been applied.

## Migration log

| File | Status | Description |
|---|---|---|
| `001_generate_quotation_number.sql` | ✅ Applied 2026-05-17 | Adds `quotation_number` column + atomic generator (fixes race condition + missing column) |
| `002_fix_handle_new_user_default_role.sql` | ⏳ Pending | Cambia el rol default de `'admin'` a `'comercial'` en el trigger de creación de perfiles (cierra escalada de privilegios) |
| `002_kitchen_pricing_catalog.sql` | ⏳ Pending | Catálogo de precios de cocina |
| `003_tv_center_pricing.sql` | ⏳ Pending | Catálogo de precios TV Center |
| `004_special_finishes_pricing.sql` | ⏳ Pending | Catálogo de acabados especiales |
| `005_closets_pricing.sql` | ⏳ Pending | Catálogo de closets |
| `006_interior_doors_pricing.sql` | ⏳ Pending | Catálogo de puertas interiores |
| `007_mesones_pricing.sql` | ⏳ Pending | Catálogo de mesones |
| `007a_quotation_status_enum.sql` | ✅ Applied 2026-05-22 | **Pre-008/011**: agrega valores faltantes a enums `quotation_status` (`client_approved`, `pending_payment_verification`, `expired`) y `user_role` (`super_admin`). Statements individuales (no transaccional). |
| `008_lead_to_project_schema.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Estructura**: tablas `opportunities`, `opportunity_assignment_history`, `visits`, `system_settings`, `agent_actions_log`; UNIQUE parcial en `clients.whatsapp_phone`; ALTERs en quotations/payments/projects. Ver `docs/prd/lead-to-project-flow.md` |
| `009_lead_to_project_functions.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Funciones**: `validate_public_token`, `get_visit_slots`, `calculate_refund_percentage`, round-robin, validación de transiciones, espejo visit→task, auto-generación de cotización, conversión a proyecto |
| `010_lead_to_project_triggers.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Triggers**: cablea las funciones de 009 a las tablas correspondientes |
| `011_lead_to_project_rls.sql` | ✅ Applied 2026-05-22 | **Lead→Project · RLS**: políticas estrictas (comercial solo ve lo suyo, admin todo). Endurece `payments` |
| `012_lead_to_project_seed.sql` | ✅ Applied 2026-05-22 | **Lead→Project · Seed**: configuración inicial en `system_settings` |
| `013_fix_notification_action_urls.sql` | ✅ Applied 2026-05-23 | Fix de rutas legacy en triggers de notificación (`/agenda/citas` → `/agenda`, `/agenda/tareas` → `/tasks`) + backfill |
| `014_whatsapp_lead_followup_flow.sql` | ✅ Applied 2026-05-23 | **Slice 3 (parcial)** · WhatsApp lead follow-up + booking público: `opportunities.public_token_expires_at`, trigger AFTER INSERT que encola welcome_lead_v1 + booking_link_v1 en `notification_queue`, RPCs `get_public_booking_context`/`get_public_visit_slots`/`book_public_visit`. Probado E2E: cliente puede agendar desde link público y token se autoinvalida |
| `014a_fix_opportunity_transitions.sql` | ✅ Applied 2026-05-23 | **Fix 009** · Agrega transiciones `new → visit_scheduled` (self-booking público) y `contacted → quoted` (bypass admin) al CASE de `validate_opportunity_transition`. Sin esto era imposible insertar una visita sobre opportunity recién creada |
| `015_fix_visit_to_task_mirror.sql` | ✅ Applied 2026-05-23 | **Fix 009** · Corrige `visit_to_task_mirror`: enum values masculino (`completado`/`cancelado` en vez de `completada`/`cancelada`), cast `::task_status` final del CASE, `task_category = 'cita'::task_category` (en vez del valor inexistente `'visit_mirror'`) |
| `016_fix_visit_to_task_mirror_timeslot.sql` | ✅ Applied 2026-05-23 | **Fix 009** · `tasks.time_slot` es `time without time zone`; reemplaza `to_char(scheduled_at,'HH24:MI')` (TEXT) por `scheduled_at::time` |
| `017_fix_auto_generate_quotation.sql` | ✅ Applied 2026-05-23 | **Fix 009** · Quita `created_by` del INSERT en quotations — la columna no existe; el comercial se deriva vía `opportunity_id → opportunities.assigned_to` |
| `018_fix_visit_to_task_mirror_availability.sql` | ✅ Applied 2026-05-23 | **Fix 009** · `visit_to_task_mirror` pre-crea row en `availability_slots` (UPSERT) antes del INSERT en tasks. Sin esto el trigger legacy `sync_task_availability_booking` abortaba la cadena porque no encontraba slot precargado |
| `019_fix_get_visit_slots_timezone.sql` | ✅ Applied 2026-05-23 | **Fix 009** · `get_visit_slots` casteaba `(date + time)::TIMESTAMPTZ` interpretando como UTC. Resultado: slots 09:00 SQL llegaban al cliente como 04:00 Colombia. Fix: `AT TIME ZONE 'America/Bogota'`. Validado en UI con click real |
| `022_default_visitor_setting.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S1** · Row `system_settings.default_visitor_id` apuntando a Alvaro + helper `get_default_visitor()`. Configurable sin deploy. |
| `023_book_public_visit_uses_default.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S1** · Fix bug latente: `book_public_visit` usa `COALESCE(get_default_visitor(), v_ctx.staff_id)` para que el admin (no el comercial) sea el visitante por defecto. |
| `023a_get_public_visit_slots_uses_default.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S1 · Post-smoke** · Sin esto el smoke fallaba: la pantalla pública mostraba slots libres del **comercial** pero la visita se persistía a nombre de **Alvaro**, generando colisiones al INSERT. Hace que `get_public_visit_slots` use `COALESCE(get_default_visitor(), v_staff_id)` igual que la 023. |
| `023b_get_visit_slots_uses_availability_overlap.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S1 · Post-smoke** · Fix definitivo de la deuda §4.2 del handoff S1. Cambia `get_visit_slots` para que detecte ocupación contra `availability_slots` con SOLAPAMIENTO `tstzrange &&`, no solo igualdad exacta contra `visits`. Cubre tasks legacy huérfanas, citas de diseño, cualquier bloque que reserve slot. Sin esto, la pantalla pública ofrecía slots que en realidad estaban ocupados por tasks creadas fuera de `book_public_visit`. |
| `024_visit_scheduled_via_admin.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S2** · ALTER del CHECK `visits_scheduled_via_check` para sumar valor `'admin'`. |
| `025_assign_visit_to_rpc.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S2** · RPC `assign_visit_to(visit_id, new_visitor_id)` (solo admin) + column-level grant que bloquea UPDATE directo de `visited_by`/`created_by` desde clientes. Smoke E2E OK: reasignación admin→comercial→admin propaga a tasks.assigned_to + libera/reserva slots + scheduled_via='admin' cuando origen no era public_link. |
| `026_visit_whatsapp_triggers.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S3** · Trigger `notify_visit_assigned_admin` + funciones `enqueue_visit_reminders_24h_internal` y `enqueue_visit_reminders_2h` (dual cliente/admin) + 2 crons. Reusa `enqueue_notification`/`fn_wa_enqueue_for_profile`. Edge function `process-whatsapp-notifications` extendida (v13) con 7 templates. **Mensajes quedan `failed` hasta que Meta apruebe los 4 templates nuevos**. |
| `027_visit_photos_bucket.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S4** · Bucket privado `visit_photos` (10 MB, MIME imagen) + helper `fn_can_access_visit_photo` + 4 policies (INSERT/SELECT por visitante/admin, UPDATE/DELETE solo admin). |
| `028_visit_summary_and_watchdog.sql` | ✅ Applied 2026-05-23 | **Fase 3 · S5** · Trigger `notify_visit_summary_client` (al `realizada`) + función `enqueue_visit_overdue_alerts` + cron horario `visit-overdue-alerts`. Mapping `notification_type='visit_overdue'` agregado en `NotificationBell`. |
| `029_scheduled_job_log_rls.sql` | ✅ Applied 2026-05-23 | RLS para logs de cron. |
| `030_phase4_quotations_new_columns.sql` | ⏳ Pending | **Fase 4 · S1** · ALTER `quotations` agregando 7 columnas (client_acceptance_note, client_rejection_reason/subtype, client_approved_at, client_rejected_at, viewed_at, view_count) + `clients.first_project_at` + CHECK constraint en subtype. |
| `031_phase4_bank_settings_seeds.sql` | ⏳ Pending | **Fase 4 · S1** · 7 filas en `system_settings` para datos bancarios (bank_name, bank_account_*, bank_holder_*, nequi/daviplata phones) editables sin deploy + helper `get_bank_setting()`. **EDITAR VALORES ANTES DE SALIR A PROD**. |
| `032_phase4_designer_qa_seed.sql` | ⏳ Pending | **Fase 4 · S1** · INSERT profile diseñador QA (`diseno.test@innovar.local`, role=`diseno`, WhatsApp = número de Alvaro) + helper `get_active_designers()`. PRE-REQ: crear `auth.users` row vía Management API (ver header de la migración). |
| `033_phase4_storage_buckets.sql` | ⏳ Pending | **Fase 4 · S1** · Buckets `payment-receipts` (5MB, image/pdf, INSERT anónimo validado por estado de quotation) + `quotation-pdfs` (10MB, solo PDF, INSERT solo service_role). RLS estricto por rol. |
| `034_phase4_public_quotation_rpcs.sql` | ⏳ Pending | **Fase 4 · S2** · 4 RPCs públicas: `get_public_quotation` (con redirect a versión vigente + tracking view_count), `accept_public_quotation`, `reject_public_quotation` (subtype adjustments_requested/declined), `request_quotation_reactivation`. |
| `035_phase4_lock_and_sync_triggers.sql` | ⏳ Pending | **Fase 4 · S2** · `send_quotation_to_client` RPC (draft→sent + WA al cliente, template diferenciado V2) + triggers: `lock_quotation_on_sent`, `sync_opportunity_from_quotation`, `notify_quotation_acceptance` (WA bank info al cliente), `notify_quotation_rejection`, `log_quotation_status_change` (audit) + `unlock_quotation` RPC (admin, exige change_reason). |
| `036_phase4_payment_flow.sql` | ⏳ Pending | **Fase 4 · S3** · `submit_quotation_payment_proof` RPC pública (cliente sube comprobante) + `verify_payment` RPC admin (asigna designer, dispara cascada reusando trigger existente `convert_quotation_to_project`, fill `clients.first_project_at`, WA al cliente) + trigger `notify_designer_on_project_assignment` (in-app + WA). |
| `037_phase4_quotation_expiry_and_reminders.sql` | ⏳ Pending | **Fase 4 · S4** · `expire_quotations_scan()` + `enqueue_quotation_reminders_3d()` (con dedup_key, MVP: solo 1 recordatorio 3d antes de vencer) + 2 crons (`wa-quotation-reminders-daily` 14:00 UTC, `wa-quotation-expiry-scan-daily` 14:05 UTC). |
| `038_phase4_pdf_generation_hook.sql` | ⏳ Pending | **Fase 4 · S5** · Tabla `pdf_generation_log` (audit/retry) + `trigger_pdf_generation(project_id)` RPC manual (llama Edge Function vía pg_net async) + trigger AFTER INSERT on `projects` que la dispara automáticamente. PRE-REQ: Edge Function `generate-quotation-pdf` desplegada. |
| `ROLLBACK_phase_3.sql` | — | Revierte 022→028 en orden inverso. Documenta pre-condiciones (filas con `scheduled_via='admin'`, bucket con objetos). |
| `ROLLBACK_phase_4.sql` | — | Revierte 030→038 en orden inverso. NO borra data del cliente automáticamente (quotations/payments/projects). Bucket files quedan en place — comentarios documentan cómo borrarlos manualmente. |
| `ROLLBACK_lead_to_project.sql` | — | Revierte 008→012. ⚠️ DESTRUCTIVO: borra opportunities/visits/payments verificados |

When you apply one, change its status to ✅.

## Orden estricto para Lead → Project (007a + 008–012)

Aplicar SECUENCIALMENTE, en este orden:

1. `007a_quotation_status_enum.sql` — extiende enums `quotation_status` y `user_role`. Correr como statements **individuales** (PG no acepta `ADD VALUE` + uso del valor en la misma transacción).
2. `008_lead_to_project_schema.sql` — tablas nuevas + ALTERs. Sin esto las siguientes fallan.
3. `009_lead_to_project_functions.sql` — funciones referenciadas en 010.
4. `010_lead_to_project_triggers.sql` — triggers usando las funciones de 009.
5. `011_lead_to_project_rls.sql` — RLS (endurece `payments`).
6. `012_lead_to_project_seed.sql` — config inicial editable por admin.

**Pre-condiciones críticas (validadas al deploy 2026-05-22):**

- **Duplicados de `whatsapp_phone`**: la migración 008 crea un UNIQUE parcial (`WHERE deleted_at IS NULL`) que falla si hay duplicados activos. Diagnóstico:
  ```sql
  SELECT regexp_replace(whatsapp_phone, '[^0-9]', '', 'g') AS normalized, COUNT(*)
   FROM public.clients
   WHERE whatsapp_phone IS NOT NULL AND deleted_at IS NULL
   GROUP BY 1 HAVING COUNT(*) > 1;
  ```
  Soft-delete (`UPDATE clients SET deleted_at = NOW() WHERE id = ...`) las filas extras antes de aplicar.

- **Helper functions existentes**: `update_updated_at()` y `get_my_role()` (en `public`). Las migraciones referenciaban `update_updated_at_column()` por error — ya corregido en 008/010.

- **Legacy en `payments.payment_type`**: la 008 agrega `CHECK (payment_type IN ('advance','installment','final','refund'))`. Si hay filas con valores en español ('abono'…) o NULL, normalizarlas antes.

- **Backup**: Free Plan no incluye backups manuales en dashboard. Alternativa probada: snapshot JSON via Management API
  ```bash
  curl -sS -X POST "https://api.supabase.com/v1/projects/<PROJECT_ID>/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"query":"SELECT row_to_json(c) FROM public.clients c;"}' \
    > db/backups/$(date +%Y-%m-%d)_clients_pre_migration.json
  ```

**Si una migración falla a mitad de camino**, la cláusula `BEGIN...COMMIT` revierte el archivo entero. Aplicar `ROLLBACK_lead_to_project.sql` si necesitas restaurar 008–012 a estado anterior.

---

## Orden estricto para Fase 3 — Visita técnica en sitio (022–028)

Cada migración corresponde a un slice del PRD `docs/prd/phase-3-on-site-visit.md`.
Aplicar secuencialmente, validando E2E entre slices. Bloqueador externo: aprobación
Meta de **5 templates nuevos** (no bloquea S1, S2, S4, S5 — solo el envío real de
los WhatsApp encolados por S3).

| Slice | Migración(es) | Bloqueador externo |
|---|---|---|
| **S1** | `022_default_visitor_setting.sql` → `023_book_public_visit_uses_default.sql` | — |
| **S2** | `024_visit_scheduled_via_admin.sql` → `025_assign_visit_to_rpc.sql` | — |
| **S3** | `026_visit_whatsapp_triggers.sql` | 4 templates Meta: `visit_assigned_admin_v1`, `visit_reminder_24h_internal_v1`, `visit_reminder_2h_client_v1`, `visit_reminder_2h_internal_v1` |
| **S4** | `027_visit_photos_bucket.sql` | — |
| **S5** | `028_visit_summary_and_watchdog.sql` | 1 template Meta: `visit_summary_client_v1` |

**Ajuste post-auditoría**: el cron existente `wa-recordatorio-24h-daily` (función
`fn_wa_recordatorio_24h_scan` con template `recordatorio24hantes`) ya cubre el
recordatorio 24h al cliente para todas las citas — incluidas las visitas técnicas
gracias al espejo `visits → tasks` con `task_category='cita'`. Por eso solo
creamos el lado interno (admin) en S3 y no duplicamos el recordatorio cliente.
Templates Meta nuevos totales: **5** (no 6 como decía el PRD original).

**Pre-condiciones de aplicación:**
- `enqueue_notification`, `fn_wa_enqueue_for_profile`, `fn_profile_wants_wa`,
  `get_my_role`, `visit_to_task_mirror`, `validate_visit_completion`,
  `trg_visit_auto_quotation`, `get_public_booking_context` deben existir
  (creados en migraciones 008–014).
- Extensiones `pg_cron` y `pg_net` activas.
- 1 admin activo en `profiles` (Alvaro Rios `09ca8b37-...`) — referenciado en
  el seed de `022`.

**Si decidís pausar entre slices**:
- Frontend de S2 (componente `VisitOwnerPicker`, hook `useAssignVisitTo`) puede
  vivir sin S3/S4/S5.
- S3 puede esperar aprobación Meta sin bloquear nada (las filas encoladas
  quedan `failed` y se reprocesan al aprobarse).
- S4 (bucket + form) puede convivir con S3 pendiente — las fotos suben igual.
- S5 puede demorarse y solo se pierde el resumen automático al cliente.

**Rollback granular**: cada migración tiene un bloque "Rollback" comentado al
pie. Preferir granular sobre `ROLLBACK_phase_3.sql` (que revierte todo).
