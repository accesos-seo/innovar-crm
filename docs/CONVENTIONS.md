# 📐 Convenciones de Código

> Cómo escribir código nuevo en Innovar CRM **sin volver a la deuda técnica que limpiamos**.
> Si dudas qué patrón usar, este archivo manda.

---

## 1. Manejo de errores

### Regla #1: **Nunca silenciar errores**

❌ **Mal** (patrón viejo, eliminado en Fase 1):
```ts
if (error) {
  console.warn("Error:", error);
  return [];   // ← El usuario ve "guardado correctamente" aunque falló
}
```

✅ **Bien**:
```ts
if (error) throw mapSupabaseError(error);
```

### Regla #2: **Usa los helpers de `src/lib/errors.ts`**

| Helper | Para qué |
|---|---|
| `assertSupabase(supabase)` | Throws si `supabase` es null. Usa al inicio de cada `queryFn` / `mutationFn`. |
| `mapSupabaseError(error)` | Convierte cualquier error de Supabase en un `AppError` con mensaje en español. |
| `notifyError(error, "Error al X")` | Muestra toast. Usa en `onError` de mutations. |
| `AppError` | Lanza errores custom: `throw new AppError("AUTH_REQUIRED", "Inicia sesión.")` |
| `unwrapSupabase(response)` | Atajo: hace `if (error) throw...; return data`. Útil en flujos secuenciales. |

### Códigos de error mapeados

`mapSupabaseError` traduce automáticamente:

| Postgres code | Significado | Mensaje al usuario |
|---|---|---|
| `42501` | RLS denied | "No tienes permisos para esta operación." |
| `PGRST301` | JWT expired | "Tu sesión expiró. Inicia sesión nuevamente." |
| `PGRST116` | Row not found | "El registro solicitado no existe." |
| `23505` | Unique violation | "Ya existe un registro con esos datos." |
| `23503` | Foreign key violation | "Hay relaciones que impiden la operación." |
| `23502` / `23514` | Not null / check constraint | "Faltan campos requeridos o son inválidos." |
| Timeout | (cliente o servidor) | "La operación tardó demasiado." |
| Network failure | Fetch failed | "Sin conexión al servidor." |

---

## 2. Cómo escribir un hook de datos

### Plantilla para queries (lectura)

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/timeout";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";
import type { MyEntity } from "@/types/database";

export function useMyEntities(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["my_entities", filters],
    staleTime: 1000 * 60 * 5,  // 5 min — ajustar según volatilidad
    retry: 0,                    // dejamos que el global lo maneje
    queryFn: async (): Promise<MyEntity[]> => {
      assertSupabase(supabase);

      let query = supabase
        .from("my_table")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);

      const response = (await withTimeout(query as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as MyEntity[]) || [];
    },
  });
}
```

### Plantilla para mutations (escritura)

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { mySchema } from "@/schemas/myEntity";   // siempre validar con Zod
import { toast } from "sonner";

export function useCreateMyEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MyEntityInput) => {
      assertSupabase(supabase);

      // 1. Validar con Zod
      const validated = mySchema.parse(input);

      // 2. Insertar
      const { data, error } = await supabase
        .from("my_table")
        .insert(validated)
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_entities"] });
      toast.success("Registrado correctamente");
    },
    onError: (error) => notifyError(error, "Error al registrar"),
  });
}
```

### Reglas adicionales para hooks

- **`retry: 0`** — explícito, no confiar en el default de React Query
- **`staleTime`** — define cuánto dura el caché "fresco". Recomendado:
  - Datos casi-estáticos (festivos, catálogos): `1000 * 60 * 60` (1h)
  - Datos de negocio (clientes, proyectos): `1000 * 60 * 5` (5min)
  - Datos en tiempo real (notificaciones): no usar staleTime o muy bajo
- **No mezclar fetches** — un hook = una tabla principal. No combinar consultas con `Promise.all` adentro.
- **Filtros como objeto** — `useMyEntities(filters)` no `useMyEntities(status, type, ...)`.
- **Tipar el retorno** — `queryFn: async (): Promise<MyEntity[]> => { ... }`.

---

## 3. Cómo escribir una página (route)

### Estructura mínima

