# PRD: Fase 3 — Visita técnica en sitio

> **Versión**: 1.0 · **Estado**: Listo para ejecución · **Audiencia**: devs y agentes de IA ejecutores
> **Fuente**: Plan maestro Fase 3 (grill-me completo) — `C:\Users\ceoel\.claude\plans\para-ir-por-lo-ancient-wigderson.md`
> **Idioma de identificadores**: inglés (código/DB) · **Idioma de UI y este documento**: español
> **Branch base**: `ux-fixes` · último commit `f08be2c`
> **Modo de trabajo**: *"para ir por lo seguro"* — reusar al máximo lo existente, no introducir scope que no esté validado

---

## 1. Problem Statement

Las Fases 1-2 dejaron en producción el flujo lead → confirmación de visita por link público (`/v/<short_code>`), con `visits` insertada + `tasks` espejo + `availability_slots` reservado. Pero **todo el camino post-confirmación está roto o ausente**:

1. **Bug latente crítico**: la RPC `book_public_visit` setea `visits.visited_by = opportunities.assigned_to`. Como `opp.assigned_to` es el **comercial** del round-robin, la visita queda en el calendario del comercial y bloquea **su** disponibilidad. Eso contradice la regla de negocio: **el que físicamente va a la casa del cliente es el administrador (Alvaro Rios), no el comercial**. El comercial atiende el WhatsApp; el admin visita.
2. **Sin vista "Mi día"** del visitante. El admin no tiene un lugar dedicado donde ver solo sus visitas de hoy y cargar las medidas en sitio. `/agenda` muestra todas las citas a todos los usuarios sin filtro por dueño.
3. **Sin notificación al admin** cuando un cliente confirma una visita: ni in-app (porque la notif va al `tasks.assigned_to = comercial`) ni por WhatsApp.
4. **Sin recordatorios automáticos**: cliente y admin no reciben aviso 24h / 2h antes de la visita.
5. **Sin form de captura en sitio**: las columnas `visits.measurements` (jsonb) y `visits.photos` (jsonb default `[]`) existen pero **no hay UI** que las llene. Alvaro tendría que llenar JSON a mano.
6. **Sin cierre del bucle al cliente**: cuando la visita se marca como `realizada`, el sistema crea borrador de cotización (Fase 4) pero el cliente no recibe ninguna señal intermedia hasta que la cotización llegue 24-48h después.
7. **Visitas huérfanas**: si Alvaro olvida marcar una visita (ni `realizada`, ni `no_show`, ni `cancelada`), queda flotando indefinidamente. Métricas mienten, opp no avanza.
8. **`scheduled_via` no contempla `'admin'`**: el CHECK actual acepta `'public_link' | 'comercial' | 'agent_a05'`. Cuando el admin agende manualmente desde el CRM, no hay valor semánticamente correcto.

---

## 2. Solution

Convertir el tramo post-confirmación en un flujo end-to-end automatizado, **reutilizando al máximo el modelo de datos existente** (las columnas `visits.measurements/photos/notes/realized_at`, los triggers `validate_visit_completion` y `trg_visit_auto_quotation`, el outbox `notification_queue`, el worker `process-whatsapp-notifications`):

