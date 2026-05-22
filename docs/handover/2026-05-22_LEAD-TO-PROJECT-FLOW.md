# HANDOFF — Rediseño del Flujo Lead → Visita → Presupuesto → Pago → Proyecto

> **Fecha**: 2026-05-22
> **De**: Sesión Claude que diseñó las Fases 1–4
> **Para**: La IA que continuará en la nueva ventana
> **Objetivo**: Que puedas tomar el trabajo SIN re-explorar todo. Lee este archivo de arriba abajo antes de hacer nada.

---

## 0. TL;DR — lo que necesitas saber en 30 segundos

- Estás trabajando en el **CRM Innovar** (muebles a medida en Pereira, Colombia).
- Hay un rediseño grande en curso: separar `clients` (entidad permanente) de `opportunities` (intentos de venta), agregar `visits` como entidad propia, formalizar versionado de cotizaciones, y construir 14 agentes/automatizaciones (con A-05 estrella: chatbot interno + n8n).
- Las **Fases 1, 2, 3, 4 ya están cerradas** (plan + PRD + migraciones SQL + refactor map). Documentos físicos creados.
- Falta **Fase 5 — Ejecución** de 7 slices de código, y **Fase 6 — `deploy-check`** que se intercala antes de cada deploy de slice.
- **Tu siguiente acción esperada**: arrancar Slice 1 (esqueleto de datos) — aplicar migraciones en staging Supabase, regenerar tipos TypeScript, sin tocar UI todavía.

---

## 1. Entorno y restricciones operativas

### 1.1 Identidad del usuario
- Email: `accesos@seolabagency.com`
- Cuenta GitHub default: `accesos-seo`
- Tono preferido: directo, conciso, sin emojis salvo que él los pida, en español

### 1.2 Rutas críticas
- **Proyecto Innovar (canónica)**: `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main`
- **Espejo OneDrive**: `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main` (no editar; es espejo)
- **Memoria global del usuario**: `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\MEMORY.md`
- **Convenciones globales del usuario**: `C:\Users\ceoel\.claude\CLAUDE.md`
- **Convenciones de agencia para sistemas agénticos**: `C:\Users\ceoel\.claude\conventions\agentic-automations.md`

### 1.3 Plataforma
- Windows 10 Pro, shell por defecto PowerShell. **Bash tool también disponible** para POSIX.
- Las rutas con espacios SIEMPRE entre comillas dobles.
- **NUNCA correr git/deploy/background tasks en rutas OneDrive** — dar los comandos al usuario para que él los ejecute manualmente. Los procesos en background suelen colgarse por la sincronización.
- Usar `Glob`, `Grep`, `Read` en vez de `find`, `grep`, `cat` (mandato del usuario).

### 1.4 Supabase — scope crítico ⚠️
- El **MCP de Supabase** disponible (`mcp__2b07c2b1...`) **NO tiene acceso al proyecto Innovar**.
- Proyecto Innovar Supabase ID: `xdzbjptozeqcbnaqhtye`
- Para ejecutar SQL en Innovar tienes **2 opciones**:
  1. **Pedirle al usuario** que pegue el SQL en el Supabase Dashboard → SQL Editor (lo más simple).
  2. **Management API directa** con el `SUPABASE_ACCESS_TOKEN` que vive en el `.env` local del proyecto. Patrón: `POST api.supabase.com/v1/projects/xdzbjptozeqcbnaqhtye/database/query` con curl (NO con `Invoke-RestMethod` — falla por encoding). Detalles en la memoria `reference_innovar_management_api.md`.
- El MCP SÍ tiene acceso a otros proyectos (`Swarm Agentes MD`, `Light_House`). **No los toques** en este trabajo.

### 1.5 Otros MCPs disponibles
- `mcp__n8n-mcp__*` — para crear workflows n8n cuando lleguemos al agente A-05 (Slice 7+)
- `mcp__Claude_Preview__*` — para previsualizar UI mientras desarrollas
- `vercel` CLI disponible — pero el **deploy lo corre el usuario MANUALMENTE**, no en background

