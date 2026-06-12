# AGENTS.md — Mapa del repositorio para agentes de IA

> Punto de entrada para cualquier agente (Claude Code, Codex, Cursor, Antigravity…).
> `AGENTS.md` es el estándar abierto; `CLAUDE.md` lo lee solo Claude. **Ambos coexisten** (§0).
> NO es una biblia: es un mapa con divulgación progresiva. Si encontrás algo obsoleto, **párate y avisá** — no improvises.

## 0. Relación con CLAUDE.md, memoria y convenciones

| Fuente | Alcance | Para qué |
|---|---|---|
| `AGENTS.md` (este archivo) | Este repo — mapa + gotchas técnicos | Entrada de cualquier agente |
| `CLAUDE.md` (raíz) | Este repo — operativa: git/deploy en vivo, autonomía, punteros | Lo carga Claude; **no lo pises** |
| `~/.claude/CLAUDE.md` | Toda la agencia | Identidad, autonomía, seguridad WhatsApp |
| memoria `project_innovar.md` | Estado vivo entre sesiones | Fases, bugs, decisiones, IDs |
| `docs/ops/*.md` | Este repo — detalle operativo (Vercel, notificaciones, storage) | Cuando toques esa área |

**Regla:** AGENTS.md = *gotchas técnicos*; CLAUDE.md = *operativa y comandos*. No dupliques. Si se contradicen, gana el código real → avisás para sincronizar.

> ⚠️ El dueño (Robert) **no es técnico**. Todo comando que termine en sus manos va **copy-paste**, PowerShell (`;`, nunca `&&`).

## 1. Antes de empezar (cada sesión)

1. Lee este `AGENTS.md` y `CLAUDE.md`.
2. Lee la memoria `project_innovar.md` (estado vivo: fase, bugs, bloqueadores).
3. **Antes de tocar schema Zod o SQL** → §6.1 (el schema local miente; verificá contra prod).
4. **Antes de tocar auth/sesión** → §7.1 (deadlock del callback, saga ya resuelta).
5. Antes de declarar "hecho" → §10 + `CHECKPOINTS.md`.

## 2. Qué es este proyecto

CRM para una empresa de **cocinas y muebles a medida**: clientes, cotizaciones con cotizador
paramétrico (cocinas, closets, puertas, mesones, TV center, acabados, herrajes), aprobación,
pago, conversión a proyecto, agenda y finanzas.

Stack real: **React 19 + TypeScript + Vite 6** (SPA), **shadcn/ui + Tailwind 4**, **Supabase**
(Postgres 17 + Auth + Storage + Edge Functions), **Express local** (`server.ts` vía `tsx`) para
el motor de precios, desplegado en **Vercel**. Estado global con **Zustand**; datos con hooks.

## 3. Mapa del repositorio

| Ruta | Qué contiene | Cuándo leerlo |
|---|---|---|
| `src/pages/*.tsx` | Páginas por ruta (Dashboard, Cotizaciones, Proyectos…) | Al tocar una vista |
| `src/features/<modulo>/` | Cotizador paramétrico por módulo | Al tocar el cotizador |
| `src/components/` | Componentes reutilizables + templates PDF (`components/pdf/templates/`) | UI y PDFs |
| `src/hooks/use*.ts` | Hooks de datos (Supabase) | Toda lectura/mutación de datos |
| `src/schemas/*.ts` | Schemas Zod — **§6.1, mienten vs prod** | Validación; verificar antes |
| `src/store/authStore.ts` | Estado de auth (Zustand) — **zona minada, §7.1** | Solo con extremo cuidado |
| `src/lib/supabaseClient.ts` | Cliente Supabase (rebuild limpio, sin capas de timeout) | Acceso a datos |
| `server.ts` + `server/services/*.engine.ts` | Motor de precios Express (un engine por módulo) | Cálculo de precios |
| `server/controllers/quotation.controller.ts` | Switch de categorías de cotización | Al agregar un módulo |
| `db/migrations/0XX_*.sql` | Migraciones numeradas (hasta `060`+) + `ROLLBACK_*.sql` + `snapshots/` | Al cambiar schema |
| `supabase/functions/` | Edge Functions (invitaciones, WhatsApp, password reset, calculate-item, tickets…) | Al tocar EFs |
| `docs/` | `ops/` (operativa), `handover/`, `prd/`, `agents/`, `architecture/` | Según el tema |

