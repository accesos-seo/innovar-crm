# PRD: Módulo de Producción / Taller

> **Documento autocontenido.** Otra IA debe poder implementar este módulo leyendo solo este PRD. Schema **validado contra producción el 2026-06-10** (Supabase project_ref `xdzbjptozeqcbnaqhtye`). ⚠️ `db/supabase_schema.sql` del repo está DESACTUALIZADO — la fuente de verdad es producción (Management API: `POST https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query`, token en `.env → SUPABASE_ACCESS_TOKEN`).

## Problem Statement

El CRM de Innovar gestiona bien la etapa comercial (leads, cotizaciones, agenda), pero la planta de producción es un punto ciego: no existe ninguna vista del taller. La base de datos **ya captura** datos de producción que ninguna pantalla muestra: archivos de diseño 3D (`design_3d_files`), despieces (`despiece_files`), contadores de revisiones de modelado/render, fecha de compra de materiales, inicio de fabricación, días estimados de fabricación. El rol `produccion` existe en el enum de roles pero **no tiene ninguna ruta asignada en la app**. Resultado: el dueño no sabe qué hay en el taller sin caminar hasta él, y el equipo de producción trabaja con papeles o WhatsApp.

## Solution

Un módulo `/produccion` con un tablero Kanban de proyectos por fase productiva (Diseño → Aprobación final → En producción → Listo para instalar → Entregado), donde cada tarjeta muestra el proyecto, su tipo de mueble, días en la fase y alertas de atraso. Al abrir una tarjeta se ve la **ficha de taller**: archivos de diseño y despiece, revisiones, fechas clave, checklist de tareas de producción y fotos de avance. Mover una tarjeta de columna actualiza el estado real del proyecto (con confirmación, porque dispara notificaciones WhatsApp al cliente). Incluye un widget de capacidad de planta y le da por fin al rol `produccion` su espacio en la app.

## User Stories

- Como **dueño/admin**, quiero ver de un vistazo cuántos proyectos hay en cada fase productiva y cuáles llevan demasiado tiempo, para detectar cuellos de botella.
- Como **operario de producción** (rol `produccion`), quiero entrar a la app y ver solo los proyectos en fabricación con su ficha de taller, para saber qué fabricar sin preguntar.
- Como **diseñador** (rol `diseno`), quiero subir los archivos 3D y el despiece al proyecto y marcar revisiones, para que producción trabaje con la versión correcta.
- Como **admin**, quiero mover un proyecto a "Listo para instalar" desde el tablero y que el sistema notifique al cliente, para no duplicar trabajo administrativo.
- Como **admin**, quiero ver el historial de cambios de fase (quién y cuándo), para auditar tiempos reales por etapa.
- Como **operario**, quiero imprimir/ver la ficha de taller de un proyecto, para tenerla en el banco de trabajo.

## Contexto del sistema existente (leer antes de implementar)

**Stack:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui, React Query, Zustand (auth), react-router con `lazy()`. Supabase (Postgres + RLS + Edge Functions + Storage). **DB en inglés, labels UI en español.**

**Enum `project_status` (PROD — lista real, el repo lista otra):**
`'contacto' | 'cotizacion_aprobada' | 'en_diseno' | 'aprobacion_final' | 'en_produccion' | 'listo_instalacion' | 'entregado' | 'completado'`

**Enum `user_role` (prod):** `'admin' | 'comercial' | 'diseno' | 'produccion' | 'super_admin'`. El rol se lee de `profiles.role` vía `useAuthStore((s) => s.profile)`.

**Enum `work_type` (prod):** `'cocina' | 'closet' | 'puertas' | 'centro_tv' | 'otro'`

**Tabla `projects` — columnas relevantes (prod):**
`id, client_id, name, work_type, status, designer_id, notes, total_amount, design_deadline, design_delivered_at, initial_measurements jsonb, design_3d_files jsonb, despiece_files jsonb, modelado_approved_at, renders_approved_at, modelado_revision_number int, render_revision_number int, materials_purchased_at, fabrication_started_at, estimated_fabrication_days int, estimated_install_date, scheduled_install_date, installation_scheduled_at, install_duration_days, delivered_at, delivery_date date, is_archived, skip_design_process bool, deleted_at, created_at, updated_at`

`design_3d_files` y `despiece_files` son JSONB **ya existentes pero dormidos** (se llenan desde el form de proyecto pero ninguna UI los muestra). Formato a estandarizar en este módulo: array de objetos `{ "path": "<storage path>", "name": "<filename>", "uploaded_at": "<iso>", "uploaded_by": "<uuid>" }`.

