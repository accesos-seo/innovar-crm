# 🏛️ Arquitectura del Sistema

> El mapa mental de cómo funciona Innovar CRM. Lee esto **primero** si eres nuevo.

---

## 1. Qué es Innovar CRM

CRM y sistema de gestión interna para **Innovar Interior** — empresa de diseño y fabricación de cocinas, closets y muebles a medida.

**Cubre el flujo completo de negocio**:

```
  Lead (solicitud)
       ↓
  Cliente
       ↓
  Cotización  ──→  Cotización aprobada
                        ↓
                    Proyecto  ──→  Diseño 3D  ──→  Producción  ──→  Instalación  ──→  Entregado
                        ↑
                   (con pagos, gastos, tareas y cierres contables asociados)
```

---

## 2. Stack tecnológico

### Frontend
- **React 19** + **TypeScript** + **Vite 6** — el framework y bundler
- **React Router 7** — routing
- **TanStack Query v5** (React Query) — caché y sincronización de datos de servidor
- **Zustand** — estado global del cliente (solo auth + UI)
- **Tailwind CSS v4** + **shadcn/ui** + **Radix UI** — estilos y primitivos accesibles
- **Framer Motion** — animaciones
- **Zod** — validación de schemas
- **Recharts** — gráficas
- **jsPDF** — generación de PDFs en cliente

### Backend
- **Supabase** — Postgres + Auth + Storage + RLS (Row-Level Security)
- **Express** (`server.ts`) — wrapper alrededor de Vite + 2 endpoints custom para cotizaciones

### Identidad del proyecto
- **Supabase project ID**: `xdzbjptozeqcbnaqhtye`
- **Puerto local**: `http://localhost:3000`
- **Repositorio**: `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\CRM-INNOVAR-APP-main\`

---

## 3. Arquitectura en capas

El sistema tiene **5 capas claramente separadas**. Cada una tiene una responsabilidad única.

```
┌─────────────────────────────────────────────────────────────┐
│  1. PÁGINAS  (src/pages/)                                   │
│     Routing, composición de componentes, layout específico  │
└─────────────────────────────────────────────────────────────┘
                            ↓ usa
┌─────────────────────────────────────────────────────────────┐
│  2. COMPONENTES  (src/components/)                          │
│     UI reutilizable: cards, tablas, modales, forms          │
└─────────────────────────────────────────────────────────────┘
                            ↓ usa
┌─────────────────────────────────────────────────────────────┐
│  3. HOOKS  (src/hooks/)                                     │
│     Lógica de datos: queries, mutations a Supabase          │
└─────────────────────────────────────────────────────────────┘
                            ↓ usa
┌─────────────────────────────────────────────────────────────┐
│  4. LIBS  (src/lib/)                                        │
│     Utilidades puras: errors, timeout, format, supabase     │
│     client. NO depende de React.                            │
└─────────────────────────────────────────────────────────────┘
                            ↓ usa
┌─────────────────────────────────────────────────────────────┐
│  5. SCHEMAS + TYPES  (src/schemas/, src/types/)             │
│     Validación Zod y tipos TypeScript                       │
└─────────────────────────────────────────────────────────────┘
```

### Regla clave: las dependencias van solo hacia abajo

- ✅ Una **página** puede importar de **componentes, hooks, lib, types**.
- ✅ Un **componente** puede importar de **hooks, lib, types**.
- ✅ Un **hook** puede importar de **lib, schemas, types**.
- ❌ Un hook **NO** puede importar de un componente o página.
- ❌ Una utilidad de `lib/` **NO** puede importar de React Query o componentes.

> Esto evita ciclos de dependencias y hace el código testeable en aislamiento.

---

## 4. Flujo de datos (el camino que recorre un dato)

Sigamos un ejemplo concreto: **"el usuario crea un cliente nuevo"**.

```
1. Usuario abre /clients/new           [src/pages/ClientCreate.tsx]
                ↓
2. Llena el formulario y hace submit
                ↓
3. El form llama a useLeads().createLead(formData)   [hook]
                ↓
4. El hook valida con Zod (si aplica)                [src/schemas/]
                ↓
5. El hook llama supabase.from('clients').insert()   [Supabase client]
                ↓
6. Si hay error → throw mapSupabaseError(error)      [src/lib/errors.ts]
                ↓                              ↓
7. React Query captura el throw       El `onError` muestra toast con mensaje en español
                ↓
