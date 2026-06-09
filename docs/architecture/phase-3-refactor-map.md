# Refactor Map — Fase 3 · Visita técnica en sitio

> **Versión**: 1.0 · **Audiencia**: devs y agentes IA ejecutores · **Fase**: 4 (post-PRD, pre-ejecución)
> **Inputs**: [PRD phase-3-on-site-visit.md](../prd/phase-3-on-site-visit.md) + plan `C:\Users\ceoel\.claude\plans\para-ir-por-lo-ancient-wigderson.md` + migraciones `db/migrations/022–028`
> **Convenciones obligatorias**: [docs/CONVENTIONS.md](../CONVENTIONS.md)
> **Modo de trabajo**: *"para ir por lo seguro"* — reusar al máximo, evitar abstracciones especulativas

Este documento mapea Fase 3 al árbol de carpetas actual: qué se crea, qué se modifica, qué se elimina, en qué orden, y bajo qué bandera. Sigue los 5 slices del PRD. No hay refactor masivo: el modelo de datos ya estaba mayoritariamente listo en Fase 1-2; este refactor cose la última pieza (UI de "Mi día" + reasignación + recordatorios + watchdog) sin tocar conceptos sólidos.

---

## 0. Principios de arquitectura aplicados a Fase 3

1. **Reuso radical sobre abstracción nueva**. Hay 3 helpers SQL listos (`enqueue_notification`, `fn_wa_enqueue_for_profile`, `fn_profile_wants_wa`), 1 worker (`process-whatsapp-notifications` v12), 1 hook realtime (`useRealtimeNotifications`), 1 sistema de campana (`NotificationBell`) — usar todo. No reinventar el outbox, no crear un `useVisitNotifications` propio.
2. **`visits` queda como fuente de verdad**. `tasks` permanece como espejo mantenido por `visit_to_task_mirror` (intacto). El nuevo código lee/escribe **directo en `visits`** cuando trata visitas; usa `tasks` solo cuando trata las views de calendario que ya consumen tasks (`/agenda`).
3. **Hooks deep, no shallow**. `useFinishVisit` orquesta validación + upload + UPDATE atómico + invalidación de queries — un solo punto de entrada. No tres hooks chiquitos que el caller compone.
4. **Convivencia de UI vieja y nueva detrás de feature flag por slice**. Default: la nueva está OFF; cada slice se activa con su flag al pasar QA.
5. **`docs/CONVENTIONS.md`**: errores via `mapSupabaseError`, mutations validan input con Zod, `retry: 0` en React Query, design tokens (no hex hardcoded), mínimo privilegio en SQL.
6. **Identifiers en inglés, UI en español**. Sin excepción.
7. **No tocar Fase 1-2**. `book_public_visit` se modifica solo en su línea de `visited_by` (migración 023); el resto del flujo público queda inmutable.

---

## 1. Hooks — nuevos y refactorizados

### 1.1 Hooks nuevos

| Hook | Propósito | Slice | Profundidad |
|---|---|---|---|
| `src/hooks/agenda/useAssignVisitTo.ts` | Mutation que llama RPC `assign_visit_to(visit_id, new_visitor_id)`. Invalida `['appointments']`, `['visits']`. Mapea error 42501 a mensaje "Solo administradores pueden reasignar". | S2 | Deep: una sola llamada cubre auth check + liberación de slot + reasignación + propagación a tasks. |
| `src/hooks/agenda/useMyVisitsToday.ts` | Query: `visits` con `visited_by = auth.uid()` AND `scheduled_at::date = CURRENT_DATE` AND `status NOT IN ('cancelada','no_show')` AND `deleted_at IS NULL`. JOIN a `clients` + `opportunities` + `profiles` del visitante. Ordena por `scheduled_at`. Realtime: invalida por cambios de `visits.status` o `visited_by`. | S4 | Deep: filtra, ordena, agrega contexto cliente/opp en una sola operación. |
| `src/hooks/agenda/useFinishVisit.ts` | Mutation que: 1) valida Zod sobre measurements, 2) sube fotos faltantes a `visit_photos`, 3) UPDATE `visits.status='realizada', measurements=..., photos=..., notes=..., realized_at=NOW()`. El trigger `validate_visit_completion` enforce reglas de DB; el trigger `trg_visit_auto_quotation` se ocupa del avance río abajo. Caller solo llama `finishVisit({ visitId, measurements, photoFiles, notes })`. | S4 | Deep: un sólo hook hace upload + write + chaining trigger. Caller no orquesta nada. |
| `src/hooks/agenda/useActiveVisitors.ts` | Query: `profiles WHERE is_active AND role IN ('admin','super_admin','comercial')`. Cacheo `staleTime: 5min`. Feed del `VisitOwnerPicker`. | S2 | Shallow pero justificado: una sola query, una sola usage. Alternativa de no extraerlo y meterlo inline en el componente sería peor (no cachea). |

