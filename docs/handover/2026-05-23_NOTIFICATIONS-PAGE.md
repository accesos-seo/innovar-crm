# HANDOFF — Página de Notificaciones (`/notifications`)

> **Fecha**: 2026-05-23
> **De**: Sesión Claude que construyó la página completa
> **Para**: Cualquier sesión futura que toque notificaciones, realtime, o el `NotificationBell`
> **Objetivo**: Capturar QUÉ se hizo, POR QUÉ, y la lección clave del bug que apareció en testing.

---

## 0. TL;DR — lo que necesitas saber en 30 segundos

- Antes había **solo el popover del bell** en la topbar. El enlace "Ver todas las notificaciones" apuntaba a `/agenda/recordatorios` (ruta inexistente → 404 silencioso).
- Ahora hay una **página completa en `/notifications`** con sidebar de categorías estilo ClickUp, búsqueda server-side, "Marcar todas como leídas", responsive, y manejo de empty states por filtro.
- Ya existía un componente `NotificationsList` (con agrupación por fecha + infinite scroll) que estaba huérfano. **Reusé eso** y le envolví la página alrededor.
- **Lección crítica capturada en este trabajo**: `useRealtimeNotifications()` NO se puede llamar desde dos componentes a la vez — el canal `'notifications-updates'` es hardcoded y Supabase rechaza el segundo `.on()`. Mantenerlo solo en `NotificationBell` (que vive en `Layout`, siempre montado).

---

## 1. Qué se construyó

### 1.1 Archivos nuevos

| Path | Propósito |
|---|---|
| `src/pages/Notifications.tsx` | Página principal `/notifications`. Sidebar de categorías + main con búsqueda y lista. |
| `docs/handover/2026-05-23_NOTIFICATIONS-PAGE.md` | Este documento. |

### 1.2 Archivos modificados

| Path | Cambio | Por qué |
|---|---|---|
| `src/App.tsx` | Lazy import `NotificationsPage` + rutas `/notifications`, `/notificaciones` (alias), `/agenda/recordatorios` (redirect histórico). | Registrar la ruta y no romper bookmarks viejos. |
| `src/components/layout/NotificationBell.tsx:62` | `navigate('/agenda/recordatorios')` → `navigate('/notifications')`. | El enlace "Ver todas" apuntaba a una ruta que nunca existió. |
| `src/hooks/notifications/useNotifications.ts` | Agregado filtro `'unread'` (eq is_read=false) + parámetro `searchQuery` que hace `or('title.ilike.%q%,body.ilike.%q%')` con escapado de `%_,`. La queryKey ahora incluye `trimmedSearch` para que React Query refresque al cambiar el término. | Soportar la pestaña "Sin leer" y la barra de búsqueda de la nueva página, server-side (no client-side, para que la búsqueda funcione contra toda la tabla y no solo las páginas ya cargadas). |
| `src/components/notifications/NotificationsList.tsx` | Acepta prop opcional `searchQuery` que pasa al hook. Mejora del copy del empty state para distinguir: sin resultados de búsqueda / sin pendientes (filtro `unread`) / sin nada en absoluto. | Componente ahora reutilizable con búsqueda. |

### 1.3 Estructura visual

```
┌──────────────────────────────────────────────────────────────────┐
│ [←] 🔔 NOTIFICACIONES  [✓ Al día | N sin leer]  [Marcar todas]    │
│     Centro de actividad: citas, pagos y cambios en tus proyectos. │
├──────────────────┬───────────────────────────────────────────────┤
│ CATEGORÍAS  [⚙] │ [🔍 Buscar en notificaciones…]                  │
│                  │                                                 │
│ 📥 Bandeja       │ HOY ───────────────────────────                │
│ ✉️  Sin leer  [9]│ ┌─────────────────────────────────────────────┐│
│ 📅 Citas         │ │ 🟪 📍 Nueva cita de diseño agendada         ││
│ 🔨 Proyectos     │ │     Para el 28/05/2026 a las 10:00 AM      ││
│ ⚙️  Sistema      │ └─────────────────────────────────────────────┘│
│                  │ AYER ──────────────────────────                │
│ ┌──────────────┐ │ ┌─────────────────────────────────────────────┐│
│ │ Sin leer     │ │ │  💰 Pago recibido: $200,000                 ││
│ │ Pendientes…  │ │ │     Proyecto Robert Virona — daviplata      ││
│ └──────────────┘ │ └─────────────────────────────────────────────┘│
│                  │                                                 │
│                  │              [ Cargar más ]                    │
└──────────────────┴───────────────────────────────────────────────┘
```

Mobile (`< md`): el sidebar colapsa a una fila horizontal scrollable de chips arriba de la lista.

---

## 2. Decisiones de diseño que tomé (y por qué)

