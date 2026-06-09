# Handover — Minimización del frontend para aislar bug del cuelgue
**Fecha:** 2026-05-22 noche (continuación del rebuild)
**Sesión origen:** Claude Opus 4.7, ~250K tokens al cierre
**Para:** próxima sesión Claude en ventana fresca

---

## 0. INSTRUCCIONES METODOLÓGICAS (NO NEGOCIABLES)

El usuario fue explícito y reiteró durante toda la sesión:

1. **Solo datos verificables.** Cada afirmación debe venir con referencia: archivo:línea, comando ejecutado, screenshot del usuario, o output de DevTools. **NO opiniones disfrazadas de datos.** Si decís "creo que es X" eso es hipótesis, marcala como tal.
2. **NO parches.** El objetivo es **minimizar progresivamente el código del frontend** hasta aislar la causa raíz. Cada cambio debe REMOVER código, no agregar. Excepción permitida: instrumentación read-only que captura evidencia sin cambiar comportamiento.
3. **Hipótesis se prueban con data, no con código.** Antes de modificar nada, planteá experimento binario que descarte o confirme la hipótesis. Ejecutalo. Recibí la data del usuario. Recién entonces avanzá.
4. **El usuario NO es técnico.** Comandos que se le pasen deben indicar EXACTAMENTE dónde se ejecutan (DevTools Console, PowerShell, Supabase Dashboard, etc.). NO usar jerga sin definirla.
5. **El usuario va a estar largo tiempo sin estar disponible.** Cada paso del handover debe poder ejecutarse y validarse autónomamente. NO encadenar "te aviso cuando termine" — diseñar cada paso para que se complete en una interacción cerrada.

**Mi sesión cometió 2 errores que NO se deben repetir:**
- Agregué un timeout de 30s al fetch global de Supabase ("fix B.2") basado en hipótesis de HTTP/2 connection lock, sin data dura. El usuario me cortó correctamente. Lo reverti, mantengo solo la instrumentación read-only.
- Especulé varias veces ("creo que es B.1", "esto es HTTP/2 lock") antes de tener evidencia. El usuario me cortó. NO repetir ese patrón.

---

## 1. TL;DR — qué sabemos con data dura

| Componente | Estado | Evidencia (dato + fuente) |
|---|---|---|
| Tu PC / red del usuario | ✅ Sana | Fetch desnudo en MISMA pestaña colgada retornó `Promise: fulfilled` |
| Backend Supabase Innovar | ✅ Sano | API: `status=ACTIVE_HEALTHY`, ping=268ms, EXPLAIN ANALYZE de queries colgantes=0.089-0.104ms |
| Cliente Supabase SDK (fetch HTTP) | ✅ Funcional | `window.__SUPABASE_FETCH_LOG`: 8 fetches reales completaron OK durante el cuelgue, 0 pending, 0 errored |
| **React Query / hooks** | 🔴 **Donde está el bug** | TanStack DevTools: `Fetching=6` con `data=null` y `lastUpdated` viejo (~2h+); pero `window.__SUPABASE_FETCH_LOG` muestra 0 pending. **React Query reporta "fetching" sin que exista un fetch HTTP correspondiente.** |

**Causa raíz parcial confirmada con data:** Existe al menos una query de React Query (`["projects", {"status": null}]`) marcada en estado `fetching` que jamás recibió data, mientras el log de fetches HTTP demuestra que NO hay request real en vuelo. Esa disparidad es el síntoma central.

**Causa raíz exacta:** NO confirmada. Falta bisección entre "RQ marca fetching pero queryFn nunca ejecuta" vs "queryFn ejecuta pero SDK no resuelve la promise". El siguiente paso (sección 7) discrimina eso.

---

## 2. HECHOS verificables (con referencias)

