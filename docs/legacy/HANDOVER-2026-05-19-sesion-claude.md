# INFORME DE SESIÓN — Innovar CRM
**Fecha:** 19 de mayo de 2026
**Agente:** Claude Sonnet 4.7
**Duración:** sesión completa
**Estado final:** 1 entrega completa lista para deploy · 1 bug crítico en diagnóstico (NO resuelto)

---

## 0. TL;DR

| Resultado | Estado |
|---|---|
| Migración server-side de 5 módulos de pricing (TV Center, Acabados, Closets, Puertas Interiores, Mesones) | ✅ COMPLETA — código listo, typecheck OK, build OK |
| Bug "módulos del CRM cuelgan en skeleton 30-100s" | ❌ NO RESUELTO — diagnosticado parcialmente |
| Aplicar migraciones SQL en Supabase Dashboard | ⚠ PENDIENTE — el usuario debe ejecutar |
| Push a GitHub | ⚠ PENDIENTE — el usuario debe ejecutar |
| Reactivar RLS desactivado durante diagnóstico | ⚠ PENDIENTE — el usuario debe ejecutar SQL incluido al final |

---

## 1. CONTEXTO INICIAL

Al arrancar la sesión, el handover anterior indicaba 5 prioridades:
1. Revisar Closets vs `4-CLOSETS.docx`
2. Revisar Puertas vs `6-PUERTAS.docx`
3. Crear Mesones desde cero
4. Migrar TV Center + Acabados a server-side
5. Conectar Dashboard a datos reales de Supabase

**Hallazgo de auditoría:** las prioridades 1, 2, 3 y 5 ya estaban implementadas correctamente. El handover anterior estaba desactualizado.

| Módulo | Estado real al iniciar | Acción tomada |
|---|---|---|
| Closets | Ya alineado con `.docx`, precios correctos | Solo verificación |
| Puertas Interiores | Ya alineado con `.docx`, precios correctos | Solo verificación |
| Mesones | Ya implementado (carpeta y código existen) | Solo verificación |
| Dashboard | Ya consume datos reales de Supabase | Solo verificación |
| TV Center + Acabados | Calculan client-side, deuda arquitectónica | **Migrado** |

---

## 2. TRABAJO ENTREGADO (Pricing Migration)

### 2.1 Decisión arquitectónica

Antes había **dos patrones distintos** para calcular cotizaciones:
- **Cocinas:** server-side via Express (`server/services/kitchen.engine.ts`), precios en `pricing_catalog` (Supabase).
- **Todos los demás módulos:** client-side con precios hardcoded en `logic.ts`.

Esto es deuda arquitectónica que no escala. La sesión unificó todos los módulos al patrón server-side. **Beneficios:**
- Una sola fuente de verdad para precios (`pricing_catalog`).
- El negocio puede actualizar precios desde el dashboard de Supabase sin redeploy.
- Patrón idéntico facilita agregar módulos nuevos.

### 2.2 Patrón aplicado en cada módulo

```
1. Migración SQL → INSERT en pricing_catalog (idempotente con ON CONFLICT)
2. Engine puro en server/services/<modulo>.engine.ts (matemática + fallback)
3. Schema Zod en src/schemas/quotation.schema.ts (validación request)
4. Método en server/services/pricing.service.ts (parse + load + delegate)
5. Case en server/controllers/quotation.controller.ts (switch routing)
6. Hook cliente refactorizado a useCalculatePrice (server-side)
7. logic.ts marcado @deprecated (mantenido solo para tests + tipos)
```

### 2.3 Resultado por módulo

| Módulo | Migración SQL | Categoría wire-level | Engine |
|---|---|---|---|
| TV Center | `003_tv_center_pricing.sql` (7 precios) | `tv_center` | `server/services/tv-center.engine.ts` |
| Acabados Especiales | `004_special_finishes_pricing.sql` (4 precios) | `especiales` | `server/services/special-finishes.engine.ts` |
| Closets | `005_closets_pricing.sql` (3 precios) | `closet` | `server/services/closets.engine.ts` |
| Puertas Interiores | `006_interior_doors_pricing.sql` (5 precios) | `puerta` (singular) | `server/services/interior-doors.engine.ts` |
| Mesones | `007_mesones_pricing.sql` (4 precios nuevos) | `mesones` | `server/services/mesones.engine.ts` |

**Nota importante:** `puerta` (singular) = puertas interiores (módulo nuevo). `puertas` (plural) sigue siendo para repuestos de cocina (legacy `DoorsConfigSchema`). No mezclar.