8. Si todo va bien, onSuccess invalida la caché → la tabla se refresca sola
```

**Por qué este flujo:**
- El usuario nunca ve un error técnico crudo (siempre español, siempre humano)
- El estado de la app se mantiene consistente automáticamente vía React Query
- Cualquier capa puede ser reemplazada sin afectar a las demás

---

## 5. Gestión del estado

Tres tipos de estado, tres herramientas diferentes:

| Tipo de estado | Herramienta | Ejemplo |
|---|---|---|
| **Estado de servidor** (datos que vienen de Supabase) | **React Query** | Lista de clientes, proyectos, pagos |
| **Estado global de cliente** (no viene de servidor) | **Zustand** | Usuario logueado, sidebar colapsado |
| **Estado local de UI** | **useState** | Modal abierto, input controlado |

> ⚠️ **Anti-patrón**: copiar datos de React Query a Zustand. React Query ya es la fuente de verdad; duplicar genera bugs de sincronización.

### Zustand stores actuales

- **`src/store/authStore.ts`** — sesión de Supabase + perfil del usuario
- **`src/store/uiStore.ts`** — estado de UI compartido (sidebar)

Mantén esto **pequeño**. Si dudas si algo debe ir aquí, probablemente no.

---

## 6. Estructura de carpetas

```
src/
├── App.tsx                # Routing, providers globales, ErrorBoundary
├── main.tsx               # Entry point de Vite
│
├── pages/                 # Una página = una ruta
│   ├── Dashboard.tsx
│   ├── Clients.tsx
│   ├── Projects.tsx
│   ├── settings/          # Páginas de /settings/*
│   └── ...
│
├── components/
│   ├── ui/                # Primitivos shadcn (Button, Input, Card, etc.)
│   ├── shared/            # Componentes propios reutilizables (ErrorBoundary,
│   │                      # ProtectedRoute, DataTable, EmptyState, etc.)
│   ├── layout/            # Sidebar, TopBar, Footer, Layout
│   └── [dominio]/         # Específicos de dominio: finanzas/, tareas/, etc.
│
├── hooks/
│   ├── useClients.ts      # Hooks de nivel raíz (todavía sin agrupar)
│   ├── useProjects.ts
│   ├── finanzas/          # Hooks agrupados por dominio
│   ├── tareas/
│   ├── agenda/
│   └── notifications/
│
├── lib/                   # Utilidades puras (sin React)
│   ├── errors.ts          # AppError, mapSupabaseError, notifyError
│   ├── supabaseClient.ts  # Cliente Supabase configurado
│   ├── timeout.ts         # withTimeout
│   ├── format-utils.ts    # Formateo de fechas, moneda, etc.
│   └── utils.ts           # cn (Tailwind class merger)
│
├── schemas/               # Validación Zod
│   ├── project.ts
│   └── quotation.ts
│
├── types/                 # Tipos TypeScript
│   ├── database.ts        # Tipos manuales (legado)
│   ├── database.types.ts  # Tipos autogenerados por Supabase CLI (preferido)
│   └── auth.ts
│
├── store/                 # Zustand stores
│   ├── authStore.ts
│   └── uiStore.ts
│
└── features/              # Módulos grandes self-contained
    └── hardware/          # El cotizador / motor de precios