---

## 2. Estado de las fases

| Fase | Habilidad / método | Deliverable | Estado |
|---|---|---|---|
| **1. Entendimiento** | `grill-me` + Modo Plan | Plan maestro con las 7 ramas resueltas + state machine global + catálogo de 14 agentes | ✅ **Cerrada** |
| **2. Formalización** | `to-prd` | PRD estructurado | ✅ **Cerrada** |
| **3. Schema** | `supabase-schema` | 5 migraciones SQL + rollback | ✅ **Cerrada** |
| **4. Refactor map** | `improve-codebase-architecture` | Mapa de qué hooks/páginas/components crear o modificar | ✅ **Cerrada** |
| **5. Ejecución** | Modo normal — 7 slices secuenciales | Código real, un PR por slice | ⏸ **Pendiente — TU TRABAJO** |
| **6. Pre-deploy** | `deploy-check` | Checklist verde antes de cada deploy | ⏸ Se intercala DENTRO de Fase 5, antes de cada deploy de slice |

---

## 3. Documentos ya creados — léelos en este orden

Antes de tocar código, lee los 4 documentos. Están todos en la carpeta del proyecto Innovar:

1. **Plan maestro** (Fase 1):
   `C:\Users\ceoel\.claude\plans\s-estoy-de-acuerdo-reactive-sundae.md`
   - Las 7 ramas con decisiones cerradas
   - Catálogo final de los 14 agentes con A-05 estrella
   - State machine global completa
   - Casos de verificación end-to-end

2. **PRD** (Fase 2):
   `docs/prd/lead-to-project-flow.md`
   - Problem statement, solución, 17 user stories
   - Sección 4 con todas las decisiones de implementación
   - Sección 4.5 con los schema contracts (DDL alto nivel)
   - Sección 4.6 con edge functions y triggers críticos
   - Sección 4.13 con reglas de RLS

3. **Migraciones SQL** (Fase 3):
   `db/migrations/008_lead_to_project_schema.sql`
   `db/migrations/009_lead_to_project_functions.sql`
   `db/migrations/010_lead_to_project_triggers.sql`
   `db/migrations/011_lead_to_project_rls.sql`
   `db/migrations/012_lead_to_project_seed.sql`
   `db/migrations/ROLLBACK_lead_to_project.sql`
   `db/migrations/README.md` ← orden de ejecución + pre-condiciones

4. **Refactor Map** (Fase 4):
   `docs/architecture/lead-to-project-refactor-map.md`
   - Sección 1: hooks nuevos y refactorizados (lista exhaustiva)
   - Sección 2: páginas nuevas y modificadas
   - Sección 3: Edge Functions y n8n flows
   - Sección 4: calculadoras compartidas (estrategia Vite + Deno)
   - Sección 5: chatbot A-05 en el frontend
   - Sección 6: feature flags y estrategia de cutover
   - Sección 7: árbol de directorios resultante
   - **Sección 9: checklist por slice — este es tu guion de trabajo**

---

## 4. Lo que tienes que hacer — Slice 1 primero

### 4.1 Slice 1 — Esqueleto de datos (sin tocar UI)

**Objetivo**: que las tablas, funciones, triggers, RLS y seed inicial estén aplicados en producción de Supabase Innovar y los tipos TypeScript regenerados. La UI sigue funcionando exactamente igual que hoy.

