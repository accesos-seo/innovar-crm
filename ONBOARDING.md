# ONBOARDING — CRM Innovar App
> Documento para agentes de IA que se incorporan al proyecto. Léelo completo antes de tocar cualquier archivo.
> Última actualización: 2026-05-18

---

## 1. Identidad del proyecto

**CRM Innovar App** es un sistema de gestión para una empresa colombiana de cocinas y muebles a medida. Incluye: cotizaciones paramétricas, clientes, proyectos, agenda, finanzas y reportes.

### Rutas del proyecto

| Propósito | Ruta |
|---|---|
| **Trabajo real (git, edición)** | `C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main` |
| Alias OneDrive (mismo contenido) | `C:\Users\ceoel\OneDrive\Documentos\Agents-automations\Innovar-App-main` |

> **REGLA CRÍTICA:** Todos los comandos de terminal (`git`, `npm`) deben darse al usuario para ejecutar manualmente. Las tareas PowerShell en background se cuelgan en rutas de OneDrive. Nunca usar `run_in_background` en este proyecto.

### Contexto de herramientas

- **CLAUDE.md** en la raíz del proyecto: leído automáticamente — contiene info de acceso a GitHub y Vercel
- **Supabase MCP del entorno**: conectado a proyectos `Light_House` y `Swarm Agentes MD`, **NO** al proyecto Innovar. No usarlo para queries de Innovar.

---

## 2. Accesos

### GitHub

| Campo | Valor |
|---|---|
| Repositorio | https://github.com/accesos-seo/innovar-crm |
| Rama activa | `master` |
| Usuario | `accesos-seo` |
| Auth | GitHub CLI (`gh`) instalado y autenticado |

**Comando para push (copiar y pegar exacto):**
```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; git add ARCHIVO1 ARCHIVO2; git commit -m "descripcion"; git push origin master
```

> Siempre especificar archivos individualmente. Nunca `git add .` — hay archivos sensibles.

### Vercel

| Campo | Valor |
|---|---|
| Proyecto | `crm-innovar-app-2026` |
| URL producción | https://crm-innovar-app-2026.vercel.app |
| Project ID | `prj_dowuuH3bdSTKuNbnNOUCWD2Hxjpi` |

> **ADVERTENCIA:** Vercel está conectado a `Rvirona/CRM-INNOVAR-APP:main`, pero el trabajo va a `accesos-seo/innovar-crm:master`. Los push **NO** disparan deploys automáticos. Hay que hacer deploy manual.

**Deploy manual (dar al usuario):**
```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; npx vercel --prod --token TU_VERCEL_TOKEN_AQUI --yes
```

### Supabase

| Campo | Valor |
|---|---|
| Project ID | `xdzbjptozeqcbnaqhtye` |
| Nombre | Innovar CRM |
| URL | `https://xdzbjptozeqcbnaqhtye.supabase.co` |
| Claves | En `.env` del proyecto (nunca subir a GitHub) |

El cliente Supabase vive en `src/lib/supabaseClient.ts` con fallback hardcodeado a la URL de Innovar.

### Servidor local de desarrollo

```powershell
Set-Location "C:\Users\ceoel\OneDrive\Escritorio\mi proyect\Agents-automations\Innovar-App-main"; npm run dev
```
Esto levanta Express + Vite en `localhost:3000`. La API del motor de cocinas (`/api/quotations/calculate-item`) solo existe en este servidor local — en Vercel el subtotal de cocina siempre muestra $0.

---

## 3. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 |
| UI | shadcn/ui **personalizado** con `@base-ui/react` (NO Radix UI) |
| Estilos | Tailwind CSS 4 |
| Formularios | react-hook-form + zod |
| Estado global | Zustand |
| Data fetching | @tanstack/react-query |
| Base de datos | Supabase (PostgreSQL) |
| Servidor | Node.js + Express (`server.ts`) |
| Animaciones | framer-motion |
| Iconos | lucide-react |