- **Visitante por defecto configurable**: nuevo row en `system_settings` con `key='default_visitor_id'` apuntando a Alvaro. `book_public_visit` y cualquier path futuro lo usan cuando `visited_by` queda NULL. Si mañana cambia quién hace las visitas, se edita un row — sin deploy.
- **Reasignación controlada**: nueva RPC `assign_visit_to(visit_id, new_visitor_id)` `SECURITY DEFINER` con check interno `get_my_role() = 'admin'`. Comerciales **no pueden** tocar `visited_by` directamente; conservan UPDATE sobre `measurements`/`photos`/`status`/`notes`. UI nueva (`VisitOwnerPicker`) integrada en el detalle de visita.
- **Notificación automática al admin**: in-app gratis vía la cadena existente (`visit_to_task_mirror` → `tasks.assigned_to = visited_by` → `notify_booking_created`). WhatsApp encolado en `notification_queue` con template Meta nuevo `visit_assigned_admin_v1`.
- **Recordatorios 24h y 2h**: dos crons SQL (`enqueue_visit_reminders_24h` y `enqueue_visit_reminders_2h`) que detectan visitas en ventanas temporales y encolan mensajes idempotentes (con `dedup_key`) a cliente y admin.
- **Vista "Mi día" + form de medidas + photo upload**: nueva ruta `/agenda/hoy`. Filtra `visited_by = auth.uid() AND scheduled_at::DATE = CURRENT_DATE`. Cada visita es una tarjeta con botón "Abrir formulario" que despliega un drawer/modal con 6 secciones de medición + uploader de fotos (Supabase Storage) + botón "Finalizar visita".
- **Cierre con resumen al cliente**: trigger `notify_visit_summary_client` al pasar status a `realizada` encola template `visit_summary_client_v1`. El cliente recibe inmediatamente "estamos preparando tu cotización en 24-48h".
- **Watchdog visitas vencidas**: cron horario `enqueue_visit_overdue_alerts` detecta visitas `agendada`/`confirmada` con `scheduled_at < NOW() - INTERVAL '2 hours'` y crea notificación in-app al `visited_by`. No marca nada automático (riesgo de falso positivo).
- **Esquema versionado de medidas**: `visits.measurements` se guarda como JSON con campo `version: 1` autodescriptivo. Si v2 agrega campos, las visitas viejas siguen legibles.
- **Sigue intacto**: `validate_visit_completion` (mín. 3 fotos + measurements no vacíos), `trg_visit_auto_quotation` (crea cotización draft + mueve opp a `quoted`), `trg_visit_to_task_mirror`, las 4 RPCs públicas de booking.

Resultado: el cliente confirma → Alvaro recibe campana + WhatsApp → recibe recordatorios → abre `/agenda/hoy` el día de la visita → mide en sitio → aprieta Finalizar → la opp avanza sola a `quoted` con cotización en borrador, y el cliente recibe acuse de recibo automático. Cero intervención manual fuera del form.

---

## 3. User Stories

### Admin (Alvaro / cualquier `role='admin'`)
- Como **admin**, quiero que toda visita confirmada por un cliente quede automáticamente a mi nombre, para que mi calendario y disponibilidad reflejen la realidad operativa.
- Como **admin**, quiero recibir una notificación in-app **y un WhatsApp** apenas un cliente confirma una visita, para no depender de que abra el CRM para enterarme.
- Como **admin**, quiero un WhatsApp 24h y 2h antes de cada visita, para preparar la salida y las rutas del día.
- Como **admin**, quiero poder delegar una visita puntual a un comercial desde el detalle de la cita (dropdown "¿Quién va?"), para resolver el caso en que no puedo ir personalmente.
- Como **admin**, quiero una vista "Mi día" (`/agenda/hoy`) que me muestre solo mis visitas del día con un botón directo al formulario de medición, para no perder tiempo navegando.
- Como **admin**, quiero cargar las medidas del espacio (largo/ancho/alto, conexiones, estado actual, servicios) en un formulario tipado con secciones colapsables, en lugar de escribir JSON a mano.
- Como **admin**, quiero subir un mínimo de 3 fotos (idealmente 5+) directamente desde el celular en sitio, para evidenciar la visita y alimentar la cotización.
- Como **admin**, quiero marcar la visita como "Finalizada" y que el sistema automáticamente cree el borrador de cotización, avance la opp a `quoted` y le mande un mensaje al cliente.
- Como **admin**, quiero que el sistema me avise cuando una visita pasó su hora y no marqué su resultado, para cerrarla yo antes de que se contamine la métrica.
- Como **admin**, quiero que solo yo (y otros admins) pueda reasignar el visitante de una visita; un comercial no debería poder cambiar quién va.

### Cliente
- Como **cliente que acaba de confirmar la visita**, quiero recibir un WhatsApp 24h antes y otro 2h antes con la hora, la dirección de la visita en mi casa, quién va a venir y un canal para responder si necesito reprogramar, para no olvidarme ni quedarme sin atender al técnico.
- Como **cliente recién visitado**, quiero recibir un WhatsApp inmediato al terminar la visita confirmando que recibí la visita y que la cotización me llega en 24-48h, para tener una expectativa clara y no quedarme en el aire.