**Checklist (de la §9 del refactor map)**:
- [ ] Verificar pre-condición: que NO hay duplicados de `whatsapp_phone` en `clients` (query en `db/migrations/README.md`)
- [ ] Pedirle al usuario un backup manual de Supabase (Settings → Database → Backups → Create manual backup)
- [ ] Aplicar `008_lead_to_project_schema.sql`
- [ ] Aplicar `009_lead_to_project_functions.sql`
- [ ] Aplicar `010_lead_to_project_triggers.sql`
- [ ] Aplicar `011_lead_to_project_rls.sql`
- [ ] Aplicar `012_lead_to_project_seed.sql`
- [ ] Regenerar tipos: `npx supabase gen types typescript --project-id xdzbjptozeqcbnaqhtye > src/types/database.types.ts`
- [ ] Crear `src/lib/features.ts` con TODOS los flags inicialmente en `false`
- [ ] Verificar que `npm run build` (o `tsc --noEmit`) pasa sin errores
- [ ] QA manual: insertar una `opportunity` de prueba desde el dashboard, verificar que el trigger `assign_commercial_round_robin` asigna comercial
- [ ] Commit + PR

**Cómo aplicar las migraciones**:

Tu camino más limpio: leer los archivos SQL, formar el cuerpo del request a la Management API, ejecutar uno por uno. El patrón está en la memoria `reference_innovar_management_api.md` del usuario. Si no puedes usar curl, pídele al usuario que pegue cada archivo en el SQL Editor de Supabase Dashboard.

**Por orden, sin saltarse ninguno**. Si falla una, el `BEGIN...COMMIT` del archivo revierte ESE archivo, pero las migraciones previas ya quedaron aplicadas. En ese caso, diagnostica y arregla el archivo que falló antes de continuar.

### 4.2 Slices 2–7 — orden estricto

Cuando termines Slice 1 y el usuario confirme, sigues con los siguientes. **No saltes el orden**. Cada slice termina con un PR mergeado, deploy a producción, y QA con clientes reales:

| Slice | Foco | Habilidad sugerida |
|---|---|---|
| 2 | Refactor `Leads.tsx` para consumir `opportunities`. Crear `OpportunityDetail`. Cutover con feature flag. | Modo normal |
| 3 | `visits` table en UI. Self-booking público `/agendar/:token`. Recordatorios A-06 + A-07. | Modo normal |
| 4 | Mediciones tipadas por servicio. Extracción de calculadoras a `src/lib/calculators/`. Foto-remota. | Modo normal |
| 5 | Versionado real de quotations. Comparador. `auto_generate_quotation` (A-10). `expiry_watcher` (A-09). | Modo normal |
| 6 | Aprobación pública + comprobante + verificación admin → conversión a proyecto. | Modo normal |
| 7+ | Agentes restantes uno a uno. **A-05 chatbot interno es el último y más complejo**. | `n8n-mcp` para el chatbot |

Cada slice tiene su propio checklist detallado en `docs/architecture/lead-to-project-refactor-map.md` §9.

### 4.3 Antes de cada deploy de slice
Pasar por **Fase 6 — `deploy-check`**:
- Build limpio (`npm run build`)
- Tipos regenerados si la migración cambió el schema
- RLS verificada (intentar acceso cruzado entre comerciales)
- Variables de entorno en Vercel actualizadas
- Plan de rollback documentado
- Backup de DB antes del deploy

---

## 5. Convenciones obligatorias del proyecto

Lee `docs/CONVENTIONS.md` completo antes de escribir código. Resumen de lo crítico:

### 5.1 Errores
- **NUNCA silenciar** errores con `console.warn(e); return [];`
- **SIEMPRE** usar `mapSupabaseError`, `assertSupabase`, `notifyError` de `src/lib/errors.ts`
- Throws con `throw mapSupabaseError(error)`

### 5.2 Hooks de datos
- Patrón `useQuery` con `retry: 0`, `staleTime` explícito, tipo de retorno tipado (`Promise<MyEntity[]>`)
- Validación Zod en TODA escritura (mutations) ANTES de tocar Supabase
- Filtros pasados como objeto, no como args sueltos
- Un hook = una tabla principal (no `Promise.all` adentro)

