# 🛣️ Roadmap de Mejoras — Innovar CRM

> Plan de las fases de mejora pendientes. Diseñado para ejecutarse en orden.
> Cada fase es **autocontenida**: termina con el sistema funcionando.

---

## ✅ Fase 1 — Estabilidad y Seguridad — COMPLETADA (2026-05-17)

Detalle completo en [`changelog/2026-05-17-phase-1.md`](./changelog/2026-05-17-phase-1.md).

**Resumen**: rutas protegidas, manejo de errores centralizado, ErrorBoundary global, eliminación de 85 sitios de errores silenciados, fix de race condition en `quotation_number`, rol por defecto seguro.

---

## 🚧 Fase 2 — Cimientos Técnicos (80% completa)

Detalle de lo hecho: `changelog/2026-05-18-phase-2.md`.

### Tareas

| # | Tarea | Esfuerzo | Estado |
|---|---|---|---|
| 2.1 | Habilitar `"strict": true` en `tsconfig.json` | L | ✅ Activado · ⏳ Errores pendientes de corregir |
| 2.2 | Regenerar `database.types.ts` (18 tablas) | M | ✅ Completo |
| 2.3 | Eliminar interfaces inline duplicadas | S | 🚧 Parcial — `HardwareItem` deprecated, faltan otros |
| 2.4 | Schemas Zod para 8 tablas | M | ✅ Completo |
| 2.5 | Unificar forma de retorno de hooks | M | 🚧 Parcial |
| 2.6 | Limpiar `package.json` | XS | ✅ Completo |
| 2.7 | Limpiar raíz del repo | S | ✅ Casi — falta borrar `MiProyecto/` manual |
| 2.8 | Resolver duplicados | S | ✅ Completo |
| 2.9 | Migración SQL del trigger `handle_new_user` | XS | ✅ Creada · ⏳ Pendiente aplicar en Supabase |
| 2.10 | Decidir convención de idioma URLs/carpetas | XS | ⏳ Pendiente |

**Para cerrar la fase falta**:
- Correr `npx tsc --noEmit` y corregir errores que aparezcan (estimo ~100-200, fix iterativo)
- Aplicar migración 002 en Supabase SQL Editor
- Borrar manualmente `MiProyecto/`
- Decidir convención de idioma (o documentar status quo)
- Continuar eliminando interfaces inline restantes

---

## ⏳ Fase 3 — Performance y Escalabilidad (2-3 semanas)

> **Objetivo**: que el sistema aguante crecimiento real (10k+ filas por tabla, 50+ usuarios concurrentes).
> Sin esto, la app se siente lenta a partir de los 2k registros.

### Tareas

| # | Tarea | Esfuerzo | Impacto |
|---|---|---|---|
| 3.1 | **Lazy loading de TODAS las rutas** en `App.tsx` (`React.lazy` + `<Suspense>`) | M | 🔴 Bundle inicial −60% |
| 3.2 | **Dynamic import de `jspdf`** en handlers de descarga (PDF se descarga solo si se usa) | S | 🔴 −300KB ruta crítica |
| 3.3 | **Server-side pagination**: agregar `.range(from, to)` a `useClients`, `useProjects`, `useLeads`, `useMaterials`, `usePayments`, `useExpenses`; configurar `DataTable` con `manualPagination: true` | L | 🔴 Escala a 100k+ filas |
| 3.4 | `manualChunks` en `vite.config.ts`: separar `recharts`, `jspdf`, `framer-motion`, `@hello-pangea/dnd` en chunks dedicados | S | 🟡 |
| 3.5 | Bundle analyzer: agregar `rollup-plugin-visualizer` y revisar el resultado | XS | 🟡 |
| 3.6 | `React.memo` en `MetricsGrid`, `DataTable`, `CategoryHeader`, `Sidebar`, `TopBar` | S | 🟡 −70% re-renders al teclear en search |
| 3.7 | `useCallback` para handlers que se pasan a hijos memorizados | M | 🟡 |
| 3.8 | Eliminar doble `useClients` en `Clients.tsx` (usar una sola query y memorizar métricas) | XS | 🟢 |
| 3.9 | Optimistic updates en `useReorderKanban` y `useArchiveProject` (drag&drop sin lag visual) | M | 🟢 |
| 3.10 | Reducir duración de animaciones de `recharts` (de 2000ms a 400ms) | XS | 🟢 |
| 3.11 | Reforzar políticas RLS en Supabase con filtros por rol donde aplique | M | 🟡 Seguridad |
| 3.12 | **Integrar Sentry** para captura de errores en producción + configurar `ignoreErrors` para filtrar ruido de extensiones (ver `KNOWN_ISSUES.md` §1.1) | M | 🟡 Observabilidad |