```

### Convención de nombres
- **Carpetas**: `kebab-case` o `camelCase` para subgrupos (`tareas/`, `finanzas/`)
- **Archivos de componentes**: `PascalCase.tsx` (`DataTable.tsx`)
- **Archivos de hooks**: `useFoo.ts` (`useClients.ts`)
- **Archivos de utilidades**: `kebab-case.ts` (`format-utils.ts`)

> ⚠️ Hay algunas inconsistencias menores (ej: `use-closet-calculator.ts` en kebab-case). Se unificarán en la **Fase 2**.

---

## 7. Seguridad (lo que se hizo en Fase 1)

### Capas de defensa

```
1. ProtectedRoute     →  Bloquea acceso a rutas sin login
2. Layout/Sidebar     →  Solo se renderiza con sesión válida
3. RLS de Supabase    →  Última línea: el servidor también valida
4. Roles en frontend  →  Algunas rutas requieren admin/super_admin
```

### Roles del sistema

| Rol | Acceso |
|---|---|
| `super_admin` | Todo |
| `admin` | Todo excepto algunas operaciones críticas |
| `comercial` | Default. Acceso a clientes, leads, cotizaciones |
| `disenador` | Acceso a proyectos asignados, diseños, tareas |
| `jefe_taller` | Acceso a producción, materiales |
| `operario` | Acceso limitado a tareas asignadas |

> **Importante**: estos roles también deben estar configurados en las **políticas RLS** de Supabase. El frontend solo gatea la UI; la seguridad real está en la DB.

### Manejo de errores centralizado

Todo error de Supabase pasa por `mapSupabaseError()` (en `src/lib/errors.ts`), que:
1. Lo clasifica (`AUTH_REQUIRED`, `RLS_DENIED`, `NETWORK`, `TIMEOUT`, etc.)
2. Lo traduce a un mensaje en español comprensible
3. Lo lanza como `AppError` para que React Query lo capture

El `<ErrorBoundary>` global atrapa cualquier error no manejado y muestra una pantalla de recuperación en lugar de un screen blanco.

Ver detalles en [`CONVENTIONS.md`](./CONVENTIONS.md#manejo-de-errores).

---

## 8. Decisiones arquitectónicas relevantes

### ✅ Supabase como backend único
**Por qué**: Postgres + Auth + Storage + Realtime + RLS en un solo servicio. Reduce DevOps a casi cero. Las RLS policies permiten que el frontend hable directo con la DB sin un backend custom.

**Trade-off**: dependencia fuerte de Supabase. Migrar a otro proveedor requeriría reescribir las RLS y posiblemente parte del cliente. **Aceptable** para una empresa pequeña/mediana.

### ✅ React Query como única caché de datos de servidor
**Por qué**: deduplicación automática, refetch inteligente, optimistic updates, sincronización entre componentes. Elimina manualmente escribir `useEffect + setState` para fetching.

**Trade-off**: curva de aprendizaje, especialmente con `queryKey` y `invalidateQueries`. Vale la pena.

### ✅ Zod para validación
**Por qué**: schemas reutilizables, errores tipados, inferencia automática de tipos TypeScript. Una sola definición sirve para validar input y tipar la salida.

### ⚠️ Express + Vite middleware (revisar en Fase 4)
**Por qué se hizo así originalmente**: 2 endpoints custom (`/api/quotations/calculate-item` y `/api/quotations/save`) requerían lógica server-side.

**Por qué es cuestionable hoy**: complica el deploy (necesita Node server permanente en vez de hosting estático). Esos 2 endpoints podrían migrar a Supabase Edge Functions y eliminar Express por completo.

**Estado**: pendiente para Fase 4.

### ✅ Generación de `quotation_number` server-side (Fase 1)
**Por qué**: el método anterior (leer último, incrementar en cliente, insertar) tenía race condition bajo concurrencia. Se reemplazó por una función Postgres con `pg_advisory_xact_lock`.

Ver `db/migrations/001_generate_quotation_number.sql`.

---

## 9. Anti-patrones identificados (a corregir en fases siguientes)

| Anti-patrón | Dónde | Fase de corrección |
|---|---|---|
| `tsconfig.json` sin `strict: true` | Raíz del proyecto | Fase 2 |
| Tipos duplicados (manual + autogenerado + inline) | `src/types/`, `src/hooks/` | Fase 2 |
| Sin `<ResourceListPage>` genérico — 10 páginas duplican el mismo esqueleto | `src/pages/` | Fase 4 |
| Sin code splitting — todo el bundle en `/login` | `src/App.tsx` | Fase 3 |
| Paginación 100% cliente — no escala a +2k filas | `src/hooks/*.ts`, `DataTable.tsx` | Fase 3 |
| Sin `React.memo` ni `useCallback` consistentemente | Global | Fase 3 |

Ver [`ROADMAP.md`](./ROADMAP.md) para el detalle de cada fase.

---

## 10. Glosario rápido

- **RLS** (Row-Level Security): mecanismo de Postgres/Supabase para autorizar lectura/escritura a nivel de fila según el usuario logueado.
- **Query Key**: identificador único de una query en React Query. Ej: `['projects', { status: 'active' }]`.
- **Optimistic update**: actualizar la UI inmediatamente asumiendo éxito, y revertir si el servidor falla. Mejor UX.
- **Mutation**: operación de escritura (insert/update/delete) en React Query.
- **Schema**: en este proyecto se refiere a (a) schema Zod para validación o (b) schema SQL de Supabase. El contexto aclara.
- **`AppError`**: clase custom (en `src/lib/errors.ts`) que envuelve errores con un código, mensaje en español y la causa original.