### 1.2 Hooks refactorizados

| Hook | Cambio | Slice |
|---|---|---|
| `src/hooks/agenda/useAppointments.ts` | **Sin cambio funcional.** Sigue alimentando `/agenda` global. Nota documentada: lee tasks (espejo), no visits. La vista `/agenda/hoy` (S4) NO usa este hook — usa `useMyVisitsToday` que lee directo de `visits`. | — |
| `src/hooks/agenda/useCompleteAppointment.ts` | **Reusable como está.** Sigue marcando `tasks.status='completado'` para citas de diseño (`cita_diseno`). Para visitas técnicas el cierre real es `useFinishVisit` (S4) — éste sigue siendo el path para citas no-visita. | — |

### 1.3 Hooks eliminados

Ninguno. El modelo es aditivo.

---

## 2. Componentes — nuevos y modificados

### 2.1 Componentes nuevos

| Componente | Propósito | Reusos | Slice |
|---|---|---|---|
| `src/components/agenda/VisitOwnerPicker.tsx` | Select que lista visitantes activos (admin + comercial). Bloqueado para no-admin (disabled + tooltip "Solo administradores pueden reasignar"). Cambio dispara `useAssignVisitTo`. Toast de éxito/error vía `mapSupabaseError`. | `Select` de shadcn, `useActiveVisitors`, `useAssignVisitTo` | S2 |
| `src/pages/MyDay.tsx` | Página de la ruta `/agenda/hoy`. Header con `CategoryHeader` (título "Tu día — [fecha]"), métricas top (3 cards: pendientes, próxima, completadas — siguen el mismo patrón visual que `Agenda.tsx`), lista de visitas como Cards verticales con CTA "Abrir formulario". Empty state si no hay visitas hoy. | `CategoryHeader`, `Card`, `useMyVisitsToday` | S4 |
| `src/components/agenda/VisitMeasurementsForm.tsx` | Form con 6 secciones colapsables (Espacio, Conexiones, Estado, Servicios, Notas, Fotos). React Hook Form + Zod (`visit-measurements.ts`). En cada sección, fields tipados con descripciones y validation hints. Sección Fotos delega a `VisitPhotoUploader`. Botón "Finalizar visita" deshabilitado hasta cumplir mínimos (3 fotos + measurements no vacío). | RHF, Zod, `Accordion`, `Input`, `Select`, `Textarea` de shadcn, `VisitPhotoUploader` | S4 |
| `src/components/agenda/VisitPhotoUploader.tsx` | Multi-upload a `visit_photos` con path `<visit_id>/<uuid>.<ext>`. Compresión client-side (canvas resize a max 1920px, JPEG q=0.85). Preview grid con thumbnails. Badge "X / 3 (mínimo)". Drag-drop + selector mobile-native (cámara o galería). Manejo de errores RLS. | `Card`, `Button`, `supabase.storage`, `browser-image-compression` opcional | S4 |
| `src/components/agenda/MyDayVisitCard.tsx` | Card individual de visita en `MyDay.tsx`. Muestra hora, cliente nombre, dirección, servicios solicitados (chips), tel del cliente con click-to-call. CTA principal "Abrir formulario". Estado visual distinto si visita ya está en curso (timestamp pasado). | `Card`, `Badge`, `Button`, lucide icons | S4 |
| `src/lib/schemas/visit-measurements.ts` | Zod schema versionado para `visits.measurements`. Exporta `VisitMeasurementsV1` type. Validation refinements: largo/ancho/alto positivos, al menos 1 servicio incluido, notas opcionales. | `zod` | S4 |

