# Estado del Sistema — Innovar CRM
**Fecha:** 2026-05-20
**Sesión:** Auditoría completa post-bug recurrente + fix de raíz del cuelgue JWT
**Estado:** Sistema operativo, fix de raíz aplicado en código (pendiente push + deploy)

> **Este documento reemplaza a todos los handovers anteriores como fuente de verdad activa.**
> Los handovers del 18 y 19 de mayo quedan archivados en `docs/legacy/` con valor histórico únicamente.

---

## 1. TL;DR

| Tema | Estado |
|---|---|
| Bug "módulos cuelgan 10-30s en skeleton" | ✅ **Fix de raíz aplicado** en `src/lib/supabaseClient.ts` (3 cambios: B.1, B.2, B.3) |
| Causa raíz confirmada | Token JWT stale + recovery con umbral demasiado alto (3 timeouts en 30s) |
| Diagnóstico rápido para el usuario | `Ctrl+Shift+R` libera el cuelgue ← confirma que es estado local, no backend |
| Migraciones SQL pendientes | 7 archivos en `db/migrations/` por aplicar en Supabase Dashboard |
| Deploy a Vercel | ⏳ Manual pendiente (auto-deploy roto: Vercel conectado a repo equivocado) |
| Branch de trabajo actual | `claude/continue-crm-innovar-r22VQ` (sesión Claude Code on the Web) |
| Última verificación typecheck | 37 errores baseline preexistentes — cero regresiones del fix |

---

## 2. Bug del cuelgue — Cierre definitivo

### 2.1 Síntoma reportado por el usuario
```
supabaseClient.ts:188 [query-error] ["activeStaff"] → Operation timed out after 10000ms
supabaseClient.ts:188 [query-error] ["appointments",...] → Operation timed out after 10000ms
```
Módulos como `/agenda`, `/proyectos`, `/cotizaciones`, `/configuracion/*` se quedan 10-30s en skeleton y caen en timeout. Tras `Ctrl+Shift+R` funciona normalmente hasta que vuelve a vencer el token.

### 2.2 Causa raíz (confirmada en esta sesión)
El access_token JWT de Supabase persistido en `localStorage["innovar-auth-token"]` se vence con el tiempo de inactividad. Cuando el usuario vuelve a abrir la app:
- Supabase JS SDK intenta usar el token vencido
- El refresh interno falla pero NO emite `console.error("Refresh Token Not Found")` (que era lo único que el interceptor del 19/05 detectaba)
- Las queries quedan colgadas hasta que `withTimeout` las aborta a los 10s
- React Query reintenta 2 veces más con backoff 3s + 6s = total ~19s antes de mostrar error
- Si el usuario navega antes de que se acumulen **3 timeouts en 30s**, el recovery automático (`recordSupabaseTimeout`) NUNCA se dispara → el usuario debe hacer `Ctrl+Shift+R` manualmente cada vez

### 2.3 Fix aplicado (3 cambios en `src/lib/supabaseClient.ts`)

**B.1 — Verificación sincrónica del JWT al cargar el módulo** (líneas 187-216)
- Función `isPersistedJwtExpired()` decodifica el claim `exp` del access_token guardado en localStorage
- Si está vencido o expira en <60s, dispara `triggerStaleRecovery` ANTES de que cualquier query corra
- Efecto: si el usuario abre la app con token vencido, va directo a `/login` sin pasar por 10s de spinner

**B.2 — Verificación proactiva al primer timeout** (líneas 105-128)
- Al primer timeout, llamar `supabase.auth.getSession()` inmediatamente
- Si la sesión es inválida o el token expira en <60s, disparar recovery sin esperar a acumular 3 timeouts
- Si la sesión es válida, mantener el comportamiento actual (esperar umbral de 3) — esto evita falsos positivos por red lenta

**B.3 — Toast visible durante el recovery** (líneas 45-52)
- Ahora `triggerStaleRecovery` muestra un toast `notify.warning` para que el usuario entienda qué pasa
- Antes solo había `console.warn` (invisible para usuario no técnico)

### 2.4 Cómo verificar que el fix funciona