### 2.4 Validaciones técnicas
- **Typecheck:** 37 errores baseline preexistentes = 37 después (cero regresiones nuevas).
- **Build Vite:** OK en 44.18s al final.
- **No tocó UI:** las shapes de retorno de los hooks se preservaron, los `*Module.tsx` no requirieron cambios.

### 2.5 Archivos creados (PR1)

```
db/migrations/
  003_tv_center_pricing.sql           [crear]
  004_special_finishes_pricing.sql    [crear]
  005_closets_pricing.sql             [crear]
  006_interior_doors_pricing.sql      [crear]
  007_mesones_pricing.sql             [crear]

server/services/
  tv-center.engine.ts                 [crear]
  special-finishes.engine.ts          [crear]
  closets.engine.ts                   [crear]
  interior-doors.engine.ts            [crear]
  mesones.engine.ts                   [crear]
```

### 2.6 Archivos modificados (PR1)

```
src/schemas/quotation.schema.ts                  [+5 schemas, enum expandido a 7 categorías]
server/services/pricing.service.ts               [+5 métodos calculateX]
server/controllers/quotation.controller.ts       [+5 cases en switch]
src/hooks/use-tv-center-calculator.ts            [reescritura server-side]
src/hooks/use-special-finishes-calculator.ts     [reescritura]
src/hooks/use-closet-calculator.ts               [reescritura]
src/hooks/use-doors-calculator.ts                [reescritura]
src/hooks/use-mesones-calculator.ts              [reescritura]
src/features/tv_center/logic.ts                  [@deprecated for production]
src/features/special_finishes/logic.ts           [@deprecated]
src/features/closets/logic.ts                    [@deprecated]
src/features/doors/logic.ts                      [@deprecated]
src/features/mesones/logic.ts                    [@deprecated]
```

---

## 3. BUG NO RESUELTO — "Módulos cuelgan en skeleton"

### 3.1 Reporte del usuario

**Síntoma:** Al navegar entre módulos del CRM, algunas páginas quedan en skeleton 30-100 segundos. Algunas terminan en error de timeout, otras en tabla vacía.

**Módulos que cargan rápido y bien:**
- Dashboard principal
- Directorio (Clientes y Ventas → directorio)
- Solicitudes y Leads (inicialmente — después también empezó a colgar)
- Agenda y Tareas → Citas
- Tareas
- Finanzas → Pagos
- Cierres contables (carga pero no registra datos automáticos — comportamiento esperado)

**Módulos que cuelgan o devuelven vacío:**
- Proyectos (error después de ~100s: "Operation timed out after 100000ms")
- Cotizaciones (skeleton perpetuo)
- Configuración → Materiales e Insumos
- Configuración → Tarifas y Precios
- Configuración → Auditoría de Sistemas
- Configuración → Días Festivos
- Notificaciones de WhatsApp

### 3.2 Hipótesis intentadas y descartadas

| # | Hipótesis | Acción aplicada | Resultado | Estado |
|---|---|---|---|---|
| 1 | `retry: 0` en hooks bloquea recuperación | Removido `retry: 0` de 21 hooks → heredan global `retry: 2` | Persiste | ❌ Descartada |
| 2 | Timeouts demasiado largos (45s) | `withTimeout` 20s→10s, `GLOBAL_TIMEOUT_MS` 15s→8s | Persiste | ❌ Descartada |
| 3 | Token de refresh inválido sin limpieza | `signOut()` forzado al detectar refresh token stale | Persiste | ❌ Descartada (no se disparó) |
| 4 | RLS con recursión infinita en `profiles` | RLS desactivado en 7 tablas (`projects`, `quotations`, `quotation_items`, `materials`, `pricing_catalog`, `holidays`, `profiles`) | **Persiste igual** | ❌ Descartada |
| 5 | Banner "Conectando" muy agresivo | Threshold 2s → 4s | Cosmético, no afecta el bug | N/A |
| 6 | JOINs anidados PostgREST | Revisado código — no es el factor común | Materiales/Holidays cuelgan con `SELECT *` simple sin JOIN | ❌ Descartada |

### 3.3 Mejoras dejadas en el código (defensa en profundidad — útiles aunque no resolvieron el bug)

Todos los cambios siguientes son **net positive** y se quedan en el código aunque no fueron suficientes:

| Cambio | Por qué se queda | Archivo |
|---|---|---|
| `retry: 2` heredado en 21 hooks | Recuperación frente a blips de red | 21 hooks |
| Timeouts reducidos | Errores surgen en ~30s en lugar de ~90s | `lib/timeout.ts`, `lib/supabaseClient.ts` |
| `signOut()` forzado en refresh token stale | Evita estado limbo (zustand cree que hay sesión pero Supabase no) | `lib/supabaseClient.ts` |
| QueryErrorReporter global | Toasts visibles cuando una query falla — adiós skeletons silenciosos | `App.tsx` |
| ConnectionBanner threshold 4s | Menos parpadeo en navegación normal | `components/shared/ConnectionBanner.tsx` |

### 3.4 Herramientas de diagnóstico instaladas (NO se ejecutaron por completo)

| Archivo | Función |
|---|---|
| `src/lib/connection-diagnostic.ts` | Test exhaustivo a Supabase al iniciar la app en dev. Reporta a consola sesión, latencias, resultados por tabla. **El usuario debía pegar este output pero no lo hizo todavía.** |
| `db/diagnostic/disable_rls_temp.sql` | Script con secciones para inspeccionar, desactivar y reactivar RLS. **Solo se ejecutó la desactivación; reactivación pendiente.** |

### 3.5 Lo que NO sabemos (info crítica faltante)

Sin estos datos no se puede cerrar el bug:

1. **Output completo del diagnóstico de consola** (`runConnectionDiagnostic`).
2. **Output de la query de policies** (la primera query del SQL de inspección — el usuario solo pegó la del estado RLS).
3. **Status code de los requests que cuelgan** en la pestaña Network de DevTools:
   - ¿200 OK con `[]`?
   - ¿504 Timeout?
   - ¿401 Unauthorized?
   - ¿Pending eterno?
   - ¿Ni siquiera se dispara?
4. **Si las queries a `clients` desde /leads cuelgan, pero las queries a `clients` desde /directorio sí funcionan** (misma tabla, diferentes hooks).

### 3.6 Hipótesis pendientes que NO se han descartado

Quedan por probar:

| Hipótesis | Por qué es plausible | Cómo probarla |
|---|---|---|
| Algún column del filtro de useLeads (`status`, `urgency`) NO existe en la tabla `clients` (similar al bug anterior de `data_origin`) | El precedente del bug `data_origin` documentado en memoria. Mismo patrón: campo en Zod pero no en DB. | Ejecutar `SELECT column_name FROM information_schema.columns WHERE table_name='clients'` y comparar con `clientSchema`. |
| Network/firewall local bloquea ciertos requests a Supabase | Que dashboard funcione y otras páginas no, en el mismo navegador, mismo usuario | Mirar pestaña Network real para confirmar el wire-level. |
| Proyecto Supabase degradado/rate-limited en ciertos endpoints | Free tier puede dar latencia errática | Login en dashboard de Supabase → ver "Database health" y "API logs". |
| Vite proxy o middleware Express interfiere | `npm run dev` corre `tsx server.ts` que monta Vite como middleware en Express, no Vite stand-alone | Probar con `vite dev` puro y ver si cambia. |
| Auth session válida para SOME endpoints pero no otros (RLS path-specific) | Imposible con permisos RLS uniformes — pero podría haber funciones SECURITY DEFINER con problemas | Aunque desactivamos RLS y siguió mal, podría ser una función custom. Inspeccionar `pg_proc`. |

### 3.7 Restricciones del entorno descubiertas

- **El MCP de Supabase NO tiene acceso al proyecto Innovar** (`xdzbjptozeqcbnaqhtye`). Solo a `Light_House` y `Swarm Agentes MD`. La memoria anterior decía lo contrario — corregido.
- Esto bloquea diagnóstico SQL directo desde el agente. El usuario debe ejecutar SQL manualmente en el dashboard de Supabase.
- **PowerShell + OneDrive es lento.** El usuario debe ejecutar git/deploy en su terminal, nunca en background.

---

## 4. ESTADO ACTUAL DEL CÓDIGO vs DEPLOY

| Categoría | Local | Aplicado en Supabase | Pushed a GitHub | En Vercel |
|---|---|---|---|---|
| **Pricing migration (PR1)** | ✅ Listo, build OK | ❌ NO aplicado (5 SQLs pendientes) | ❌ NO pusheado | ❌ No |
| **Connection fixes (PR2)** | ✅ Listo, build OK | N/A | ❌ NO pusheado | ❌ No |
| **Diagnostic tooling** | ✅ Instalado en dev | N/A | ❌ NO pusheado | ❌ No |
| **RLS DISABLED en 7 tablas** | N/A | ⚠ AÚN DESACTIVADO ⚠ | N/A | N/A |