**Tareas:** tabla `tasks` con `project_id, assigned_to, title, status task_status, priority, due_date, task_category, kanban_order, estimated_hours, actual_hours`. Enums prod: `task_status = 'pendiente'|'en_progreso'|'en_revision'|'bloqueado'|'completado'|'cancelado'`; `task_category = 'cita'|'operativa'|'diseno'|'produccion'|'administrativa'|'seguimiento'`. Ya existe página `/tasks` con Kanban — **reutilizar sus componentes de tarjeta/columna si son extraíbles; si están acoplados, crear los del módulo sin refactorizar `/tasks`.**

**Notificaciones WhatsApp existentes que disparan los cambios de estado de proyecto** (vía triggers ya en prod, procesadas por la EF `process-whatsapp-notifications`): al iniciar fabricación (`fabricacion_iniciada_v1`), al programar instalación (`instalacion_programada_v1`), al entregar (`proyecto_completado_v1`). **Mover tarjetas en el Kanban dispara estos mensajes** → el módulo debe pedir confirmación explícita antes de cada movimiento. `system_settings.wa_test_phone_override` redirige todo a QA — no tocar.

**Edge Functions existentes relacionadas (no modificar, solo conocer):** `coordinador-produccion` (cron semanal, genera fichas de taller vía template WA `ficha_taller_v1`), `monitor-capacidad` (cron diario, alertas amarilla/roja por carga), `notificador-fabricacion`, `notificador-instalacion_programada`.

**Patrón de página tipo** (copiar de `src/pages/Projects.tsx`): estado local de filtros + hook React Query (`useProjects({ status })` → `{ data, isLoading, isError }`) + mutaciones (`useUpdateProject()`) + `useMemo` para métricas + render con `CategoryHeader` → `MetricsGrid` → `StatusSubnav` → contenido. Componentes compartidos: `CategoryHeader, MetricsGrid, StatusSubnav, DataTable, FilterSheet, DetailModal, PremiumLoader, EmptyState, PrimaryButton`.

**Rutas con rol** (patrón literal de `App.tsx`):
```tsx
<Route path="/settings/users" element={<Protected roles={["admin", "super_admin"]}><UsersSettingsPage /></Protected>} />
```

**Feature flags:** `src/lib/features.ts` — patrón `xxxEnabled: import.meta.env.VITE_FF_XXX === 'true'`.

**Migraciones:** `db/migrations/NNN_nombre.sql`, idempotentes + bloque `-- ROLLBACK` comentado. Última en prod: `052`. Si el PRD del Portal del Cliente (053) ya se aplicó, **este módulo usa `054_production_module.sql`**; si no, coordinar numeración.

**Design system:** inputs `h-12 rounded-none border-border/50`, botones primarios `h-14`.

**Storage buckets existentes:** `visit_photos`, `payment-receipts`, `quotation-pdfs`. (El PRD del Portal crea `project-photos`.)

## Implementation Decisions

### Módulos involucrados

1. **Página `/produccion`** — Kanban de planta (nueva).
2. **Panel "Ficha de taller"** — detalle productivo de un proyecto (sheet/modal desde la tarjeta).
3. **Migración `054_production_module.sql`** — historial de estados, bucket de archivos, settings de capacidad.
4. **Gestor de archivos de diseño/despiece** — sube a Storage y mantiene los JSONB `design_3d_files`/`despiece_files`.
5. **Acceso del rol `produccion`** — ruta, sidebar y redirect post-login.

### Migración `054_production_module.sql`

1. **Tabla `project_status_history`** (no existe nada equivalente en prod; `project_phase_log` es un log de notificaciones, NO sirve):
```sql
CREATE TABLE IF NOT EXISTS public.project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_status project_status,
  to_status project_status NOT NULL,
  changed_by uuid REFERENCES public.profiles(id),
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psh_project ON public.project_status_history(project_id, changed_at DESC);
```
   Trigger `trg_log_project_status` `AFTER UPDATE OF status ON projects` (cuando `OLD.status IS DISTINCT FROM NEW.status`) que inserta la fila con `changed_by = auth.uid()` (NULL si lo cambió un proceso de sistema). RLS: SELECT para `authenticated`; INSERT solo vía trigger (función `SECURITY DEFINER`).
