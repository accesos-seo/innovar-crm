# CRM Innovar — Guía para Claude

> Leído automáticamente por Claude al abrir esta carpeta. Mapa operativo + punteros.
> El mapa técnico del repo (arquitectura, gotchas, checklist de "hecho") vive en `AGENTS.md` — no duplicar acá.

## Identidad del proyecto

- **Nombre:** CRM Innovar App — CRM para empresa de cocinas y muebles (cotizaciones, clientes, proyectos, agenda, finanzas)
- **Dueño:** Robert, NO técnico — instrucciones que le lleguen: siempre copy-paste
- **Carpeta canónica (ÚNICA válida):** `D:\Agents-automations\04-Innovar`
- ⛔ **Rutas MUERTAS — ignorar siempre:** `OneDrive\Escritorio\...\Innovar-App-main` y `OneDrive\Documentos\...\Innovar-App-main` son réplicas legacy desincronizadas. Si la sesión arranca parada en una de ellas, moverse a `D:` antes de tocar nada. Ver `feedback_innovar_canonical_path.md`.
- **Stack:** React 19 + TS + Vite 6, shadcn/ui + Tailwind 4, Supabase, Express local (`server.ts`), deploy Vercel. Detalle y mapa de carpetas: `AGENTS.md` §2-§5.

## Modo de trabajo: EN VIVO (orden del dueño, 2026-06-12)

**Todos los cambios se suben en vivo. No se acumula trabajo local.** El ciclo completo lo ejecuta el agente, sin delegar:

1. Editar → `npm run build` (y `npm run typecheck`, sin errores nuevos sobre baseline)
2. `git add ARCHIVOS_EXPLICITOS` + `git commit` (nunca `git add .`)
3. `git push origin master` — **lo hace el agente** (repo en `D:`, sin conflictos de watcher)
4. Deploy manual a Vercel — **lo hace el agente** vía CLI o API (auto-deploy roto, ver abajo)
5. Verificar prod (URL viva, smoke test) y reportar

> Esto reemplaza la política anterior ("solo push lo hace el usuario", "cambios solo locales").
> Siguen delegándose ÚNICAMENTE: acciones destructivas (force push, DROP, DELETE masivo),
> secretos que no estén en ningún `.env`, y mensajes WhatsApp reales (ver AGENTS.md §6.3).

## Autonomía operativa

Hereda el modo de autonomía del `CLAUDE.md` global. Específico de Innovar — el agente HACE SOLO:

- **SQL en Supabase Innovar** (`xdzbjptozeqcbnaqhtye`) → Management API con `SUPABASE_ACCESS_TOKEN` del `.env`. Patrón: `reference_innovar_management_api.md`.
- **Migraciones SQL contra producción** (idempotentes, con ROLLBACK) cuando el usuario aprobó el contenido.
- **Cron jobs, Vault secrets, Edge Functions** (`supabase functions deploy`) con el PAT del `.env`.
- **Verificación post-migración:** smoke-tests sobre `pg_proc`, `pg_trigger`, `pg_policies`, `information_schema`.
- **git push + deploy Vercel** (modo en vivo, ver arriba).

## GitHub

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/accesos-seo/innovar-crm |
| Rama de trabajo | `master` (estado vivo del proyecto: memoria `project_innovar.md`) |
| Cuenta | `accesos-seo` — `gh` autenticado. Error de auth → `gh auth status` |

```powershell
Set-Location "D:\Agents-automations\04-Innovar"; git add ARCHIVO1 ARCHIVO2; git commit -m "DESCRIPCION"; git push origin master
```

## Vercel — deploy

| Campo | Valor |
|---|---|
| Proyecto | `crm-innovar-app-2026` |
| Producción | https://crm-innovar-app-2026.vercel.app |
| Token | `.env` → `VERCEL_TOKEN` |

> ⚠️ **Auto-deploy ROTO:** Vercel está conectado a `Rvirona/CRM-INNOVAR-APP:main`, el trabajo va a `accesos-seo/innovar-crm:master`. El push NO dispara deploy → **deploy manual tras cada push** (lo hace el agente).
> Comandos CLI/API, IDs de proyecto/team y env vars: **`docs/ops/vercel-deploy.md`**.

```powershell
Set-Location "D:\Agents-automations\04-Innovar"; npx vercel --prod --token TU_VERCEL_TOKEN_AQUI --yes
```

## Supabase

| Campo | Valor |
|---|---|
| Project ID | `xdzbjptozeqcbnaqhtye` |
| URL | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| Claves | `.env` del proyecto |

- **Acceso SQL:** Management API con `SUPABASE_ACCESS_TOKEN` (PAT) — tabla universal en `~/.claude/CLAUDE.md`. **No usar MCP** (apunta a Light_House, no a Innovar).
- **Schema local miente** — verificar contra `information_schema` antes de tocar Zod/SQL: `AGENTS.md` §6.1.
- **Storage (bucket avatares, políticas):** `docs/ops/storage-buckets.md`.
- **Notificaciones (tabla, 7 triggers, anti-patrón Realtime):** `docs/ops/notificaciones.md`.

## Pendientes conocidos (verificado 2026-06-12)

- [ ] Conectar Vercel al repo correcto `accesos-seo/innovar-crm:master` (mientras: deploy manual)
- [ ] `MesonesTemplate.tsx` — template PDF de mesones pendiente; `MesonesModule` no restaura config guardada
- [ ] Rotar el PAT de Supabase (estuvo hardcodeado en un script local; nunca llegó al remoto)
- [ ] Limpiar ~20 archivos basura `*.tmp.*` sin trackear en el working tree

## Archivos que NUNCA deben subirse

`.env` (claves), `.claude/` (tokens locales), `.vercel/` (IDs), `node_modules/`, `*.log`, `*.tmp.*` — aunque el usuario lo pida explícitamente.

## Reglas de trabajo

1. Dueño NO técnico → todo comando que le llegue: copy-paste, PowerShell con `;` (nunca `&&`)
2. Antes de push: `git status` para confirmar que no van archivos sensibles
3. `npm run dev` funciona (repo en `D:`); para verificación rápida preferir `npm run build` + `npm run preview`
4. Diagnóstico de bugs: primero incógnito/estado del navegador, después frontend, último RLS (`feedback_diagnose_browser_state_first.md`)
5. DB en inglés, labels en español (`feedback_innovar_db_language_convention.md`)
6. Antes de declarar "hecho": checklist de `AGENTS.md` §10 + `CHECKPOINTS.md`

## Punteros — dónde vive cada cosa

| Tema | Documento |
|---|---|
| Mapa del repo, arquitectura, gotchas, zonas minadas | `AGENTS.md` |
| Criterios de "hecho" | `CHECKPOINTS.md` |
| Deploy Vercel (IDs, API, env vars) | `docs/ops/vercel-deploy.md` |
| Notificaciones (arquitectura + triggers) | `docs/ops/notificaciones.md` |
| Storage / buckets | `docs/ops/storage-buckets.md` |
| Estado vivo del proyecto (fases, bugs, decisiones) | memoria `project_innovar.md` |
| Handoffs por sesión | `docs/handover/` |
| PRDs (portal cliente, postventa, producción, agentes) | `docs/prd/`, `docs/agents/` |
| Onboarding narrativo del producto | `docs/legacy/ONBOARDING.md` |
| Legacy (cotizadores Word, handovers viejos) e informes | `docs/legacy/` · `docs/informes/` |