---

## 5. ⚠ ACCIÓN URGENTE PENDIENTE

**Reactivar RLS en Supabase Dashboard** (SQL Editor del proyecto Innovar):

```sql
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
```

Las policies se preservaron al desactivar — al reactivar vuelven exactas. Cero riesgo de pérdida.

---

## 6. PLAN DE TRABAJO PARA LA SIGUIENTE SESIÓN

### Fase A — Cerrar el bug del cuelgue (prioridad ALTA)

**A.1. Recolectar evidencia que falta:**

1. Pedir al usuario que reinicie el dev server (`Ctrl+C` y `npm run dev`) y haga `Ctrl+Shift+R` en el navegador.
2. Pedir el output del bloque `🔬 DIAGNÓSTICO DE CONEXIÓN INNOVAR` que aparece en la consola del navegador.
3. Pedir screenshot de la pestaña Network → un request específico a `xdzbjptozeqcbnaqhtye.supabase.co` que cuelgue, expandido con Status, Time, Response Headers, Response Body.
4. Pedir output de esta SQL en Supabase Dashboard:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='clients'
   ORDER BY ordinal_position;
   ```
   Comparar resultado con los campos referenciados en `useLeads.ts` (líneas 40-54): `status`, `urgency`, `city`, `created_at`. Si alguno no existe → bug encontrado.

**A.2. Decisión basada en evidencia A.1:**

| Si el Network muestra... | Diagnóstico | Fix |
|---|---|---|
| 200 OK con `[]` después de 30s | Query devuelve vacío, posible filtro inválido | Revisar useLeads y filtros |
| 504 Timeout | Supabase tarda en responder | Inspeccionar el query plan, añadir índices |
| 401/403 | Auth roto | Forzar logout/login |
| Pending eterno (no resuelve) | Network/firewall | Verificar VPN, DNS, conectividad directa a `xdzbjptozeqcbnaqhtye.supabase.co` |
| Request nunca dispara | Bug en hook (excepción antes de fetch) | Logs en queryFn |

**A.3. Si la evidencia no clarifica:**

- Pedir al usuario instalar Supabase CLI localmente.
- Conectar al proyecto Innovar con `supabase link --project-ref xdzbjptozeqcbnaqhtye`.
- Inspeccionar policies, logs de Postgres, y health del proyecto.

### Fase B — Deploy de PR1 (pricing migration)

Una vez resuelto el bug del cuelgue:

**B.1. Aplicar SQLs en Supabase Dashboard (orden importa):**

Ir a [SQL Editor de Innovar](https://supabase.com/dashboard/project/xdzbjptozeqcbnaqhtye/sql/new) y ejecutar uno por uno:
1. `003_tv_center_pricing.sql`
2. `004_special_finishes_pricing.sql`
3. `005_closets_pricing.sql`
4. `006_interior_doors_pricing.sql`
5. `007_mesones_pricing.sql`

Verificar con:
```sql
SELECT category, count(*)
FROM pricing_catalog
WHERE category IN ('tv_center','especiales','closet','puerta','mesones')
GROUP BY category;
```
Esperado: 5 categorías, total 23 filas nuevas (7+4+3+5+4).

**B.2. Commit + push:**

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"

# PR1 - Pricing migration (commit separado)
git add db/migrations/003_tv_center_pricing.sql db/migrations/004_special_finishes_pricing.sql db/migrations/005_closets_pricing.sql db/migrations/006_interior_doors_pricing.sql db/migrations/007_mesones_pricing.sql server/services/tv-center.engine.ts server/services/special-finishes.engine.ts server/services/closets.engine.ts server/services/interior-doors.engine.ts server/services/mesones.engine.ts server/services/pricing.service.ts server/controllers/quotation.controller.ts src/schemas/quotation.schema.ts src/hooks/use-tv-center-calculator.ts src/hooks/use-special-finishes-calculator.ts src/hooks/use-closet-calculator.ts src/hooks/use-doors-calculator.ts src/hooks/use-mesones-calculator.ts src/features/tv_center/logic.ts src/features/special_finishes/logic.ts src/features/closets/logic.ts src/features/doors/logic.ts src/features/mesones/logic.ts

git commit -m "feat(pricing): unificar todos los modulos a server-side"

# PR2 - Connection fixes (commit separado)
git add src/hooks/agenda/ src/hooks/finanzas/ src/hooks/notifications/ src/hooks/tareas/ src/hooks/useClients.ts src/hooks/useHolidays.ts src/hooks/useLeads.ts src/hooks/useMaterials.ts src/hooks/usePricing.ts src/hooks/useProjects.ts src/hooks/useQuotations.ts src/hooks/useSystemDictionary.ts src/hooks/useWhatsApp.ts src/components/shared/ConnectionBanner.tsx src/lib/timeout.ts src/lib/supabaseClient.ts src/App.tsx src/lib/connection-diagnostic.ts db/diagnostic/disable_rls_temp.sql HandOver/HANDOVER-2026-05-19-sesion-claude.md

git commit -m "fix(query): heredar retry global, timeouts cortos, diagnostico y logout limpio"

git push origin master
```