2. **Bucket `project-files`** (privado, 50 MB por archivo): para 3D y despieces. MIME permitidos: `application/pdf`, `image/*`, `application/octet-stream` (los formatos de CAD — `.skp`, `.dwg`, `.dxf` — llegan como octet-stream; validar extensión en el frontend: `pdf,skp,dwg,dxf,png,jpg,jpeg,webp`). Policies de INSERT/SELECT/DELETE para `authenticated` con rol `admin|super_admin|diseno|produccion` (mismo patrón que `visit_photos`, migración `027`). Path: `<project_id>/design3d/<uuid>-<filename>` y `<project_id>/despiece/<uuid>-<filename>`.
3. **Seeds en `system_settings`:** `production_capacity_max` (default `'5'` — máx. proyectos simultáneos en `en_produccion` antes de alerta) y `production_stale_days` (default `'7'` — días sin cambio de fase para marcar tarjeta como estancada).
4. **Backfill best-effort del historial:** insertar en `project_status_history` una fila sintética por cada proyecto existente con su status actual (`from_status NULL, note 'backfill 054'`), para que "días en fase" tenga base desde el día 1.
5. **ROLLBACK** comentado al pie.

### Página `/produccion` — Kanban

- Ruta: `<Route path="/produccion" element={<Protected roles={["admin","super_admin","produccion","diseno"]}><ProduccionPage /></Protected>} />` (lazy). Agregar ítem "Producción" al sidebar para esos roles, con ícono `Factory` o `Hammer` de lucide-react.
- **Columnas fijas (5)** mapeadas a `project_status`: `en_diseno` ("Diseño"), `aprobacion_final` ("Aprobación final"), `en_produccion` ("En producción"), `listo_instalacion` ("Listo para instalar"), `entregado` ("Entregado", colapsada por defecto mostrando solo los últimos 30 días). Proyectos en `contacto`/`cotizacion_aprobada`/`completado` NO aparecen.
- Query: `projects` con `status IN (las 5 fases)`, `is_archived = false`, `deleted_at IS NULL`, join `clients(name)`. Hook nuevo `useProductionBoard()` (React Query, key `['production-board']`, `staleTime` 30s).
- **Tarjeta:** nombre del proyecto, cliente, badge `work_type` (label español: cocina → "Cocina", centro_tv → "Centro TV", etc.), días en la fase actual (calculado desde la última fila de `project_status_history`; badge rojo si supera `production_stale_days`), avatar del diseñador asignado, mini-indicador de tareas de producción (`completadas/total` de `tasks` con `task_category='produccion'` y ese `project_id`).
- **Drag & drop** con `@dnd-kit/core` (verificar primero si ya está en `package.json` — `/tasks` tiene Kanban; si usa otra lib, usar esa misma). Reglas de movimiento:
  - `diseno` puede mover: `en_diseno → aprobacion_final`.
  - `produccion` puede mover: `en_produccion → listo_instalacion`.
  - `admin`/`super_admin`: cualquier movimiento adelante o atrás.
  - Todo movimiento abre un **diálogo de confirmación** que advierte explícitamente si el cambio dispara WhatsApp al cliente (lo disparan: entrar a `en_produccion`, `listo_instalacion` con instalación agendada, `entregado`). Texto del diálogo: "Esto actualizará el proyecto a «{fase}» y enviará una notificación de WhatsApp al cliente. ¿Continuar?" — con campo `note` opcional que se guarda en `project_status_history.note`.
  - El movimiento ejecuta `useUpdateProject().mutateAsync(id, { status })`; el trigger de la migración registra el historial. Optimistic update + rollback en error.
- **Header del módulo:** `CategoryHeader` ("Producción", subtítulo "Tablero de planta") + `MetricsGrid` con 4 métricas: proyectos en producción, capacidad usada (`n / production_capacity_max`, en ámbar si ≥80%, rojo si ≥100% — mismos umbrales que la EF `monitor-capacidad`), proyectos estancados (> `production_stale_days` días en fase), instalaciones próximas 7 días (`scheduled_install_date` en la semana).
- Filtros: por `work_type` y por diseñador (`FilterSheet`).

### Ficha de taller (panel de detalle)

Click en tarjeta → `Sheet` lateral ancho (o `DetailModal`, según cuál use `/tasks`) con pestañas:

1. **Resumen:** cliente, tipo de mueble, montos NO visibles para rol `produccion` (ocultar `total_amount` si `profile.role === 'produccion'`), fechas clave (inicio fabricación, días estimados `estimated_fabrication_days`, instalación programada), revisiones (`modelado_revision_number`, `render_revision_number` con sus `*_approved_at`), notas del proyecto.
2. **Archivos:** dos secciones — "Diseño 3D" (`design_3d_files`) y "Despiece" (`despiece_files`). Cada una lista los archivos del JSONB con nombre, fecha, botón descargar (signed URL 1h del bucket `project-files`) y botón eliminar (roles `admin|super_admin|diseno`). Botón "Subir archivo" (roles `admin|super_admin|diseno`): sube a Storage y hace UPDATE del JSONB (append del objeto `{path, name, uploaded_at, uploaded_by}`). Mutación con invalidación de `['production-board']`.
3. **Checklist:** tareas del proyecto con `task_category='produccion'`, render como checklist simple (toggle `pendiente ↔ completado` vía la mutación de tasks existente), botón "Agregar tarea" inline (crea task con `task_category='produccion'`, `project_id`, `assigned_to` opcional). No duplicar el Kanban de `/tasks` aquí.
4. **Historial:** filas de `project_status_history` del proyecto (fase → fase, quién, cuándo, nota), orden descendente.
5. **Botón "Imprimir ficha":** vista imprimible (CSS `@media print` en una ruta `/produccion/ficha/:id` o ventana nueva con `window.print()`) con: logo, proyecto, cliente, tipo, medidas iniciales (`initial_measurements` JSONB renderizado como tabla clave/valor si existe), lista de despieces, checklist de producción, fechas. Sin montos.

