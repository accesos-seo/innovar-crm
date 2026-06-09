# Handover — Clean rebuild de la capa Supabase
**Fecha:** 2026-05-22 (noche)
**Sesión origen:** Claude Opus 4.7 (autónoma + interactiva, ventana ~302K tokens al cierre)
**Para:** próxima sesión Claude en ventana fresca
**Tipo:** Handover ejecutivo — todo lo que necesitás para arrancar el rebuild sin leer el resto

> **LEÉ ESTE DOC PRIMERO Y COMPLETO.** Luego andá a [2026-05-22_REBUILD-PLAN.md](2026-05-22_REBUILD-PLAN.md) para los comandos paso a paso.

---

## 1. TL;DR — Estado y decisión

| Tema | Estado |
|---|---|
| Bug del cuelgue de módulos | 🔴 **PERSISTE, es cíclico y aleatorio** — usuario ya lleva días con esto |
| Fixes del 2026-05-20 aplicados a master via cherry-pick (sesión actual) | ✅ Aplicados en rama `test-auth-fixes-local`, validados via Tests 1+2 (JWT vencido + orphan token) |
| Decisión consensuada con usuario | **Reset / clean rebuild** de la capa Supabase. Los fixes actuales son insuficientes Y posiblemente parte del problema (sobre-protección de timeouts estrangula queries lentas-pero-válidas). |
| Próxima sesión (vos) | Ejecutar el rebuild siguiendo [2026-05-22_REBUILD-PLAN.md](2026-05-22_REBUILD-PLAN.md) en una rama nueva, sin tocar master |
| Restricción importante | **NO ejecutes git/npm en background sobre OneDrive** — CLAUDE.md lo prohíbe. Foreground está OK. |

---

## 2. Contexto cronológico (qué intentó cada sesión)

Para evitar repetir errores de sesiones previas:

| Fecha | Sesión | Qué hizo | Resultado |
|---|---|---|---|
| 2026-05-19 | Sonnet 4.7 | Interceptor `console.error` para "Refresh Token Not Found" en `supabaseClient.ts`. Reducción de timeouts. Desactivación temporal de RLS. | Bug persistía. RLS fue reactivada al día siguiente. |
| 2026-05-19 tarde | Opus 4.7 cierre | Validó vía incógnito que sesiones nuevas funcionaban. Marcó "resuelto". | ❌ Falsamente cerrado. Bug volvió en horas. |
| 2026-05-20 | Opus 4.7 | Fix B.1 (JWT decode at mount), B.2 (proactive getSession on first timeout), B.3 (toast visible). Deploy a Vercel desde rama `claude/continue-crm-innovar-r22VQ`. | Bug volvió. |
| 2026-05-20 tarde | Misma sesión | Encontró el orphan token (`sb-{ref}-auth-token` legacy). Fix B.4 (cleanup orphan). Deploy. | Marcado "fix de raíz en prueba". |
| 2026-05-20 noche | Misma sesión | Race conditions fix (commit `1be513d`): StrictMode dev-only, listener consolidado, getSession no más paralelo. Deploy. | Sesión cerró con "en prueba". |
| 2026-05-20 → 22 | Otras sesiones | Slice 1 + Slice 2 (Lead→Project + opportunities) sobre master. NUNCA MERGEARON los fixes del 20/05. | Master diverge de prod. |
| 2026-05-22 (esta) | Opus 4.7 | (1) Diagnóstico completo identificó la divergencia master vs prod. (2) Cherry-pick de los 3 fixes del 20/05 sobre rama `test-auth-fixes-local`. (3) Tests 1+2 pasaron empíricamente. (4) Usuario reporta que el cuelgue cíclico PERSISTE incluso con todos los fixes. | Confirmamos: **hay un bug más profundo que los fixes del 20/05 no resuelven.** Posiblemente CAUSADO POR los fixes. |

---

## 3. El verdadero diagnóstico (lo que sabemos ahora)

### Síntoma reportado por el usuario (textual)
> "Esto es cíclico: siempre sucede. Estoy navegando perfectamente, no pasa nada. Luego se bloquea una zona, me saca, y al volver a iniciar, luego me puede bloquear cualquier zona del proyecto. No se trata de una categoría: en cualquier momento deja de funcionar cualquier categoría, y siempre está pasando eso."

Observado en pantalla durante esta sesión:
- `/projects` → cargó pero con banner "Conectando con Innovar" >4s
- `/finanzas/gastos` → skeleton perpetuo → tras ~1 min lo sacó a login automáticamente → reloguea → entra
- `/clients` → cards superiores cargaron (count queries), tabla inferior se quedó en skeleton

