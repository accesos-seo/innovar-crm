# CHECKPOINTS.md — Criterios objetivos de "hecho bien" en Innovar CRM

> Qué significa **terminado** en este repo. Criterios verificables con comando/inspección, no
> opiniones. **Self-improving loop:** cada fallo por una razón no cubierta acá se agrega como
> checkpoint nuevo ANTES de cerrar. Nombre libre; lo importante es que `AGENTS.md` lo referencie.

---

## Globales

### CHK-GLOB-001 — Typecheck sin regresión
`npm run typecheck` → 0 errores **nuevos** sobre el baseline (~32 pre-existentes, AGENTS.md §7.2).

### CHK-GLOB-002 — Build verde
`npm run build` → completa sin error. Verificación real sobre el build (repo en `D:`, sin watchers problemáticos).

### CHK-GLOB-003 — Sin `console.log`/`TODO` huérfano en archivos modificados
Salvo en `*.test.ts`.

### CHK-GLOB-004 — Memoria actualizada si fue trabajo significativo
`project_innovar.md` refleja el cambio (fase, bug, decisión, IDs).

---

## Schema / datos (el área que más muerde)

### CHK-DB-001 — Schema Zod verificado contra producción
Si tocaste un schema en `src/schemas/` o agregaste una columna en una query: se verificó contra
`information_schema.columns` vía Management API. **No confiar en `db/supabase_schema.sql`** (miente).
Columna en Zod que no existe en prod → `.passthrough()` + quitar `.default()`. (AGENTS.md §6.1)

### CHK-DB-002 — Migración idempotente + rollback
Toda migración nueva usa `IF EXISTS`/`ON CONFLICT DO UPDATE` y, si toca una fase con rollback,
extiende el `ROLLBACK_*.sql` correspondiente.

### CHK-DB-003 — Triggers de notificación versionados
Si modificaste un trigger plpgsql → `CREATE OR REPLACE FUNCTION` vía Management API + migración nueva
que lo snapshotea. No editar en prod sin dejar rastro en `db/migrations/`.

### CHK-DB-004 — Management API sin alias `check`
Queries vía Management API no usan el alias `check` (rompe pg-meta → 502).

---

## Auth / sesión (zona minada)

### CHK-AUTH-001 — No llamar al SDK dentro del callback de auth
Ningún cambio agrega `supabase.from(...)` (ni nada que internamente llame `get_my_role()`) dentro de
`onAuthStateChange`. Eso reintroduce el deadlock. (AGENTS.md §7.1)

### CHK-AUTH-002 — No reintroducir capas de timeout en cascada
No se vuelven a agregar `fetchWithTimeout` + `withTimeout` + retries apilados sobre el cliente Supabase.
Si un módulo cuelga, primero reproducir en incógnito (descarta JWT stale) antes de teorizar RLS.

---

## Cotizador / precios

### CHK-QUOT-001 — Categoría correcta cableada
Un módulo nuevo usa el string de categoría YA cableado en `useQuotationBuilder.ts` /
`QuotationDesignStep.tsx`. Cuidado `puerta` (interiores) vs `puertas` (repuestos cocina), y
`'especiales'` (no `'acabados_especiales'`). (AGENTS.md §5.2)

### CHK-QUOT-002 — Engine con fallback
Todo engine nuevo en `server/services/` tiene un FALLBACK record hardcoded; si `pricing_catalog`
falla, devuelve el fallback, no lanza error que colapse el motor.

### CHK-QUOT-003 — Shape de retorno preservado
Al migrar un módulo client→server, el shape que recibe la UI no cambia (no hace falta tocar componentes).

---

## WhatsApp (compliance + seguridad)

### CHK-WA-001 — Solo template aprobada para proactivos
Nada de `type:"text"` proactivo. HTTP 200 ≠ entrega.

### CHK-WA-002 — Destinatarios de prueba únicamente
Tests solo a Robert `573183061286` o Heduin `+584127862439`. Nunca a clientes. No activar
`slice_3_enabled` sin templates Meta aprobados + OK explícito de Robert.

---

## Deploy / git

### CHK-DEPLOY-001 — Ciclo EN VIVO ejecutado por el agente (orden 2026-06-12)
`git add` (archivos explícitos, nunca `git add .`) + `commit` + `push` + `vercel --prod --yes`
los ejecuta el agente al cerrar cada cambio — no se entregan comandos al usuario ni se acumula
trabajo local. Verificar deploy Ready (auto-deploy de Vercel está ROTO: `docs/ops/vercel-deploy.md`).

### CHK-DEPLOY-002 — Nada sensible commiteado
`.env`, `.claude/`, `.vercel/`, `*.log` fuera del commit.

### CHK-DEPLOY-003 — Escaneo de secretos en archivos nuevos
Antes de commitear archivos NUEVOS: `grep -E "sbp_|eyJhbGciOi|AIza|client_secret"` sobre lo que
entra al add. Match con valor literal → mover a env y sanear ANTES del push. (Origen: 3 scripts
con service_role+PAT hardcodeados encontrados en Manager Ascent, 2026-06-12.)

---

## Identidad (cross-cliente)

### CHK-ID-001 — Cliente correcto verificado
Antes del primer SQL de escritura, deploy o EF de la sesión: el `project_ref` de Supabase (y el
proyecto Vercel, si aplica) que vas a tocar coincide con el de este arnés Y con la tabla universal
de `~/.claude/CLAUDE.md`. Tocar infra de otro cliente es el incidente más grave del ecosistema
(Emporium apuntando a la DB y al Vercel de Innovar — 2026-06-09 y 2026-06-12).

---

## Cuándo agregar checkpoints nuevos

Cada vez que algo se rechace por una razón no cubierta arriba, agregá el checkpoint antes de cerrar
la feature. Es el loop que evita repetir el mismo bug (la saga del cuelgue costó varias sesiones —
por eso CHK-AUTH-001/002 existen).
