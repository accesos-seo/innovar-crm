# Cierre TENTATIVO — Bug del cuelgue cíclico resuelto

**Fecha:** 2026-05-22 (sesión nocturna)
**Estado:** ✅ Fix funcionando en 15+ min de testing intensivo. **NO definitivo** — falta test largo (1+ hora) y limpieza para commit.
**Branch:** `clean-supabase-rebuild` (HEAD `7c088c8` + cambios uncommitted)

---

## ⛔ ALERTA CRÍTICA PARA CUALQUIER IA / DEV QUE LEA ESTO DESPUÉS

**NO TOQUES NUNCA EL CÓDIGO QUE ARREGLAMOS ACÁ.**

Este bug nos llevó **una semana y media** de debugging. Tuvimos múltiples "falsas victorias" donde parecía resuelto y volvía. La causa raíz exacta es un anti-patrón conocido de Supabase JS y el fix es de 3-7 líneas. Cualquier "mejora", "refactor" o "limpieza" sobre este path puede reintroducir el deadlock y romper toda la app silenciosamente.

### Líneas/Archivos PROHIBIDOS de modificar sin autorización explícita del usuario

| Archivo | Líneas / Bloque | Por qué |
|---|---|---|
| `src/store/authStore.ts` | Bloque `initializeAuth()` líneas ~111-158 | Acá está el fix. NO mover `ensureProfile()` al listener. NO `await` métodos SDK dentro de `onAuthStateChange`. |
| `src/store/authStore.ts` | El callback de `onAuthStateChange` (líneas ~134-155) | Solo puede contener `set()` de Zustand. NUNCA `await supabase.<algo>` adentro. |

### La regla absoluta (memorizá esto)

> **PROHIBIDO** llamar cualquier método del cliente Supabase (`.from()`, `.rpc()`, `.storage`, `.functions`, `.auth.*`, etc.) **adentro del callback de `supabase.auth.onAuthStateChange()`**. Esto causa deadlock interno del SDK y cuelga queries silenciosamente. Si necesitás cargar datos en respuesta a un cambio de auth, hacelo en un `useEffect` de un componente que reaccione a cambios del store, NO dentro del callback de auth.

### Si tu nueva tarea toca login, perfil, sesión, roles, o tokens

1. **Pausá**. Leé este documento entero antes de proponer cambios.
2. **Antes de modificar `authStore.ts`**, decile al usuario: "Voy a tocar el área del bug del cuelgue. ¿Confirmás?"
3. **Después de cualquier cambio en `authStore.ts`**, hacer test largo del usuario (1+ hora, cubriendo al menos un token refresh natural ~50min) ANTES de mergear.

### El usuario te va a pedir cosas como…

- "Agregá esta nueva funcionalidad de leads"
- "Refactoreá el authStore para que sea más limpio"
- "Actualizá el manejo de roles"
- "Hagamos optimistic updates de profile"

**Cualquiera de esas que toque `authStore.ts` o el flow de auth requiere PARAR Y CONFIRMAR antes**. El usuario te lo dijo textual: "*Llevamos una semana y media en este tema. Que ya sepa que nunca más vuelva a tocar lo que arreglamos, porque eso fue traumático.*"

---

---

## TL;DR — Causa y fix

**Causa raíz:** llamar `supabase.from('profiles').select(...)` desde adentro del callback `supabase.auth.onAuthStateChange()` causa un deadlock interno del SDK Supabase JS. Es un anti-patrón conocido y documentado por Supabase.

**El fix:** mover la llamada a `ensureProfile()` afuera del listener. Mantenerla solo en `initializeAuth()` (que NO está dentro de ningún callback de auth).

**Diff exacto del fix** (en `src/store/authStore.ts`):

```diff
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT" || event === "USER_DELETED") {
      set({ user: null, profile: null });
      return;
    }

    if (session?.user) {
-     const profile = (await ensureProfile(session.user)) || fallbackProfile(session.user);
-     set({ user: session.user, profile });
+     // NO llamar SDK methods desde adentro del callback de onAuthStateChange.
+     // Es un anti-patrón documentado por Supabase que causa deadlock interno.
+     // El profile cargado en initializeAuth() persiste (set hace merge en Zustand).
+     set({ user: session.user });
    }
  });
```

3 líneas removidas + 4 líneas agregadas (comentario + un set más simple).

---

## Por qué nos confundió tantos días

El bug se nos escapó a TRES diagnósticos previos por dos razones cruzadas:

### 1. La "falsa victoria" del bypass total

Cuando bypasseábamos `ensureProfile()` completamente (sesión anterior), el bug "desaparecía" — pero NO porque arreglábamos el deadlock. Pasaba que:

- `ensureProfile()` saltea → `fallbackProfile()` setea role = `'comercial'`
- La UI esconde features admin para roles no-admin
- Las páginas con bug (`/settings/users`, `/settings/audit`, etc.) o no se renderizaban o no disparaban su query problemática
- → Resultado: parecía limpio, pero solo porque NO se ejecutaban las queries que colgaban

Cuando reanudábamos `ensureProfile()` correctamente, role volvía a `'admin'` y el bug volvía a manifestarse. Falsa correlación, no causación.

### 2. El sesgo del bug "cíclico aleatorio"

El handover anterior describía "cualquier módulo cuelga random después de un rato". La realidad es **más estrecha**:

- Solo cuelgan páginas que hacen queries a tablas con RLS protegida por admin (`profiles`, `audit_logs`, `holidays`, `notification_queue`).
- Otras páginas (dashboard, leads, gastos, clientes) NO cuelgan porque su RLS no hace el mismo trabajo.
- El "aleatorio" venía de: `onAuthStateChange` se dispara en múltiples eventos (token refresh cada ~50 min, focus de tab, navegación, etc.). El bug se gatilla cuando el listener corre Y vos visitás una página admin antes del próximo refresh.

---

## Cronología completa de la debugging (para handover futuro)

| Etapa | Hipótesis | Resultado | Aprendizaje |
|---|---|---|---|
| Sesión anterior (rebuild) | "3 capas de timeout estrangulan queries" | Removidas. Bug persistió. | Timeouts no eran la causa. |
| Sesión anterior (RQ) | "React Query en limbo" | TanStack DevTools mostraba `fetching=6 data=null lastUpdated=2h+`. Refetch button disabled. | Síntoma real pero no causa. |
| Esta sesión, Paso 2A (`useProjectsNoRQ`) | "React Query es la causa" | `/projects` sin RQ → SIGUIÓ colgando con SDK normal. | RQ descartado. |
| Esta sesión, Paso 2C (`useProjectsNoSDK`) | "SDK `.from()` es la causa" | `/projects` sin SDK → carga perfecto. Pero otros módulos siguen colgando. | SDK contribuye pero solo es síntoma del deadlock subyacente. |
| Esta sesión, Paso 2A.1 (`useRealtimeNotifications` off) | "WebSocket realtime es la causa" | Mejora parcial. Algunos módulos siguen colgando. | Realtime no era causa independiente. |
| Esta sesión, Paso 2A.2 (`ensureProfile` bypass total) | "ensureProfile es la causa" | "Limpio" 10 min pero por **falsa victoria** (role downgrade a comercial escondía admin pages). | Falso fix por correlación. |
| Esta sesión, baseline positivo | "Restaurar ensureProfile reproduce el bug" | Bug volvió EN PÁGINAS ADMIN ESPECÍFICAS solamente (users, whatsapp, audit, holidays). | El bug es LOCALIZADO a admin queries, no global. |
| Esta sesión, **bisección dentro de ensureProfile** | "ensureProfile en listener es el problema, no en init" | **Fix funcionando**: 15+ min sin un solo cuelgue. | ✅ Causa raíz aislada con causación, no correlación. |

---

## Estado del código (uncommitted en `clean-supabase-rebuild`)

### A. El fix real (mínimo, 7 líneas)

**Archivo:** `src/store/authStore.ts` líneas 133-152
- ✅ `ensureProfile()` se mantiene en `initializeAuth()` (línea 127): corre UNA vez al arrancar.
- ❌ `ensureProfile()` removido de `onAuthStateChange` listener: el callback ya no hace queries al SDK.

### B. Código diagnóstico que hay que LIMPIAR antes del commit final

Estos cambios fueron herramientas para llegar al diagnóstico. NO son parte del fix:

1. **`src/hooks/useProjects.ts`** — agregados hooks `useProjectsNoRQ` y `useProjectsNoSDK`. Hay que **borrarlos** y dejar solo el `useProjects` original.

2. **`src/pages/Projects.tsx`** — cambiado para usar `useProjectsNoSDK`. Hay que **revertir al `useProjects` original**. También limpiar las líneas `void useProjects; void useProjectsNoRQ;`.

3. **`src/components/layout/NotificationBell.tsx`** — el comentario del paso 2A.1 (reactivado pero con texto diagnóstico viejo). Hay que **limpiar el comentario** y dejar solo `useRealtimeNotifications();`.

4. **`src/lib/supabaseClient.ts`** — la instrumentación `instrumentedFetch` con `console.log` y `window.__SUPABASE_FETCH_LOG`. **Decisión a tomar**: ¿mantener como diagnóstico permanente, o limpiar? Tiene valor para debugging futuro pero ensucia los logs.

### C. Otros archivos modificados (no relacionados al fix de hoy)