## 4. Comandos canónicos

```powershell
npm run dev         # tsx server.ts — Express + Vite (repo en D:, corre sin problema)
npm run build       # vite build → dist/   (verificación real)
npm run preview     # sirve dist/ — verificación rápida de UI
npm run typecheck   # tsc --noEmit — baseline ~32 errores pre-existentes, no sumar nuevos
npm run test        # vitest run
```

## 5. Arquitectura que NO se ve en el árbol

### 5.1 Cotizador de 3 capas (patrón canónico)
```
src/features/<modulo>/logic.ts        → motor puro (tipos, constantes, cálculo) — @deprecated en prod
src/hooks/use-<modulo>-calculator.ts  → hook React (useMemo sobre el motor)
src/features/<modulo>/<Modulo>Module.tsx → UI (Card + footer con total)
```
Hub central: `src/components/quotations/steps/QuotationDesignStep.tsx`. Cada módulo notifica vía
`onDataChange(total, config)`; el `config` se guarda en `item.configuration` y alimenta el PDF.
Falta `MesonesTemplate.tsx` (PDF) y `initialData` en `MesonesModule` (§7.5).

### 5.2 Motor de precios server-side
Todo cálculo pasa por `POST /api/quotations/calculate-item` — Express local Y Edge Function
`calculate-item` (portada a prod 2026-06-12). Precios en `pricing_catalog`. **Cada engine tiene
FALLBACK hardcoded**: si la query falla, usa el fallback en vez de colapsar. Para migrar un
módulo client-side: replicar el patrón de TV Center (memoria `project_innovar.md`).

> **Gotcha de categorías:** `puerta` (singular) = puertas interiores (`features/doors/`);
> `puertas` (plural) = repuestos/tapas de cocina. NO mezclar. Acabados es `'especiales'`,
> NO `'acabados_especiales'`. Usar el string ya cableado en `useQuotationBuilder.ts`.

### 5.3 Acceso a Supabase
- **Frontend:** cliente único en `src/lib/supabaseClient.ts` (anon key, RLS aplica). Datos vía hooks.
- **SQL / migraciones / schema:** **Management API** con `SUPABASE_ACCESS_TOKEN` del `.env`
  (`POST .../v1/projects/xdzbjptozeqcbnaqhtye/database/query`). El agente las ejecuta directo.
  Patrón: memoria `reference_innovar_management_api.md`.
- **El MCP Supabase del entorno apunta a Light_House, NO a Innovar.** No usarlo acá.

### 5.4 Notificaciones
Tabla `notifications`, 7 triggers plpgsql en prod. Arquitectura completa, deep-links y
anti-patrón Realtime: **`docs/ops/notificaciones.md`**. Modificás un trigger →
`CREATE OR REPLACE FUNCTION` vía Management API + migración nueva.

## 6. Reglas de dominio que muerden

### 6.1 ⚠️ El schema local `db/supabase_schema.sql` está DESACTUALIZADO
Producción tiene columnas que el archivo local no declara, y NO tiene otras que sí declara
(ej. `data_origin`: en Zod pero NO en prod → error PG `42703`).
**Siempre verificá contra `information_schema.columns` vía Management API antes de tocar un schema Zod.**
Fix del patrón repetido: `.passthrough()` + remover el `.default()`. Ver `bug_innovar_data_origin_phantom_column.md`.

### 6.2 Migraciones contra producción
Idempotentes (`IF EXISTS`/`ON CONFLICT DO UPDATE`). El agente las aplica vía Management API
cuando Robert aprueba el contenido. No uses el alias `check` en queries (rompe pg-meta).
Hay `ROLLBACK_*.sql` por fase — mantenelos.

### 6.3 WhatsApp
Proactivo = **template aprobada** (texto libre no llega fuera de ventana 24h; HTTP 200 ≠ entrega).
`slice_3_enabled = FALSE` es **intencional** — no activar sin templates Meta + OK de Robert.
Pruebas: solo Robert `+573183061286` o Heduin `+584127862439`, nunca clientes.