### 5.3 Naming
- Componentes: `PascalCase.tsx`
- Hooks: `useXxx.ts`
- Utils: `kebab-case.ts`
- Identificadores en código y tablas: **inglés**
- Mensajes UI: **español**
- Documentación humana: **español**

### 5.4 Tailwind
- Usar tokens (`bg-card`, `text-primary`) — NUNCA hex hardcoded
- NO modificar `src/components/ui/` (primitivos shadcn)

### 5.5 Anti-patrones a evitar
- `as any` para silenciar TS
- `useEffect` para fetch (usar `useQuery`)
- `useState` después de `fetch`
- Asignar `role='admin'` por defecto al crear perfiles (mínimo privilegio: `'comercial'`)
- Generar IDs/números secuenciales en cliente (usar RPC server-side)
- Operaciones sin asumir que RLS puede fallar

### 5.6 Idioma de identificadores TS vs DB
- **Tablas Supabase**: snake_case en inglés (`opportunities`, `opportunity_id`)
- **TypeScript**: camelCase (`opportunityId`)
- React Query keys: array `['opportunities', { status: 'new' }]`

---

## 6. Decisiones de negocio que NO debes reabrir

Estas ya están resueltas en el plan maestro de Fase 1. NO las cuestiones — el usuario hizo grill-me sobre ellas:

- **Visitas solo martes y jueves**, 4 slots de 1.5h + 30min gap por día por comercial
- **Asignación round-robin** automática al crear opportunity; admin puede reasignar
- **Visita es entidad propia** (`visits` table), con modalidades `presencial` o `foto_remota`
- **Aprobación cliente NO basta** — el commitment real es el pago verificado por admin
- **Sugerido 30% de abono**, sin mínimo bloqueante (admin puede verificar cualquier monto con warning)
- **Versionado de cotizaciones** SOLO después de enviar al cliente (mientras `draft`, se edita en sitio)
- **Cliente recurrente vuelve a aparecer en leads** (esto es exactamente lo que la lógica vieja rompía)
- **Validez de cotización**: 30 días default, auto-expiry con reactivación por nueva versión
- **Política de devolución**: 90% antes de materiales, 50% materiales sin fabricación, 0% con fabricación iniciada
- **Lead dormido**: marca a los 30 días, lost automático a los 60 días
- **A-05 es chatbot interno + n8n** (NO Telegram externo) — esta decisión la cambió el usuario tras la propuesta inicial
- **Campos del formulario de creación de lead**: EXACTAMENTE los que ya están en `src/pages/LeadCreate.tsx`. No agregar ni quitar.

---

## 7. Diagnóstico — orden de operaciones (mandato del usuario)

Cuando algo falle:
1. **PRIMERO**: pedir reproducción en modo incógnito o con Clear Site Data del navegador (descarta JWT stale, cache, estado de browser)
2. **SEGUNDO**: revisar frontend (Network tab, console, errores TS)
3. **TERCERO**: backend / RLS / policies — SOLO si los pasos 1-2 no lo explican

Hay un postmortem detallado de un bug pasado del usuario en `feedback_diagnose_browser_state_first.md` (memoria). Lección: el usuario perdió 2 sesiones debuggeando backend cuando el problema era un token JWT stale en localStorage.

---

## 8. Memoria persistente — actualízala cuando aprendas algo nuevo