### Comercial (`role='comercial'`)
- Como **comercial**, quiero seguir viendo mis citas de diseño en `/agenda` sin que se mezclen con visitas técnicas que no me corresponden, pero el alcance de Fase 3 NO cambia ese comportamiento (queda igual; la separación se logra porque `visited_by` será el admin).
- Como **comercial**, quiero poder agregar medidas/fotos a una visita si soy designado como visitante en un caso particular (delegación del admin), pero **no** quiero tener permiso para cambiar quién es el visitante de una visita.

### Sistema (automatizaciones)
- Como **sistema**, debo encolar mensajes en `notification_queue` con `dedup_key` para evitar duplicados si un cron corre dos veces o si un trigger se dispara redundantemente.
- Como **sistema**, debo respetar las plantillas Meta aprobadas; si el template no está aprobado al momento de encolar, el worker `process-whatsapp-notifications` marcará el row como `failed` sin afectar el resto del flujo.

---

## 4. Implementation Decisions

### 4.1 Módulos involucrados

| Capa | Módulo | Tipo | Cambio |
|---|---|---|---|
| **DB config** | `system_settings` | Existente | Nuevo row `key='default_visitor_id'` |
| **DB schema** | `visits.scheduled_via` | Existente | ALTER del CHECK constraint para sumar `'admin'` |
| **DB schema** | `visits` (RLS) | Existente | Política UPDATE endurecida: comerciales no pueden tocar `visited_by` |
| **DB function** | `get_default_visitor()` | Nueva | Helper SQL stable, lee `system_settings` |
| **DB function** | `book_public_visit` | Existente | CREATE OR REPLACE: usar `COALESCE(get_default_visitor(), v_ctx.staff_id)` |
| **DB function** | `assign_visit_to(p_visit_id, p_new_visitor_id)` | Nueva | RPC SECURITY DEFINER, solo admin |
| **DB function** | `enqueue_visit_reminders_24h()` | Nueva | Encola 2 mensajes/visita en ventana de mañana |
| **DB function** | `enqueue_visit_reminders_2h()` | Nueva | Encola 2 mensajes/visita en ventana de próximas 2-3h |
| **DB function** | `enqueue_visit_overdue_alerts()` | Nueva | Inserta `notifications` para visitas vencidas 2h+ |
| **DB function** | `notify_visit_assigned_admin()` | Nueva | Trigger AFTER INSERT ON `visits`, encola WhatsApp al visitante |
| **DB function** | `notify_visit_summary_client()` | Nueva | Trigger AFTER UPDATE OF status (a `realizada`), encola WhatsApp resumen al cliente |
| **DB cron** | `visit-reminders-24h` | Nueva | `0 18 * * *` (18:00 Colombia) |
| **DB cron** | `visit-reminders-2h` | Nueva | `*/30 * * * *` |
| **DB cron** | `visit-overdue-alerts` | Nueva | `15 * * * *` |
| **Edge function** | `process-whatsapp-notifications` | Existente (v12) | Agregar 6 builders en TEMPLATE_REGISTRY |
| **External** | Meta Business Manager | — | Aprobar 6 templates UTILITY/ES (bloqueador 24-48h) |
| **Frontend page** | `MyDay` | Nueva | Ruta `/agenda/hoy` |
| **Frontend page** | `AppointmentDetailModal` | Existente | Integrar `VisitOwnerPicker` cuando appointment es visita |
| **Frontend page** | `App.tsx` | Existente | Registrar ruta `/agenda/hoy` lazy-loaded |
| **Frontend component** | `VisitOwnerPicker` | Nuevo | Dropdown admins + comerciales activos |
| **Frontend component** | `VisitMeasurementsForm` | Nuevo | Form 6 bloques + react-hook-form + Zod |
| **Frontend component** | `VisitPhotoUploader` | Nuevo | Multi-upload a Supabase Storage |
| **Frontend hook** | `useAssignVisitTo` | Nuevo | Mutation que llama RPC |
| **Frontend hook** | `useMyVisitsToday` | Nuevo | Query: visited_by=me ∧ scheduled_at=hoy |
| **Frontend hook** | `useFinishVisit` | Nuevo | UPDATE visits.status='realizada' con measurements/photos |
| **Frontend schema** | `visit-measurements.ts` | Nuevo | Zod schema v1 |
| **Storage** | bucket `visit_photos` | Nueva (si no existe) | Policies: upload por `visited_by` o admin; read por mismo + cliente vía signed URL (futuro) |