### ⚠️ Diferencia crítica de UI: `@base-ui/react`

Los componentes `Select` y `Dialog` en `src/components/ui/` **NO son Radix UI** estándar — son wrappers de `@base-ui/react`. Esto tiene implicaciones importantes:

**Select:**
- `SelectItem` necesita el prop `label` para que `SelectValue` muestre texto legible. Sin `label`, muestra el `value` crudo (ej. "COMPLETA_STANDARD" en lugar de "Completa Standard").
- `SelectTrigger` tiene `w-fit` por defecto — siempre agregar `w-full` en la clase.
- `SelectContent` hereda el ancho del trigger con `w-(--anchor-width)`.

```tsx
// CORRECTO:
<SelectTrigger className="w-full h-14 ...">
  <SelectValue />
</SelectTrigger>
<SelectContent>
  <SelectItem value="COMPLETA_STANDARD" label="Completa Standard">
    Completa Standard
  </SelectItem>
</SelectContent>

// INCORRECTO (muestra "COMPLETA_STANDARD" en el trigger):
<SelectItem value="COMPLETA_STANDARD">Completa Standard</SelectItem>
```

**Dialog:**
- `DialogTrigger` soporta `asChild` (via `React.cloneElement`) O el prop `render`.
- `DialogContent` usa `DialogPortal` internamente.

---

## 4. Arquitectura del cotizador (foco principal)

El cotizador paramétrico es el núcleo del CRM. Sigue un patrón de 3 capas:

```
src/features/[modulo]/logic.ts              → Motor puro (tipos, constantes, cálculo)
src/hooks/use-[modulo]-calculator.ts        → Hook React (useMemo sobre el motor)
src/features/[modulo]/[Modulo]Module.tsx    → UI (Card + footer con total)
```

### Hub central

`src/components/quotations/steps/QuotationDesignStep.tsx`

- Renderiza un `<Tabs>` con todas las categorías.
- `ItemWrapper` está definido a nivel de módulo (fuera del componente) — **NUNCA moverlo adentro** del componente o causará React error #185 (bucle infinito de remounts).
- Cada módulo notifica cambios vía `onDataChange(total, config)`.
- `config` se guarda en `quotation_items.configuration` (JSONB) en Supabase.

### Estado global del cotizador

`src/hooks/quotations/useQuotationBuilder.ts`

Este hook maneja todo el estado del flujo de cotización:
- Paso 1: selección de cliente
- Paso 2: diseño paramétrico (módulos)
- Paso 3: revisión y guardado

Items iniciales (siempre pre-cargados):
```typescript
const INITIAL_ITEMS = [
  { id: 'initial-cocina',    category: 'cocina',    calculatedTotal: 0, configuration: {} },
  { id: 'initial-closet',    category: 'closet',    calculatedTotal: 0, configuration: {} },
  { id: 'initial-puerta',    category: 'puerta',    calculatedTotal: 0, configuration: {} },
  { id: 'initial-tv-center', category: 'tv_center', calculatedTotal: 0, configuration: {} },
  { id: 'initial-herrajes',  category: 'herrajes',  calculatedTotal: 0, configuration: {} },
  { id: 'initial-especiales',category: 'especiales',calculatedTotal: 0, configuration: {} },
];
```

### Patrón anti-bucle infinito (lastUpdateRef)

Todos los módulos usan este patrón para evitar loops en `onDataChange`:

```typescript
const lastUpdateRef = React.useRef({ total: -1, configStr: '' });
React.useEffect(() => {
  const total = results.total; // o calculation?.data?.calculated_total
  const configStr = JSON.stringify(formData);
  if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
    lastUpdateRef.current = { total, configStr };
    onDataChange(total, formData);
  }
}, [results, formData, onDataChange]);
```

---

## 5. Módulos del cotizador — Estado completo

### 5.1 Cocina Integral (`src/features/kitchen/`)