### 2.1 Categorías del sidebar
Solo 5 — `Bandeja / Sin leer / Citas y visitas / Proyectos / Sistema`. **No agregué "Pagos" como categoría dedicada** porque el `notification_type` que usa el backend para pagos no es claro desde el código (el ícono cae al fallback `Info` y el emoji 💰 viene en el título). Las notificaciones de pago caen actualmente bajo "Sistema". Si se quiere "Pagos" como categoría aparte, primero hay que confirmar en DB qué `notification_type` se usa (probablemente nada estándar — revisar las edge functions o triggers que insertan en `notifications`) y extender la lista en `useNotifications.ts:28-34`.

### 2.2 No agregué concepto de "Archivado"
Habría requerido migración a Supabase (columna `archived_at` en `notifications`) + UI para archivar/desarchivar + filtro nuevo. El usuario eligió "sólo leído/no-leído por ahora" en la pre-pregunta. Si después extraña la separación, agregar en un slice aparte.

### 2.3 Búsqueda server-side, no client-side
Con `useInfiniteQuery` y `PAGE_SIZE=20`, una búsqueda client-side solo encontraría matches en las páginas ya cargadas — UX engañosa ("¿por qué no aparece esta notificación si sé que existe?"). La queryKey de React Query incluye el `searchQuery`, así que cambiar el término dispara una nueva query desde la página 0. Debounce de 300ms en `Notifications.tsx:53-56` para no spammear Supabase mientras se tipea.

### 2.4 `useUnreadCount` solo en "Sin leer", no por categoría
Mostrar un badge por cada categoría requeriría 5 queries adicionales (o una agregación con groupBy server-side). Por ahora el contador global ya es útil y barato. Si se quiere granularidad, considerar una vista materializada en Supabase con `count(*) FILTER (WHERE notification_type = ...)`.

### 2.5 Aliases de ruta
Registré tres paths que apuntan al mismo destino:
- `/notifications` — la canónica
- `/notificaciones` — redirect (español, por consistencia con el resto del CRM que mezcla idiomas en rutas)
- `/agenda/recordatorios` — redirect (no era una ruta real, pero por si alguien guardó el link viejo o aparece en algún correo/log)

---

## 3. 🚨 LECCIÓN CRÍTICA — Supabase Realtime channels son singletons globales

### El bug
En el primer intento agregué `useRealtimeNotifications()` también en la página `/notifications`. Al navegar a la página, todo crasheaba con:

```
cannot add `postgres_changes` callbacks for realtime:notifications-updates
after `subscribe()`.
```

### La causa
`useRealtimeNotifications` está implementado así (`src/hooks/notifications/useRealtimeNotifications.ts:14`):

```ts
const channel = supabase
  .channel('notifications-updates')   // ← nombre hardcoded
  .on('postgres_changes', { ... }, handler)
  .subscribe();
```

El nombre del canal `'notifications-updates'` es **constante**. Cuando dos componentes invocan este hook, ambos llaman a `supabase.channel('notifications-updates')`, y el cliente de Supabase **devuelve la misma instancia de canal**. El primer componente hace `.on(...).subscribe()` → OK. El segundo intenta `.on(...)` sobre un canal ya suscrito → **error fatal y la página queda blanca** (el ErrorBoundary muestra el card de "Algo salió mal").

### La regla
**Para cada canal `supabase.channel(<nombre fijo>)`, debe haber UN solo punto de suscripción en la app**, normalmente un componente que vive en `Layout` (siempre montado). Las páginas hijas se enteran de los cambios vía invalidación de React Query, no via su propia subscripción.

### Cómo evitarlo en código nuevo
Si necesitas suscripción realtime en una página específica:

1. **Opción A — Compartir el canal existente**: confiar en que el hook ya está activo desde `Layout` (caso de notificaciones).
2. **Opción B — Canal único por consumer**: si el hook DEBE poder coexistir con otro suscriptor, generar el nombre dinámicamente:
   ```ts
   const channelName = useMemo(() => `notifications-${user.id}-${crypto.randomUUID()}`, [user.id]);
   const channel = supabase.channel(channelName).on(...).subscribe();
   ```
   Cuesta una conexión websocket adicional, pero elimina la colisión.
3. **Opción C — Singleton context**: crear un `RealtimeProvider` que multiplexea los callbacks de varios consumidores sobre un solo canal. Es lo más limpio si esto pasa de ser dos hooks a ser cinco.

Para este proyecto **Opción A es lo correcto** — el `Layout` siempre está montado, el bell ya invalida `['notifications']` y eso refresca cualquier página que use queries con ese prefijo (incluyendo la nueva `/notifications`).

