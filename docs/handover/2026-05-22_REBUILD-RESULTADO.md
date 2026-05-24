# Resultado del clean rebuild — capa Supabase
**Fecha:** 2026-05-22 (noche, modo auto)
**Sesión:** Opus 4.7
**Estado:** ✅ Rebuild aplicado + typecheck + build OK. Pendiente: smoke test del usuario.

---

## TL;DR

- ✅ Rama `clean-supabase-rebuild` creada desde `master` (a20e4fc)
- ✅ Commit del rebuild: `7c088c8` — 27 archivos, +49 / -478 líneas
- ✅ `payment_type` fix restaurado al working tree (uncommitted, listo para review)
- ✅ Typecheck: 32 errores (baseline pre-existente, ningún error nuevo del rebuild)
- ✅ Build: exitoso en 19.57s
- 🔴 **PENDIENTE:** smoke test del usuario en `npm run dev` (Fase 6.4 del plan)

---

## Lo que cambió en el rebuild

### `src/lib/supabaseClient.ts` — simplificado de ~190 a ~45 líneas
**Eliminado:**
- `fetchWithTimeout` con AbortController (capa 1 de timeout, 8s)
- Constantes `GLOBAL_TIMEOUT_MS`, `STALE_TIMEOUT_THRESHOLD`, `TIMEOUT_WINDOW_MS`
- Contador `recentTimeoutTimestamps`
- Función `triggerStaleRecovery` (forzaba signOut + hard redirect a /login)
- Detección de JWT vencido al mount
- Listener `onAuthStateChange` interno (ya hay uno en `authStore.ts`)
- Interceptor de `console.error` para "Refresh Token Not Found"
- Llamada a `triggerStaleRecovery` con `setTimeout(0)`

**Mantenido:**
- Fallback URL + key
- Cleanup idempotente del orphan token `sb-{ref}-auth-token`
- `storageKey: 'innovar-auth-token'` (para no desloguear usuarios actuales)
- Exports stub `recordSupabaseTimeout`, `recordSupabaseSuccess`, `resetTimeoutTracking` como no-ops (compatibilidad — eliminables en futura iteración)

### `src/App.tsx` — edits puntuales
- Quitado import de `recordSupabaseTimeout`, `recordSupabaseSuccess`, `runConnectionDiagnostic`
- `queryErrorCache.onError`: solo notifica errores de red. Quitado el branch de timeout que disparaba `recordSupabaseTimeout()`
- `queryErrorCache.onSuccess`: eliminado (era no-op desde el último cambio)
- `queryClient` defaults: `retry: 1`, `retryDelay: 2000` (de `retry: 2` con backoff exponencial). Quitado `networkMode: "always"`.
- `useEffect`: quitado el bloque que disparaba `runConnectionDiagnostic` con `setTimeout(1500)`

### `src/store/authStore.ts` — sin cambios
Master ya tenía la versión limpia (los cherry-picks que añadían `resetTimeoutTracking` viven en `test-auth-fixes-local`, no en master). Skip de Fase 3.

### 23 hooks/páginas — quitar `withTimeout`
Patrón aplicado: `withTimeout(query, ms?)` → `query` (la query directa). El `await` se mantiene; el `as any` se mantiene donde estaba.

Archivos editados:
- `src/hooks/useClients.ts`, `useLeads.ts`, `useProjects.ts`, `useOpportunities.ts`, `useHolidays.ts`, `useMaterials.ts`, `usePricing.ts`, `useQuotations.ts`, `useSystemDictionary.ts`, `useWhatsApp.ts`
- `src/hooks/agenda/useActiveStaff.ts`, `useAppointments.ts`
- `src/hooks/finanzas/useClosures.ts`, `useExpenses.ts`, `useFinancialSummary.ts`, `usePayments.ts`, `useProjectBalance.ts`
- `src/hooks/notifications/useNotifications.ts`, `useUnreadCount.ts`
- `src/hooks/tareas/useTaskComments.ts`, `useTasks.ts`
- `src/pages/settings/Audit.tsx`, `Users.tsx`

Verificación: `grep withTimeout src/` → 0 matches (timeout.ts ya estaba eliminado).

### Archivos eliminados
- `src/lib/timeout.ts`
- `src/lib/connection-diagnostic.ts`

---

## Estado actual del repo

```
Branch: clean-supabase-rebuild
HEAD:   7c088c8 refactor(supabase): clean rebuild capa auth/data — remove timeout layers
Base:   a20e4fc (master, Slice 1 + 2)
```

### Working tree (uncommitted)
El `payment_type` fix del 22/05 está restaurado al working tree:
```
M  CLAUDE.md
M  docs/KNOWN_ISSUES.md
M  src/components/finanzas/NewPaymentModal.tsx
M  src/components/finanzas/PaymentsList.tsx
M  src/hooks/finanzas/usePayments.ts   ← auto-merged con quitar-withTimeout (limpio)
M  src/pages/Pagos.tsx
M  src/schemas/payment.ts
```

