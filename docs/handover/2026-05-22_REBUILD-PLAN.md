# Plan ejecutable — Clean rebuild de la capa Supabase
**Para ejecutar después de leer [HANDOVER-CLEAN-REBUILD.md](2026-05-22_HANDOVER-CLEAN-REBUILD.md).**

> **Este es el plan paso a paso con código exacto.** El agente que retoma debe ejecutarlo sin desviarse. Si surge una duda, parar y consultar con el usuario — no improvisar.

---

## Fase 0 — Pre-flight (5 min)

### 0.1 — Confirmar contexto

Ejecutar (el usuario corre o el agente foreground):

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
git status
git branch --show-current
git log --oneline -3
```

**Estado esperado al arrancar:**
- Branch: `test-auth-fixes-local`
- HEAD: `bc87231 fix(frontend): eliminar race conditions globales...`
- Working tree: 7 archivos modificados (payment_type fix), varios docs untracked

Si NO match exacto, parar y consultar.

### 0.2 — Guardar payment_type fix

```powershell
git stash push -m "payment_type_2026-05-22_pre_rebuild" -- CLAUDE.md docs/KNOWN_ISSUES.md src/components/finanzas/NewPaymentModal.tsx src/components/finanzas/PaymentsList.tsx src/hooks/finanzas/usePayments.ts src/pages/Pagos.tsx src/schemas/payment.ts
```

### 0.3 — Crear rama desde master (NO desde test-auth-fixes-local)

```powershell
git checkout master
git checkout -b clean-supabase-rebuild
git log --oneline -1
```

**Esperado:** HEAD = `a20e4fc Merge pull request #10 from accesos-seo/feature/slice-2-opportunities-cutover`

---

## Fase 1 — Simplificar `src/lib/supabaseClient.ts`

**Acción:** reemplazar TODO el contenido del archivo (actualmente ~190 líneas) por la versión limpia abajo.

**Nuevo contenido completo de `src/lib/supabaseClient.ts`:**

```typescript
import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://xdzbjptozeqcbnaqhtye.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkemJqcHRvemVxY2JuYXFodHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDU3MTQsImV4cCI6MjA5MTY4MTcxNH0.M4-nl-r-M3sMNGUoJoyRXar8dwdnUkAJGR9YGkV5bNk';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)
  || process.env.VITE_SUPABASE_URL
  || FALLBACK_URL;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || process.env.VITE_SUPABASE_ANON_KEY
  || FALLBACK_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Configuración de Supabase incompleta. Verifica VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
}

// Limpieza idempotente del token huérfano legacy. Versiones antiguas del cliente
// no usaban `storageKey` custom y dejaban `sb-{ref}-auth-token` en localStorage.
// Si se queda ahí vencido, el SDK lo lee internamente y se cuelga. Esta línea
// resuelve definitivamente ese vector. Cero impacto en sesiones limpias.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('sb-xdzbjptozeqcbnaqhtye-auth-token');
  }
} catch {
  /* ignore */
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        storageKey: 'innovar-auth-token',
      },
    })
  : null as any;

// Exports legacy mantenidos para que App.tsx y authStore.ts compilen sin tocarlos
// en esta fase. En Fase 2/3 se eliminan los callsites y entonces se borran.
export function recordSupabaseTimeout(): void { /* no-op */ }
export function recordSupabaseSuccess(): void { /* no-op */ }
export function resetTimeoutTracking(): void { /* no-op */ }
```

**Lo que se quita (versus la versión anterior):**
- ❌ `fetchWithTimeout` y todo el AbortController custom
- ❌ Constante `GLOBAL_TIMEOUT_MS`, contadores `recentTimeoutTimestamps`, `STALE_TIMEOUT_THRESHOLD`, `TIMEOUT_WINDOW_MS`
- ❌ Función `triggerStaleRecovery` (con toast, signOut forzado, hard redirect)
- ❌ Función `isPersistedJwtExpired` (JWT decode al mount)
- ❌ Listener `onAuthStateChange` (queda solo el de authStore.ts)
- ❌ Interceptor `console.error` para detectar "Refresh Token Not Found"
- ❌ Llamada a `triggerStaleRecovery` con setTimeout(0)