El usuario tiene un sistema de memoria en `C:\Users\ceoel\.claude\projects\C--Users-ceoel\memory\`:
- `MEMORY.md` es el índice (líneas tras la 200 se truncan — mantenerlo conciso)
- Cada memoria es un `.md` con frontmatter `name`/`description`/`metadata.type`
- Tipos: `user` / `feedback` / `project` / `reference`

**Memorias relevantes para este trabajo**:
- `project_innovar.md` — estado del proyecto Innovar
- `reference_innovar_management_api.md` — patrón curl para correr SQL en Innovar
- `bug_innovar_data_origin_phantom_column.md` — postmortem de bug similar (data_origin no existía en producción)
- `feedback_supabase_first_search.md` — los agentes viven en Edge Functions Light_House, no en filesystem
- `feedback_diagnose_browser_state_first.md` — orden de diagnóstico

Cuando aprendas algo nuevo del proyecto (decisión nueva, bug resuelto, restricción descubierta), guárdalo como memoria nueva o actualiza la existente.

---

## 9. Lista de archivos creados en esta sesión (referencia rápida)

### En `Innovar-App-main/`
```
docs/
├── prd/
│   └── lead-to-project-flow.md                          ← PRD completo
├── architecture/
│   └── lead-to-project-refactor-map.md                  ← Refactor map con checklist por slice
└── handover/
    └── 2026-05-22_LEAD-TO-PROJECT-FLOW.md               ← ESTE archivo (handoff)

db/migrations/
├── 008_lead_to_project_schema.sql                       ← Tablas + ALTERs + UNIQUE + índices
├── 009_lead_to_project_functions.sql                    ← 12 funciones helper + trigger funcs
├── 010_lead_to_project_triggers.sql                     ← Triggers cableados
├── 011_lead_to_project_rls.sql                          ← Políticas RLS estrictas
├── 012_lead_to_project_seed.sql                         ← system_settings inicial
├── ROLLBACK_lead_to_project.sql                         ← Reversión completa
└── README.md                                            ← Actualizado con orden + pre-condiciones
```

### Fuera de `Innovar-App-main/` (local del usuario)
```
C:\Users\ceoel\.claude\plans\
└── s-estoy-de-acuerdo-reactive-sundae.md                ← Plan maestro Fase 1
```

---

## 10. Cómo empezar tu primer turno en la nueva ventana

Sugerencia de primer mensaje al usuario en la nueva ventana:

> "Estoy tomando el trabajo del rediseño Lead → Proyecto. Leí el handoff en `docs/handover/2026-05-22_LEAD-TO-PROJECT-FLOW.md`. Las Fases 1-4 están cerradas (plan + PRD + 5 migraciones SQL + refactor map).
>
> Mi próxima acción es arrancar **Slice 1 — Esqueleto de datos**: aplicar las 5 migraciones en staging Supabase y regenerar `src/types/database.types.ts`, sin tocar UI todavía.
>
> Antes de aplicar, necesito que:
> 1. Verifiques en el dashboard que no hay duplicados de `whatsapp_phone` en `clients` (te paso la query si quieres).
> 2. Hagas un backup manual desde Supabase Dashboard → Settings → Database → Backups.
>
> ¿Avanzo con eso?"

---

## 11. Reglas conversacionales con el usuario

- **No le preguntes obviedades** ya cerradas en este handoff. Si dice "sigue adelante", sigue.
- **Para acciones destructivas o de impacto** (correr migraciones en prod, force-push, deploy): pídele confirmación primero.
- **Verifica que ejecutó las cosas manuales** (backups, copy-paste en dashboard) antes de continuar.
- **Si te pide hacer algo fuera de scope del flujo Lead→Proyecto**, hazlo, pero no te metas al trabajo del flujo si no termina lo solicitado.
- El usuario habla español. Tu output también. Identificadores de código en inglés.

---

## 12. Cuando termines Fase 5

El refactor está completo cuando la §11 del refactor map (Definition of Done) está toda en verde. Eso típicamente toma semanas. No tienes que terminarlo en una sesión.

**Cierre limpio del trabajo entre sesiones**: al final de cada sesión, escribe un mini-handoff en `docs/handover/YYYY-MM-DD_<slice-name>.md` con: qué quedó hecho, qué falta, qué encontraste sorprendente. Así la próxima IA (o tú mismo en otra ventana) no pierde tiempo.

---

**Fin del handoff. Buena suerte. El trabajo está sólido. Solo ejecutá.**
