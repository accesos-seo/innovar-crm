# Diagnóstico — Bug "módulos cuelgan" / token refresh / conexión Supabase
**Fecha:** 2026-05-22 (sesión autónoma)
**Agente:** Claude Opus 4.7
**Habilidad usada:** `/diagnose` (metodología de 6 fases)
**Tipo:** Evidence-gathering puro — cero modificación de código
**Para abrir:** lee este doc COMPLETO antes de tocar nada relacionado a auth/Supabase

---

## TL;DR — Lo que descubrí

| Pregunta del plan | Respuesta corta |
|---|---|
| 1. ¿El fix del 2026-05-19 está realmente en producción? | **SÍ**, y MÁS — producción corre los fixes del **2026-05-20** que son más completos. |
| 2. ¿El síntoma actual es el mismo bug, una regresión, o uno nuevo? | **DEPENDE de dónde lo veas** — hay dos mundos paralelos (ver §3) |
| 3. ¿Causa raíz confirmada con evidencia? | **SÍ** — token huérfano legacy `sb-xdzbjptozeqcbnaqhtye-auth-token` (no es teoría, está documentado en el commit `eab7382`) |
| 4. ¿Cuántos bugs distintos hay? | **3 — pero solo 1 es el del cuelgue** (ver §4) |
| 5. ¿Opciones de fix priorizadas? | Ver §7 — recomiendo opción B (merge selectivo) |

**El hallazgo más importante:** la rama `master` y la rama deployed (`claude/continue-crm-innovar-r22VQ`) son dos mundos paralelos. Producción tiene fixes que master no tiene. Master tiene features que producción no tiene. Esta divergencia es probablemente la causa de la confusión "¿por qué a veces sí y a veces no?".

---

## 1. Metodología y limitaciones

### Lo que pude verificar (evidencia objetiva)
- ✅ Código actual en working tree, master y rama lateral
- ✅ Historia completa de commits y branches via `git`
- ✅ Estado de deploys en Vercel via API
- ✅ Estado de DB Innovar via Supabase Management API (RLS, schema, row counts)
- ✅ Diffs exactos entre lo que está deployed y lo que está en master

### Lo que NO pude verificar (requiere acción del usuario)
- ❌ Reproducción en vivo del bug
- ❌ Estado del localStorage en el browser del usuario AHORA
- ❌ HAR file / Network tab del request que cuelga
- ❌ Si el usuario reporta el bug desde producción o desde `npm run dev` local

Las hipótesis abajo dependen de cuál de estos dos escenarios estamos.

---

## 2. Evidencia clave recolectada

### 2.1 — Producción está en una rama lateral, NO en master

`crm-innovar-app-2026.vercel.app` (alias raíz, verificado vía Vercel API) apunta a:

```
deployment:  dpl_4MrWxayDaYD8drYZPfE7iZ4QT8QR
state:       READY · PROMOTED
created:     2026-05-20 16:22 UTC (hace 2 días)
commit:      1be513d32905ea15e5c0f3c841ad8d831431d189
message:     fix(frontend): eliminar race conditions globales que causaban timeouts aleatorios
branch:      claude/continue-crm-innovar-r22VQ   ← NO master
deploy via:  CLI (no auto-deploy)
```

### 2.2 — Master diverge de la rama deployed en 2 dimensiones

```
master (HEAD a20e4fc)
├─ TIENE: Slice 1 (Lead→Project data skeleton)
├─ TIENE: Slice 2 (cutover Leads→opportunities con feature flag)
├─ TIENE: payment_type fix (en working tree, sin commit)
├─ NO TIENE: orphan token cleanup (sb-{ref}-auth-token)
├─ NO TIENE: JWT-decode-at-mount check
├─ NO TIENE: proactive getSession() on first timeout
├─ NO TIENE: deduplicación de onAuthStateChange listener
├─ NO TIENE: StrictMode-only-in-dev
└─ NO TIENE: toast visible "Tu sesión expiró"

claude/continue-crm-innovar-r22VQ (HEAD 1be513d) ← DEPLOYED
├─ TIENE: TODOS los fixes anteriores
├─ NO TIENE: Slice 1
├─ NO TIENE: Slice 2 / opportunities
└─ NO TIENE: payment_type fix
```