### 4.2 Schema / API contracts

#### 4.2.1 Nueva fila en `system_settings`
```sql
INSERT INTO system_settings (key, value)
VALUES ('default_visitor_id', jsonb_build_object('id', '09ca8b37-95b8-43dc-9b01-1100519d5ec5'))
ON CONFLICT (key) DO NOTHING;
```

#### 4.2.2 ALTER CHECK `visits_scheduled_via_check`
```sql
ALTER TABLE public.visits DROP CONSTRAINT visits_scheduled_via_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_scheduled_via_check
  CHECK (scheduled_via IN ('public_link','comercial','admin','agent_a05'));
```

#### 4.2.3 Helper `get_default_visitor()`
```sql
CREATE OR REPLACE FUNCTION public.get_default_visitor()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (value->>'id')::uuid FROM public.system_settings WHERE key = 'default_visitor_id';
$$;
```

#### 4.2.4 `book_public_visit` (modificada)
- Cambio puntual: el INSERT a `visits` toma `COALESCE(get_default_visitor(), v_ctx.staff_id)` en `visited_by` (en lugar de `v_ctx.staff_id` solo). Resto idéntico.
- El mensaje al cliente sigue diciendo "Te atenderá {{staff_name}}" porque el comercial sigue siendo el dueño de la opp (`opportunities.assigned_to`). El admin es el visitante, no el asesor.

#### 4.2.5 RPC `assign_visit_to`
```
assign_visit_to(p_visit_id uuid, p_new_visitor_id uuid) RETURNS visits
```
- `SECURITY DEFINER`.
- Check interno: `IF get_my_role() <> 'admin' THEN RAISE EXCEPTION 'Solo administradores pueden reasignar visitas' USING ERRCODE='42501'; END IF;`.
- UPDATE `visits SET visited_by = p_new_visitor_id, scheduled_via = COALESCE(scheduled_via, 'admin'), updated_at = NOW() WHERE id = p_visit_id`.
- El trigger `visit_to_task_mirror` (UPDATE branch) recalcula `tasks.assigned_to` y reserva el nuevo `availability_slot`.
- RETURN del row actualizado.

#### 4.2.6 RLS endurecida en `visits`
- Estrategia preferida: **columna grant** + RLS limpio.
  - `REVOKE UPDATE ON public.visits FROM authenticated;`
  - `GRANT UPDATE (measurements, photos, status, notes, modality, is_exception, exception_reason, scheduled_at, duration_minutes, client_confirmed_at, realized_at, reschedule_count) ON public.visits TO authenticated;`
- Resultado: la columna `visited_by` (y `created_by`) ya no puede actualizarse vía SQL directo desde un cliente autenticado. La única vía válida es la RPC `assign_visit_to`.
- Si PostgreSQL no respeta column-level grant junto con RLS en este escenario, fallback: definir una policy `visits_update_visited_by_admin_only` con `WITH CHECK (visited_by = (SELECT visited_by FROM visits WHERE id = NEW.id) OR get_my_role() = 'admin')`. Documentar en la migración cuál estrategia ganó.

#### 4.2.7 Triggers nuevos
```
trg_notify_visit_assigned_admin   AFTER INSERT ON visits   FOR EACH ROW
trg_notify_visit_summary_client   AFTER UPDATE OF status ON visits FOR EACH ROW WHEN (NEW.status='realizada' AND OLD.status<>'realizada')
```
- Ambos encolan rows en `notification_queue` con `dedup_key` apropiado (`visit-assigned-<visit_id>`, `visit-summary-<visit_id>`).