| Archivo | Descripción |
|---|---|
| `KitchenModule.tsx` | UI — usa `@hookform/resolvers/zod` + `useCalculatePrice` |
| `logic.ts` | No contiene motor — usa edge function server |
| `src/hooks/useCalculatePrice.ts` | Hook que llama a `/api/quotations/calculate-item` |
| `server/services/kitchen.engine.ts` | Motor de cálculo real (solo en local) |

**Funcionamiento:**
- Cálculo servidor-side vía POST a `/api/quotations/calculate-item`
- En Vercel: siempre $0 (la ruta no existe en hosting estático)
- Schema Zod: `KitchenConfigSchema` en `src/schemas/quotation.schema.ts`

**Precios base (COP):**
- `COMPLETA_STANDARD`: $900.000/ml inferiores + $900.000/ml superiores
- `COMPLETA_PREMIUM`: $1.100.000/ml c/u
- `COMPLETA_DELUXE`: $1.350.000/ml c/u
- `SOLO_SUPERIOR` / `SOLO_INFERIOR`: $900.000/ml
- `FRENTE_POLLO`: $750.000/ml

**Módulos especiales (descuentan metraje):**
| Código | Descuento | Precio fijo |
|---|---|---|
| `NICHO_NEVECON` | −1.0ml | $1.200.000 |
| `NICHO_NEVERA` | −0.75ml | $1.100.000 |
| `ALACENA_ENTREPAÑOS` | −0.5ml | $1.250.000 |
| `ALACENA_HERRAJE` | −0.5ml | $900.000 |
| `TORRE_HORNOS` | −0.7ml | $1.350.000 |

**Mesón:**
- `SINTERIZADO`: $1.200.000/ml | `CUARZO`: $850.000/ml | `GRANITO`: $700.000/ml
- Profundidad: ≤60cm sin recargo | 61-90cm ×1.30 | 91-120cm ×2.00

---

### 5.2 Closet (`src/features/closets/`)

| Archivo | Descripción |
|---|---|
| `ClosetCotizador.tsx` | UI (importado como `ClosetModule`) |
| `logic.ts` | Motor client-side |
| `src/hooks/use-closet-calculator.ts` | Hook |

**Estado:** Funciona. Tiene `initialData` prop. Template PDF: `ClosetTemplate.tsx`.

---

### 5.3 Puertas (`src/features/doors/`)

| Archivo | Descripción |
|---|---|
| `DoorsModule.tsx` | UI |
| `logic.ts` | Motor client-side |
| `src/hooks/use-doors-calculator.ts` | Hook |

**Estado:** Funciona. Tiene `initialData` prop. Template PDF: `DoorsTemplate.tsx`.

---

### 5.4 Centro de TV (`src/features/tv_center/`)

| Archivo | Descripción |
|---|---|
| `TVCenterModule.tsx` | UI con Dialog de ficha técnica |
| `logic.ts` | Motor client-side |
| `src/hooks/use-tv-center-calculator.ts` | Hook |

**Bug corregido (2026-05-18):** `logic.ts` usaba variable `extraShelves` no definida → cambiada a `shelvesAdj`. Commit `79785b4`.

**Precios base:** $2.800.000 a 1.60m. Cada 20cm = ±$500.000. Rango: 1.20m–2.40m.

**Estado:** Funciona. Tiene `initialData` prop. Template PDF: `TVCenterTemplate.tsx`.

---

### 5.5 Mesones (`src/features/mesones/`)

| Archivo | Descripción |
|---|---|
| `MesonesModule.tsx` | UI |
| `logic.ts` | Motor client-side |
| `src/hooks/use-mesones-calculator.ts` | Hook |

**Estado:** Funciona pero **faltan dos cosas:**
1. ⚠️ Sin prop `initialData` — no restaura config guardada al reabrir cotización
2. ⚠️ Sin template PDF (`MesonesTemplate.tsx` pendiente de crear)