**Definición de "hecho"** para Fase 3:
- Lighthouse Performance ≥ 85 en `/login`
- Tabla de Clients carga en < 500ms con 5000 filas
- Bundle inicial (chunk de entry) < 250 KB gzipped
- Las páginas pesadas (Dashboard, QuotationBuilder, Inventory) son chunks separados

---

## ⏳ Fase 4 — Refactor Estructural (3-4 semanas)

> **Objetivo**: reducir el código ~30% extrayendo patrones repetidos. Hace que agregar features sea trivial.
> Esta fase **no es urgente** pero el código pide a gritos extraerla.

### Tareas

| # | Tarea | Esfuerzo | Impacto |
|---|---|---|---|
| 4.1 | **Crear `<ResourceListPage<T>>` genérico** con props `{ queryHook, columns, filterConfig, metricsBuilder, detailFields }` | L | 🟡 −2500 LOC |
| 4.2 | Migrar 10 páginas list (`Inventory`, `Clients`, `Leads`, `Quotations`, `Projects`, `Materials`, `Holidays`, `Pricing`, `Users`, `Gastos`) a usar `<ResourceListPage>` | L | 🟡 |
| 4.3 | Dividir `QuotationBuilder.tsx` (1260 líneas) en `QuotationSteps/`, `QuotationPreview/`, `quotationPdf.ts` | L | 🟡 |
| 4.4 | Dividir `Dashboard.tsx` (751 líneas) en `<KpiCard>`, `<ProjectsChart>`, `<PriorityList>`, `<RecentTable>` | M | 🟢 |
| 4.5 | Reorganizar `src/`: <br>– Renombrar `features/` → `features/cotizador/` <br>– Mover hooks de dominio a subcarpetas (`hooks/clients/`, `hooks/leads/`, etc.) | M | 🟡 Estructura clara |
| 4.6 | Componente `<InteractiveCard>` reemplaza el patrón "hover lift" repetido en 8 páginas | S | 🟢 |
| 4.7 | Variant de `<Button>` para el estilo `uppercase tracking-widest` repetido | S | 🟢 |
| 4.8 | Reemplazar 117 hex hardcodeados (`#44ddc1`, `#1c1b1b`, etc.) por CSS variables / Tailwind tokens | M | 🟢 |
| 4.9 | (Opcional) Migrar `server.ts` a Vercel Functions / Supabase Edge Functions, eliminar Express | M | 🟢 Simplifica deploy |
| 4.10 | (Opcional) Sistema i18n con `i18next`, eliminar `formatSentenceCase` aplicado a literales | L | 🟢 Multi-idioma |

**Definición de "hecho"** para Fase 4:
- `src/pages/Clients.tsx`, `Leads.tsx`, `Inventory.tsx`, etc. son < 80 líneas cada uno (solo configuración del `<ResourceListPage>`)
- Cero colores hex hardcodeados en componentes
- No hay archivos > 500 líneas (excepto componentes intencionalmente grandes como tablas complejas)
- Agregar una nueva entidad CRM toma < 1 día (no 1 semana)

---

## 🔮 Fases futuras (sin compromiso)

Ideas para cuando todo lo anterior esté hecho:

- **Tests automatizados**: Vitest está instalado pero solo hay 1 test. Cobertura mínima en utilities y hooks críticos.
- **Storybook**: para los componentes shared (DataTable, MetricsGrid, etc.) — facilita visualizar variantes.
- **Telemetría**: Sentry para errores en producción, Posthog/Plausible para uso.
- **Modo offline**: PWA con Service Worker para que la app funcione sin conexión (especialmente útil para instaladores en obra).
- **Notificaciones push**: cuando un cliente aprueba/rechaza, cuando se completa una etapa.
- **Edge Functions**: para webhook de Meta WhatsApp, cron de recordatorios, etc.

---

## 📈 Cómo trabajar con este roadmap

1. **Empieza siempre por la fase más baja sin completar.** No saltes fases.
2. **Cierra una tarea por completo antes de empezar la siguiente.** No dejes cosas a medias.
3. **Cuando termines una fase**:
   - Mueve esta sección a `changelog/YYYY-MM-DD-phase-N.md`
   - Marca aquí como completada
   - Actualiza `ARCHITECTURE.md` y `CONVENTIONS.md` con los nuevos patrones
4. **Si descubres trabajo nuevo durante una fase**, agrégalo a la fase apropiada (no a la actual). Mantén el alcance.
5. **Las estimaciones de esfuerzo** son XS (<2h), S (medio día), M (1-2 días), L (3-5 días). Para un dev experimentado trabajando full-time.

---

## 🎯 Norte estratégico

El destino es un CRM que cualquier dev nuevo pueda entender en **medio día**, donde agregar un módulo nuevo (ej: "Proveedores") tome **un día**, y donde el sistema **nunca mienta al usuario** sobre el estado real de los datos.

Cada fase nos acerca a ese norte. La Fase 1 ya nos puso en la dirección correcta. 🚀