#### 4.2.8 Crons SQL
```sql
SELECT cron.schedule('visit-reminders-24h', '0 18 * * *',  'SELECT enqueue_visit_reminders_24h();');
SELECT cron.schedule('visit-reminders-2h',  '*/30 * * * *', 'SELECT enqueue_visit_reminders_2h();');
SELECT cron.schedule('visit-overdue-alerts','15 * * * *',   'SELECT enqueue_visit_overdue_alerts();');
```
- Idempotencia: cada función usa `dedup_key` en sus inserts a `notification_queue` y dedup `(user_id, related_id, notification_type)` en `notifications`.

#### 4.2.9 Schema JSON `visits.measurements` (versión 1)
```jsonc
{
  "version": 1,
  "espacio":    { "largo_cm": number, "ancho_cm": number, "alto_cm": number,
                  "forma": "lineal" | "L" | "U" | "isla" | "peninsula" },
  "conexiones": { "agua": { "ubicacion": string },
                  "gas":  { "tipo": "natural" | "propano" | "ninguno", "ubicacion": string },
                  "voltaje": "110" | "220" | "ambos",
                  "desague": { "ubicacion": string } },
  "estado":     { "remover_cocina_actual": boolean,
                  "tipo_pared": "drywall" | "mamposteria" | "mixto",
                  "tipo_piso":  string },
  "servicios":  { "<service_key>": { "incluido": boolean, "notas": string } },
                // service_key ∈ cocina_integral | mesones | closets | tv_center | puertas | acabados
  "notas":      string
}
```
- Validación cliente: Zod schema en `src/lib/schemas/visit-measurements.ts`.
- Validación DB: `validate_visit_completion` ya bloquea si `measurements = '{}'` o `photos < 3`. No se modifica.

#### 4.2.10 Templates Meta a aprobar (bloqueador externo)

| Key | Categoría | Vars | Audience |
|---|---|---|---|
| `visit_assigned_admin_v1` | UTILITY · ES | {{1=cliente_nombre}} {{2=fecha}} {{3=hora}} {{4=direccion}} | admin (`visited_by`) |
| `visit_reminder_24h_client_v1` | UTILITY · ES | {{1=nombre}} {{2=hora}} {{3=visitante_nombre}} {{4=direccion}} | cliente |
| `visit_reminder_24h_internal_v1` | UTILITY · ES | {{1=hora}} {{2=cliente_nombre}} {{3=direccion}} {{4=cliente_tel}} {{5=servicios}} | admin |
| `visit_reminder_2h_client_v1` | UTILITY · ES | {{1=nombre}} {{2=hora}} | cliente |
| `visit_reminder_2h_internal_v1` | UTILITY · ES | {{1=hora}} {{2=cliente_nombre}} {{3=direccion}} {{4=cliente_tel}} | admin |
| `visit_summary_client_v1` | UTILITY · ES | {{1=nombre}} {{2=plazo_horas}} | cliente |

### 4.3 Arquitectura — slices ejecutables

Cada slice debe ser ship-able por sí solo, con su propia verificación E2E y handoff antes de pasar al siguiente.

| Slice | Goal | Migraciones | Frontend |
|---|---|---|---|
| **S1** | Default visitor + notif in-app correcta | `022_default_visitor_setting.sql`, `023_book_public_visit_uses_default.sql` | — |
| **S2** | Reasignar visita + `scheduled_via='admin'` | `024_visit_scheduled_via_admin.sql`, `025_assign_visit_to_rpc.sql` | `VisitOwnerPicker`, `useAssignVisitTo`, integración en `AppointmentDetailModal` |
| **S3** | WhatsApp al admin + recordatorios + 6 templates Meta | `026_visit_whatsapp_triggers.sql` + cron schedule | TEMPLATE_REGISTRY en `process-whatsapp-notifications/index.ts` |
| **S4** | Vista "Mi día" + form de medidas + photo upload + "Finalizar visita" | `027_visit_photos_bucket.sql` (si bucket no existe) | `MyDay`, `VisitMeasurementsForm`, `VisitPhotoUploader`, `useMyVisitsToday`, `useFinishVisit`, `visit-measurements.ts`, ruta en `App.tsx` |
| **S5** | Watchdog + resumen al cliente | `028_visit_summary_and_watchdog.sql` + cron schedule | — |