### 6.4 GRANTs amplios en anon
El rol `anon` tiene DELETE/UPDATE/TRUNCATE sobre las tablas (RLS protege, pero no es ideal).
No asumas que anon es solo-lectura.

## 7. Cosas que parecen bugs pero NO lo son

**No las "arregles".**

### 7.1 La saga del cuelgue de módulos — YA resuelta, no la reabras
Causa raíz: llamar `supabase.from()` dentro del callback `onAuthStateChange` (`authStore.ts`)
→ deadlock interno del SDK. Fix: `ensureProfile()` solo en `initializeAuth()`. **NO re-agregues
capas de timeout** (`fetchWithTimeout`/`withTimeout`/retry) — estrangulaban queries legítimas
y disparaban signOut; se eliminaron en el clean rebuild. Si un módulo "cuelga": reproducir en
**incógnito** antes de teorizar RLS. Ver `feedback_supabase_no_sdk_in_onauth_callback.md`.

### 7.2 ~32 errores TS de baseline en `tsc --noEmit`
Pre-existentes. No sumes nuevos; no los "arregles" a ciegas con `!`.

### 7.3 Server Express "supabaseUrl is required" (si reaparece)
El controller usa fallbacks hardcoded; las cotizaciones funcionan igual. No urgente.

### 7.4 Supabase Realtime channels son singletons globales
`useRealtimeNotifications()` usa canal hardcoded; solo se invoca desde `Layout`. No lo llames
desde una segunda página. Detalle: `docs/ops/notificaciones.md`.

### 7.5 Mesones sin template / sin initialData
`MesonesTemplate.tsx` pendiente y `MesonesModule` no restaura config guardada. Conocido.

## 8. Git y deploy — MODO EN VIVO (orden del dueño, 2026-06-12)

**Todo cambio se sube en vivo; el agente ejecuta el ciclo completo:**
build verde → `git add` explícito + `commit` → `git push origin master` → deploy manual Vercel
(auto-deploy roto: Vercel apunta a `Rvirona/CRM-INNOVAR-APP:main`, no al repo de trabajo) →
verificar prod. Comandos e IDs: `docs/ops/vercel-deploy.md`.
- **SQL / migraciones / Vault / EF deploy** → el agente, vía Management API + PAT del `.env`.
- Se delega SOLO: destructivas (force push, DROP, DELETE masivo), secretos ausentes de `.env`, WhatsApp real (§6.3).
- **Nunca subir** `.env`, `.claude/`, `.vercel/`, `*.log`, `*.tmp.*` (aunque lo pidan).

## 9. Sistema multiagente — cuándo orquestar

Tarea simple (un archivo) → directo. Tarea compleja (cotizador + schema + RLS, o ambigua) →
líder (descompone) → implementador (respeta §6/§7) → revisor (typecheck/build + CHECKPOINTS).
En este ecosistema ese loop ya lo dan `/grill-me`, `/code-review`, `/qa-autofix` + Workflow.
La auditoría paralela (varios Explore) pescó 4 bugs latentes el 2026-05-20 — herramienta válida acá.

## 10. Antes de declarar "hecho"

- [ ] Checkpoints aplicables de `CHECKPOINTS.md` en verde.
- [ ] `npm run typecheck` sin errores nuevos sobre el baseline (~32) y `npm run build` verde.
- [ ] Schema Zod/SQL tocado → verificado contra prod vía Management API (§6.1).
- [ ] UI tocada → verificada en `npm run preview` o anotada como pendiente visual.
- [ ] **Modo en vivo:** push + deploy + verificación en prod hechos (§8).
- [ ] Memoria del proyecto actualizada si fue trabajo significativo.

## 11. Cuándo parar y preguntar

- Migración no idempotente o que requiere intervención manual.
- Acción destructiva no autorizada (DROP, DELETE masivo, force push).
- WhatsApp hacia cualquiera que no sea número de prueba, o activar `slice_3_enabled`.
- Tentación de tocar `authStore.ts` / capas de timeout (§7.1) — confirmá antes.
- Conflicto entre `AGENTS.md` y el código real → avisar, no improvisar.