### 2.2 Componentes modificados

| Componente | Cambio | Slice |
|---|---|---|
| `src/components/agenda/AppointmentDetailModal.tsx` | Si `appointment.appointment_type === 'visita_tecnica'` y hay una visita asociada (mismo `id`), renderizar `<VisitOwnerPicker visit={visit} />` dentro del bloque de información. Si rol del user no es admin, el picker aparece disabled. Cero cambio en `cita_diseno`. | S2 |
| `src/App.tsx` | Agregar `<Route path="/agenda/hoy" element={<Suspense><MyDayPage /></Suspense>} />` dentro del wrapper protegido (lazy-loaded). Mantener orden alfabético/lógico con las rutas existentes de `/agenda`. | S4 |
| `src/components/layout/NotificationBell.tsx` | Sumar mapping en `getNotificationIcon` y `getNotificationColor` para `notification_type='visit_overdue'` → ícono `Clock` + color `orange-500`. Resto intacto. | S5 |

### 2.3 Componentes eliminados

Ninguno.

---

## 3. Estructura de directorios — antes / después

### Antes (estado en `ux-fixes` @ `f08be2c`)
```
src/
├── components/
│   ├── agenda/
│   │   ├── AppointmentDetailModal.tsx
│   │   ├── CitasCalendarView.tsx
│   │   ├── CitasListView.tsx
│   │   ├── ClientSearchSelect.tsx
│   │   ├── NewAppointmentModal.tsx
│   │   └── SlotPicker.tsx
│   ├── layout/
│   │   └── NotificationBell.tsx
│   └── notifications/
│       ├── NotificationsFilters.tsx
│       ├── NotificationsList.tsx
│       └── NotificationsMetrics.tsx
├── hooks/
│   └── agenda/
│       ├── useActiveStaff.ts
│       ├── useAppointments.ts
│       ├── useAvailableSlots.ts
│       ├── useBookAppointment.ts
│       ├── useCancelAppointment.ts
│       ├── useCompleteAppointment.ts
│       └── usePublicBooking.ts
├── lib/
│   ├── errors.ts
│   └── supabaseClient.ts
├── pages/
│   ├── Agenda.tsx
│   ├── Notifications.tsx
│   └── PublicBooking.tsx
└── App.tsx
```

### Después (Fase 3 completa)
```
src/
├── components/
│   ├── agenda/
│   │   ├── AppointmentDetailModal.tsx         ← MODIFICADO (S2)
│   │   ├── CitasCalendarView.tsx
│   │   ├── CitasListView.tsx
│   │   ├── ClientSearchSelect.tsx
│   │   ├── MyDayVisitCard.tsx                 ← NUEVO (S4)
│   │   ├── NewAppointmentModal.tsx
│   │   ├── SlotPicker.tsx
│   │   ├── VisitMeasurementsForm.tsx          ← NUEVO (S4)
│   │   ├── VisitOwnerPicker.tsx               ← NUEVO (S2)
│   │   └── VisitPhotoUploader.tsx             ← NUEVO (S4)
│   ├── layout/
│   │   └── NotificationBell.tsx               ← MODIFICADO (S5)
│   └── notifications/   (sin cambios)
├── hooks/
│   └── agenda/
│       ├── useActiveStaff.ts
│       ├── useActiveVisitors.ts               ← NUEVO (S2)
│       ├── useAppointments.ts
│       ├── useAssignVisitTo.ts                ← NUEVO (S2)
│       ├── useAvailableSlots.ts
│       ├── useBookAppointment.ts
│       ├── useCancelAppointment.ts
│       ├── useCompleteAppointment.ts
│       ├── useFinishVisit.ts                  ← NUEVO (S4)
│       ├── useMyVisitsToday.ts                ← NUEVO (S4)
│       └── usePublicBooking.ts
├── lib/
│   ├── errors.ts
│   ├── schemas/                               ← NUEVO directorio (S4)
│   │   └── visit-measurements.ts              ← NUEVO (S4)
│   └── supabaseClient.ts
├── pages/
│   ├── Agenda.tsx
│   ├── MyDay.tsx                              ← NUEVO (S4)
│   ├── Notifications.tsx
│   └── PublicBooking.tsx
└── App.tsx                                    ← MODIFICADO (S4)
```