### Por qué los fixes del 20/05 no son suficientes

Los 3 fixes (`e527c82`, `eab7382`, `1be513d`) atacan **token state**:
- B.1: JWT vencido en localStorage
- B.4: token huérfano legacy
- Race conditions de listeners + StrictMode

Pero el bug actual NO es token state. Pruebas:
1. Tras login fresco, navegación funciona varios clicks
2. Sesión es válida (cards cargan, queries simples responden)
3. Luego una query específica se cuelga, sin error visible en console
4. Las cards (count queries) cargan; las tablas (filtered + JOINed queries) son las que cuelgan

### Hipótesis dominante (la del rebuild)

**Los fixes del 20/05 introdujeron 3 capas de timeout en cascada que estrangulan queries lentas-pero-legítimas:**

```
[capa 1] fetchWithTimeout         → abort a 8s
[capa 2] withTimeout              → reject a 10s
[capa 3] React Query retry: 2     → backoff 3s, 6s, hasta 10s
```

Una query que toma 12s legítimamente (cold-start Supabase free tier, RLS pesada, JOIN anidado, lo que sea) muere en capa 1 a los 8s. La capa 2 ve AbortError y rechaza. Capa 3 reintenta. Y así. Después de 3 timeouts en 30s, el recovery automático fuerza signOut → kick a login.

**El usuario perceives un "cuelgue" porque la query VA a responder, pero la matamos antes.**

Esto explica:
- Por qué es cíclico (cada vez que una query toca un endpoint lento, repite el ciclo)
- Por qué pasa en módulos distintos (cualquier tabla con query compleja califica)
- Por qué cards funcionan y tablas no (cards = COUNT simple; tablas = SELECT con JOIN/IN/filtros)
- Por qué no hay errores claros en console (los timeouts se silencian al ser parte del flujo de recovery)

### Lo que el rebuild prueba/refuta

Si removemos las 3 capas y queries lentas funcionan (toman 15s pero responden) → confirmamos hipótesis.
Si removemos las 3 capas y queries siguen colgando indefinidamente → es un problema más profundo (Supabase free tier, red, RLS recursiva). **Pero al menos lo aislamos.**

### Hipótesis alternativas que también vale evaluar

1. **Supabase free tier rate-limiting o cold-start agresivo.** El proyecto Innovar (`xdzbjptozeqcbnaqhtye`) podría estar en free tier que ralentiza ciertos endpoints. Validar con dashboard de Supabase → Reports → Performance.

2. **RLS policies pesadas en tablas específicas.** Si `profiles_admin_all` usa `get_my_role()` que consulta `profiles` recursivamente, queries que JOIN contra profiles pagan ese costo en cada fila. Ya documentado en handover del 19/05 sección 3.5.

3. **Connection pool exhausted.** Free tier Supabase tiene ~60 conexiones. Si cada query mantiene conexión > tiempo razonable, se acumulan.

---

## 4. Estado del repo al cierre de esta sesión

### Branches relevantes (en orden de relevancia)
```
master                                   a20e4fc  ← código base (Slice 1+2, sin auth fixes)
test-auth-fixes-local                    bc87231  ← rama actual con cherry-picks aplicados. NO TOCAR.
                                                    Sirve como referencia: "esto es lo que NO funcionó".
origin/claude/continue-crm-innovar-r22VQ 1be513d  ← rama deployed en producción 2026-05-20
```

### Working tree (HEAD = `test-auth-fixes-local`)
```
Modified (payment_type fix del 22/05, NO commiteado):
  CLAUDE.md
  docs/KNOWN_ISSUES.md
  src/components/finanzas/NewPaymentModal.tsx
  src/components/finanzas/PaymentsList.tsx
  src/hooks/finanzas/usePayments.ts
  src/pages/Pagos.tsx
  src/schemas/payment.ts

Untracked:
  docs/handover/2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md
  docs/handover/2026-05-22_OPCION-B-RUNBOOK.md
  docs/handover/2026-05-22_STATE-WHEN-YOU-RETURN.md
  docs/handover/2026-05-22_HANDOVER-CLEAN-REBUILD.md   ← este doc
  docs/handover/2026-05-22_REBUILD-PLAN.md             ← plan ejecutable
  supabase/
```

### Stashes (5 totales, ninguno hay que tocar)
```
stash@{0}: On master: wip-user-changes-eol-and-real-2026-05-22   ← agenda WIP del usuario
stash@{1}: On feature/slice-1-data-skeleton: ...                 ← histórico de Slice 1
stash@{2}: On claude/elegant-hawking-F0ptO: ...                  ← respaldo del 22/05
```