Visibles en `git status`:
- `CLAUDE.md`, `docs/KNOWN_ISSUES.md` — del fix de `payment_type` Spanish→English.
- `src/components/finanzas/*`, `src/hooks/finanzas/usePayments.ts`, `src/pages/Pagos.tsx`, `src/schemas/payment.ts` — idem.
- `src/pages/settings/Audit.tsx` — migrado a useQuery con limit(50) en sesión anterior.

Esos ya están commiteados conceptualmente, hay que decidir si entran en este PR o en otro.

---

## Por qué el fix funciona — explicación técnica

El SDK Supabase JS usa un mutex interno para serializar operaciones de auth (refresh de token, fetch de sesión, etc.). Cuando `onAuthStateChange` dispara un callback:

1. SDK adquiere el mutex.
2. Ejecuta el callback con `(event, session)`.
3. Si **adentro del callback** hacés `await supabase.from(...)`, esa query ESPERA al mutex que ya está tomado por el callback.
4. El callback ESPERA a que el `await` termine.
5. → **Deadlock**: cada uno espera al otro.

El callback termina eventualmente (timeout interno de Supabase, o crash), pero mientras tanto todas las queries del SDK quedan colgadas. La página muestra spinner/skeleton para siempre.

**Por qué solo afecta admin queries:** las páginas admin disparan queries que requieren RLS check vía `get_my_role()`. Esa función internamente hace un select a `profiles`. Si justo en ese momento el callback de auth está corriendo (haciendo TAMBIÉN un select a profiles), las dos queries chocan en el mutex de auth → deadlock visible. Las páginas no-admin no piden `get_my_role()` con tanta frecuencia y zafan.

**Documentación oficial relevante:** Supabase docs recomiendan explícitamente "do not call any Supabase methods inside `onAuthStateChange` callbacks" — exactamente lo que estábamos haciendo en `authStore.ts:141`.

---

## Qué queda para cerrar (mañana)

### 1. Test largo de confianza
- **Quién:** usuario.
- **Cómo:** usar la app como un día de trabajo normal, 1-2 horas mínimo. Esperar al menos un token refresh (que ocurre ~50 min después de login).
- **Qué buscar:** cualquier cuelgue inesperado, especialmente en `/settings/users`, `/settings/audit`, `/settings/holidays`, WhatsApp. Esos eran los testigos.
- **Si pasa:** fix confirmado a largo plazo.
- **Si falla:** anotar exactamente cuándo (¿después de cuánto tiempo? ¿qué evento auth?), screenshot, mandar para próxima sesión.

### 2. Limpieza diagnóstica (sesión próxima)

Lista de cambios a revertir antes del commit final, en orden:

- [ ] Revertir `src/pages/Projects.tsx` para usar `useProjects` original (no `useProjectsNoSDK`).
- [ ] Borrar de `src/hooks/useProjects.ts` los hooks `useProjectsNoRQ` y `useProjectsNoSDK` y el import de `useEffect`/`useState`.
- [ ] Limpiar comentarios diagnósticos largos de `src/store/authStore.ts` (dejar solo un comentario corto explicando el anti-patrón).
- [ ] Limpiar comentarios diagnósticos de `src/components/layout/NotificationBell.tsx` (dejar la línea `useRealtimeNotifications();` sin el wall de comentario).
- [ ] Decidir destino de la instrumentación en `src/lib/supabaseClient.ts` (probable: borrar `instrumentedFetch` y `__SUPABASE_FETCH_LOG`; quedan en el git history si los necesitamos).

### 3. Commit limpio + PR

Después de la limpieza, el commit final debería tener EXACTAMENTE:
- 3-7 líneas modificadas en `src/store/authStore.ts`.
- Un comentario explicando por qué.
- Mensaje de commit del estilo: `fix(auth): no llamar SDK desde onAuthStateChange callback (Supabase deadlock conocido)`.

PR a `main` (vía la cuenta `accesos-seo`, recordá que auto-deploy está roto — chequear contra el SHA de Vercel actual).

### 4. Eliminar la posibilidad de regresión

Considerar agregar a `CLAUDE.md` o `CONVENTIONS.md` un párrafo:

> **Anti-patrón Supabase prohibido:** Nunca llamar métodos del cliente Supabase (`.from()`, `.rpc()`, `.storage`, etc.) dentro del callback de `supabase.auth.onAuthStateChange()`. Causa deadlock interno del SDK. Si necesitás hacer una query reactiva a cambios de auth, hacelo en un `useEffect` del componente que reaccione a cambios del store de auth, no dentro del callback.

---

## Archivos a leer si te perdés mañana

1. **Este doc** primero.
2. `docs/handover/2026-05-22_HANDOVER-MINIMIZATION-CONTINUATION.md` — contexto previo de la saga (puede estar desactualizado).
3. `src/store/authStore.ts` — el archivo del fix. Mirar líneas 126-152.
4. `docs/handover/2026-05-22_HANDOVER-CLEAN-REBUILD.md` y `_REBUILD-PLAN.md` — historia del rebuild original.

