# PRD — Decisiones del Cliente · Departamento FINANZAS (Cierres y Gastos)

> **Autocontenido.** Otra IA debe poder implementar esto leyendo solo este documento + el código. Todo dato de esquema fue **verificado contra producción** (Supabase Innovar, Management API) y código vivo el **19/06/2026**. Antes de implementar, re-validar contra prod (el archivo `db/supabase_schema.sql` está desactualizado y no es fuente de verdad).
>
> **Origen:** Cuestionario 1 ("Cierres Contables y Gastos de Empresa", Q1–Q7) de [`../decisiones/decisiones-innovar-cuestionarios.md`](../decisiones/decisiones-innovar-cuestionarios.md). Estado de cada ítem en [`../decisiones/00-matriz-segmentacion-brechas.md`](../decisiones/00-matriz-segmentacion-brechas.md).

## Problem Statement

El cliente (Cocinas Integrales Pereira) describió, como si ya existiera, un módulo de **cierre contable de período** que consolida varios proyectos terminados + los gastos de bodega del período en dos reportes PDF (Ejecutivo y Anexo), con regla de corte temporal para los gastos de bodega y un flujo de reversión auditado restringido al CEO. **La verificación contra producción muestra que el sistema NO implementa ese modelo:**

- El cierre real es **por proyecto** (`accounting_closures.project_id` es `NOT NULL`, 6 filas reales). **No existe** una entidad de cierre de período que consolide proyectos + gastos de bodega.
- **No existe** la generación de PDF del cierre (Reporte Ejecutivo / Anexo), aunque la librería `jsPDF` ya está en el repo y se usa en cotizaciones.
- **No existe** la regla de corte temporal de gastos de bodega ("desde el último cierre confirmado hasta hoy").
- **No existe** reversión auditada de cierres ni la tabla `closure_audit_log`; solo hay archivar/restaurar (soft-delete).
- Las **categorías de gasto** en prod son **10** y mayormente **distintas** a las 13 que el cliente da por activas.

Si el cliente revisa la base de datos esperando lo que describió, no lo va a encontrar. Este PRD cierra esa brecha de forma ordenada.

## Solution

Construir una **capa de cierre de período** por encima del cierre por proyecto existente (sin romper lo actual), más los reportes PDF, la regla de corte de bodega, la reversión auditada y la reconciliación de categorías. Reutilizar la infraestructura existente (RPC de cierre, `jsPDF`, `system_settings`, patrón de roles).

## User Stories

- Como **CEO/Super Admin**, quiero generar un **cierre de período** que liste los proyectos terminados y 100% pagados del período con su comparativo cotizado vs. real, y reste los gastos de bodega acumulados desde el último cierre, para ver la utilidad neta del negocio.
- Como **CEO**, quiero **descargar el Reporte Ejecutivo (PDF)** y el **Anexo de Gastos (PDF)** para archivo y para decidir.
- Como **CEO**, quiero **revertir** un cierre confirmado solo yo, con motivo obligatorio, y que quede auditado.
- Como **administrador de gastos**, quiero que las **categorías de bodega** reflejen las del negocio real (arriendo, energía, agua, etc.).

## Contexto del sistema existente (leer antes de implementar)

**Stack:** React 19 + Vite + TypeScript + Tailwind + shadcn/ui · Supabase (Postgres + RLS + RPC). DB en inglés, labels UI en español. Migraciones en `db/migrations/` (última: **060**; la siguiente es **061**). Convención de funciones/triggers: `CREATE OR REPLACE` + snapshot versionado.

**Lo que YA existe y se reutiliza:**