```tsx
import { useNavigate } from "react-router-dom";
import { useMyEntities } from "@/hooks/useMyEntities";
import { DataTable } from "@/components/shared/DataTable";
import { CategoryHeader } from "@/components/shared/CategoryHeader";

export default function MyEntitiesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useMyEntities();

  // El componente NUNCA muestra error técnico crudo.
  // React Query + ErrorBoundary global ya manejan los catastróficos.
  // Aquí solo renderizamos el estado.

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader
        title="MIS ENTIDADES"
        subtitle="Descripción corta"
        onBack={() => navigate("/")}
      />
      <DataTable
        data={data || []}
        isLoading={isLoading}
        columns={columns}
      />
    </div>
  );
}
```

### Reglas

- **Una página = un default export**
- **No definir hooks dentro del componente** (excepto los hooks de React: `useState`, `useMemo`, etc.)
- **Routing**: la página NO sabe en qué ruta está montada. Recibe `useParams()` para leer la URL si necesita.
- **Auth**: la página NO chequea auth. El `<ProtectedRoute>` ya lo hizo arriba en `App.tsx`.

---

## 4. Cómo agregar una ruta nueva

Edita `src/App.tsx`:

```tsx
<Route
  path="/mi-modulo"
  element={<Protected><MiModuloPage /></Protected>}
/>
```

Para ruta que solo admins pueden ver:
```tsx
<Route
  path="/settings/algo-critico"
  element={
    <Protected roles={["admin", "super_admin"]}>
      <AlgoCriticoPage />
    </Protected>
  }
/>
```

### Convenciones de URL

- **Plurales para listados**: `/clients`, `/projects`, `/quotations`
- **`:id` para detalle**: `/projects/:id`
- **`new` para crear**: `/projects/new`
- **`/settings/*` para configuración**: `/settings/users`, `/settings/holidays`
- **Idioma**: cuando hay duda, usar español (`/finanzas/pagos`) o inglés consistentemente. **Decisión pendiente para Fase 2.**

---

## 5. Cómo agregar un tipo TypeScript

### Para una tabla de Supabase
1. **Preferido**: regenerar `src/types/database.types.ts` con Supabase CLI:
   ```bash
   npx supabase gen types typescript --project-id xdzbjptozeqcbnaqhtye > src/types/database.types.ts
   ```
2. **Mientras tanto**: agregar la interfaz en `src/types/database.ts`.

### NO HAGAS:
❌ Definir el tipo inline dentro del hook (`useMaterials` y `usePricing` lo hacían — es deuda técnica).

### Para algo que no es una tabla
- Si es input de un formulario → schema Zod en `src/schemas/`
- Si es un tipo helper → archivo dedicado en `src/types/`

---

## 6. Validación con Zod

**Toda escritura a Supabase debe validar con Zod primero.**

```ts
// src/schemas/myEntity.ts
export const myEntitySchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
});

// En el hook:
const validated = myEntitySchema.parse(input);  // ← throws si no pasa
await supabase.from("my_table").insert(validated);
```

**Por qué**: el frontend valida antes de gastar un round-trip al servidor. Errores tipados, mensajes claros, tipos automáticos.

> Actualmente solo `projects` y `quotations` tienen schemas. **Pendiente para Fase 2**: agregar para el resto (`clients`, `materials`, `pricing_catalog`, `holidays`, `tasks`, `expenses`, `payments`).

---

## 7. Naming

| Tipo | Convención | Ejemplo |
|---|---|---|
| Componente React | `PascalCase.tsx` | `DataTable.tsx` |
| Hook | `useXxx.ts` (camelCase) | `useClients.ts` |
| Utilidad pura | `kebab-case.ts` | `format-utils.ts` |
| Tipo / interfaz | `PascalCase` | `interface Client { }` |
| Constante exportada | `SCREAMING_SNAKE_CASE` | `DEFAULT_PAGE_SIZE` |
| Variable / función | `camelCase` | `const userName` |
| Carpeta de dominio | `lowercase` o `kebab-case` | `tareas/`, `agenda/` |
| Query key (React Query) | array con string + filtros | `["projects", { status: "active" }]` |