### 4.4 Decisiones arquitectónicas clave

- **Reutilizar `notification_queue` antes que crear nueva tabla** para mensajes salientes (admin y cliente). El recipient_type genérico ya lo soporta.
- **No agregar columnas a `visits`** para "estados intra-visita" (`in_transit`, `in_visit`). El flujo mínimo de Fase 3 no los necesita; agregar enums = scope inflado.
- **No agregar valores nuevos a `opportunities.status`**. La progresión `visit_scheduled → visit_completed → quoted` ya cubre el caso. El trigger `trg_visit_auto_quotation` se mantiene.
- **`get_default_visitor()` como helper SQL**, no como JSON parseado en cada caller. Permite cambiar el visitante default modificando un row, sin recompilar/redeployar.
- **Dedup keys por convención**: `visit-assigned-<visit_id>`, `visit-reminder-24h-<visit_id>`, `visit-reminder-2h-<visit_id>`, `visit-summary-<visit_id>`. Para `notifications` (in-app): dedup por `(user_id, related_id, notification_type)`.
- **Storage bucket `visit_photos`**: si no existe, crearlo en migración con RLS de upload (visitante + admin) y read (mismo). Signed URLs para clientes en Fase 4 (no en scope).
- **Lazy loading**: `MyDay` y todos los componentes nuevos se importan con `React.lazy` para no inflar el bundle inicial.
- **Convenciones del repo (`docs/CONVENTIONS.md`)**: errores via `mapSupabaseError`, Zod en mutations, `retry: 0` en React Query, design tokens (no hex hardcoded), mínimo privilegio en SQL.

### 4.5 Reutilizaciones

- `validate_visit_completion` (intacto).
- `trg_visit_auto_quotation` (intacto).
- `trg_visit_to_task_mirror` (intacto — el fix de D1 fluye a través de él automáticamente).
- `notify_booking_created` (intacto — al cambiar `visited_by` a admin, la notif in-app le llega al admin sin tocar la función).
- `process-whatsapp-notifications` v12 (solo se extiende el TEMPLATE_REGISTRY).
- `useRealtimeNotifications` (sigue montado solo en `Layout`, NO duplicar).
- `CategoryHeader`, `DeleteFlow`, `assertSupabase`, `mapSupabaseError` (importar tal cual).

---

## 5. Testing Decisions

### 5.1 Verificación end-to-end por slice

#### Slice 1 (default visitor)
1. Crear opportunity QA `[QA-PHASE3-S1] Cliente X` vía SQL con `data_origin='whatsapp'`.
2. Confirmar visita llamando `SELECT * FROM book_public_visit('<token>', '2026-05-28T09:00:00+00:00');`.
3. Aserción: `SELECT visited_by FROM visits WHERE opportunity_id = '<opp_id>'` → uuid de Alvaro.
4. Aserción: `SELECT assigned_to FROM tasks WHERE id = '<visit_id>'` → uuid de Alvaro.
5. Aserción: `SELECT staff_id FROM availability_slots WHERE date = '2026-05-28' AND start_time = '09:00'` → uuid de Alvaro.
6. Aserción: `SELECT 1 FROM notifications WHERE user_id = '<alvaro_id>' AND related_id = '<visit_id>' AND notification_type = 'booking_new'` → 1 row.

#### Slice 2 (reasignar)
1. Login como Alvaro → `/agenda` → abrir detalle de la visita QA → ver dropdown "¿Quién va?" con Alvaro pre-seleccionado.
2. Cambiar a un comercial activo → aplicar → red de confirmación.
3. Aserción SQL: `visits.visited_by` = nuevo comercial; slot anterior `is_booked=false`, nuevo slot creado y `is_booked=true`.
4. Cerrar sesión, login como comercial (no el original) → abrir misma visita → dropdown ausente o disabled.
5. Intento malicioso: en consola, llamar `supabase.from('visits').update({ visited_by: ... }).eq('id', ...)` como comercial → debe fallar (permission denied / column not updatable).