**Lo que se mantiene:**
- ✅ Fallback URL y key (no depender solo de env vars)
- ✅ Cleanup del orphan `sb-{ref}-auth-token` (defensa cheap e idempotente)
- ✅ `storageKey: 'innovar-auth-token'` (no cambiamos esto para no desloguear a todos los usuarios)
- ✅ Exports stub de `recordSupabaseTimeout` etc. (no-ops) → permite compilar Fase 1 antes de Fase 2

---

## Fase 2 — Simplificar `src/App.tsx`

**Acción:** edits puntuales. NO reemplazar el archivo entero.

### Edit 2.1 — Quitar imports innecesarios

**Buscar:**
```typescript
import { supabase, recordSupabaseTimeout, recordSupabaseSuccess } from "@/lib/supabaseClient";
import { runConnectionDiagnostic } from "@/lib/connection-diagnostic";
```

**Reemplazar por:**
```typescript
import { supabase } from "@/lib/supabaseClient";
```

### Edit 2.2 — Simplificar `queryErrorCache`

**Buscar el bloque entero del `QueryCache`:**
```typescript
const queryErrorCache = new QueryCache({
  onError: (error, query) => {
    const msg = (error as Error)?.message ?? String(error);
    const tableHint = JSON.stringify(query.queryKey).slice(0, 80);
    console.error(`[query-error] ${tableHint} → ${msg}`);

    const isTimeout = /timed out|timeout/i.test(msg);
    if (isTimeout) {
      recordSupabaseTimeout();
      notify.error(
        'Error al cargar datos',
        `${msg.split('.')[0]}. Verifica la consola para más detalles.`
      );
    } else if (/network|fetch/i.test(msg)) {
      notify.error(
        'Error al cargar datos',
        `${msg.split('.')[0]}. Verifica la consola para más detalles.`
      );
    }
  },
  onSuccess: () => {
    recordSupabaseSuccess();
  },
});
```

**Reemplazar por:**
```typescript
const queryErrorCache = new QueryCache({
  onError: (error, query) => {
    const msg = (error as Error)?.message ?? String(error);
    const tableHint = JSON.stringify(query.queryKey).slice(0, 80);
    console.error(`[query-error] ${tableHint} → ${msg}`);
    if (/network|fetch/i.test(msg)) {
      notify.error(
        'Error de conexión',
        `${msg.split('.')[0]}. Verifica tu conexión a internet.`
      );
    }
  },
});
```

### Edit 2.3 — Simplificar `queryClient` defaults

**Buscar:**
```typescript
const queryClient = new QueryClient({
  queryCache: queryErrorCache,
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 10000),
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});
```

**Reemplazar por:**
```typescript
const queryClient = new QueryClient({
  queryCache: queryErrorCache,
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 2000,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});
```

### Edit 2.4 — Quitar `runConnectionDiagnostic` del useEffect

**Buscar el bloque dentro del `useEffect`:**
```typescript
    // Diagnóstico de conexión — solo en dev. Escribe a consola.
    // Permite identificar si el problema es auth, RLS o latencia de red.
    if (import.meta.env.DEV) {
      // Esperamos a que initializeAuth tenga oportunidad de cargar la sesión
      const t = setTimeout(() => {
        runConnectionDiagnostic().catch(err => console.error('[diag] crashed:', err));
      }, 1500);
      return () => clearTimeout(t);
    }
```

**Eliminar este bloque entero.** El `useEffect` queda solo con `initializeAuth()` y el `notify.warning` si supabase es null.

---

## Fase 3 — Simplificar `src/store/authStore.ts`

### Edit 3.1 — Quitar import de `resetTimeoutTracking`

**Buscar:**
```typescript
import { supabase, resetTimeoutTracking } from "@/lib/supabaseClient";
```
o (si la cherry-pick no se aplicó):
```typescript
import { supabase } from "@/lib/supabaseClient";
```

**Reemplazar por (asegurar):**
```typescript
import { supabase } from "@/lib/supabaseClient";
```

### Edit 3.2 — Limpiar `onAuthStateChange`

**Buscar el bloque entero del listener:**
```typescript
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT" || event === "USER_DELETED") {
          try {
            localStorage.removeItem("innovar-auth-token");
          } catch {
            /* ignore */
          }
          resetTimeoutTracking();
          set({ user: null, profile: null });
          return;
        }

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          resetTimeoutTracking();
        }

        if (session?.user) {
          const profile = (await ensureProfile(session.user)) || fallbackProfile(session.user);
          set({ user: session.user, profile });
        }
      });
```