### Estado de la DB Innovar (verificado vía Management API)
- ✅ RLS ON en todas las tablas críticas
- ✅ Tablas: clients (14 rows), projects (7), quotations (9), holidays (18), pricing_catalog (57), profiles (3)
- ✅ `opportunities` existe (Slice 2 schema) pero tiene 0 rows
- ✅ Schema de `clients` no tiene `data_origin` (descartada esa hipótesis vieja)

---

## 5. Lo que la próxima sesión TIENE QUE HACER

1. **Leer este doc** completo
2. **Leer [2026-05-22_REBUILD-PLAN.md](2026-05-22_REBUILD-PLAN.md)** — tiene los comandos exactos
3. **Verificar pre-flight** (git status, branch, working tree)
4. **Crear branch `clean-supabase-rebuild`** desde master (NO desde test-auth-fixes-local)
5. **Aplicar los cambios** archivo por archivo según el plan
6. **Validar** con el usuario corriendo `npm run dev` y navegando
7. **Si funciona**: cerrar bug, decidir merge a master
8. **Si NO funciona**: rama de pruebas se descarta, se confirma que el problema es estructural (red/Supabase) y se cambia de estrategia

---

## 6. Lo que la próxima sesión NO TIENE QUE HACER (warnings)

- ❌ **No agregar más capas de timeout** — el problema actual es que ya hay 3. Si el rebuild falla, el siguiente paso es OTRA estrategia, no MÁS capas.
- ❌ **No tocar master directamente** — todo en `clean-supabase-rebuild`
- ❌ **No mergear `test-auth-fixes-local`** — esa rama es referencia histórica, no destino
- ❌ **No tocar Vercel** — el usuario explicitó: solo importa local hasta que funcione perfecto
- ❌ **No agregar console interceptors** — son frágiles (string matching) y hacen el bug más difícil de diagnosticar
- ❌ **No usar setTimeout para "deferred" recovery** — agregaba race conditions
- ❌ **No tocar Supabase MCP para Innovar** — el MCP de este entorno NO tiene acceso a `xdzbjptozeqcbnaqhtye`. Para SQL usar Management API con token de `.env` ([reference_innovar_management_api.md](../../../../.claude/projects/C--Users-ceoel/memory/reference_innovar_management_api.md))
- ❌ **No correr git/npm en background sobre OneDrive** — CLAUDE.md lo prohíbe. Foreground OK pero lento.
- ❌ **No instalar dependencias nuevas** — el rebuild USA LAS MISMAS que ya están en package.json

---

## 7. Información operativa que necesitás

### Rutas
- **Proyecto canónico:** `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
- **Espejo (no usar):** `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main`

### Credenciales (en `.env` del proyecto)
- `SUPABASE_URL` y `SUPABASE_ANON_KEY` → para Vite/cliente
- `SUPABASE_SERVICE_KEY` → backup, server-side
- `SUPABASE_ACCESS_TOKEN` (`sbp_...`) → Management API para queries SQL contra Innovar
- `VERCEL_TOKEN` → no usar (out of scope)

### Proyecto Supabase Innovar
- Project ID: `xdzbjptozeqcbnaqhtye`
- URL: `https://xdzbjptozeqcbnaqhtye.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/

### Convenciones de usuario
- Usuario NO es técnico — todos los comandos deben ser copy-paste
- PowerShell encadena con `;`, NO `&&`
- Trabajar con paths entre comillas dobles si tienen espacios

---

## 8. Para el agente que retoma — lo más importante en una línea

**El usuario lleva días con este bug, intentamos 6 fixes acumulativos sobre la capa Supabase, todos fallaron. El próximo paso es REMOVER capas, no agregar. Si el rebuild simple tampoco resuelve, el problema NO está en el frontend.**

---

## 9. Docs relacionados (lectura opcional, después de este handover)

- [2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md](2026-05-22_DIAGNOSIS-TOKEN-CONNECTION.md) — diagnóstico inicial detallado
- [2026-05-22_OPCION-B-RUNBOOK.md](2026-05-22_OPCION-B-RUNBOOK.md) — el runbook que generó la rama `test-auth-fixes-local`
- [2026-05-22_STATE-WHEN-YOU-RETURN.md](2026-05-22_STATE-WHEN-YOU-RETURN.md) — status para el usuario al volver de la primera tanda
- `../legacy/` o `../HandOver/` — handovers viejos del 17-19 de mayo (referencia histórica)

---

*Fin del handover. Próximo paso: leer [REBUILD-PLAN.md](2026-05-22_REBUILD-PLAN.md).*
