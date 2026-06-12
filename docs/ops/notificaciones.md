# Notificaciones — arquitectura del sistema

> Extraído del CLAUDE.md raíz el 2026-06-12 (optimización de arnés).
> **Snapshot histórico (2026-05-23)** — la columna viva del estado del proyecto es la memoria
> `project_innovar.md`. Verificar contra prod (Management API) antes de modificar triggers.

## Componentes

- **Tabla DB:** `notifications` (columnas: id, user_id, title, body, is_read, notification_type, priority, action_url, related_table, related_id, created_at)
- **Tipos conocidos de `notification_type`:** `booking_new`, `booking_reminder`, `booking_completed`, `booking_cancelled`, `project_status`, `system`. Las notificaciones de pagos actualmente caen bajo `system` (a confirmar con las edge functions/triggers que insertan).
- **Página completa:** `/notifications` (`src/pages/Notifications.tsx`) — sidebar de categorías + búsqueda server-side + "Marcar todas como leídas".
- **Bell (topbar):** `src/components/layout/NotificationBell.tsx` — popover con últimas 15.
- **Componente compartido de lista:** `src/components/notifications/NotificationsList.tsx` — agrupa por fecha (Hoy/Ayer/Esta semana/Anteriores), infinite scroll, acepta `filterType` y `searchQuery`.
- **Triggers de notificaciones (Supabase producción):** 7 funciones plpgsql. La que está en migraciones locales: `notify_project_created` (`db/migrations/009_lead_to_project_functions.sql:490`). Las 6 restantes (`notify_booking_created`, `notify_booking_status_change`, `notify_task_assigned`, `notify_task_blocked`, `notify_task_comment`, `notify_task_completed`) están en producción y se snapshottearon en `db/migrations/013_fix_notification_action_urls.sql` al arreglar el bug de `action_url` legacy. Si modificás alguna: `CREATE OR REPLACE FUNCTION` vía Management API + migración nueva.

## Pendientes específicos

- [x] **Deep-linking en `/tasks` y `/agenda`** — implementado 2026-06-12 (commit `19c8b5d`: auto-abrir modal desde notificación en Pagos, Agenda y Soporte; migración `060_fix_notification_deeplink_urls.sql`).

## ⚠️ Anti-patrón: Supabase Realtime channels son singletons globales

`useRealtimeNotifications()` usa `supabase.channel('notifications-updates')` con nombre
**hardcoded**. Solo se puede invocar desde UN componente a la vez (actualmente:
`NotificationBell` dentro de `Layout`). Llamarlo desde una segunda página revienta con:

> `cannot add postgres_changes callbacks for realtime:notifications-updates after subscribe()`

Si necesitás realtime en una página nueva: confiá en que el hook ya está activo desde `Layout`
y el bell invalida `['notifications']` automáticamente.
Detalles: `docs/handover/2026-05-23_NOTIFICATIONS-PAGE.md` §3 y memoria
`feedback_supabase_realtime_channel_singleton.md`.