### Auditoría pendiente
Vale revisar si hay otros hooks de realtime en el proyecto con el mismo patrón (nombre de canal hardcoded). Comando de búsqueda:

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern "supabase\.channel\(" -SimpleMatch:$false
```

Si aparece más de un sitio que use el mismo string, hay riesgo de la misma colisión.

---

## 3.5 Bug descubierto en testing — `action_url`s legacy en producción

### Síntoma
El usuario reportó (2026-05-23, ~7am) que al clicar notificaciones tipo "Visita técnica", "Cita", "Nueva tarea" → 404 (`/agenda/tareas?task_id=X` no existe). "Pago recibido" sí funcionaba.

### Causa raíz
6 funciones plpgsql en producción (`notify_booking_created`, `notify_booking_status_change`, `notify_task_assigned`, `notify_task_blocked`, `notify_task_comment`, `notify_task_completed`) insertaban notificaciones con `action_url` apuntando a paths que **nunca existieron** en el router: `/agenda/citas?task_id=X` y `/agenda/tareas?task_id=X`. Las rutas reales son `/agenda` y `/tasks`. Las funciones solo existían en producción DB — no estaban en las migraciones locales del repo.

### Fix RESUELTO en origen — 2026-05-23

Investigación vía Management API (`POST api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query` con el `SUPABASE_ACCESS_TOKEN` del `.env` local):

1. **Auditoría de patrones existentes**:
   ```sql
   SELECT split_part(action_url, '?', 1) AS path, COUNT(*)
   FROM public.notifications WHERE action_url IS NOT NULL GROUP BY 1;
   ```
   Resultado: `/finanzas/pagos` (16, OK) · `/agenda/citas` (11, ROTO) · `/agenda/tareas` (5, ROTO).

2. **Identificación de funciones culpables**:
   ```sql
   SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
   AND (prosrc ILIKE '%/agenda/tareas%' OR prosrc ILIKE '%/agenda/citas%');
   ```
   Resultado: 6 funciones (listadas arriba).

3. **Migración `013_fix_notification_action_urls.sql`** creada y aplicada a producción:
   - `CREATE OR REPLACE FUNCTION` para los 6 triggers con `'/agenda/citas?task_id=' || NEW.id` → `'/agenda?task_id=' || NEW.id` y `'/agenda/tareas?task_id=' || NEW.id` → `'/tasks?task_id=' || NEW.id`.
   - Backfill de las 16 filas existentes en `notifications`.

4. **Verificación post-fix**:
   ```sql
   -- Patrones de URL en notifications:
   -- /finanzas/pagos (16) · /agenda (11) · /tasks (5)  ✓
   -- Funciones con paths legacy:
   -- 0 resultados  ✓
   ```

### Helper de cliente — REMOVIDO

En el primer intento creé `src/lib/notifications-url.ts` como band-aid en cliente. Una vez que el fix de origen quedó aplicado y verificado, **eliminé el helper** (anti-pattern documentado en memoria global: "capas defensivas pueden estrangular operaciones válidas"). Los click handlers en `NotificationsList` y `NotificationBell` ahora vuelven a usar `notif.action_url` directo.

### Limitación restante
Las páginas `/tasks` y `/agenda` **no leen los query params** (`?task_id=X`) — solo aterrizan en el listado. La metadata `?task_id=X` se preserva en los `action_url` para cuando se implemente deep-linking en list pages (mejora aparte, en pendientes).

---

## 4. Estado actual y verificación

### Lo que YA funciona (verificado por el usuario)
- [x] Ruta `/notifications` carga la página completa
- [x] Click en "Ver todas las notificaciones" del bell navega correctamente
- [x] El error del realtime se resolvió tras quitar el hook duplicado

### Lo que falta verificar manualmente
- [ ] Cambiar entre categorías filtra correctamente
- [ ] Buscar texto en barra superior trae resultados correctos
- [ ] "Marcar todas como leídas" actualiza el contador del bell y vacía la categoría "Sin leer"
- [ ] Click en una notificación con `action_url` navega y la marca como leída
- [ ] Empty states aparecen correctamente cuando una categoría no tiene items
- [ ] Realtime: si alguien (o un trigger) inserta una notificación en DB, aparece sin recargar
- [ ] Mobile (< 768px): el sidebar colapsa a chips horizontales y todo sigue usable

### Mejoras futuras posibles
1. **Categoría "Pagos"** — ver §2.1, requiere confirmar `notification_type`.
2. **Archivado** — ver §2.2, requiere migración SQL.
3. **Per-category unread counts** — ver §2.4.
4. **Acciones por hover** en cada notificación (marcar/borrar/snooze) tipo ClickUp — actualmente la única acción inline es click-para-ir-y-marcar.
5. **Notificaciones agrupadas** ("3 pagos recibidos hoy") — útil cuando vuelen muchas. Requiere agregación.
6. **Filtros multi-select** — actualmente solo una categoría a la vez.

---

## 5. Comandos útiles (copy-paste para el dueño)

### Probar localmente
```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
npm run dev
```
Luego abrir `http://localhost:3000/notifications` o clic en la campana → "Ver todas".

### Subir cambios a GitHub
```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
git add src/pages/Notifications.tsx src/App.tsx src/components/layout/NotificationBell.tsx src/hooks/notifications/useNotifications.ts src/components/notifications/NotificationsList.tsx docs/handover/2026-05-23_NOTIFICATIONS-PAGE.md
git status
git commit -m "feat(notifications): página /notifications con sidebar de categorías + búsqueda"
git push origin master
```

### Deploy a producción
```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
npx vercel --prod
```