**Test 1 — JWT vencido al iniciar:**
1. Levantar `npm run dev`, hacer login normal
2. DevTools → Console: `localStorage.setItem('innovar-auth-token', JSON.stringify({ ...JSON.parse(localStorage.getItem('innovar-auth-token')), expires_at: Math.floor(Date.now()/1000) - 3600 }))`
3. Recargar la página
4. **Esperado:** redirige a `/login` en <2s con toast "Tu sesión expiró"

**Test 2 — Red lenta con sesión sana:**
1. DevTools → Network → Throttling: "Slow 3G"
2. Navegar a `/agenda`
3. **Esperado:** queries tardan pero NO disparan recovery (sesión es válida)

### 2.5 Runbook si vuelve a aparecer el cuelgue

Si el usuario vuelve a reportar "módulos cuelgan en skeleton":

1. **Primera pregunta:** ¿Funciona en modo incógnito o tras `Ctrl+Shift+R`?
   - Sí → es estado local. Verificar si el fix B.1/B.2/B.3 está deployado a producción. Si no, hacer deploy.
   - No → bug nuevo. Capturar:
     - HAR file de DevTools Network durante el cuelgue
     - Output de `localStorage.getItem('innovar-auth-token')` (anonimizado)
     - Salida de `await supabase.auth.getSession()` ejecutado en consola
     - Logs de Supabase Dashboard últimas 24h

2. **Comando manual de recovery** (si el usuario está bloqueado y no se puede hacer deploy):
   ```js
   // En DevTools Console:
   localStorage.removeItem('innovar-auth-token'); location.reload();
   ```

3. **NO repetir hipótesis ya descartadas:**
   - `retry: 0` en hooks ❌ (causa MÁS cuelgues, no menos)
   - Timeouts agresivos (<5s) ❌ (rompen red lenta legítima)
   - Desactivar RLS ❌ (no es la causa y deja deuda de seguridad)
   - JOINs PostgREST anidados ❌ (también fallan sin joins)

---

## 3. Migraciones SQL pendientes

7 archivos por aplicar en Supabase SQL Editor (en este orden):

| # | Archivo | Propósito | Filas que añade |
|---|---|---|---|
| 1 | `db/migrations/002_fix_handle_new_user_default_role.sql` | Cambia rol default `admin` → `comercial` | trigger reescrito |
| 2 | `db/migrations/002_kitchen_pricing_catalog.sql` | Precios server-side de cocinas | 10 filas |
| 3 | `db/migrations/003_tv_center_pricing.sql` | Precios TV Center | 7 filas |
| 4 | `db/migrations/004_special_finishes_pricing.sql` | Precios acabados especiales | 4 filas |
| 5 | `db/migrations/005_closets_pricing.sql` | Precios closets | 3 filas |
| 6 | `db/migrations/006_interior_doors_pricing.sql` | Precios puertas interiores | 5 filas |
| 7 | `db/migrations/007_mesones_pricing.sql` | Precios mesones | 4 filas |

**Verificación post-aplicación (1 sola query):**
```sql
SELECT category, COUNT(*) AS filas
FROM pricing_catalog
GROUP BY category
ORDER BY category;
```
Esperado: ≥7 categorías incluyendo `cocina`, `closet`, `puerta`, `tv_center`, `especiales`, `mesones`, `herrajes`.

> **Importante:** El MCP de Supabase conectado en este entorno NO es el proyecto Innovar (es Light_House / Swarm Agentes). El usuario debe aplicarlas manualmente en https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/sql/new

---

## 4. Estado del repositorio

- **Rama de trabajo actual:** `claude/continue-crm-innovar-r22VQ`
- **Rama de producción:** `master` (en remoto `accesos-seo/innovar-crm`)
- **Último commit pusheado a `master`:** `c6dd3f9 fix(audit): herrajes en switch, material schema sin campos fantasma, withTimeout en 6 hooks...`
- **Pendiente de push:** el fix B.1/B.2/B.3 + esta consolidación de docs (se hace en esta sesión)

---

## 5. Vercel

- **Proyecto activo:** `crm-innovar-app-2026` → https://crm-innovar-app-2026.vercel.app
- **Auto-deploy:** ⚠️ **ROTO** — Vercel conectado a `Rvirona/CRM-INNOVAR-APP:main`, pero el trabajo real va a `accesos-seo/innovar-crm:master`
- **Workaround:** Deploy manual con `npx vercel --prod` desde la máquina del usuario tras cada push importante
- **Pendiente futuro:** Reconectar Vercel al repo correcto