### 2.1 Estado del repo Innovar
- **Ruta canónica:** `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
- **Branch actual:** `clean-supabase-rebuild` (creado desde master `a20e4fc`)
- **HEAD:** `7c088c8 refactor(supabase): clean rebuild capa auth/data — remove timeout layers`
- **Working tree uncommitted al cierre:**
  - `src/lib/supabaseClient.ts` — instrumentación `instrumentedFetch` agregada (read-only, NO cambia comportamiento)
  - `src/pages/settings/Audit.tsx` — migrado a `useQuery` con `.limit(50)`
  - 7 archivos del `payment_type` fix (CLAUDE.md, docs/KNOWN_ISSUES.md, src/components/finanzas/NewPaymentModal.tsx, src/components/finanzas/PaymentsList.tsx, src/hooks/finanzas/usePayments.ts, src/pages/Pagos.tsx, src/schemas/payment.ts)
- **Stashes residuales (no relevantes para este handover):** 3 stashes viejos
- **typecheck:** 32 errores (baseline pre-existente, NO regresiones del rebuild)
- **build:** OK 20.55s

### 2.2 Estado de Supabase Innovar (verificado via Management API)
- **Project ID:** `xdzbjptozeqcbnaqhtye`
- **Status:** `ACTIVE_HEALTHY`
- **Region:** us-west-2
- **Postgres version:** 17.6.1.104
- **Latencia de ping HTTPS desde la máquina del usuario:** 268ms total, 115ms connect, 83ms DNS (401 esperado por auth incorrecta — descarta red/firewall)

### 2.3 Queries diagnosticadas que cuelgan en frontend (todas instantáneas en DB)
| Tabla | Filas | EXPLAIN ANALYZE | Policy SELECT |
|---|---|---|---|
| `audit_logs` | 3 | 0.089ms | `get_my_role() = 'admin'` |
| `materials` | 0 | 0.104ms | `true` |
| `profiles` (usado por get_my_role) | 3 | trivial | — |

### 2.4 `get_my_role()` (función crítica)
```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$function$
```
**`SECURITY DEFINER` confirmado — saltea RLS de profiles → NO hay recursión RLS.**

### 2.5 Captura del usuario durante cuelgue (DevTools del navegador, screenshots en chat)
- **`window.__SUPABASE_FETCH_LOG` filtrado:**
  ```json
  { "total": 8, "pending": [], "errored": [] }
  ```
- **Fetch desnudo ejecutado en MISMA pestaña colgada durante el cuelgue:**
  ```javascript
  fetch('https://xdzbjptozeqcbnaqhtye.supabase.co/rest/v1/profiles?select=id&limit=1', { headers: { apikey: '...' } })
  ```
  Resultado: `Promise [[PromiseState]]: "fulfilled"` (visto en screenshot del usuario)
- **TanStack React Query DevTools panel (screenshot):**
  - Fresh: 0
  - **Fetching: 6**
  - Paused: 0
  - **Stale: 2**
  - Inactive: 0
- **Query específica colgada (panel de detalles desplegado):**
  - queryKey: `["projects", { "status": null }]`
  - fetchStatus: `fetching`
  - data: `null`
  - observers: 1
  - **lastUpdated: 19:00:00** (timestamp viejo — el usuario tomó screenshot a las 21:18, llevaba ~2h18m fetching)
- **Páginas observadas colgadas durante la sesión:**
  - `/settings/audit` (skeleton "Recuperando Historial de Auditoría")
  - `/settings/materials` (skeleton "Cargando Catálogo de Materiales")
  - `/settings/users` (skeleton "Cargando Directorio de Usuarios")
  - `/projects` (skeleton "Analizando Base de Datos de Proyectos")
  - En TODOS los casos: banner "Conectando con Innovar — espera un momento..." visible
  - En TODOS los casos: tras navegar a Dashboard u otra ruta, esa ruta cargó normal
  - El cuelgue es **cíclico**: módulo X carga bien, después se cuelga; navegás a otro y carga; volvés a X y a veces cuelga, a veces no.

### 2.6 Información de entorno del usuario
- **Browser:** Chrome (también en modo incógnito el bug se reproduce)
- **OS:** Windows 10 Pro
- **Path OneDrive:** sí (puede afectar git background, NO afecta el dev server según los hechos vistos)
- **El usuario reporta** problemas similares con otros editores AI (Codex OpenAI, OpenCode, Antigravity Google) — "React no carga información"
  - **Nota:** este factor NO es causal del bug de Innovar según la evidencia 2.5 — el fetch desnudo en su misma pestaña funciona. Si fuera entorno sistémico, el fetch desnudo también colgaría. Es coincidencia, no causa común.

---

## 3. Hipótesis DESCARTADAS con evidencia

| Hipótesis | Evidencia que la descarta |
|---|---|
| 3 capas de timeout (`fetchWithTimeout` 8s + `withTimeout` 10s + retry x2) estrangulaban queries | Removidas en commit 7c088c8. Bug persiste. |
| HTTP/2 connection lock / idle TCP zombie | `window.__SUPABASE_FETCH_LOG`: 0 pending. Browser NO tiene streams stuck. |
| JWT refresh token blocking del fetch | Los 8 fetches reales completaron. Fetch desnudo en pestaña colgada responde fulfilled. |
| CORS / red bloqueada / firewall | Idem anterior |
| Cold start Supabase free tier | Backend responde en 0.1ms; ping desde la máquina 268ms |
| Query mal escrita (SELECT * sin LIMIT) | Tabla `materials` tiene 0 filas; EXPLAIN 0.104ms. Aún así cuelga. La cantidad de filas no es la causa. |
| RLS recursiva en profiles vía `get_my_role()` | `get_my_role()` es `SECURITY DEFINER` → saltea RLS de profiles. Sin recursión. |
| Entorno del usuario (antivirus, extensiones, proxy) | Fetch desnudo desde MISMA pestaña en MISMO momento responde OK. Si fuera entorno, también colgaría. |
| Componente UI no actualiza aunque data llegó | Data sigue `null` en TanStack DevTools → la data nunca llegó al estado de RQ. |

---

## 4. Lo que el usuario quiere — método de minimización

**Objetivo único:** ir removiendo código del frontend hasta que el bug deje de reproducirse o hasta tener un caso mínimo. Cada paso descarta un sospechoso.

**El usuario ha pedido textualmente:**
> "Limpiar todo el código del frontend o parte de él para ir descartando si era el frontend o el backend."
> "No quiero estar arreglando con parches."
> "Vamos minimizando código del frontend para ir encontrando al culpable."

---

## 5. PRÓXIMO PASO EXACTO (no negociable, ejecutarlo primero)

**Bisección RQ vs SDK Supabase.**

El usuario debe reproducir el cuelgue en una página (típicamente `/projects` o `/settings/materials`). Una vez visible el spinner + banner "Conectando con Innovar":

### Instrucción al usuario (paso a paso)
1. Abrir DevTools (F12 si no está abierto) y verificar que el panel de TanStack React Query DevTools está visible (botón flotante en la esquina inferior izquierda de la app).
2. En el panel TanStack, buscar la query en estado `fetching` que corresponde a la página colgada (ej. `["projects", {"status": null}]`).
3. Click sobre esa query → se abre panel "Query Details" a la derecha.
4. En la sección "Actions" del panel, click en el botón **Refetch**.
5. Mantener abierta la pestaña Console del DevTools y mirar si aparecen líneas nuevas.

### Casos posibles (resultados binarios, descartan hipótesis)

**Caso A:** aparece en Console una línea tipo `[fetch#N] → GET v1/projects?...` seguida de `[fetch#N] ✓ 200 in XXXms` y la query sale del estado `fetching` → **la query estaba en limbo**: RQ la marcaba fetching sin ejecutar el queryFn. Bug en React Query lifecycle o en cómo el hook lo invoca.

**Caso B:** NO aparece NINGUNA línea nueva en Console (ni `→` ni `✓`) → **RQ no consigue invocar el queryFn**. Bug interno de RQ o conflicto con StrictMode/React 19/versión RQ.

**Caso C:** aparece `[fetch#N] → GET v1/projects?...` pero NUNCA aparece el `✓` correspondiente → **SDK Supabase recibe la promise pero no la resuelve**. Bug del cliente Supabase JS.

**Caso D:** aparece todo el flujo OK (igual que caso A pero la query sigue marcada fetching) → bug en cómo RQ procesa la respuesta. (Improbable, listo por completitud.)

**El siguiente paso del plan depende del caso resultante.** Ver sección 6.

---

## 6. PLAN DE MINIMIZACIÓN (orden estricto, cada paso es binario)

### Paso 1 — Bisección RQ vs SDK (sección 5)
Resultado A/B/C/D decide qué se ataca primero.

### Paso 2A (si caso A o B → React Query es sospechoso)
**Acción de minimización:** crear un hook alternativo `useProjectsNoRQ` en `src/hooks/useProjects.ts` que use solo `useState + useEffect + fetch directo al SDK Supabase` (sin React Query). Cambiar la página `src/pages/Projects.tsx` para usar ese hook en lugar de `useProjects`.

```typescript
// Bosquejo, no copiar literal — adaptar a tipos reales:
export function useProjectsNoRQ() {
  const [data, setData] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("projects").select(/*...*/).is("deleted_at", null);
      if (!cancelled) { setData(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return { data, loading };
}
```

**Test:** reproducir el escenario que causaba cuelgue.
- Si la página `/projects` deja de colgar → **React Query confirmado como culpable**. Avanzar a Paso 3.
- Si sigue colgando → RQ NO era la causa. Reset, volver al SDK.

### Paso 2C (si caso C → SDK Supabase es sospechoso)
**Acción de minimización:** reemplazar el SDK Supabase en `useProjects` por `fetch` directo al endpoint REST de PostgREST:

```typescript
queryFn: async () => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=*&deleted_at=is.null&is_archived=eq.false&order=created_at.desc`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  return await r.json();
}
```

**Test:** reproducir cuelgue.
- Si no cuelga → SDK confirmado. Avanzar a Paso 3.
- Si sí cuelga → SDK no era. Volver al setup original.

### Paso 3 — Confirmar y aislar más
Con el culpable identificado (RQ o SDK), seguir minimizando hasta encontrar el archivo/línea que dispara el bug. Si es RQ, probar versión anterior (`pin` específico en package.json). Si es SDK, idem.

### Paso 4 — Solo entonces decidir fix
Con causa raíz confirmada, evaluar opciones (downgrade, patch, workaround). NO parchar antes de este punto.

---

## 7. Comandos útiles para la próxima sesión

### 7.1 Comando para inspeccionar fetch log durante un cuelgue
**Dónde:** DevTools Console del browser, en el campo `>` al final.
```javascript
JSON.stringify({total: window.__SUPABASE_FETCH_LOG?.length, pending: window.__SUPABASE_FETCH_LOG?.filter(e => !e.completedAt).map(e => ({id:e.id, url:e.url, ageMs:Date.now()-e.startedAt})), errored: window.__SUPABASE_FETCH_LOG?.filter(e => e.error).map(e => ({id:e.id, url:e.url, error:e.error}))}, null, 2)
```

### 7.2 Comando para fetch desnudo desde la misma pestaña
**Dónde:** DevTools Console.
```javascript
const t0=Date.now();fetch('https://xdzbjptozeqcbnaqhtye.supabase.co/rest/v1/profiles?select=id&limit=1',{headers:{'apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkemJqcHRvemVxY2JuYXFodHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDU3MTQsImV4cCI6MjA5MTY4MTcxNH0.M4-nl-r-M3sMNGUoJoyRXar8dwdnUkAJGR9YGkV5bNk'}}).then(r=>r.text()).then(t=>console.log('OK',Date.now()-t0+'ms',t.slice(0,80))).catch(e=>console.log('ERROR',Date.now()-t0+'ms',e.message))
```
**NOTA:** la consola debe tener filtro "All levels" o "Info" activado (sino los `console.log` se ocultan — pasó al usuario en esta sesión).

### 7.3 Consultar Supabase Innovar directamente (NO via MCP — el MCP no tiene acceso)
**Dónde:** terminal Bash (foreground OK), en la ruta del proyecto.
```bash
cd "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"
TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env | sed 's/.*=//' | tr -d '"' | tr -d "'")
curl -s -X POST "https://api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"query":"SELECT count(*) FROM projects;"}'
```

### 7.4 Verificar typecheck y build (para validar minimizaciones)
**Dónde:** PowerShell o Bash en la ruta del proyecto.
```
npm run typecheck   # esperado: 32 errores baseline
npm run build       # esperado: success en ~20s
```

---

## 8. Files y referencias clave para retomar

### 8.1 Archivos donde está el bug (en orden de relevancia)
- [src/hooks/useProjects.ts:24](src/hooks/useProjects.ts:24) — hook que ahora mismo tiene la query atascada
- [src/hooks/useMaterials.ts:33](src/hooks/useMaterials.ts:33) — mismo patrón, también cuelga
- [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts) — cliente SDK + instrumentación read-only
- [src/App.tsx](src/App.tsx) — config global QueryClient (retry:1, retryDelay:2000)

### 8.2 Documentos previos de esta saga
- [docs/handover/2026-05-22_HANDOVER-CLEAN-REBUILD.md](docs/handover/2026-05-22_HANDOVER-CLEAN-REBUILD.md) — contexto de por qué se hizo el rebuild
- [docs/handover/2026-05-22_REBUILD-PLAN.md](docs/handover/2026-05-22_REBUILD-PLAN.md) — plan paso a paso del rebuild
- [docs/handover/2026-05-22_REBUILD-RESULTADO.md](docs/handover/2026-05-22_REBUILD-RESULTADO.md) — qué quedó tras el rebuild
- [docs/handover/2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md](docs/handover/2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md) — diagnóstico previo de la saga del JWT
- **Este doc:** `docs/handover/2026-05-22_HANDOVER-MINIMIZATION-CONTINUATION.md`

### 8.3 Convenciones del entorno (no obviar)
- **No correr `git`, `npm run dev`, deploys en background sobre OneDrive paths** — los hooks/timeouts del entorno se quejan. Foreground está OK.
- **Supabase MCP NO tiene acceso a proyecto Innovar** (`xdzbjptozeqcbnaqhtye`) → usar Management API con `SUPABASE_ACCESS_TOKEN` del `.env`.
- **El usuario corre `npm run dev` manualmente.** No iniciarlo desde la sesión. Pedirle que lo haga si está parado.

---

## 9. Compromiso de la próxima sesión

Al retomar:
1. **Leer este doc completo antes de cualquier acción.**
2. **NO agregar código** salvo instrumentación read-only que capture evidencia.
3. **No proponer fix** hasta tener data del caso A/B/C/D del paso 1.
4. **Pedir al usuario UN comando o UNA acción por interacción** — no más. Esperar evidencia. Entonces avanzar.
5. **Marcar explícitamente** cada vez que algo es hipótesis vs dato.
6. Al cierre de cada paso, actualizar este handover (o crear `2026-05-23_HANDOVER-MINIMIZATION-STEP-N.md` con los nuevos datos), para que cada IA sucesiva no pierda evidencia.

---

## 10. Fin

El usuario lleva días con este bug y ya pidió dos veces que dejemos de especular. **La metodología pesa más que cualquier fix individual.** Si la próxima sesión quiere atajos o "ya sé qué es", debe leer la sección 0 de nuevo.

*— Sesión origen 2026-05-22 noche, Opus 4.7, 250K tokens al cierre.*
