# AGENTS.md — Mapa del repositorio para agentes de IA

> Punto de entrada para cualquier agente que trabaje en este repo (Claude Code, Codex, Cursor,
> Antigravity…). `AGENTS.md` es el estándar abierto que leen todas esas herramientas; `CLAUDE.md`
> lo lee solo Claude. **Ambos coexisten** (ver §0). NO es una biblia: es un mapa con divulgación
> progresiva. Si encuentras algo obsoleto, **párate y avisa** — no improvises.

---

## 0. Relación con CLAUDE.md, memoria y convenciones

| Fuente | Alcance | Para qué |
|---|---|---|
| `AGENTS.md` (este archivo) | **Este repo** — mapa + gotchas técnicos | Entrada de cualquier agente/herramienta |
| `CLAUDE.md` (raíz) | Este repo — comandos copy-paste de git/deploy, autonomía, SQL de Storage | Lo carga Claude solo; **no lo pises** |
| `ONBOARDING.md` (raíz) | Este repo — onboarding narrativo extenso | Contexto de producto si lo necesitás |
| `~/.claude/CLAUDE.md` | Toda la agencia | Identidad, autonomía, seguridad WhatsApp |
| `~/.claude/projects/.../memory/project_innovar.md` | Estado vivo entre sesiones | Fases, bugs, decisiones, IDs |

**Regla:** AGENTS.md guarda los *gotchas técnicos del repo*; CLAUDE.md guarda los *comandos copy-paste y la operativa*. No dupliques. Si se contradicen, gana el código real → avisás para sincronizar.

> ⚠️ El dueño (Robert) **no es técnico**. Todo comando que termine en sus manos va **copy-paste**, en PowerShell (`;` para encadenar, nunca `&&`).

---

## 1. Antes de empezar (cada sesión)

1. Lee este `AGENTS.md` y `CLAUDE.md`.
2. Lee `~/.claude/projects/C--Users-ceoel/memory/project_innovar.md` para el estado vivo (fase, bugs, bloqueadores).
3. **Antes de tocar cualquier schema Zod o SQL** → §6.1 (el schema local miente; verificá contra prod).
4. **Antes de tocar auth/sesión** → §7.1 (deadlock del callback, saga de cuelgues ya resuelta).
5. Antes de declarar "hecho" → `CHECKPOINTS.md`.

---

## 2. Qué es este proyecto

CRM para una empresa de **cocinas y muebles a medida**: clientes, cotizaciones con cotizador
paramétrico (cocinas, closets, puertas, mesones, TV center, acabados, herrajes), aprobación,
pago, conversión a proyecto, agenda y finanzas.

Stack real: **React 19 + TypeScript + Vite 6** (SPA), **shadcn/ui + Tailwind 4**, **Supabase**
(Postgres 17 + Auth + Storage + Edge Functions), **Express local** (`server.ts` vía `tsx`) para
el motor de precios, desplegado en **Vercel**. Estado global con **Zustand**; datos con hooks.

---

## 3. Mapa del repositorio

| Ruta | Qué contiene | Cuándo leerlo |
|---|---|---|
| `src/pages/*.tsx` | Páginas por ruta (Dashboard, Cotizaciones, Proyectos, Notifications…) | Al tocar una vista |
| `src/features/<modulo>/` | Cotizador paramétrico por módulo (kitchen, closets, doors, mesones, tv_center, special_finishes, hardware, common) | Al tocar el cotizador |
| `src/components/` | Componentes reutilizables + templates PDF (`components/pdf/templates/`) | UI y PDFs |
| `src/hooks/use*.ts` | Hooks de datos (Supabase) | Toda lectura/mutación de datos |
| `src/schemas/*.ts` | Schemas Zod — **ver §6.1, mienten vs prod** | Validación; verificar antes |
| `src/store/authStore.ts` | Estado de auth (Zustand) — **zona minada, ver §7.1** | Solo con extremo cuidado |
| `src/lib/supabaseClient.ts` | Cliente Supabase (rebuild limpio, sin capas de timeout) | Acceso a datos |
| `src/lib/errors.ts` | `mapSupabaseError` | Manejo de errores |
| `server.ts` + `server/services/*.engine.ts` | Motor de precios Express (un engine por módulo) | Al tocar cálculo de precios |
| `server/controllers/quotation.controller.ts` | Switch de categorías de cotización | Al agregar un módulo al cotizador |
| `db/migrations/0XX_*.sql` (70 archivos, hasta 041) | Migraciones numeradas + varios `ROLLBACK_*.sql` | Al cambiar schema |
| `supabase/functions/` | `admin-invite-user`, `process-whatsapp-notifications` | Al tocar invitaciones o WhatsApp |
| `docs/handover/`, `docs/prd/`, `docs/architecture/` | Handoffs, PRDs y refactor-maps por fase | Contexto histórico |
| `HandOver/` (raíz) | Handovers de auditorías y sesiones | Contexto histórico |