**Reemplazar por:**
```typescript
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT" || event === "USER_DELETED") {
          set({ user: null, profile: null });
          return;
        }

        if (session?.user) {
          const profile = (await ensureProfile(session.user)) || fallbackProfile(session.user);
          set({ user: session.user, profile });
        }
      });
```

**Qué se quita:**
- ❌ `localStorage.removeItem("innovar-auth-token")` manual en SIGNED_OUT (el SDK lo hace internamente)
- ❌ Llamadas a `resetTimeoutTracking()` (la función ya es no-op pero limpia el código)

---

## Fase 4 — Simplificar los 22 hooks que usan `withTimeout`

### Patrón de transformación

**Antes:**
```typescript
const response = (await withTimeout(query as any)) as any;
const { data, error } = response;
```

**Después:**
```typescript
const { data, error } = await query;
```

**Antes:**
```typescript
const response = (await withTimeout(query as any, 15000)) as any;
```

**Después:**
```typescript
const response = await query;
```

### Lista completa de archivos a modificar

```
src/hooks/useClients.ts
src/hooks/useLeads.ts
src/hooks/useProjects.ts
src/hooks/useOpportunities.ts
src/hooks/useHolidays.ts
src/hooks/useMaterials.ts
src/hooks/usePricing.ts
src/hooks/useQuotations.ts
src/hooks/useSystemDictionary.ts
src/hooks/useWhatsApp.ts
src/hooks/agenda/useActiveStaff.ts
src/hooks/agenda/useAppointments.ts
src/hooks/finanzas/useClosures.ts
src/hooks/finanzas/useExpenses.ts
src/hooks/finanzas/useFinancialSummary.ts
src/hooks/finanzas/usePayments.ts
src/hooks/finanzas/useProjectBalance.ts
src/hooks/notifications/useNotifications.ts
src/hooks/notifications/useUnreadCount.ts
src/hooks/tareas/useTaskComments.ts
src/hooks/tareas/useTasks.ts
src/pages/settings/Audit.tsx
src/pages/settings/Users.tsx
```

### Para cada archivo
1. Quitar el import: `import { withTimeout } from "@/lib/timeout";`
2. Reemplazar TODAS las llamadas a `withTimeout(query, ...)` con la query directa
3. Si el archivo no tiene ninguna llamada después, dejar import quitado

### Verificación post-cambios
```powershell
# Debería retornar 0 matches (solo el archivo de timeout.ts mismo)
Get-ChildItem -Path src -Recurse -Filter *.ts,*.tsx | Select-String -Pattern "withTimeout"
```

---

## Fase 5 — Eliminar archivos obsoletos

```powershell
Remove-Item src\lib\timeout.ts
Remove-Item src\lib\connection-diagnostic.ts
```

Asegurarse que NADIE más los importa (después de Fase 4 no debería haber nadie).

---

## Fase 6 — Verificación local

### 6.1 Typecheck
```powershell
npm run typecheck
```

**Esperado:** ≤32 errores (baseline post-cherry-pick). NUEVOS errores se permiten solo si son `'withTimeout' is not defined` o referencias a `timeout.ts` que faltó limpiar.

### 6.2 Build
```powershell
npm run build
```

**Esperado:** build exitoso, ~45s.

### 6.3 Dev server
```powershell
# Si hay un dev previo corriendo:
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run dev
```

### 6.4 Smoke test (CRÍTICO — pedirle al usuario)

**Pedirle al usuario que abra ventana incógnita** en `http://localhost:3000` y navegue:

| Página | Tiempo de carga esperado | Acción si falla |
|---|---|---|
| `/` (Dashboard) | <3s | Capturar Network tab |
| `/projects` | <5s | Capturar Network tab |
| `/clients` | <5s | Capturar Network tab |
| `/finanzas/gastos` | <5s | Capturar Network tab |
| `/finanzas/pagos` | <5s | Capturar Network tab |
| `/settings/materials` | <5s | Capturar Network tab |
| `/settings/holidays` | <5s | Capturar Network tab |

### 6.5 Test de tiempo prolongado

Si el smoke test pasa, pedir al usuario que:
1. Deje la pestaña abierta 30 minutos
2. Vuelva y navegue — verificar que NO hay cuelgues cíclicos
3. Esperar 1 hora (token refresh debería pasar) y volver a navegar

Si pasa los 30 min y la 1 hora → **bug cerrado.**

---

## Fase 7 — Si funciona