**Total**: 6 archivos nuevos en frontend (excluyendo migraciones SQL en `db/migrations/`) + 3 archivos modificados. Cero borrados.

---

## 4. Dependencias entre slices

```
S1 (DB-only)
 └── S2 (DB + Frontend) — depende de S1 (visited_by debe ser admin antes de tener UI de reasignar)
      └── S3 (DB + Edge Fn registry) — independiente de S4, pero requiere S1 (los triggers leen visited_by)
           └── S5 (DB only) — depende de S3 (comparte el patrón de templates Meta + worker)
      └── S4 (DB + Frontend) — depende de S2 (necesita visited_by correcto + reasignación funcional)
           └── S5 (cierra el bucle: form de finalizar dispara summary trigger)
```

Reglas operativas:
- **S1 se aplica primero** y queda en producción **al menos 24h** antes de S2, para ver si el fix del bug latente rompe algún caso de uso del calendario actual.
- **S2 y S3 pueden ir en paralelo** (S2 toca frontend, S3 espera aprobación Meta).
- **S4 espera S2** (necesita la reasignación funcional como red de seguridad si algún slot queda mal).
- **S5 cierra al final** (cuando Alvaro ya usó `/agenda/hoy` al menos 1 visita).

---

## 5. Estrategia de cutover y feature flags

### 5.1 Feature flags propuestos

Innovar **no tiene** un sistema de feature flags estructurado (no hay GrowthBook ni LaunchDarkly). Las flags se implementan como **rows en `system_settings`** con prefix `feature_` y un helper hook `useFeatureFlag(key)`.

Si **no se quiere implementar el helper** (overhead extra para Fase 3), alternativa "para ir por lo seguro": cutover **commit-by-commit** sin flags, ship por slice, rollback granular vía git revert si hay problema.

Recomendación: **sin flags**. Cada slice ya es ship-able solo, cada migración tiene rollback granular, y la convivencia "código nuevo dormido / DB vieja" no aplica acá (las migraciones son cambios de comportamiento, no de schema; salvo `assign_visit_to` que es opt-in).

### 5.2 Cutover por slice

| Slice | Estrategia | Tiempo de soak en prod |
|---|---|---|
| **S1** | Apply migraciones 022 + 023 → opcionalmente, smoke test con QA opportunity. Sin cambio de frontend. | 24h antes de S2 |
| **S2** | Apply 024 + 025 → ship `VisitOwnerPicker` + hooks. Verificación manual: admin reasigna; comercial intenta y falla. | 48h antes de S4 |
| **S3** | Apply 026. Aprobar 4 templates Meta en paralelo (no bloquea — las filas encoladas quedan `failed` hasta aprobación). Crons activos inmediatamente. | Sin soak — independiente |
| **S4** | Apply 027 → ship `MyDay`, `VisitMeasurementsForm`, `VisitPhotoUploader`, `useMyVisitsToday`, `useFinishVisit`, ruta `/agenda/hoy` en `App.tsx`. Verificación: Alvaro carga 1 visita real de prueba E2E (con cliente QA). | 48h antes de S5 |
| **S5** | Apply 028. Aprobar `visit_summary_client_v1` en Meta. | Cierre de Fase 3 |

### 5.3 Rollback granular