---

## 4. Comandos canónicos

```powershell
npm run dev         # tsx server.ts — Express + Vite. OJO: ver nota OneDrive abajo
npm run build       # vite build → dist/   (verificación real)
npm run preview     # sirve dist/ — PREFERIR esto a `dev` sobre OneDrive
npm run typecheck   # tsc --noEmit — baseline ~32 errores pre-existentes, no sumar nuevos
npm run test        # vitest run
```

> ⚠️ **OneDrive:** NO corras `npm run dev` (watcher vivo) ni `git push`/`vercel --prod` en
> background sobre este path — se cuelgan. Esos tres van **al usuario como comando copy-paste**
> (ver CLAUDE.md). Todo lo demás (SQL, Management API, lecturas, logs) lo ejecuta el agente.

---

## 5. Arquitectura que NO se ve en el árbol

### 5.1 Cotizador de 3 capas (patrón canónico)
```
src/features/<modulo>/logic.ts        → motor puro (tipos, constantes, cálculo) — @deprecated en prod
src/hooks/use-<modulo>-calculator.ts  → hook React (useMemo sobre el motor)
src/features/<modulo>/<Modulo>Module.tsx → UI (Card + footer con total)
```
Hub central: `src/components/quotations/steps/QuotationDesignStep.tsx`. Cada módulo notifica vía
`onDataChange(total, config)`; el `config` se guarda en `item.configuration` y alimenta el PDF.

### 5.2 Motor de precios server-side (Express)
Todo cálculo pasa por `POST /api/quotations/calculate-item` (Express en `server/`). Precios en la
tabla `pricing_catalog`. **Cada engine tiene FALLBACK hardcoded** como red de seguridad: si la
query a `pricing_catalog` falla, el engine usa el fallback en vez de colapsar. Para migrar un
módulo client-side: replicar el patrón de TV Center (ver `project_innovar.md` → "Arquitectura de pricing").

> **Gotcha de categorías:** `puerta` (singular) = puertas interiores (`features/doors/`);
> `puertas` (plural) = repuestos/tapas de cocina. NO mezclar. Acabados es `'especiales'`,
> NO `'acabados_especiales'`. Usar el string ya cableado en `useQuotationBuilder.ts`.

### 5.3 Acceso a Supabase
- **Frontend:** cliente único en `src/lib/supabaseClient.ts` (anon key, RLS aplica). Datos vía hooks.
- **SQL / migraciones / schema:** **Management API** con `SUPABASE_ACCESS_TOKEN` del `.env`
  (`POST .../v1/projects/xdzbjptozeqcbnaqhtye/database/query`). El agente las ejecuta directo.
  Patrón en `~/.claude/.../memory/reference_innovar_management_api.md`.
- **El MCP Supabase del entorno apunta a Light_House/Swarm, NO a Innovar.** No usarlo para queries de Innovar (aunque a veces conecte, puede revocar mid-sesión).

### 5.4 Notificaciones
Tabla `notifications`. 7 triggers plpgsql en prod (solo `notify_project_created` está en migraciones
locales; los otros 6 se snapshottearon en `013_fix_notification_action_urls.sql`). Modificás una →
`CREATE OR REPLACE FUNCTION` vía Management API + migración nueva.

---

## 6. Reglas de dominio que muerden

### 6.1 ⚠️ El schema local `db/supabase_schema.sql` está DESACTUALIZADO
Producción tiene columnas que el archivo local no declara, y NO tiene otras que sí declara
(ej. `data_origin` es columna fantasma: está en Zod pero NO en prod → error PG `42703`).
**Siempre verificá contra `information_schema.columns` vía Management API antes de tocar un schema Zod.**
Patrón de bug repetido (`data_origin`, `materials.stock`/`brand`): el fix es `.passthrough()` +
remover el `.default()`. Ver `bug_innovar_data_origin_phantom_column.md`.

### 6.2 Migraciones contra producción
Idempotentes (`IF EXISTS`/`ON CONFLICT DO UPDATE`). El agente las aplica vía Management API cuando
Robert aprueba el contenido. **No uses el alias `check`** en queries vía Management API si lo notás
romper pg-meta. Hay `ROLLBACK_*.sql` por fase — mantenelos.

