# CRM Innovar — Guía para Claude

> Este archivo es leído automáticamente por Claude al abrir esta carpeta.
> Contiene todo lo necesario para trabajar en el proyecto sin preguntas.

---

## Identidad del proyecto

- **Nombre:** CRM Innovar App
- **Propósito:** CRM para empresa de cocinas y muebles (cotizaciones, clientes, proyectos, agenda, finanzas)
- **Dueño:** No es técnico — todas las instrucciones deben ser de copiar y pegar
- **Carpeta real del proyecto:** `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
- **Alias en OneDrive (mismo contenido, sincronizado):** `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main`

> **IMPORTANTE:** Usar siempre la ruta del **Escritorio** para comandos de git y deploy. Las **tareas PowerShell en background largo** se cuelgan en rutas de OneDrive — para esos casos puntuales (git push, vercel --prod, npm run dev) dar el comando al usuario. **Para todo lo demás (Supabase queries, Management API, lecturas, regenerar logs, escribir archivos) el agente ejecuta directamente.**

---

## Autonomía operativa (Innovar)

Hereda el "Modo de autonomía por defecto" del `CLAUDE.md` global (`C:\Users\ceoel\.claude\CLAUDE.md`). Casos específicos de este proyecto:

### El agente HACE SOLO (no delegar)
- **SQL en Supabase Innovar** (`xdzbjptozeqcbnaqhtye`) → Management API con `SUPABASE_ACCESS_TOKEN` del `.env`. Patrón canonizado en `reference_innovar_management_api.md`.
- **Migraciones SQL** aplicadas contra producción cuando el usuario aprueba el contenido (no requiere pedir "corré esto vos").
- **Cron jobs, Vault secrets, Edge Functions deploy** con `supabase functions deploy` y el PAT del `.env`.
- **Verificación post-migración**: smoke-tests SQL sobre `pg_proc`, `pg_trigger`, `pg_policies`, `information_schema`.

### El agente DELEGA al usuario
- `git add` / `git commit` / `git push` (OneDrive race conditions)
- `vercel --prod` (deploy a producción)
- `npm run dev` (usar `vite preview` sobre build en su lugar)
- Secretos de proveedores externos NO presentes en `.env` (Meta Business Manager, n8n, etc.)

Feedback explícito del usuario 2026-05-23: la conducta de "pedile al usuario que corra el SQL en el dashboard" estaba mal calibrada y debe evitarse. Si tengo el PAT, lo uso.

---

## GitHub

| Campo | Valor |
|---|---|
| Repositorio de trabajo | https://github.com/accesos-seo/innovar-crm |
| Rama | `master` |
| Cuenta GitHub | `accesos-seo` |
| Autenticación | GitHub CLI (`gh`) ya instalado y autenticado |

### Hacer push (copiar y pegar)

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; git add ARCHIVO1 ARCHIVO2; git commit -m "DESCRIPCION"; git push origin master
```

> Siempre especificar los archivos individualmente en `git add` — nunca usar `git add .` para evitar subir archivos sensibles.

### Verificar estado antes de subir

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; git status
```

---

## Vercel — Deploy

| Campo | Valor |
|---|---|
| Proyecto activo | `crm-innovar-app-2026` |
| URL de producción | https://crm-innovar-app-2026.vercel.app |
| Project ID | `prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi` |
| Team ID | `team_K7m1K8aMiKR36myzPROYViA8` |
| Token | En `.env` del proyecto como `VERCEL_TOKEN` |
| Repo conectado en Vercel | `Rvirona/CRM-INNOVAR-APP` (rama `main`) ⚠️ |

> **ADVERTENCIA CRÍTICA — Repo desconectado:** Vercel está conectado a `Rvirona/CRM-INNOVAR-APP:main`, pero el trabajo real va a `accesos-seo/innovar-crm:master`. Los push automáticos NO disparan deploys en Vercel. Hay que hacer deploy manual cada vez.

### Hacer deploy manual a Vercel (copiar y pegar)

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; npx vercel --prod --token TU_VERCEL_TOKEN_AQUI --yes
```