### 7.1 Recuperar payment_type fix
```powershell
git stash pop  # recupera el stash de Fase 0.2
```

### 7.2 Commit del rebuild (sin payment_type)
```powershell
# Primero stash el payment_type otra vez para commitear el rebuild solo
git stash push -m "payment_type_postclear" -- CLAUDE.md docs/KNOWN_ISSUES.md src/components/finanzas/NewPaymentModal.tsx src/components/finanzas/PaymentsList.tsx src/hooks/finanzas/usePayments.ts src/pages/Pagos.tsx src/schemas/payment.ts

git add src/lib/supabaseClient.ts src/App.tsx src/store/authStore.ts src/hooks src/pages/settings
git rm src/lib/timeout.ts src/lib/connection-diagnostic.ts
git commit -m "refactor(supabase): simplificar capa auth/data — remove timeout layers"

git stash pop  # restaurar payment_type
```

### 7.3 Discutir merge con usuario
- ¿Mergear a master ahora?
- ¿Cuándo deployar a Vercel? (out of scope inmediato según el usuario)

---

## Fase 8 — Si NO funciona

El bug sigue tras el rebuild → **el problema NO está en el frontend.**

Pasos siguientes (NO ejecutar en esa misma sesión — son investigaciones nuevas):

### 8.1 Aislar Supabase
- Login en https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/
- Reports → Performance — ¿hay queries lentas (>5s)?
- Logs → API logs últimas 24h — ¿hay 5xx, 429 (rate limit)?
- Settings → Billing — ¿proyecto en free tier? ¿auto-pausa habilitada?

### 8.2 Aislar la query culpable
Pedirle al usuario:
1. Abrir página que cuelga
2. F12 → Network → filtro `xdzbjptozeqcbnaqhtye`
3. Captura mostrando el request pending y su Time
4. Click derecho en el request → Copy → Copy as cURL
5. Pegar el cURL para análisis

### 8.3 Aislar RLS
Para una query que cuelga, ejecutar versión cruda contra DB con service role:
```sql
SET ROLE postgres;
-- ejecutar la query exacta sin RLS
SELECT * FROM clients;
-- comparar tiempo con la query via API
```

### 8.4 Rollback del rebuild
```powershell
git checkout master
git branch -D clean-supabase-rebuild   # solo si confirmado que NO sirvió
```

---

## Apéndice A — Snapshot del archivo actual `src/lib/supabaseClient.ts` (referencia)

Si necesitás ver lo que se va a borrar:
```powershell
git show test-auth-fixes-local:src/lib/supabaseClient.ts | Out-File -Encoding utf8 src\lib\supabaseClient.OLD.ts
```
(Crear como respaldo opcional, NO commitear.)

---

## Apéndice B — Decisiones de diseño documentadas

### ¿Por qué mantener `storageKey: 'innovar-auth-token'` en vez de usar el default?

Si removemos el storageKey custom, todos los usuarios pierden su sesión actual (one-time logout). Mantenerlo no aporta riesgo nuevo. El orphan token cleanup (1 línea) protege contra el residuo del cambio histórico.

### ¿Por qué `retry: 1` en lugar de `retry: 2` o `retry: 0`?

- `retry: 0` → bugs reales se ven al primer intento, no hay margen para blips de red
- `retry: 2` → 3 intentos en serie con backoff, multiplica tiempo de error visible
- `retry: 1` → un solo retry rápido (2s), suficiente para blips, no enmascara queries genuinamente rotas

### ¿Por qué eliminar `withTimeout`?

Era una capa por encima del fetch de Supabase. Supabase SDK ya tiene su propio timeout interno (configurable). Apilar timeouts crea race conditions. Si una query tarda 15s legítimamente, queremos esperar — no matarla.

### ¿Por qué eliminar el `recovery` automático?

Convertía cualquier query lenta en "kick a login" — falso positivo. Si una sesión es realmente inválida, Supabase responderá 401 y el usuario será redirigido naturalmente por `ProtectedRoute` cuando intente acción autenticada. Menos magia, más previsible.

### ¿Por qué eliminar `runConnectionDiagnostic` auto?

Era una segunda llamada a `getSession()` a 1.5s del mount, en paralelo a `initializeAuth()`. Generaba race conditions. Sigue disponible si alguien necesita debugear: importar manualmente desde DevTools.

---

*Fin del plan ejecutable. Tiempo estimado total: 2-3 horas (incluye smoke test).*