### 6.3 WhatsApp
Proactivo = **template aprobada** (texto libre no llega fuera de ventana 24h; HTTP 200 ≠ entrega).
`slice_3_enabled = FALSE` es **intencional** — no lo actives sin templates Meta aprobados + OK de Robert.
Pruebas: solo a números autorizados (Robert `573183061286`, Heduin `+584127862439`), nunca a clientes.

### 6.4 GRANTs amplios en anon
El rol `anon` tiene hoy DELETE/UPDATE/TRUNCATE sobre las tablas (RLS protege, pero no es ideal).
Si tocás seguridad de datos, tenelo presente; no asumas que anon es solo-lectura.

---

## 7. Cosas que parecen bugs pero NO lo son

**No las "arregles".**

### 7.1 La saga del cuelgue de módulos — YA resuelta, no la reabras
- **Causa raíz:** llamar `supabase.from('profiles')` dentro del callback `onAuthStateChange`
  (`authStore.ts`) → deadlock interno del SDK. Fix: `ensureProfile()` solo en `initializeAuth()`,
  nunca dentro del callback. Anti-patrón en `feedback_supabase_no_sdk_in_onauth_callback.md`.
- **NO re-agregues capas de timeout** (`fetchWithTimeout` + `withTimeout` + React Query retry).
  Esas 3 capas en cascada estrangulaban queries legítimas lentas (cold start) y disparaban signOut.
  Se eliminaron en el clean rebuild. Si un módulo "cuelga", primero pedí reproducir en **incógnito**
  (descarta JWT stale) antes de teorizar RLS.

### 7.2 ~32 errores TS de baseline en `tsc --noEmit`
Pre-existentes. No sumes nuevos; no los "arregles" a ciegas con `!`.

### 7.3 Server Express "supabaseUrl is required" (si reaparece)
El controller usa fallbacks hardcoded; las cotizaciones funcionan igual. No urgente.

### 7.4 Supabase Realtime channels son singletons globales
`useRealtimeNotifications()` usa un canal hardcoded; solo se invoca desde `Layout`. No lo llames
desde una segunda página (revienta con "cannot add postgres_changes callbacks after subscribe()").

### 7.5 Mesones sin template / sin initialData
`MesonesTemplate.tsx` está pendiente y `MesonesModule` no restaura config guardada. Conocido.

---

## 8. Deploy y git (qué hace el agente, qué se delega)

- **SQL / migraciones / Vault / Edge Functions deploy** → el agente, vía Management API + PAT del `.env`.
- **`git add` + `git commit`** → **los hace el agente en foreground**, sin preguntar. Nunca `git add .` — archivos explícitos. **Solo `git push`** se delega al usuario (race conditions OneDrive afectan push/background, no commits).
- **`vercel --prod`** → al usuario, copy-paste. ⚠️ Vercel está conectado a `Rvirona/CRM-INNOVAR-APP:main`, NO a `accesos-seo/innovar-crm:master` → los push NO disparan deploy. Deploy manual cada vez.
- **Nunca subir** `.env`, `.claude/`, `.vercel/`, `*.log` (aunque lo pidan).

---

## 9. Sistema multiagente — cuándo orquestar

- Tarea simple (un archivo, lógica acotada) → directo.
- Tarea compleja (toca cotizador + schema + RLS, o ambigua) → líder (descompone, no codea) →
  implementador (un sub-paso, respeta §6/§7) → revisor (typecheck/build, valida CHECKPOINTS, aprueba/rechaza).
- En este ecosistema ese loop ya lo dan `/grill-me`, `/code-review`, `/qa-autofix` + Workflow.
- La **auditoría paralela** (varios Explore en paralelo) ya pescó 4 bugs latentes el 2026-05-20 — es una herramienta válida para este repo.

---

## 10. Antes de declarar "hecho"

- [ ] Checkpoints aplicables de `CHECKPOINTS.md` en verde.
- [ ] `npm run typecheck` sin errores nuevos sobre el baseline (~32).
- [ ] `npm run build` verde.
- [ ] Si tocaste schema Zod/SQL → verificado contra prod vía Management API (§6.1).
- [ ] Si tocaste UI → verificado en `npm run preview` o anotado como pendiente visual.
- [ ] Memoria del proyecto actualizada si fue trabajo significativo.

---

## 11. Cuándo parar y preguntar

- Migración no idempotente o que requiere intervención manual.
- Acción destructiva no autorizada (DROP, DELETE masivo, force push).
- WhatsApp hacia cualquiera que no sea número de prueba, o activar `slice_3_enabled`.
- Tentación de tocar `authStore.ts` / capas de timeout (§7.1) — confirmá antes.
- Conflicto entre `AGENTS.md` y el código real → avisar, no improvisar.