#### Slice 3 (WhatsApp + recordatorios)
1. Confirmar nueva visita QA → `SELECT * FROM notification_queue WHERE event_reference_id = '<visit_id>' AND template_name = 'visit_assigned_admin_v1'` → 1 fila `status='pending'`.
2. UPDATE visita a `scheduled_at = CURRENT_DATE + INTERVAL '1 day' + TIME '09:00'` → llamar `SELECT enqueue_visit_reminders_24h();` → 2 filas nuevas (`visit_reminder_24h_client_v1` + `visit_reminder_24h_internal_v1`).
3. UPDATE visita a `scheduled_at = NOW() + INTERVAL '2 hours'` → llamar `SELECT enqueue_visit_reminders_2h();` → 2 filas nuevas.
4. Re-ejecutar las funciones → no duplica (verificar count constante por `dedup_key`).
5. Una vez aprobados los 6 templates Meta, observar `process-whatsapp-notifications` cycle: status pasa a `sent` → `delivered`.

#### Slice 4 (Mi día + form + finalizar)
1. Login como Alvaro → `/agenda/hoy` → ver tarjeta de visita QA (forzar `scheduled_at = today`).
2. Click "Abrir formulario" → completar 6 bloques (con valores válidos Zod) + subir 3 fotos al bucket `visit_photos`.
3. Click "Finalizar visita" → request resuelve sin error.
4. Aserción: `visits.status='realizada'`, `visits.measurements.version=1` con campos esperados, `visits.photos` array con ≥3 URLs.
5. Aserción: `opportunities.status='quoted'`.
6. Aserción: `quotations` v1 `initial` `draft` creada (gracias a `trg_visit_auto_quotation`).
7. Aserción Slice 5 (si ya está): `notification_queue` fila `visit_summary_client_v1` para el cliente.

#### Slice 5 (watchdog + resumen)
1. Marcar otra visita como `realizada` → verificar fila `visit_summary_client_v1` en `notification_queue`.
2. UPDATE visit: `scheduled_at = NOW() - INTERVAL '3 hours'`, `status='agendada'` → llamar `SELECT enqueue_visit_overdue_alerts();` → 1 fila en `notifications` con `notification_type='visit_overdue'` para `visited_by`.
3. Re-ejecutar → count constante (dedup respetado).

### 5.2 Verificación E2E full (post-Slice 5)
- Lead nuevo → confirmación pública → fix bug visited_by → notif in-app + WhatsApp encolado → recordatorios 24h + 2h → Alvaro abre `/agenda/hoy` → form + fotos → Finalizar → opp `quoted` + draft cotización + resumen al cliente.

### 5.3 Testing no-funcional
- **Bundle size**: medir antes/después del Slice 4 con `npm run build`. Si crece >20%, evaluar code-splitting más agresivo en `VisitMeasurementsForm`.
- **RLS**: con sesión de comercial, intentar UPDATE directo de `visited_by` y verificar denegación. Con sesión de admin, verificar éxito vía RPC.
- **Idempotencia de crons**: correr 2 veces seguidas y verificar que la cantidad de rows en `notification_queue`/`notifications` permanece.
- **Mobile** (Alvaro carga fotos desde celular): probar `VisitPhotoUploader` desde `/agenda/hoy` en viewport 375px y verificar que cámara + galería responden.

---

## 6. Out of Scope