### Disparar redeploy vía API (cuando Claude lo hace)

```bash
curl -X POST "https://api.vercel.com/v13/deployments?teamId=team_K7m1K8aMiKR36myzPROYViA8&forceNew=1" \
  -H "Authorization: Bearer VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"crm-innovar-app-2026","project":"prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi","gitSource":{"type":"github","repoId":"1210035787","ref":"main"}}'
```

### Variables de entorno en Vercel (ya configuradas)

| Variable | ID en Vercel | Valor |
|---|---|---|
| `VITE_SUPABASE_URL` | `VOe0hiQcqJEWVtDb` | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `Ef4LwttryZf6qBnR` | clave anon del `.env` local |

---

## Supabase

| Campo | Valor |
|---|---|
| Project ID | `xdzbjptozeqcbnaqhtye` |
| URL | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| Claves | En `.env` del proyecto |

> **ADVERTENCIA:** El Supabase MCP conectado en este entorno Claude es `Light_House` y `Swarm Agentes MD` — NO el proyecto Innovar. No usar el MCP para queries de Innovar.

### Bucket de avatares (Storage)

Si el avatar no se sube, ejecutar en SQL Editor de Supabase:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Avatar upload authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatar update authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');
```

---

## Stack técnico

- **Frontend:** React 19 + TypeScript + Vite 6
- **UI:** shadcn/ui + Tailwind CSS 4
- **Base de datos:** Supabase (PostgreSQL + Storage)
- **Servidor local:** Node.js + Express (`server.ts`)
- **Deploy:** Vercel (proyecto `crm-innovar-app-2026`)

## Estructura de carpetas

```
src/
  pages/        → Páginas (Dashboard, Proyectos, Cotizaciones, Profile...)
  components/   → Componentes reutilizables y templates PDF
  hooks/        → Hooks de datos (conexión a Supabase)
  features/     → Módulos del cotizador paramétrico
    kitchen/      → Cocinas (server-side via Edge Function)
    closets/      → Closets (client-side)
    doors/        → Puertas (client-side, reescrito)
    mesones/      → Mesones (client-side, nuevo)
    tv_center/    → Centro TV (client-side)
    special_finishes/ → Acabados especiales (client-side)
    hardware/     → Herrajes (client-side)
  store/        → Estado global (Zustand)
server/
  services/     → Motor de precios server-side
db/
  migrations/   → Migraciones de base de datos