Cada migración tiene su bloque "Rollback" comentado. Para revertir un slice:
1. Frontend: `git revert <commit-del-slice>` en `ux-fixes`.
2. DB: ejecutar el bloque rollback de la migración correspondiente (no `ROLLBACK_phase_3.sql` global, salvo emergencia).
3. Si revertir S1 después de S2/S4 está en producción: **no hacerlo** — habría visitas creadas con `visited_by=admin` que la versión vieja del `book_public_visit` no produciría, pero que el frontend nuevo lee bien. Mantener S1.

---

## 6. Patrón de reuso de piezas existentes

Cada pieza del Fase 3 evita reinventar lo que ya existe. Mapa explícito:

| Pieza existente | Uso en Fase 3 | Slice |
|---|---|---|
| `CategoryHeader` (`src/components/shared/CategoryHeader.tsx`) | Header de `MyDay.tsx` con título "Tu día — [fecha]". Misma firma usada en `Agenda.tsx`. | S4 |
| `useRealtimeNotifications` (`src/hooks/notifications/useRealtimeNotifications.ts`) | **NO duplicar**. Sigue montado solo en `Layout`. `useMyVisitsToday` invalida queries por subscriptions propias a `visits` con channel name único (`crypto.randomUUID()`), no por el canal de notifications. | S4 |
| `NotificationBell` + popover | Renderiza notifs `visit_overdue` (S5) automáticamente vía `notification_type` mapping. Sin nueva UI. | S5 |
| `mapSupabaseError`, `assertSupabase` (`src/lib/errors.ts`) | Todos los hooks nuevos los usan. Error 42501 de `assign_visit_to` se mapea a mensaje user-friendly. | S2, S4 |
| `enqueue_notification` SQL helper | Usado por `notify_visit_summary_client` (S5) + `enqueue_visit_reminders_2h` (S3, lado cliente). Dedup automático. | S3, S5 |
| `fn_wa_enqueue_for_profile` SQL helper | Usado por `notify_visit_assigned_admin` (S3) + ambos lados internos de los crons 24h/2h. Chequea `is_active` + preferencias del profile. | S3 |
| `fn_wa_recordatorio_24h_scan` cron existente | **Sigue intacto** — ya cubre el lado cliente 24h con template `recordatorio24hantes`. No duplicamos. | — |
| `validate_visit_completion` trigger | **Sigue intacto** — exige `measurements != '{}'` + `photos ≥ 3`. `useFinishVisit` confía en él y no duplica la validación en el cliente (Zod valida shape, el trigger valida invariants). | S4 |
| `trg_visit_auto_quotation` trigger | **Sigue intacto** — al pasar `status='realizada'`, crea cotización draft + mueve opp a `quoted`. `useFinishVisit` solo dispara el UPDATE; el trigger hace el resto. | S4 |
| `visit_to_task_mirror` trigger | **Sigue intacto** — el fix de S1 (visited_by=admin) atraviesa este trigger transparente. La task espejo queda con `assigned_to=admin` automáticamente. | S1 |
| `process-whatsapp-notifications` Edge Function v12 | Solo se extiende el TEMPLATE_REGISTRY con los 5 builders nuevos. La lógica del worker es la misma. | S3 |
| `AppointmentDetailModal` | Hospeda al nuevo `VisitOwnerPicker` dentro de un bloque condicional. Sin refactor estructural. | S2 |

---

## 7. Storage — convenciones del bucket `visit_photos`

| Aspecto | Decisión |
|---|---|
| Bucket name | `visit_photos` (private) |
| Path | `<visit_id>/<uuid>.<ext>` — primer folder = visit_id, validado por `fn_can_access_visit_photo` |
| MIME permitidos | `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/heic`, `image/heif` (HEIC para iPhone) |
| Size limit | 10 MB por archivo |
| Compresión client-side | Resize a max 1920px lado mayor + JPEG q=0.85 antes del upload. Reduce típico 5MB → 800KB. |
| Acceso lectura | Admin, super_admin, `visited_by` del visit, `assigned_to` de la opp del visit. Cliente NO accede directo — en Fase 4 se generarán signed URLs si se quiere mostrar en una cotización. |
| Acceso escritura | Admin, super_admin, `visited_by`. |
| Borrado | Solo admin/super_admin. (Si Alvaro se equivoca, puede pedir borrado.) |
| Retención | Sin policy automática. Las fotos viven con la visit; soft-delete de la visit no borra las fotos (manual). |

