# Runbook — Opción B: Sync master con los fixes de producción
**Para ejecutar cuando vuelvas. Tiempo estimado: 30–45 minutos.**

> Este runbook asume que ya leíste [2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md](./2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md). Si no, leelo primero — sin ese contexto los pasos abajo no tienen sentido.

---

## Por qué este runbook existe

Producción corre commit `1be513d` de la rama `claude/continue-crm-innovar-r22VQ`, que tiene 3 fixes críticos del bug del cuelgue.
Master no los tiene. Slice 1/2 (Lead→Project, opportunities) sí están en master pero NO en producción.

Esta es la causa del loop infinito de los últimos días: cada agente AI nuevo lee master, no ve los fixes, re-investiga desde cero.

**Objetivo del runbook:** traer los 3 fixes a master sin perder Slice 1/2, sin perder el payment_type fix de working tree.

---

## Pre-flight — verificaciones antes de empezar

Ejecutá esto **vos** (no Claude — git en OneDrive es lento en background) y compará con lo esperado:

### Check 1 — Working tree actual
```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
git status
```

**Esperado:** modificados pero NO commiteados: `CLAUDE.md`, `docs/KNOWN_ISSUES.md`, `src/components/finanzas/NewPaymentModal.tsx`, `src/components/finanzas/PaymentsList.tsx`, `src/hooks/finanzas/usePayments.ts`, `src/pages/Pagos.tsx`, `src/schemas/payment.ts`. Untracked: `supabase/`.

**Si difiere:** parar. Algo se movió entre el diagnóstico y ahora. Avisame.

### Check 2 — Master está al día con origin
```powershell
git fetch origin; git status
```

**Esperado:** `Your branch is up to date with 'origin/master'.`

### Check 3 — La rama lateral existe y los 3 commits están ahí
```powershell
git log --oneline origin/claude/continue-crm-innovar-r22VQ | Select-String -Pattern "e527c82|eab7382|1be513d"
```

**Esperado:** 3 líneas, uno con cada SHA.

### Check 4 — Producción sigue en 1be513d
```powershell
$env:VERCEL_TOKEN = "[VERCEL_TOKEN_REDACTED]"
curl.exe -s -H "Authorization: Bearer $env:VERCEL_TOKEN" "https://api.vercel.com/v6/deployments?projectId=prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi&teamId=team_K7m1K8aMiKR36myzPROYViA8&limit=1" | Select-String -Pattern "githubCommitSha"
```

**Esperado:** `"githubCommitSha":"1be513d32905ea15e5c0f3c841ad8d831431d189"`.

**Si difiere:** alguien deployó algo nuevo entre el diagnóstico y ahora. Revisar antes de continuar.

---

## Paso 1 — Guardar el working tree actual

Necesitamos un working tree limpio para el cherry-pick. Stash las 7 modificaciones del payment_type fix:

```powershell
git stash push -m "payment_type_fix_2026-05-22_pre_cherrypick" -- CLAUDE.md docs/KNOWN_ISSUES.md src/components/finanzas/NewPaymentModal.tsx src/components/finanzas/PaymentsList.tsx src/hooks/finanzas/usePayments.ts src/pages/Pagos.tsx src/schemas/payment.ts
git status
```

**Esperado:** Working tree limpio (`nothing to commit, working tree clean`) excepto el `supabase/` untracked.

> ⚠️ Si querés conservar también los stashes anteriores (`wip-user-changes-eol-and-real-2026-05-22` etc.), no los toques. Este nuevo stash es independiente.

---

## Paso 2 — Crear rama de trabajo

```powershell
git checkout -b sync-prod-auth-fixes-2026-05-22 master
```

**Esperado:** `Switched to a new branch 'sync-prod-auth-fixes-2026-05-22'`.

---

## Paso 3 — Cherry-pick los 3 commits en orden

**ORDEN ES IMPORTANTE.** Cada commit asume el estado del anterior.

### 3.1 — `e527c82` (JWT decode at mount + first timeout check)
```powershell
git cherry-pick e527c82
```

**Esperado:** `[sync-prod-auth-fixes-2026-05-22 XXXXXXX] fix(supabase): detectar JWT vencido al mount...`

**Si hay conflicto:** parar y avisar. El análisis dice que no debería haberlo, pero si aparece es info importante.

### 3.2 — `eab7382` (orphan token cleanup)
```powershell
git cherry-pick eab7382
```

**Esperado:** `[sync-prod-auth-fixes-2026-05-22 XXXXXXX] fix(supabase): limpiar token huerfano legacy...`

### 3.3 — `1be513d` (race conditions globales)
```powershell
git cherry-pick 1be513d
```

**Esperado:** `[sync-prod-auth-fixes-2026-05-22 XXXXXXX] fix(frontend): eliminar race conditions globales...`

Este es el que toca 4 archivos: `App.tsx`, `supabaseClient.ts`, `authStore.ts`, `main.tsx`. Probabilidad de conflicto: muy baja (Slice 1/2 nunca tocaron esos archivos), pero si aparece, los conflictos serían en:
- `authStore.ts` — el agregar `resetTimeoutTracking` al import e invocarlo en `onAuthStateChange`

---

## Paso 4 — Verificación local

### 4.1 — Que typecheck no haya regresiones
```powershell
npm run typecheck
```