```

---

## Arquitectura del cotizador — Patrón 3 capas

Cada módulo sigue:

```
src/features/[modulo]/logic.ts              → Motor puro (tipos, constantes, cálculo)
src/hooks/use-[modulo]-calculator.ts        → Hook React (useMemo sobre el motor)
src/features/[modulo]/[Modulo]Module.tsx    → UI (Card + footer con total)
```

El hub central es `src/components/quotations/steps/QuotationDesignStep.tsx`.
Todos los módulos notifican cambios vía `onDataChange(total, config)`.
El `config` se guarda en `item.configuration` en Supabase y alimenta los templates PDF.

### Templates PDF existentes

| Módulo | Template |
|---|---|
| Cocinas | `src/components/pdf/templates/KitchenTemplate.tsx` |
| Closets | `src/components/pdf/templates/ClosetTemplate.tsx` |
| Puertas | `src/components/pdf/templates/DoorsTemplate.tsx` |
| TV Center | `src/components/pdf/templates/TVCenterTemplate.tsx` |
| Herrajes | `src/components/pdf/templates/HardwareTemplate.tsx` |
| Acabados | `src/components/pdf/templates/SpecialFinishesTemplate.tsx` |
| Mesones | ⚠️ **Pendiente crear** |

---

## Pendientes conocidos

- [ ] `MesonesTemplate.tsx` — crear template PDF para mesones
- [ ] `MesonesModule` sin `initialData` — no restaura config guardada al reabrir cotización
- [ ] Conectar Vercel al repo correcto `accesos-seo/innovar-crm:master` para deploys automáticos
- [ ] Verificar políticas del bucket `avatars` en Supabase Storage (ver SQL arriba)

---

## Archivos que NUNCA deben subirse

| Archivo / Carpeta | Por qué |
|---|---|
| `.env` | Contiene claves privadas de Supabase y tokens |
| `.claude/` | Contiene tokens y permisos locales |
| `.vercel/` | Contiene IDs del proyecto Vercel |
| `node_modules/` | Dependencias (se instalan con `npm install`) |
| `*.log` | Logs de errores locales |

---

## Reglas de trabajo

1. El dueño NO es técnico — siempre dar comandos de copiar y pegar
2. Usar `;` para encadenar comandos en PowerShell (nunca `&&`)
3. No usar tareas PowerShell en background en rutas OneDrive — se cuelgan
4. Antes de cualquier push, confirmar con `git status` que no hay archivos sensibles
5. Nunca subir `.env` aunque el usuario lo pida explícitamente
6. El Supabase MCP del entorno NO corresponde al proyecto Innovar — no usarlo
7. Para deploys a Vercel: usar el comando `npx vercel --prod` o la API (ver sección Vercel)
8. Si hay error de autenticación GitHub: `gh auth status`

---

## Notificaciones — arquitectura actual (2026-05-23)

- **Tabla DB:** `notifications` (columnas: id, user_id, title, body, is_read, notification_type, priority, action_url, related_table, related_id, created_at)
- **Tipos conocidos de `notification_type`:** `booking_new`, `booking_reminder`, `booking_completed`, `booking_cancelled`, `project_status`, `system`. Las notificaciones de pagos actualmente caen bajo `system` (a confirmar con las edge functions/triggers que insertan).
- **Página completa:** `/notifications` ([src/pages/Notifications.tsx](src/pages/Notifications.tsx)) — sidebar de categorías + búsqueda server-side + "Marcar todas como leídas".
- **Bell (topbar):** [src/components/layout/NotificationBell.tsx](src/components/layout/NotificationBell.tsx) — popover con últimas 15.
- **Componente compartido de lista:** [src/components/notifications/NotificationsList.tsx](src/components/notifications/NotificationsList.tsx) — agrupa por fecha (Hoy/Ayer/Esta semana/Anteriores), infinite scroll, acepta `filterType` y `searchQuery`.
- **Triggers de notificaciones (Supabase producción):** 7 funciones plpgsql. La que está en migraciones locales: `notify_project_created` ([009_lead_to_project_functions.sql:490](db/migrations/009_lead_to_project_functions.sql)). Las 6 restantes (`notify_booking_created`, `notify_booking_status_change`, `notify_task_assigned`, `notify_task_blocked`, `notify_task_comment`, `notify_task_completed`) están en producción y se snapshottearon en [013_fix_notification_action_urls.sql](db/migrations/013_fix_notification_action_urls.sql) al arreglar el bug de `action_url` legacy. Si modificas alguna, hacelo con `CREATE OR REPLACE FUNCTION` vía Management API y agregá una migración nueva.

### Pendientes específicos de notificaciones

- [ ] **Deep-linking en `/tasks` y `/agenda`** — los `action_url` de tareas y citas ya traen `?task_id=X` pero esas páginas no leen el query param. Implementarlo abriría el item específico en vez de solo aterrizar en el listado.

### ⚠️ Anti-patrón: Supabase Realtime channels son singletons globales

`useRealtimeNotifications()` usa `supabase.channel('notifications-updates')` con nombre **hardcoded**. Solo se puede invocar desde UN componente a la vez (actualmente: `NotificationBell` dentro de `Layout`). Llamarlo desde una segunda página revienta con:

> `cannot add postgres_changes callbacks for realtime:notifications-updates after subscribe()`

Si necesitas realtime en una página nueva: confía en que el hook ya está activo desde `Layout` y el bell invalida `['notifications']` automáticamente. Detalles en [docs/handover/2026-05-23_NOTIFICATIONS-PAGE.md §3](docs/handover/2026-05-23_NOTIFICATIONS-PAGE.md).