---

## 8. Testing — qué cubre cada slice

| Slice | Test mínimo |
|---|---|
| **S1** | SQL smoke: crear opp QA + llamar `book_public_visit` + asserts en `visits.visited_by`, `tasks.assigned_to`, `availability_slots.staff_id`, `notifications`. |
| **S2** | E2E manual: admin reasigna en UI, slot anterior libera, nuevo slot reservado. Comercial intenta UPDATE directo de `visited_by` → permission denied. RPC con rol no-admin → 42501. |
| **S3** | SQL: insertar visita y verificar 1 row en `notification_queue` con `template_name='visit_assigned_admin_v1'`. Forzar `scheduled_at = mañana 9am` + `SELECT enqueue_visit_reminders_24h_internal();` → row interna. Forzar `scheduled_at = NOW()+2h` + cron 2h → 2 rows. Re-correr ambos → counts iguales (idempotencia). |
| **S4** | E2E real desde mobile: Alvaro abre `/agenda/hoy`, abre form, completa 6 secciones, sube 3 fotos desde cámara, finaliza. Asserts: `visits.status='realizada'`, `measurements.version=1`, `photos.length>=3`, `opportunities.status='quoted'`, `quotations` con draft v1. |
| **S5** | SQL: marcar visita como `realizada` → row `visit_summary_client_v1` encolada. UPDATE visit a `scheduled_at = NOW()-3h` + correr `enqueue_visit_overdue_alerts()` → 1 row en `notifications` con `notification_type='visit_overdue'`. Re-correr → count constante. |

Stack de testing: no hay tests unitarios formales en el repo. Verificación = manual + SQL queries directas. Smoke tests al cierre de cada slice quedan documentados en `docs/handover/YYYY-MM-DD_PHASE-3-SLICE-N.md`.

---

## 9. Apéndice — funciones SQL nuevas (referencia rápida desde frontend)

| Función SQL | Parámetros | Retorno | Llamada desde frontend |
|---|---|---|---|
| `public.assign_visit_to(p_visit_id, p_new_visitor_id)` | uuid, uuid | `public.visits` (row) | `supabase.rpc('assign_visit_to', { p_visit_id, p_new_visitor_id })` |
| `public.get_default_visitor()` | — | uuid | Llamada interna desde `book_public_visit`. **No exponer en frontend.** |
| `public.enqueue_visit_reminders_24h_internal()` | — | int | Solo cron. No llamada manual. |
| `public.enqueue_visit_reminders_2h()` | — | int | Solo cron. |
| `public.enqueue_visit_overdue_alerts()` | — | int | Solo cron. |

Funciones reusadas (no nuevas pero relevantes):
- `public.book_public_visit(text, timestamptz)` — modificada en S1, sigue siendo la única vía pública.
- `public.get_public_booking_context(text)` — sin cambio.
- `public.get_public_visit_slots(text, date, date)` — sin cambio.

---

## 10. Apéndice — out of scope (no entra en este refactor)

Documentado para claridad: estos elementos están **fuera** del scope de Fase 3 y NO aparecen en este refactor map.

- Modalidad `foto_remota` UI.
- Flujo "En camino" / "Llegué" / `field_phase`.
- Geo check-in.
- Reagendamiento público del cliente.
- Filtro "Mías / Todas" en `/agenda` global.
- Auto-asignación de visitante por zona geográfica.
- Pre-llenar `measurements` con datos del lead.
- Limpieza de Robert Anderson (usuario lo dejó activo).
- Pausa manual entre `visit_completed` y `quoted`.
- Versionado de `measurements` v2 (solo v1 en esta fase).
- Sistema general de feature flags (no se construye en esta fase).

Cada uno tiene su sección "Out of scope" en el PRD.