---

### 5.6 Herrajes (`src/features/hardware/`)

| Archivo | Descripción |
|---|---|
| `HardwareModule.tsx` | UI |
| `logic.ts` | Motor client-side |
| `src/hooks/use-hardware-calculator.ts` | Hook |

**Estado:** Funciona. Tiene `initialData` prop. Template PDF: `HardwareTemplate.tsx`.

---

### 5.7 Acabados Especiales (`src/features/special_finishes/`)

| Archivo | Descripción |
|---|---|
| `SpecialFinishesModule.tsx` | UI |
| `logic.ts` | Motor client-side |
| `src/hooks/use-special-finishes-calculator.ts` | Hook |

**Estado:** Funciona. Tiene `initialData` prop. Template PDF: `SpecialFinishesTemplate.tsx`.

---

## 6. Templates PDF

Ubicación: `src/components/pdf/templates/`

| Template | Módulo | Estado |
|---|---|---|
| `KitchenTemplate.tsx` | Cocina | ✅ Existe |
| `ClosetTemplate.tsx` | Closet | ✅ Existe |
| `DoorsTemplate.tsx` | Puertas | ✅ Existe |
| `TVCenterTemplate.tsx` | Centro TV | ✅ Existe |
| `HardwareTemplate.tsx` | Herrajes | ✅ Existe |
| `SpecialFinishesTemplate.tsx` | Acabados | ✅ Existe |
| `MesonesTemplate.tsx` | Mesones | ❌ **PENDIENTE CREAR** |

Los templates reciben un objeto `data` con: `client_name`, `total_amount`, `configuration`, `date`. Son componentes React que se renderizan inline (no generan PDF directamente — el PDF básico se genera con jsPDF en `useQuotationBuilder.handlePrintPDF`).

---

## 7. Base de datos Supabase — Tablas relevantes

### Tabla `quotations`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid | FK → clients |
| `subtotal` | numeric | Suma de items sin descuento |
| `discount_type` | text | `'percent'` \| `'fixed'` \| `'none'` |
| `discount_value` | numeric | Valor del descuento |
| `transport_cost` | numeric | Costo de transporte |
| `total_amount` | numeric | Total final con IVA |
| `status` | text | `draft` \| `sent` \| `approved` \| etc. |
| `version_number` | int | Versión de la cotización |
| `is_locked` | boolean | Si está bloqueada para edición |
| `notes` | text | Notas internas |

### Tabla `quotation_items`

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `quotation_id` | uuid | FK → quotations |
| `product_category` | text | `'cocina'` \| `'closet'` \| etc. |
| `description` | text | Descripción textual |
| `unit_price` | numeric | Precio unitario |
| `quantity` | int | Cantidad (siempre 1) |
| `configuration` | jsonb | Config completa del módulo |
| `calculated_total` | numeric | ⚠️ **Ver advertencia abajo** |

> **BUG CONOCIDO:** El código en `useQuotationBuilder.ts` intenta insertar `calculated_total` en `quotation_items`, pero esa columna puede no existir en el schema de Supabase. Error: `"Could not find the 'calculated_total' column of 'quotation_items' in the schema cache"`. Solución: ejecutar en SQL Editor de Supabase:
> ```sql
> ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS calculated_total numeric DEFAULT 0;
> ```

### Tabla `clients`

| Columna | Descripción |
|---|---|
| `id` | uuid PK |
| `name` | Nombre completo |
| `email` | Correo (nullable) |
| `whatsapp_phone` | Teléfono WhatsApp (nullable) |

---

## 8. Flujo de navegación del cotizador