- **Modalidad `foto_remota`** (D9): la columna `visits.modality='foto_remota'` permanece reservada. Flujo dedicado de pedido de fotos por WhatsApp + cotización marcada `tentativa` → sub-fase futura.
- **Botones "En camino" / "Llegué"** (D6 — descartado): no se agrega `visits.field_phase` ni triggers asociados.
- **Geo check-in** (D12 — descartado): sin botón "Llegué" no aplica.
- **Reagendamiento público del cliente** (D13): el cliente no tiene un link para mover su propia visita. Si necesita reprogramar, responde al WhatsApp y un humano lo atiende.
- **Filtro "Mías / Todas" en `/agenda`** (D16): la vista global de `/agenda` queda como está; `/agenda/hoy` cubre el caso "mis visitas de hoy".
- **Auto-asignación de visitante por zona geográfica**: idea registrada en plan, fuera de scope.
- **Pre-llenar `measurements` con datos del lead**: idea registrada en plan, fuera de scope.
- **Pausa manual entre `visit_completed` y `quoted`** (D11 — descartado): el trigger `trg_visit_auto_quotation` permanece como está.
- **Cleanup de Robert Anderson** (D15): el usuario decide mantenerlo activo como cuenta de pruebas. Riesgo documentado: como tiene `role='admin'`, puede usar la RPC `assign_visit_to` si alguien entra con su cuenta.
- **Versionado de `measurements` con migración futura a v2**: solo se documenta que `version: 1` está reservado; cualquier campo nuevo va en `version: 2` con backfill explícito.

---

## 7. Further Notes

### 7.1 Bloqueadores externos
- **Aprobación de 6 templates Meta** (24-48h). El usuario debe crearlos y enviarlos a revisión en Meta Business Manager. Mientras no estén aprobados, los rows encolados quedan `failed` sin bloquear el resto del sistema. Slices 1, 2, 4 y 5 pueden avanzar en paralelo sin esperar Meta.

### 7.2 Riesgos conocidos
- **Robert Anderson activo**: bajo D15, Robert (admin de prueba) puede usar `assign_visit_to`. Si alguien testea con su cuenta puede mover visitas reales. Mitigación recomendada (out of scope pero registrada): `UPDATE profiles SET is_active = false WHERE id = '<robert_id>'` cuando se cierre la fase de QA.
- **RLS column-level grant**: la estrategia preferida (REVOKE/GRANT por columna) puede no convivir bien con todas las policies actuales de `visits`. Si surge un edge case en QA, fallback documentado en §4.2.6.
- **Storage bucket `visit_photos`**: si no existe, hay que crearlo con policies correctas. Subir 5+ fotos por visita a 2-3 MB cada una son ~15 MB/visita. A 100 visitas/mes = 1.5 GB/mes — verificar plan Supabase contratado tiene capacidad.
- **Cron load**: los 3 crons sumados corren ~75 invocaciones/día. Despreciable, pero monitorear `cron.job_run_details` en `/settings/whatsapp` por si una función explota silenciosamente.

### 7.3 Dependencias verificadas
- `system_settings`, `notification_queue`, `notifications`, `availability_slots`, `tasks`, `visits`, `opportunities`, `profiles`, `quotations` — todas existen y operativas en producción.
- `process-whatsapp-notifications` v12 ya corre con cron de 1 minuto.
- Convención de `dedup_key` ya usada en triggers de Fase 1 — no se inventa nada nuevo.

### 7.4 Open questions diferidas
- Granularidad de fotos: ¿debe haber categorías ("frente", "lateral", "conexiones") o queda como array plano? **Decisión actual**: array plano con descripción opcional por foto. Si v2 lo requiere, se introduce.
- Texto exacto de los 6 templates Meta: el PRD especifica variables; el wording exacto se redacta al momento de crear los templates en Meta Business y se documenta en `reference_innovar_whatsapp_templates.md`.
- Estrategia de retry: cuando un template Meta no está aprobado, los rows en `notification_queue` quedan `failed`. ¿Re-procesarlos automáticamente cuando el template se aprueba o forzar manual? **Decisión actual**: manual via `/settings/whatsapp` → resetear `status='pending'` → cron del worker los retoma.

### 7.5 Cierre del ciclo (post-implementación)
- Cada slice termina con commit en `ux-fixes` + handoff en `docs/handover/YYYY-MM-DD_PHASE-3-SLICE-N.md` + actualización del entry en `MEMORY.md`.
- Al cerrar Slice 5 (Fase 3 completa), generar un único handoff consolidado `2026-05-XX_PHASE-3-COMPLETE.md` con el resumen de las 7 migraciones aplicadas, los 6 templates Meta aprobados, y un E2E test corrido en producción.