Untracked (handovers + supabase/ pre-existentes):
```
?? docs/handover/2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md
?? docs/handover/2026-05-22_HANDOVER-CLEAN-REBUILD.md
?? docs/handover/2026-05-22_OPCION-B-RUNBOOK.md
?? docs/handover/2026-05-22_REBUILD-PLAN.md
?? docs/handover/2026-05-22_STATE-WHEN-YOU-RETURN.md
?? docs/handover/2026-05-22_REBUILD-RESULTADO.md   ← este doc
?? supabase/
```

### Stashes restantes
```
stash@{0}: On master: wip-user-changes-eol-and-real-2026-05-22
stash@{1}: On feature/slice-1-data-skeleton: ...
stash@{2}: On claude/elegant-hawking-F0ptO: respaldo-2026-05-22
```
*(El stash `payment_type_2026-05-22_pre_rebuild` ya fue dropped tras el pop exitoso.)*

---

## QUÉ FALTA — smoke test del usuario (Fase 6.4 + 6.5 del plan)

Esta es la validación que el agente NO puede hacer — requiere browser real. Cuando vuelvas:

### 1. Arrancar dev server
```powershell
cd "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
# Si hay un dev previo corriendo:
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run dev
```

### 2. Smoke test en ventana incógnita

Abrir `http://localhost:3000` (o el puerto que Vite reporte) en incógnito. Login normal. Navegar:

| Página | Tiempo esperado | Si falla, capturar Network tab |
|---|---|---|
| `/` Dashboard | <3s | ✓ |
| `/projects` | <5s | ✓ |
| `/clients` | <5s | ✓ |
| `/finanzas/gastos` | <5s | ✓ |
| `/finanzas/pagos` | <5s | ✓ |
| `/settings/materials` | <5s | ✓ |
| `/settings/holidays` | <5s | ✓ |

### 3. Test prolongado (CRÍTICO — el bug original es cíclico)

Si el smoke test pasa:
1. Dejar la pestaña abierta **30 min**
2. Volver y navegar → verificar que NO hay cuelgues cíclicos
3. Esperar **1 hora** (token refresh debería pasar) y volver a navegar

Si pasa 30 min + 1 h → **bug cerrado.**

---

## Próximos pasos según resultado

### Caso A — Si funciona ✅
1. Decidir mergear `clean-supabase-rebuild` a `master`
2. Decidir cuándo deployar a Vercel (el usuario dijo: out of scope inmediato)
3. Considerar commitear el `payment_type` fix por separado (es ortogonal al rebuild)
4. Limpiar branches obsoletos: `test-auth-fixes-local` se puede borrar (`git branch -D test-auth-fixes-local`)
5. Actualizar memoria del proyecto Innovar marcando bug del cuelgue como resuelto

### Caso B — Si NO funciona 🔴
El bug NO está en el frontend. Pasos siguientes (NO ejecutar en la misma sesión que descubre la falla — investigación nueva):

1. **Aislar Supabase** — Dashboard → Reports → Performance: ¿queries >5s? ¿429? ¿auto-pausa?
2. **Aislar query culpable** — F12 → Network → filtro `xdzbjptozeqcbnaqhtye` → cURL del request pendiente
3. **Aislar RLS** — comparar tiempo de query vía API vs `SET ROLE postgres; SELECT * FROM ...` con service role
4. **Rollback** si el rebuild no aporta: `git checkout master; git branch -D clean-supabase-rebuild`

---

## Notas operativas

- **NO ejecuté Vercel deploy** (out of scope explícito del usuario)
- **NO mergeé a master** (decisión queda en manos del usuario tras smoke test)
- **El branch `test-auth-fixes-local` sigue intacto** como referencia histórica del intento previo
- **El `payment_type` fix** quedó uncommitted intencionalmente — es un cambio ortogonal al rebuild y merece su propio commit/review

---

## Lecciones acumulables

Si esto resuelve el bug → confirma la hipótesis: **3 capas de timeout en cascada estrangulan queries lentas-pero-legítimas.** Vale la pena escribir un memory de feedback: "antes de agregar timeouts/retries defensivos, medir las queries reales — si una query toma 12s legítimamente por cold-start o JOIN pesado, matarla a los 8s solo genera el bug que querías prevenir."

Si NO resuelve → confirma que el problema es estructural (Supabase free tier, RLS recursiva, red, etc.) y la búsqueda se mueve fuera del frontend.

---

*Próxima sesión: corre el smoke test, reporta resultado al usuario, y según caso A o B, ejecuta los siguientes pasos.*