### Permisos y redirect del rol `produccion`

- En el login/redirect post-auth: si `profile.role === 'produccion'`, redirigir a `/produccion` en lugar de `/` (localizar el redirect actual en el flujo de auth — probablemente en `Login.tsx` o `AuthCallback.tsx` — y agregar el caso).
- Sidebar para `produccion`: mostrar solo "Producción", "Tareas" y "Mi perfil".
- RLS: `projects` ya es legible por `authenticated` (verificar política existente antes de asumir; si la política actual restringe por rol, ampliarla para `produccion` con SELECT y UPDATE solo de la columna `status` — si granularidad por columna no es viable con la política actual, permitir UPDATE y confiar en la UI + trigger de historial para auditoría).
- Feature flag: `VITE_FF_PRODUCTION_MODULE` (`FEATURES.productionModuleEnabled`) — si OFF, ocultar sidebar item y ruta.

## Testing Decisions

- **Migración:** aplicar en prod vía Management API (es idempotente); verificar: tabla `project_status_history` existe, trigger registra un UPDATE de status de un proyecto de prueba, backfill insertó ~12 filas (hay 12 proyectos en prod).
- **Kanban:** mover tarjeta adelante (con confirmación) → status cambia en DB + fila en historial + tarjeta cambia de columna. Cancelar el diálogo → nada cambia. Mover hacia atrás con rol no-admin → bloqueado.
- **Notificaciones:** con `wa_test_phone_override` activo en `system_settings` (redirige todo al número de QA del equipo — **nunca probar contra clientes reales**), mover un proyecto a `en_produccion` y verificar la fila correspondiente en `notification_queue`.
- **Archivos:** subir un PDF y un `.skp` → aparecen en el JSONB y en el bucket; descargar vía signed URL funciona; URL sin firma da 403; eliminar limpia JSONB y Storage.
- **Roles:** entrar con usuario `produccion` de prueba → redirect a `/produccion`, no ve montos en la ficha, no puede subir archivos de diseño, sí puede marcar checklist y mover `en_produccion → listo_instalacion`.
- **Build:** `npx tsc --noEmit` y `npm run build` limpios en `D:\Agents-automations\04-Innovar` (ruta canónica). Smoke con `vite preview`.

## Out of Scope

- Planificación de capacidad avanzada (Gantt, scheduling automático de planta).
- Control de inventario/consumo de materiales por proyecto (módulo Inventario separado, Tier 2).
- Tiempos por operario / nómina de taller.
- Edición de los archivos 3D (solo almacenar/descargar).
- Modificar las Edge Functions `coordinador-produccion` / `monitor-capacidad` (siguen operando igual; el widget de capacidad solo replica su lectura).
- App móvil nativa para el taller (la web responsive basta en V1).

## Further Notes

- **Riesgo principal:** los triggers de WhatsApp ya existentes sobre `projects.status` convierten cada drag & drop en un mensaje potencial al cliente. El diálogo de confirmación es obligatorio, no opcional. Validar en QA qué transiciones exactas disparan mensajes consultando los triggers reales en prod: `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.projects'::regclass AND NOT tgisinternal;`
- **Verificar antes de codificar:** (1) la lib de drag & drop que ya usa el Kanban de `/tasks`; (2) las políticas RLS actuales de `projects` y `tasks`; (3) si `useUpdateProject` invalida queries de forma compatible con el board.
- `estimated_hours`/`actual_hours` de `tasks` quedan capturados por el checklist — un futuro reporte de productividad (Tier 2) los explotará; no construirlo ahora.
- El número de migración (`054`) asume que `053_client_portal.sql` (PRD Portal del Cliente) va primero. Los tres PRDs de este lote son independientes entre sí en código; solo coordinan numeración de migraciones: portal=053, producción=054, postventa=055.
- Commits en español (`feat(produccion): ...`), `git add` por archivo (nunca `git add .`), push solo con autorización del usuario.