| Pieza | Ubicación | Estado |
|---|---|---|
| Tabla `accounting_closures` (per-proyecto) | cols: `id, project_id (NOT NULL), closed_by, closure_date, total_income, total_expenses, net_profit, profit_margin, notes, status, created_at, updated_at, deleted_at` | ✅ en uso (6 filas) |
| RPC `create_accounting_closure(p_project_id uuid, p_closed_by uuid, p_notes text)` | **existe en prod pero NO está versionada** en migraciones | ⚠️ deuda: snapshotear a migración |
| Trigger `fn_cierre_automatico_proyecto()` (mig `049`) | cierra proyecto al `delivered_at` + `is_fully_paid` + no `completado` | ✅ |
| `is_fully_paid` (columna derivada en `projects`, mig `037`) | true cuando `balance_due <= 0` | ✅ |
| Tabla `expenses` | `project_id (nullable → NULL = gasto empresa/bodega), category (enum expense_category), amount, expense_date, approval_status, registered_by, approved_by, ...` | ✅ |
| Enum `expense_category` (10) | `{materiales, operativo, nomina, transporte, herramientas, servicios_publicos, arriendo, subcontrato, otro, dietas}` | 🟡 reconciliar |
| UI Cierres | `src/pages/CierresContables.tsx` (lista, métricas, filtros; `canSee = admin\|\|comercial`; crear solo `isAdmin`), `NewClosureModal.tsx` (filtro `status==='entregado' && !accounting_closure_id`), `ClosureDetailPanel.tsx`, `ClosuresColumns.tsx` | ✅ |
| Hooks | `src/hooks/finanzas/`: `useCreateClosure` (llama la RPC), `useClosures`, `useArchiveClosures`, `useRestoreClosures` | ✅ |
| **PDF reutilizable** | `jsPDF ^4.2.1` + `html2canvas` en `package.json`; patrón en `src/hooks/quotations/useQuotationBuilder.ts` | ✅ reusar |
| RLS `accounting_closures` (prod real) | `admin_all_closures` (ALL), `gerente_select_closures` (SELECT), `Todos leen cierres` (SELECT authenticated) | 🟡 ajustar |
| Roles del sistema | `admin, super_admin, comercial, diseno, produccion, administradora, gerente` — **no existe "CEO"** (mapear CEO → `super_admin`) | — |
| `system_settings` (key/value JSONB) | config editable por admin | ✅ reusar |

## Implementation Decisions

### Decisión central (requiere OK del CEO): modelo de período sobre el de proyecto
El documento describe un **cierre de período**; el sistema tiene **cierre por proyecto**. Recomendación: **agregar una capa de período** que consolide los cierres por proyecto + el bloque de bodega, sin tocar `accounting_closures` (preserva las 6 filas y el flujo actual). Las tablas nuevas son exactamente los conceptos que el cliente nombró (`accountingClosureProjects` / `accountingClosureOperationalExpenses`):

```
accounting_closure_periods           -- el cierre del período
  id, period_start (date, nullable), period_end (date), created_by, status
  ('borrador'|'confirmado'|'revertido'), confirmed_at, total_projects_profit,
  total_bodega_expenses, net_profit, created_at, reverted_at, reverted_by, reverted_reason
accounting_closure_period_projects   -- snapshot por proyecto incluido (Q6)
  id, period_id (FK), project_id, project_name, quoted_value, total_paid,
  balance_due, project_expenses, profit, margin_pct
accounting_closure_period_expenses   -- snapshot de gastos de bodega del período (Q6)
  id, period_id (FK), category, description, amount, expense_date
```

- **Regla de corte de bodega (Q3):** al crear un período, los gastos de bodega incluidos = `expenses` con `project_id IS NULL` y `expense_date` entre la **fecha del último período `confirmado`** (exclusivo) y `period_end`. Si no hay período previo, desde el inicio. Implementar en una RPC `create_closure_period(p_period_end date, p_project_ids uuid[], p_created_by uuid)` que arma los tres snapshots de forma atómica.
- **Filtro de proyectos elegibles (Q2):** solo proyectos `status='entregado'`/`completado` **y** `is_fully_paid = true`. **Corregir también `NewClosureModal.tsx:32`**, que hoy filtra solo por `status==='entregado'` sin verificar pago.

### Reversión auditada (Q4)
- Tabla nueva `closure_audit_log (id, period_id, action, performed_by, performed_at, previous_status, projects_count, reason)`.
- RPC `revert_closure_period(p_period_id uuid, p_reason text)`: valida `get_my_role() = 'super_admin'` (CEO), exige `length(p_reason) >= 10`, pasa el período a `revertido`, inserta en `closure_audit_log`. Rechaza a cualquier no-super_admin a nivel servidor (la UI solo muestra el botón a `super_admin`). Política: gastos tardíos NO reabren — van al período siguiente (mostrar aviso en el diálogo).