---

## 6. Cifras del sistema (snapshot)

| Recurso | Conteo |
|---|---|
| Clientes | 11 |
| Cotizaciones | 9 |
| Proyectos | 7 |
| Materiales en tabla | 0 (vacía — pendiente carga inicial de negocio) |
| Festivos | 18 |
| Precios en `pricing_catalog` | 60 (sube a 60+33 si se aplican las 7 migraciones SQL) |
| Profiles | 2 |
| Audit log | 162 eventos |
| Cola WhatsApp | 6 mensajes |
| Triggers DB | 50 |
| Funciones SQL | 51 |
| Cron jobs activos | 1 |

---

## 7. Archivos clave del proyecto

| Archivo | Para qué |
|---|---|
| `src/lib/supabaseClient.ts` | Cliente Supabase + recovery automático de JWT stale (modificado hoy) |
| `src/lib/timeout.ts` | Wrapper `withTimeout` (10s default) — NO tocar, está sano |
| `src/lib/connection-diagnostic.ts` | Herramienta de diagnóstico ad-hoc en consola |
| `src/App.tsx:73-114` | QueryCache global + listener `[query-error]` que invoca `recordSupabaseTimeout` |
| `CLAUDE.md` | Guía operativa del proyecto (rutas, comandos PowerShell, reglas) |

---

## 8. Documentación archivada en `docs/legacy/`

Estos documentos se mueven a legacy pero **mantienen valor histórico** (especialmente para diagnóstico de regresiones):

| Archivo | Por qué se archiva | Cuándo consultarlo |
|---|---|---|
| `docs/legacy/HANDOVER-2026-05-18-fase-1-2.md` | Cerrada Fase 1 + Fase 2 (estabilidad y cimientos) | Si necesitás entender la migración a errores tipados o el patrón `mapSupabaseError` |
| `docs/legacy/HANDOVER-2026-05-19-sesion-claude.md` | Pricing migration completa + 5 hipótesis descartadas del bug | Si vuelve a aparecer el cuelgue y querés ver qué NO probar otra vez |
| `docs/legacy/HANDOVER-2026-05-19-cierre-bug-cuelgue.md` | Diagnóstico parcial del JWT stale (correcto pero fix incompleto) | Referencia para comparar el fix B.1/B.2/B.3 actual con la versión anterior |
| `docs/legacy/PROMPT-PARA-PROXIMO-AGENTE.md` | Instrucciones de handoff ya consumidas | Solo para historia |
| `docs/legacy/MOTOR_COCINAS.md`, `pipeline_arquitectura.md`, etc. | Documentación arquitectónica previa | Si necesitás entender decisiones de diseño del cotizador |

---

## 9. Próximas tareas sugeridas (cuando el usuario decida)

| Tarea | Esfuerzo | Beneficio |
|---|---|---|
| Aplicar las 7 migraciones SQL pendientes | Bajo (15 min) | Pricing server-side funcional para los 5 módulos |
| Deploy manual a Vercel del fix B.1/B.2/B.3 | Bajo (5 min) | Cuelgue resuelto en producción |
| Reconectar Vercel a `accesos-seo/innovar-crm:master` | Bajo (config Vercel) | Auto-deploy funciona |
| Endurecer GRANTs SQL: revocar `DELETE`/`TRUNCATE`/`UPDATE` de `anon` | Bajo (1 script SQL) | Seguridad: hoy `anon` tiene permisos excesivos |
| Crear `MesonesTemplate.tsx` para PDFs de mesones | Medio | Completa el feature |
| `MesonesModule` sin `initialData` — no restaura config guardada al reabrir | Medio | Bug UX al editar cotización con mesones |
| Carga inicial de materiales | Variable | Tabla `materials` no muestra "sin registros" |
| Tests unitarios para los 6 engines server-side | Medio | Protege regresiones matemáticas |
| Regenerar `db/supabase_schema.sql` desde producción | Bajo | Schema local refleja realidad (hoy desfasado) |

---

*Generado en sesión del 2026-05-20 por Claude Opus 4.7 — esta es la fuente de verdad activa del proyecto.*