### 2.3 — Stats del diff master ↔ side branch

59 archivos diferentes, 1873 inserciones, 7964 deleciones. Las deleciones grandes son los archivos de opportunities (`useOpportunities.ts`, `OpportunityDetail.tsx`, `LeadsLegacy.tsx`, etc.) que existen en master pero NO en la rama deployed.

### 2.4 — Working tree y stashes

```
Working tree (sin commit):       payment_type fix + docs updates (2026-05-22)
stash@{0} on master:             31 archivos, feature de "active appointment" en agenda
stash@{1} on slice-1:            pre-merge WIP
stash@{2} on otra rama:          ONBOARDING.md changes
```

### 2.5 — Estado de la DB Innovar (verificado via Management API)

| Tabla | RLS | Filas |
|---|---|---|
| clients | ✅ ON | 14 |
| projects | ✅ ON | 7 |
| quotations | ✅ ON | 9 |
| materials | ✅ ON | 0 |
| holidays | ✅ ON | 18 |
| pricing_catalog | ✅ ON | 57 |
| profiles | ✅ ON | 3 |
| opportunities | ✅ ON | 0 |
| tasks | ✅ ON | — |

Hipótesis muertas:
- ❌ "RLS desactivada en producción" — todas las tablas tienen RLS ON
- ❌ "Falta `data_origin` / `status` / `urgency` en clients" — todas existen (verificado con `information_schema.columns`)
- ❌ "Tabla `opportunities` no existe" — existe y tiene RLS

### 2.6 — Historia de fixes del bug del cuelgue (orden cronológico)

| Commit | Fecha | Rama | En master? | En prod? |
|---|---|---|---|---|
| `01f7993` retry + timeouts + diagnostic | 2026-05-19 | master | ✅ | ✅ |
| `2e18c26` recovery on 3 timeouts | 2026-05-19 | master | ✅ | ✅ |
| `0480cfd` 400 detection + queryCache count | 2026-05-19 | master | ✅ | ✅ |
| `b807e32` 30s window + hard redirect | 2026-05-19 | master | ✅ | ✅ |
| `6f5c55e` skip recovery on password grant | 2026-05-19 | master | ✅ | ✅ |
| `e527c82` JWT decode at mount + first timeout | 2026-05-20 | **side** | ❌ | ✅ |
| `eab7382` **orphan token cleanup** ← causa raíz REAL | 2026-05-20 | **side** | ❌ | ✅ |
| `1be513d` race conditions globales | 2026-05-20 | **side** | ❌ | ✅ |

---

## 3. Los DOS mundos paralelos (clave para entender el síntoma)

### Mundo A — Producción (`crm-innovar-app-2026.vercel.app`)

- Corre código del 2026-05-20 (rama lateral)
- Tiene los 3 fixes más profundos del cuelgue (B.1 + B.2 + B.4 + race conditions)
- **NO tiene** Slice 2 (Leads sigue siendo el flujo viejo basado en `clients`)
- **NO tiene** la renombrada de "Directorio → Clientes" en sidebar
- Si el usuario ve el bug aquí → es un cuelgue NUEVO, distinto al del 19/20 de mayo

### Mundo B — Local (`npm run dev` desde master)

- Corre código del 2026-05-22 (master)
- Solo tiene los fixes del 2026-05-19 (interceptor de console.error + recovery por 3 timeouts en 30s)
- Tiene Slice 1 + Slice 2 (Leads opportunities-based con feature flag)
- Tiene el payment_type fix en working tree
- Si el usuario ve el bug aquí → **es REGRESIÓN del bug del 2026-05-20** (los fixes profundos no están)

**Diagnóstico operativo:** dependiendo de dónde el usuario haya estado probando, el sistema le da una respuesta distinta. Eso explica la sensación de "una y otra vez intentamos pero no se resuelve".

---

## 4. Cuántos bugs distintos hay