### Idioma de identificadores
- **Código** (variables, funciones, tipos): **inglés**
- **Tablas Supabase**: **inglés** (`clients`, `projects`)
- **Mensajes UI**: **español**
- **Comentarios técnicos**: ambos, preferir inglés para uniformidad
- **Documentación humana** (este archivo): **español**

---

## 8. Estilos y Tailwind

### Usar tokens de diseño, no colores hex

❌ **Mal**:
```tsx
<div className="bg-[#1c1b1b] text-[#44ddc1]">
```

✅ **Bien**:
```tsx
<div className="bg-card text-primary">
```

Los tokens viven en `src/index.css` como variables CSS. Si necesitas un color nuevo, agrégalo allí, no inline.

### Componentes shadcn — no modificar `src/components/ui/`
Esos son los primitivos. Si necesitas un botón con estilo especial, crea un variant en `button.tsx` o un componente nuevo en `src/components/shared/`.

### Clases repetidas → componente o util
Si copias 5+ clases Tailwind en 3+ lugares, extráelas:
```tsx
// Antes (repetido en 8 páginas):
<div className="bg-card/50 p-4 rounded-sm border border-border/10 hover:-translate-y-1 hover:shadow-2xl ...">

// Después:
<InteractiveCard>...</InteractiveCard>
```

---

## 9. Performance — guidelines mínimos

- **Memoiza arrays/objects derivados** que se pasan a hijos:
  ```tsx
  const filtered = useMemo(() => items.filter(...), [items]);
  ```
- **`useCallback`** para handlers que se pasan a `React.memo` o hooks como `useEffect`.
- **No crear arrays inline en props de listas** (cada render rompe memoización aguas abajo):
  ```tsx
  // ❌ Mal
  <Component options={[1, 2, 3]} />
  // ✅ Bien
  const options = useMemo(() => [1, 2, 3], []);
  <Component options={options} />
  ```
- **Lazy-load páginas pesadas** (Recharts, jsPDF, drag&drop): usar `React.lazy()` — esto se hace masivamente en Fase 3.

---

## 10. Anti-patrones — qué NO hacer

| ❌ Anti-patrón | ✅ En su lugar |
|---|---|
| `as any` para silenciar TS | Tipear correctamente o usar `unknown` y narrow |
| `useEffect` para fetch de datos | `useQuery` |
| Setear `useState` después de `fetch` | `useQuery` con `data` directo |
| Asignar `role: 'admin'` por defecto al crear perfil | Mínimo privilegio: `'comercial'` |
| Importar de `@/types/database` y `useMaterials` al mismo tiempo (tipo duplicado) | Usar la fuente única que corresponda |
| `console.warn(error); return [];` en hooks | `throw mapSupabaseError(error)` |
| Copiar/pegar el esqueleto de una página listado | Esperar a Fase 4 (componente `<ResourceListPage>`) |
| Generar IDs/números secuenciales en cliente | RPC server-side con lock (ej: `generate_next_quotation_number`) |
| Operaciones masivas sin RLS check | RLS siempre activa; el frontend asume que puede fallar |

---

## 11. Cuando dudes…

1. **Mira un hook ya refactorizado** (Fase 1) como referencia:
   - Query simple: `src/hooks/finanzas/useExpenses.ts`
   - Mutation con upload de archivo: `src/hooks/finanzas/useCreatePayment.ts`
   - Hook completo (queries + mutations): `src/hooks/useProjects.ts`
   - Race condition + retry: `src/hooks/useQuotations.ts`

2. **Lee** [`ARCHITECTURE.md`](./ARCHITECTURE.md) y este archivo.

3. **Pregunta** en el equipo. Si la respuesta toma >30 min de excavación, **documéntala aquí**.

---

## 12. Checklist antes de hacer commit

- [ ] El nuevo código sigue las convenciones de naming
- [ ] Errores se manejan con `mapSupabaseError` y `notifyError`
- [ ] Mutations tienen `onError`
- [ ] Validación Zod en operaciones de escritura
- [ ] Tipos correctos (no `as any`)
- [ ] No hay colores hex hardcodeados
- [ ] Si agregaste un patrón nuevo, lo documentaste aquí
- [ ] Si tocaste el schema de Supabase, agregaste migración en `db/migrations/`