```
/quotations/new
    │
    ├── Step 1: QuotationClientStep
    │   - Busca clientes existentes (Supabase, debounce 400ms)
    │   - Al abrir: carga todos los clientes (limit 20, alfabético)
    │   - Al escribir: filtra con ilike en nombre/email/teléfono
    │   - Dialog para crear cliente nuevo en el momento
    │
    ├── Step 2: QuotationDesignStep  ← FOCO ACTUAL DE TRABAJO
    │   - Tabs con 8 categorías (sidebar en desktop, horizontal en móvil)
    │   - Cada tab = módulo paramétrico independiente
    │   - Items iniciales pre-cargados (ver INITIAL_ITEMS arriba)
    │   - Botón "NUEVO PRODUCTO" agrega instancias adicionales
    │   - ItemWrapper con botón Trash al hover (elimina item)
    │   - Footer: transporte, descuento, total proyectado
    │
    └── Step 3: Revisión + Guardado
        - Guarda en Supabase: quotations + quotation_items
        - PDF básico con jsPDF (sin usar los templates React)
```

---

## 9. Cálculo de totales

```typescript
// En useQuotationBuilder.ts
const subtotalItems = items.reduce((sum, item) => sum + item.calculatedTotal, 0);
const discountAmount = subtotalItems * (discountPercent / 100);
const baseSubtotal = subtotalItems - discountAmount;
const subtotalWithTransport = baseSubtotal + transportCost;
const taxes = subtotalWithTransport * 0.19;  // IVA 19%
const grandTotal = subtotalWithTransport + taxes;
```

---

## 10. Pendientes técnicos conocidos

| # | Tarea | Prioridad | Archivo(s) |
|---|---|---|---|
| 1 | Crear `MesonesTemplate.tsx` | Alta | `src/components/pdf/templates/` |
| 2 | Agregar `initialData` a `MesonesModule` | Media | `src/features/mesones/MesonesModule.tsx` |
| 3 | Agregar columna `calculated_total` en Supabase | Alta | SQL: `ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS calculated_total numeric DEFAULT 0;` |
| 4 | Conectar Vercel al repo correcto `accesos-seo/innovar-crm:master` | Baja | Configuración de Vercel |
| 5 | Verificar políticas bucket `avatars` en Supabase Storage | Media | SQL en CLAUDE.md |
| 6 | El motor de cocinas (`/api/calculate-item`) no existe en Vercel | Estructural | Considerar migrar a Supabase Edge Function |

---

## 11. Reglas de trabajo con este proyecto

1. **El dueño NO es técnico** — siempre dar comandos completos de copiar y pegar
2. Usar `;` para encadenar en PowerShell (nunca `&&`)
3. **Nunca** `run_in_background` en PowerShell para este proyecto (OneDrive bloquea)
4. Antes de push: confirmar con `git status` que no hay `.env` ni `.claude/`
5. **Nunca** subir `.env` — contiene claves de Supabase
6. El Supabase MCP del entorno NO es el proyecto Innovar — no usarlo para queries de Innovar
7. Para deploys a Vercel: usar `npx vercel --prod` con el token del usuario
8. Trabajar **solo en local** hasta que el usuario pida deploy a Vercel
9. Al tocar `QuotationDesignStep.tsx`: `ItemWrapper` debe estar siempre **fuera** del componente (nivel módulo), nunca adentro — causa React error #185
10. Al agregar `SelectItem` en cualquier módulo: siempre incluir el prop `label`
11. Al agregar `SelectTrigger`: siempre incluir `w-full` en className

---

## 12. Commits recientes relevantes

| Hash | Descripción |
|---|---|
| `79785b4` | Fix TV Center crash (extraShelves undefined) + Kitchen/TVCenter Select labels |
| `4b07e4e` | Fix client search UX + ItemWrapper infinite loop + Kitchen input decimals |

---

## 13. Archivos que NUNCA deben subirse

| Archivo | Razón |
|---|---|
| `.env` | Claves privadas de Supabase y tokens |
| `.claude/` | Tokens y permisos locales de Claude |
| `.vercel/` | IDs del proyecto Vercel |
| `node_modules/` | Dependencias |
| `*.log` | Logs locales |