### Bug #1 — Cuelgue por token huérfano legacy 🔴 (el que el usuario refiere)
- **Estado**: resuelto en producción 2026-05-20 con `eab7382`. NO resuelto en master.
- **Causa raíz**: en versiones tempranas la app no tenía `storageKey: 'innovar-auth-token'`. El SDK guardaba el token con el nombre default `sb-xdzbjptozeqcbnaqhtye-auth-token`. Al agregar el storageKey custom, los browsers de usuarios existentes mantuvieron AMBOS tokens. El default vence con el tiempo, el SDK intenta usarlo internamente, se cuelga 10s sin emitir error legible.
- **Fix conocido**: borrar el orphan token al cargar `supabaseClient.ts`.
- **Evidencia**: documentado en commit `eab7382` con captura del localStorage del usuario que tenía AMBOS tokens.

### Bug #2 — `payment_type` español/inglés 🟡 (independiente)
- **Estado**: fix en working tree (NewPaymentModal.tsx, PaymentsList.tsx, usePayments.ts, payment.ts, Pagos.tsx). Sin commit.
- **Documentado** en [docs/KNOWN_ISSUES.md](../KNOWN_ISSUES.md) y [CLAUDE.md](../../CLAUDE.md)
- **No tiene relación** con el cuelgue del token.

### Bug #3 — Divergencia master ↔ producción 🟠 (organizacional)
- **Estado**: ACTIVO y es la causa de la confusión actual.
- **No es bug funcional** sino de proceso: las dos ramas no se sincronizaron, y cada nueva sesión de Claude trabajó sobre una distinta sin reconciliar.
- **Manifestación**: cuando el usuario hace `npm run dev` ve un comportamiento, cuando abre prod ve otro. Genera la falsa percepción de "nunca se resuelve".

---

## 5. Hipótesis ranked y falsables (Fase 3 de /diagnose)

| # | Hipótesis | Probabilidad | Test falsable |
|---|---|---|---|
| H1 | El usuario reporta el bug desde local (`npm run dev` sobre master), que NO tiene los fixes del 20/05 | **🔴 95%** | Preguntar: ¿el bug es en `crm-innovar-app-2026.vercel.app` o en `localhost:5173`? Si dice "local" → confirmado |
| H2 | El orphan token volvió a aparecer en el browser del usuario (limpieza está, pero algo lo reintroduce) | 🟡 10% | DevTools → Application → Local Storage en prod. Si existe `sb-xdzbjptozeqcbnaqhtye-auth-token`: H2 viva. Si no: H2 muerta |
| H3 | Slice 2 cutover hizo un cambio que afecta el flujo de auth (authStore.ts diff vs side branch) | 🟡 15% | Comparar `authStore.ts` master vs deployed — ya hecho: master tiene 1 listener menos. No es la causa pero confirma divergencia |
| H4 | Hay un cuelgue NUEVO en prod no relacionado al token (red, RLS, query lenta) | 🟢 5% | Necesita HAR file de Network tab — pendiente del usuario |
| H5 | El feature flag de Slice 2 hace que la Leads page consulte `opportunities` (tabla con 0 rows, posibles policies faltantes) y eso parece "cuelgue" | 🟢 5% | Verificar policies de `opportunities` + revisar `src/lib/features.ts` |

**Hipótesis dominante:** H1. El usuario ha estado debugueando en local sobre master, donde NO están los fixes del 20/05. Cada nueva sesión de Claude:
1. Lee handovers viejos (que dicen "resuelto")
2. No se entera de que producción y master divergieron
3. Re-investiga desde cero
4. Llega a las mismas conclusiones que ya estaban en la rama lateral
5. Pero no las aplica a master (no las ve)

---

## 6. ¿Por qué cada agente AI llegó al "resuelto" sin que lo estuviera?

Esto explica los "demasiados intentos" que mencionó el usuario:

1. **2026-05-19 (sesión Sonnet 4.7)**: identificó "JWT stale" como hipótesis. Aplicó parche B.0 (interceptor console.error). Marcó como tentativamente resuelto.
2. **2026-05-19 tarde (Opus 4.7, cierre)**: confirmó vía incógnito que el fix B.0 funcionaba para sesiones nuevas. Marcó como ✅ RESUELTO en handover.
3. **2026-05-20 (Opus 4.7, nueva sesión)**: bug REAPARECIÓ tras horas de uso. Identificó que B.0 no era suficiente. Aplicó B.1+B.2+B.3 (JWT decode at mount, proactive getSession, toast). Deploy a prod. Marcó "en prueba".
4. **2026-05-20 tarde (misma sesión)**: bug REAPARECIÓ. Inspeccionó localStorage del usuario directamente, encontró el orphan token. Aplicó B.4 (orphan cleanup). Deploy. Marcó "fix de raíz aplicado, en prueba por usuario".
5. **2026-05-20 tarde-tarde**: aplicó fix #5 (race conditions globales — StrictMode, doble listener, getSession paralelo). Deploy `1be513d`. **Último deploy de producción hasta hoy.**
6. **2026-05-21 — 2026-05-22 (otras sesiones)**: arrancaron desde master, NO sabían de la rama lateral, hicieron Slice 1, Slice 2, payment_type fix. Master diverge cada vez más de prod.
7. **Hoy (2026-05-22)**: usuario reporta "el bug persiste". Quien debuguea ve master code (sin fixes) y vuelve a teorizar desde cero.

**El loop infinito no es del bug. Es de la documentación + la divergencia git.**

---

## 7. Opciones de fix priorizadas (decisión del usuario)

### 🥇 Opción B — Merge selectivo de los fixes de auth a master (RECOMENDADA)

**Qué se hace:**
1. Cherry-pick (o aplicar manualmente) los 3 commits clave de `claude/continue-crm-innovar-r22VQ`:
   - `e527c82` — JWT decode at mount + first timeout check
   - `eab7382` — orphan token cleanup
   - `1be513d` — race conditions (StrictMode + doble listener + getSession paralelo)
2. Resolver conflictos posibles en `authStore.ts` (Slice 2 lo tocó)
3. Deploy de master a prod
4. Validar reproducibilidad del bug (debería estar muerto)

**Pro:** preserva Slice 1+2, preserva fixes de auth, master = prod por primera vez en una semana.
**Contra:** requiere resolver merge conflicts en authStore.ts manualmente. Esfuerzo: 30-60 min.
**Riesgo:** medio-bajo. Los archivos en conflicto son acotados.

### 🥈 Opción C — Reset quirúrgico desde la rama deployed (lo que propuse en la conversación)

**Qué se hace:**
1. Crear rama `clean-data-layer` desde `claude/continue-crm-innovar-r22VQ` (la deployed)
2. Re-aplicar Slice 1 y Slice 2 encima de los fixes de auth
3. Resolver el payment_type fix en el camino
4. Deploy y validar

**Pro:** empieza desde el código MÁS estable (el que prod ya valida).
**Contra:** re-implementar Slice 1+2 es duplicar trabajo que ya está hecho en master. 3-5 días.
**Recomendado solo si la opción B revela tantos conflictos que sea más barato re-aplicar features.**

### 🥉 Opción A — Deploy master tal cual está, ver qué pasa

**Qué se hace:**
1. `npx vercel --prod` desde master (con payment_type fix committed o no, decidir)

**Pro:** 5 minutos.
**Contra:** GARANTIZADO que el bug del cuelgue vuelve a producción (los fixes del 20/05 no están en master).
**Recomendado:** NO.

### Opción D — Hacer nada hasta tener evidencia fresh del bug en vivo

**Qué se hace:**
1. Cuando el usuario vuelva, hacer Fase 2 del `/diagnose` (reproducir): pedir incógnito, HAR file, localStorage dump.
2. Si el bug es solo en local: confirma H1, ir a Opción B.
3. Si el bug es en prod: hipótesis nueva, investigar antes de actuar.

**Pro:** evita tocar nada sobre suposiciones.
**Contra:** demora 1-2 días más.
**Recomendado:** combinar con B — preparar la opción B pero ejecutarla después de confirmar H1.

---

## 8. Fase 2 — Plan de reproducción (para cuando el usuario vuelva)

Estas son las preguntas y pasos que cierran el diagnóstico:

### 8.1 — Pregunta crítica
**¿Donde ves el bug? `crm-innovar-app-2026.vercel.app` o `localhost:5173` con `npm run dev`?**

### 8.2 — Si dice "en producción"
1. Abrir DevTools → Application → Local Storage → `https://crm-innovar-app-2026.vercel.app`
2. Verificar: ¿hay clave `sb-xdzbjptozeqcbnaqhtye-auth-token`? Debería NO existir (el código deployed la borra al cargar).
3. Si existe: tomar screenshot, anotar `expires_at` del valor.
4. Network tab → reproducir el cuelgue → exportar HAR
5. Console tab → screenshot completo durante el cuelgue
6. Reportar resultado.

### 8.3 — Si dice "en local"
1. CONFIRMADO H1. No hay nada que reproducir.
2. Ejecutar Opción B (merge selectivo).
3. Probar de nuevo en local.
4. Probar en incógnito tras deploy.

### 8.4 — Si dice "en ambos"
1. Es probable que en local sea H1 (master sin fixes) y en prod sea otra cosa.
2. Hacer 8.2 para el caso de prod, marcar como "bug nuevo" si la cleanup del orphan no se está ejecutando.

---

## 9. Archivos clave referenciados en este diagnóstico

### Estado actual (master)
- [src/lib/supabaseClient.ts](../../src/lib/supabaseClient.ts) — 190 líneas, fixes 2026-05-19 únicamente
- [src/store/authStore.ts](../../src/store/authStore.ts) — 1 listener (no consolidado con supabaseClient)
- [src/main.tsx](../../src/main.tsx) — StrictMode siempre activo
- [src/App.tsx](../../src/App.tsx) — `runConnectionDiagnostic` se ejecuta auto a 1.5s en dev
- [src/hooks/useLeads.ts:34-37](../../src/hooks/useLeads.ts) — query a `projects` antes de `clients` (dependencia oculta)
- [src/hooks/useClients.ts:22-25](../../src/hooks/useClients.ts) — misma dependencia oculta a `projects`
- [src/lib/timeout.ts](../../src/lib/timeout.ts) — `withTimeout(10000ms)`
- [src/lib/connection-diagnostic.ts](../../src/lib/connection-diagnostic.ts) — herramienta en consola

### Versión deployed (rama `claude/continue-crm-innovar-r22VQ`)
- `src/lib/supabaseClient.ts` — 290+ líneas, fixes 2026-05-20 (B.1+B.2+B.3+B.4 + race conditions)
- `src/store/authStore.ts` — listener consolidado con resetTimeoutTracking()
- `src/main.tsx` — StrictMode solo en dev
- `HandOver/STATE-OF-SYSTEM-2026-05-20.md` — fuente de verdad de esa sesión (no existe en master)
- `HandOver/CONTINGENCIA-TOKEN-NO-EXPIRA.md` — runbook por si el bug recurre

### Historial completo de fixes del cuelgue
Cronología detallada en §2.6 de este doc.

---

## 10. Lo que no hice y por qué (transparencia)

- **No modifiqué ningún archivo** (el plan era cero modificación)
- **No hice commits, pushes, deploys** (el plan era cero acciones destructivas)
- **No probé reproducir el bug** (el usuario está fuera; reproducir requiere browser)
- **No instalé instrumentation nueva** (no es necesario — los logs existentes en supabaseClient.ts y connection-diagnostic.ts son suficientes cuando se reproduzca)
- **No ejecuté `Ctrl+Shift+R` ni Clear Site Data** (es del usuario)

---

## 11. Próximo paso recomendado

Cuando el usuario vuelva:

1. Leer la pregunta crítica de §8.1
2. Confirmar H1 (90% likely)
3. Ejecutar Opción B (§7) — preparar PR con cherry-pick de los 3 commits clave
4. Resolver conflictos en authStore.ts si los hay
5. Deploy a Vercel
6. Validar reproducibilidad en incógnito

Tiempo estimado: 1-2 horas si H1 se confirma, 1-2 días si hay que hacer Opción C.

---

*Fin del diagnóstico. Generado por sesión autónoma de Claude Opus 4.7 el 2026-05-22.*