### Reportes PDF (Q6) — reusar `jsPDF`
- **Reporte Ejecutivo:** tabla por proyecto (Proyecto, Cotizado, Cobrado, Saldo Pendiente, Gastos Proyecto, Utilidad, Margen %), fila de proyecto con pérdida resaltada (fondo rosado + "▼ PÉRDIDA"), fila de totales, tarjetas resumen (cotizado, cobrado+saldo, gastos proyecto, gastos bodega, utilidad neta + margen), sección de firmas (elaboró / aprobó / Gerencia).
- **Anexo de Gastos:** Sección 1 = gastos de bodega por categoría con subtotales; Sección 2 = por proyecto con comparativo cotizado vs. real. Seguir el patrón de `useQuotationBuilder.ts`. Nuevo hook `src/hooks/finanzas/useClosurePeriodPdf.ts`.

### Categorías de gasto (Q1b)
- El cliente espera 13 etiquetas de bodega (arriendo, luz/energía, agua, internet, insumos aseo, insumos papelería, cortesía atención cliente, gasolina vehículos, mant. moto, mant. bodega, mant. maquinaria, nómina, otro). Hoy el enum tiene 10 mayormente distintas.
- **Migración:** `ALTER TYPE expense_category ADD VALUE ...` para las nuevas (los enum solo agregan; no se borran valores en uso). Decidir con el cliente si **se agregan** las 13 conservando las 10, o si se hace una **reasignación** (mapear `servicios_publicos`→desglosar en luz/agua/internet, etc.). Actualizar el array `CATEGORIES` en `NewExpenseModal.tsx:37-48` para mostrar las de bodega cuando `class==='empresa'`.

### Permisos (Q7)
- El cliente quiere "solo super_admin/CEO" para cierres. Hoy la UI deja crear a `admin` (`CierresContables.tsx:139`) y el RLS permite a `admin` + `super_admin`. **Ajustar:** crear/confirmar/revertir cierres de período solo `super_admin`; lectura para `admin`/`gerente`. Reflejar en UI y en las RPC (`SECURITY DEFINER` con check de rol).

### Deuda técnica a saldar
Snapshotear la RPC `create_accounting_closure` existente (no versionada) a una migración `CREATE OR REPLACE`, para que el repo sea fuente de verdad (regla de arnés).

## Testing Decisions

1. **Esquema:** aplicar la migración en prod vía Management API; verificar las 3 tablas nuevas + el enum ampliado + las RPC con `pg_get_functiondef`.
2. **Regla de corte (Q3):** crear 2 gastos de bodega antes y 2 después de un período confirmado; crear el siguiente período y verificar que solo entran los posteriores. Caso sin período previo = entran todos.
3. **Filtro (Q2):** un proyecto `entregado` con saldo > 0 NO debe ser elegible; con `is_fully_paid` sí.
4. **Reversión (Q4):** `revert_closure_period` falla con `admin` y con motivo < 10 chars; con `super_admin` + motivo válido pasa el período a `revertido` y crea fila en `closure_audit_log`.
5. **PDF (Q6):** generar Ejecutivo + Anexo de un período con ≥1 proyecto en pérdida; verificar fila rosada, totales y las 2 secciones del anexo.
6. **Permisos (Q7):** `admin` no ve el botón crear/revertir período; `super_admin` sí; `gerente` solo lectura.

## Out of Scope
- Rehacer el cierre por proyecto existente (`accounting_closures`) — se conserva y se consolida desde la capa de período.
- Costeo absorbente / prorrateo de bodega entre proyectos (el cliente lo descartó explícitamente en Q1).
- Reapertura de cierres confirmados (política: gastos tardíos al período siguiente).

## Further Notes (riesgos y decisiones conscientes)
- **Riesgo de expectativa:** este es el mayor gap de Finanzas. Conviene que el CEO sepa que el "cierre de período + PDFs" se va a construir ahora, no que ya existía.
- **Decisión que necesita el CEO:** (a) confirmar el modelo de período sobre proyecto; (b) definir si las categorías se **agregan** (13 nuevas junto a las 10) o se **reasignan**.
- **Conformidad ✅ ya cumplida (no requiere build, informar al cliente):** gastos de bodega independientes de proyectos (Q1a, `expenses.project_id NULL`); no prorrateo (Q1/Q2); política sin dietas (Q5); cálculo per-proyecto de utilidad existente.
- **No reinventar:** reusar `useQuotationBuilder.ts` (PDF), `create_accounting_closure` (per-proyecto), `is_fully_paid` (mig 037), `system_settings`.
- **Commits:** `feat(finanzas): ...` en español, `git add` por archivo, push tras OK.