**B.3. Verificación post-deploy:**

Abrir cotización nueva en producción → tab por tab:
- Cocina (regresión, debe seguir funcionando idéntico)
- Closet (1m × 2m estándar → $1.500.000)
- Puerta (1 batiente 80cm → $890.000)
- Centro TV (1.60m sin opciones → $2.800.000)
- Mesones (granito estándar 2m fondo 60cm → $1.530.000 con lavaplatos)
- Especiales (1 puerta 0.8×0.8m → $783.000)

### Fase C — Mejoras pendientes (no urgentes)

| Tarea | Esfuerzo | Beneficio |
|---|---|---|
| Tests unitarios para los 5 engines server-side | Medio | Regresión matemática protegida |
| Filtro `is_active=true` en `PricingService.loadCatalog()` | Bajo | Permitiría descontinuar precios sin eliminarlos |
| UI admin para editar `pricing_catalog` desde el dashboard del CRM | Alto | Negocio actualiza precios sin tocar SQL |
| Limpiar el `tsc-errors.log` baseline (37 errores TS preexistentes) | Medio-Alto | Calidad de código general |
| Conectar Vercel al repo correcto (`accesos-seo/innovar-crm:master` en vez de `Rvirona/CRM-INNOVAR-APP:main`) | Bajo (config Vercel) | Auto-deploy al push |
| Crear `MesonesTemplate.tsx` para PDFs de mesones | Medio | Falta feature de PDF para este módulo |

---

## 7. APRENDIZAJES PARA SESIONES FUTURAS

1. **El MCP de Supabase NO llega a Innovar.** Cualquier diagnóstico SQL exige al usuario ejecutar en el dashboard. Plan tus queries con anticipación.

2. **El handover anterior tenía 4 de 5 prioridades obsoletas.** Verificar contra el código actual ANTES de actuar.

3. **El proyecto vive en `OneDrive\Escritorio`**, no en `Documentos` (este último solo tiene mirror parcial con `ONBOARDING.md`).

4. **PowerShell + OneDrive = procesos lentos y timeouts.** Nunca correr git/build en background. Dar comandos al usuario para que ejecute manualmente.

5. **Las constantes `puerta` (singular) vs `puertas` (plural)** son dos categorías distintas — puertas interiores vs repuestos de cocina respectivamente. No mezclar.

6. **El bug "0 leads / módulos cuelgan" no es RLS.** Ya descartado experimentalmente. La próxima sesión debe empezar por evidencia del Network tab y comparar columnas de DB vs schemas Zod (precedente: bug `data_origin`).

7. **`logic.ts` deprecados se mantienen** porque la UI sigue importando constantes no-monetarias (`WIDTH_OPTIONS`, `BASE_WIDTH`, etc.). Solo los precios viven en DB.

---

## 8. ARCHIVOS DE REFERENCIA

- Plan de la sesión: `C:\Users\ceoel\.claude\plans\selecciona-la-tarea-con-sleepy-meteor.md`
- Memoria de Innovar: `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\project_innovar.md` (actualizado en esta sesión con la matriz de módulos server-side)
- Memoria general: `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md` (corregido el alcance del MCP Supabase)
- Documentos fuente de cotizaciones: `Cotizacioners/1-COCINAS.docx` a `6-PUERTAS.docx`
- Bug histórico relacionado: `bug_innovar_data_origin_phantom_column.md` (mismo patrón potencial)

---

*Fin del informe. Generado en sesión del 2026-05-19 por Claude Sonnet 4.7.*