---

## Sospechas que NO probamos pero quedan flotando

- **¿`useRealtimeNotifications` también tiene un patrón parecido?** Su `.channel().subscribe()` con callback de `postgres_changes`... ¿llama métodos del SDK dentro? Vimos que su `payload` callback hace `queryClient.invalidateQueries(...)` — eso NO es SDK, es de React Query. Probablemente seguro. Pero conviene re-leer con cuidado.
- **¿Hay otros call sites de `onAuthStateChange` en el proyecto?** Hicimos grep solo del primario. Si hay más en otros providers o hooks, podrían tener el mismo bug.
- **¿La instrumentación `instrumentedFetch` debe quedarse permanente?** Es útil para debugging pero ensucia logs. Decisión pendiente.

---

## Cierre

Bug confirmado, fix funcionando, falta validación de largo plazo y limpieza para PR. Mañana es solo cleanup + verificación, no debugging nuevo (con suerte).

**Diff final esperado:** ~7 líneas en `authStore.ts`. **Tiempo invertido:** una semana y media de debugging, ~250K tokens en la sesión más larga.

*— Sesión 2026-05-22 noche. Claude Opus 4.7.*

---

## 📋 PROMPT COPY-PASTE PARA PRÓXIMA SESIÓN

Cuando arranques una nueva sesión con Claude Code (mañana o cualquier día siguiente), pegá ESTE texto verbatim como primer mensaje. Le da el contexto crítico para que NO repita errores:

```
Estoy trabajando en el CRM Innovar en:
C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main

Antes de hacer NADA, leé este archivo completo:
docs/handover/2026-05-22_FIX-CONFIRMED-AUTH-CALLBACK-DEADLOCK.md

CONTEXTO CRÍTICO QUE NO PODÉS IGNORAR:

1. Acabamos de resolver un bug que nos llevó UNA SEMANA Y MEDIA de debugging.
   Era un cuelgue cíclico silencioso en módulos admin (users, audit, holidays,
   WhatsApp). Causa raíz: un `await supabase.from(...)` dentro del callback de
   `onAuthStateChange` en `src/store/authStore.ts`. Anti-patrón documentado de
   Supabase JS que causa deadlock interno del SDK.

2. El fix está aplicado en `src/store/authStore.ts` (uncommitted en branch
   `clean-supabase-rebuild`). Son ~7 líneas. NO LAS TOQUES.

3. Cualquier cambio que propongas y que toque `authStore.ts`, login, sesión,
   roles, profile, tokens, o el callback de onAuthStateChange requiere que
   PARES, me lo digas, y esperes mi confirmación explícita ANTES de modificar.

4. NUNCA jamás llames métodos del cliente Supabase (.from, .rpc, .storage,
   .functions, .auth.*) adentro del callback de
   `supabase.auth.onAuthStateChange()`. Si necesitás reaccionar a cambios de
   auth para hacer queries, usá un useEffect en un componente que escuche el
   store de Zustand, NO el callback.

5. Pendientes inmediatos del fix antes de mergear:
   - Test largo (1+ hora cubriendo un token refresh natural ~50min).
   - Cleanup de código diagnóstico (useProjectsNoRQ, useProjectsNoSDK,
     comentarios largos en authStore.ts y NotificationBell.tsx, e
     `instrumentedFetch` en supabaseClient.ts).
   - Commit limpio (~7 líneas en authStore.ts) + PR a main.

6. Posible bug pendiente: WhatsApp no se está enviando al crear leads nuevos.
   Improbable que sea por nuestro fix (no tocamos backend/triggers/queue), pero
   chequear `notification_queue` antes de descartar conexión. Ver task #19 del
   plan.

Después de leer el handover y absorber el contexto, contestame con un resumen
de 3-5 líneas: qué entendiste del estado actual y qué propones como próximo
paso. NO arranques a editar código hasta que yo confirme.

Mi objetivo de mañana en adelante es agregar funcionalidades nuevas (no más
debugging). Cada vez que tu trabajo te lleve cerca del auth/profile/onAuth,
PARÁ y avisame antes de avanzar.
```

---

## 🚦 Regla de oro para sesiones futuras

> **Si una IA o dev rompe el fix de `authStore.ts` reintroduciendo `await supabase.<algo>` adentro de `onAuthStateChange`, el bug del cuelgue cíclico vuelve idéntico y otra vez perdés días enteros de trabajo.**

Esta regla quedó en:
- Este handover (acá).
- `feedback_supabase_no_sdk_in_onauth_callback.md` en la memoria persistente del usuario.
- `MEMORY.md` (índice de memoria) con marca ✅ y 🔴.

Si todas esas referencias se rompen alguna vez, este archivo es la fuente de verdad.