**Esperado:** 37 errores baseline preexistentes (no nuevos). Si suben, parar.

### 4.2 — Que build pase
```powershell
npm run build
```

**Esperado:** build exitoso. Tiempo ~45s. Si falla, leer el error con calma.

### 4.3 — Smoke test local (opcional pero recomendado)
```powershell
npm run dev
```

Abrí `http://localhost:5173`, hacé login, navegá a Proyectos, Cotizaciones, Materiales. Si carga todo en <5s sin cuelgues: 🎉.

Si se cuelga: probar primero `Ctrl+Shift+R` + verificar que `localStorage` no tenga `sb-xdzbjptozeqcbnaqhtye-auth-token` (DevTools → Application → Storage). Si lo tiene: el código está bien pero el browser tiene el huérfano persistido — borrar y recargar.

---

## Paso 5 — Recuperar el payment_type fix

```powershell
git stash pop
```

**Esperado:** los 7 archivos del payment_type fix vuelven al working tree, sin conflictos (modifican archivos distintos a los del cherry-pick).

Verificar:
```powershell
git status
```

Debería listar los 7 modificados otra vez (como estaba antes de empezar).

---

## Paso 6 — Push de la rama (NO merge a master aún)

```powershell
git push -u origin sync-prod-auth-fixes-2026-05-22
```

Esto deja la rama en GitHub. **NO HACER merge a master todavía** — primero validar en preview.

---

## Paso 7 — Deploy a Vercel desde la rama

Deploy manual (auto-deploy sigue roto):

```powershell
npx vercel --prod --token $env:VERCEL_TOKEN --yes
```

**Importante:** esto va a deployar la rama `sync-prod-auth-fixes-2026-05-22` directamente a producción. Si preferís validar en preview primero, omití `--prod`:

```powershell
npx vercel --token $env:VERCEL_TOKEN --yes
```

Y testeá en la URL de preview que devuelve.

---

## Paso 8 — Validación en producción

Probar que el bug del cuelgue NO reaparece:

1. Abrir `https://crm-innovar-app-2026.vercel.app` en una **ventana incógnita nueva**
2. Hacer login
3. Navegar a Proyectos → Cotizaciones → Materiales → Festivos → Auditoría → WhatsApp
4. Cada uno debería cargar en <5s
5. DevTools → Application → Local Storage → verificar que NO existe `sb-xdzbjptozeqcbnaqhtye-auth-token` (solo `innovar-auth-token`)
6. Console → no debería haber errores rojos de "Operation timed out" o "Refresh Token"

**Si pasa todo:** ✅ bug cerrado. Hacer merge a master:

```powershell
git checkout master
git merge sync-prod-auth-fixes-2026-05-22 --no-ff -m "merge: traer fixes de auth 2026-05-20 a master"
git push origin master
```

**Si falla algo:** rollback inmediato:

```powershell
# Volver el alias de prod al deploy anterior (1be513d)
# (esto se hace en el dashboard de Vercel — Settings → Production Deployments)
```

Y avisame con el error específico.

---

## Paso 9 — Cleanup post-éxito

Si todo salió bien:

```powershell
# Borrar la rama de trabajo
git branch -d sync-prod-auth-fixes-2026-05-22
git push origin --delete sync-prod-auth-fixes-2026-05-22

# La rama 'claude/continue-crm-innovar-r22VQ' YA NO ES NECESARIA
# Su contenido ahora está en master. Borrarla:
git push origin --delete claude/continue-crm-innovar-r22VQ
```

> NO borres la rama hasta haber validado en producción por al menos 24h. Es tu único rollback si algo sale mal.

---

## Apéndice A — Si los cherry-picks fallan con conflictos

Análisis previo dice que NO deberían fallar. Pero si fallan:

```powershell
# Para cancelar un cherry-pick a mitad de camino:
git cherry-pick --abort

# Volver a master limpio:
git checkout master
git branch -D sync-prod-auth-fixes-2026-05-22
git stash pop
```

Y avisame con la salida exacta del conflicto. No improvisar — los conflictos en auth code son delicados.

---

## Apéndice B — Lo que NO hace este runbook

- ❌ NO commitea el payment_type fix (sigue pendiente, separado, en stash o working tree)
- ❌ NO modifica nada de Slice 1/2 / opportunities
- ❌ NO aplica migraciones SQL (las que el handover del 19/05 mencionaba ya están aplicadas según verificación en DB)
- ❌ NO toca la rama lateral `claude/continue-crm-innovar-r22VQ` hasta el cleanup final
- ❌ NO cambia la configuración de Vercel (sigue conectado al repo equivocado)

Todo eso son tareas separadas que pueden hacerse después.

---

## Apéndice C — Estado esperado después del runbook

| Componente | Antes | Después |
|---|---|---|
| `master` | sin fixes auth 20/05 | con fixes auth 20/05 ✅ |
| `master` | con Slice 1/2 | con Slice 1/2 (intacto) |
| Working tree | payment_type fix dirty | payment_type fix dirty (intacto via stash pop) |
| Producción | corre rama lateral | corre master (al día) ✅ |
| Bug del cuelgue | persiste o aleatorio | cerrado en prod ✅ |
| Rama lateral | activa, deployed | borrada (post-validación) |

---

*Generado por sesión autónoma de Claude Opus 4.7 el 2026-05-22.*
