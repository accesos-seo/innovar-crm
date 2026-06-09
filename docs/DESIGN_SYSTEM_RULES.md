# Innovar CRM — Design System Rules (Basado en `/leads/new`)

**Fecha:** 2026-05-24  
**Aplicable a:** S3.2.b UI admin (y todas las nuevas UI en adelante)  
**Patrón base:** `src/pages/LeadCreate.tsx` (se refiere como "Lead Create Form Pattern")

---

## 1. INPUTS (Text, Email, Phone, Number)

### Regla General
```typescript
// Altura estándar: 48px (h-12)
// Borde: subtle, medio tono
// Fondo: fondo default o levemente más oscuro
// Focus: cambio de fondo, sin growl de sombra
// Placeholder: ejemplos reales específicos
// Label: uppercase, pequeño, bold, tracking widest

className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
```

### Estructura
```
┌─────────────────────────────┐
│ LABEL PEQUEÑO UPPERCASE *   │  ← text-[10px] font-bold uppercase tracking-widest
│                             │
│ [       placeholder         │  ← h-12, border-border/50, bg-background/50
│                             │
└─────────────────────────────┘
  Error mensaje si aplica
```

### Variantes
| Tipo | Clase adicional | Uso |
|------|---|---|
| Normal | `bg-background/50` | Campos estándar (nombre, email, dirección) |
| Highlighted | `bg-primary/5 border-primary/30` | Campos condicionales (ej: ciudad custom) |
| Disabled | `opacity-50 cursor-not-allowed` | Campos no editables |

### FormLabel
```tsx
// SIEMPRE pequeño, uppercase, bold
<FormLabel className="text-[10px] font-bold uppercase tracking-widest">
  Nombre *
</FormLabel>
```

### Placeholder
```tsx
// Ser específico, no genérico
❌ placeholder="Ingresa el nombre"
✅ placeholder="Ej. Carlos Rodriguez"

❌ placeholder="Cantidad"
✅ placeholder="Ej. 500.50"
```

---

## 2. DROPDOWNS / SELECT

### Regla General
```typescript
// Trigger: h-12, rounded-none, border-border/50
// Contenido: SelectContent con sombra, rounded-sm
// Placeholder: como inputs
// Valores: uppercase, font-medium o font-bold

className="w-full !h-12 rounded-none border-border/50 bg-background font-bold"
// SelectContent: className="rounded-sm border-border/20 shadow-xl"
// SelectItem: className="h-10 font-bold uppercase text-[10px] tracking-widest"
```

### Estructura
```
┌─────────────────────────────┐
│ LABEL PEQUEÑO UPPERCASE *   │
│ [Selecciona una opción ▼]   │  ← h-12, trigger
└─────────────────────────────┘

Cuando se abre:
╔═════════════════════════════╗
║ ✓ Opción Seleccionada       │  ← con checkmark
║   Opción 2                  │
║   Opción 3                  │
╚═════════════════════════════╝
   sombra: shadow-xl
```

### Implementación
```tsx
<FormField
  control={form.control}
  name="city"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
        Ciudad *
      </FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
            <SelectValue placeholder="Selecciona una ciudad">
              {field.value ? formatSentenceCase(field.value) : undefined}
            </SelectValue>
          </SelectTrigger>
        </FormControl>
        <SelectContent className="rounded-sm border-border/20 shadow-xl">
          {OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="font-medium">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## 3. CHECKBOXES (Multi-select en grid)

### Regla General
```typescript
// Grid layout: cols-2 en mobile, cols-5 en desktop
// Cada item: border, bg-muted/20, p-4, hover state, cursor-pointer
// Checkbox + label en fila, gap-3
// Label: uppercase, small, bold

className="flex flex-row items-center space-x-3 space-y-0 rounded-none border border-border/50 p-4 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
```

### Estructura
```
Servicios:
┌──────┐ ┌──────┐ ┌──────┐
│ ☑ CO │ │ ○ CL │ │ ○ TV │  ← grid cols-3 gap-4
│ Coci │ │ Clos │ │ Cent │
└──────┘ └──────┘ └──────┘
```

### Implementación
```tsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  {SERVICES.map((service) => (
    <FormField
      control={form.control}
      name="services"
      render={({ field }) => (
        <FormItem
          className="flex flex-row items-center space-x-3 space-y-0 rounded-none border border-border/50 p-4 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
          onClick={() => {
            const current = field.value || [];
            const next = current.includes(service)
              ? current.filter((v: string) => v !== service)
              : [...current, service];
            field.onChange(next);
          }}
        >
          <FormControl>
            <Checkbox
              checked={field.value?.includes(service)}
              onCheckedChange={(checked) => {
                field.onChange(
                  checked
                    ? [...field.value, service]
                    : field.value?.filter((v: string) => v !== service)
                );
              }}
            />
          </FormControl>
          <FormLabel className="text-xs font-bold uppercase cursor-pointer">
            {service}
          </FormLabel>
        </FormItem>
      )}
    />
  ))}
</div>
```

---

## 4. RADIO BUTTONS (Single-select vertical)

### Regla General
```typescript
// Stack vertical con gap-3
// Cada opción: p-4, border, hover state
// Indicador: círculo personalizado con relleno interior
// Label: uppercase, small, bold
// Selected: border-primary, bg-primary/5, ring-1 ring-primary/20

// Unselected:
className="border border-border/50 bg-background hover:border-primary/30"

// Selected:
className="border border-primary bg-primary/5 ring-1 ring-primary/20"
```

### Estructura
```
Prioridad:
○ LO ANTES POSIBLE
◉ MEDIANO PLAZO     ← con relleno y anillo
○ SOLO AVERIGUANDO

Colores:
- Unselected: gris claro
- Selected: primary color + fondo tenue + ring subtle
```

### Implementación
```tsx
<FormField
  control={form.control}
  name="priority"
  render={({ field }) => (
    <FormItem className="space-y-4">
      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
        Prioridad *
      </FormLabel>
      <div className="flex flex-col gap-3">
        {PRIORITIES.map((p) => (
          <label
            key={p}
            className={cn(
              "flex items-center gap-4 p-4 border transition-all cursor-pointer group",
              field.value === p
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border/50 bg-background hover:border-primary/30"
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                field.value === p
                  ? "border-primary"
                  : "border-muted-foreground group-hover:border-primary/50"
              )}
            >
              {field.value === p && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
            <input
              type="radio"
              className="hidden"
              name={field.name}
              value={p}
              checked={field.value === p}
              onChange={() => field.onChange(p)}
            />
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                field.value === p ? "text-primary" : "text-muted-foreground"
              )}
            >
              {p}
            </span>
          </label>
        ))}
      </div>
    </FormItem>
  )}
/>
```

---

## 5. SECCIONES (Headers de contenido)

### Regla General
```typescript
// Borde izquierdo: border-l-4 border-primary, pl-4
// Icono: w-4 h-4 text-primary
// Título: xs, font-black, uppercase, tracking-[0.2em], italic
// Spacing: mb-6 antes de contenido

className="flex items-center gap-2 border-l-4 border-primary pl-4"
```

### Estructura
```
🏠 IDENTIFICACIÓN DEL PROSPECTO
───────────────────────────

[Contenido de la sección...]
```

### Implementación
```tsx
<div className="space-y-6">
  <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
    <User className="w-4 h-4 text-primary" />
    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
      Identificación del prospecto
    </h3>
  </div>
  
  {/* Contenido de la sección */}
</div>
```

---

## 6. BOTONES

### Primario (Acción principal)
```tsx
<PrimaryButton
  type="submit"
  label="Registrar Lead"
  icon={Zap}
  className="flex-1 sm:flex-none h-14 px-12 rounded-none"
/>
```
- Alto: `h-14` (56px)
- Padding: `px-12`
- Sin bordes redondeados: `rounded-none`
- Con icono a la izquierda
- Loading state cuando `disabled={true}`

### Secundario (Cancelar/Volver)
```tsx
<Button
  type="button"
  variant="ghost"
  onClick={() => navigate(-1)}
  className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
>
  Cancelar
</Button>
```
- Alto: `h-14`
- Ghost variant (sin fondo, solo borde on hover)
- Borde transparent normal, `border-border/50` on hover
- Texto uppercase, bold

### Botones de tabla/inline
```tsx
// En modales o dentro de contenido
<Button
  variant="outline"
  size="sm"
  className="text-xs font-bold uppercase h-9 px-4 rounded-none"
>
  Acción
</Button>
```
- Alto: `h-9`
- Size: `sm`
- Outline variant

### Reglas generales de botones
| Propiedad | Valor |
|-----------|-------|
| Altura base | `h-14` (56px) para call-to-action |
| Altura secundaria | `h-9` (36px) para inline/modales |
| Border radius | `rounded-none` (siempre cuadrados) |
| Font | `font-bold uppercase text-xs tracking-widest` |
| Iconografía | Icono a la izquierda, gap-2 |
| Padding | `px-8` a `px-12` según contexto |

---

## 7. MODALES

### Estructura Base
```
┌─────────────────────────────┐
│ Título del Modal        [X] │  ← Header, X cierra
├─────────────────────────────┤
│                             │
│  [Contenido del modal]      │
│  [Inputs, checkboxes, etc]  │
│                             │
├─────────────────────────────┤
│ [Cancelar]  [Acción]        │  ← Footer con 2 botones
└─────────────────────────────┘
```

### Implementación
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg rounded-none border-border/20">
    <DialogHeader>
      <DialogTitle className="text-lg font-bold uppercase">
        Título del Modal
      </DialogTitle>
    </DialogHeader>
    
    <div className="space-y-6 py-4">
      {/* Contenido aquí */}
    </div>
    
    <DialogFooter className="flex gap-3">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(false)}
        className="h-12 rounded-none font-bold uppercase text-xs"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        className="h-12 rounded-none font-bold uppercase text-xs"
      >
        Acción
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 8. GRIDS Y ESPACIADO

### Espaciado Vertical (entre secciones)
```
space-y-10 ← entre grandes bloques
space-y-6  ← entre subsecciones
space-y-4  ← entre items
space-y-2  ← entre líneas de texto
```

### Grids para inputs
```tsx
// 2 columnas iguales en desktop, 1 en mobile
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* FormField aquí */}
</div>

// 3 columnas: campo ancho (2/3) + campo corto (1/3)
// Uso: Nombre + Precio, Concepto + Código, etc.
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <div className="md:col-span-2">
    <FormField name="name" ... />  {/* campo principal — más ancho */}
  </div>
  <FormField name="price" ... />  {/* campo secundario — más angosto */}
</div>

// Full width (col-span-2 en grid de 2)
<div className="md:col-span-2">
  {/* FormField aquí */}
</div>
```

### Regla de gap
```
gap-6 → entre campos dentro de una sección (estándar)
gap-8 → permitido en grids con pocos campos muy anchos
```

### Padding general
```
Formularios: p-8 en container principal
Modales: p-6
Secciones: space-y-6 entre headers y contenido
```

---

## 9. COLORES SEMÁNTICOS

| Propósito | Color | CSS |
|-----------|-------|-----|
| Primario (CTAs, focus, accents) | Marca cyan | `text-primary`, `border-primary`, `bg-primary/5` |
| Borde sutil | Gris claro | `border-border/50`, `border-border/20` |
| Fondo sutil | Muted | `bg-muted/20`, `bg-muted/40` |
| Texto etiquetas | Gris medio | `text-muted-foreground` |
| Error | Rojo | `text-destructive`, `border-destructive` |
| Success | Verde | `text-emerald-500` |

---

## 10. TIPOGRAFÍA

### Labels
```tsx
className="text-[10px] font-bold uppercase tracking-widest"
```

### Titles (sección)
```tsx
className="text-xs font-black uppercase tracking-[0.2em] italic"
```

### Body text en FormMessage
```tsx
// Automático via FormMessage component
```

### Helper text (pequeño, gris)
```tsx
className="text-[10px] text-muted-foreground italic"
```

---

## 11. ERRORES Y VALIDACIÓN

### FormMessage (automático)
```tsx
// Siempre agregá después de FormControl
<FormMessage /> // → rojo, pequeño, bajo el input
```

### Estados visuales
- ❌ **Error**: borde rojo, texto error en rojo
- ✅ **Valid**: sin cambio visual (implicit success)
- ⏳ **Loading**: cursor wait, disabled state

---

---

## 13. CONTENEDOR DE FORMULARIO (Page Form Card)

Patrón obligatorio para **toda página de creación/edición** (`/new`, `/edit`, settings pages).  
Referencia canónica: `src/pages/MaterialCreate.tsx`, `src/pages/settings/BankSettings.tsx`.

### Estructura completa
```
max-w-4xl (o max-w-3xl para forms simples)
  └── CategoryHeader (title + subtitle + onBack + icon)
  └── <form> card
        ├── [1px] gradient line (top brand accent)
        ├── <div p-8 space-y-10>
        │     ├── Sección 01 (header + fields)
        │     ├── [1px] divider bg-primary/20
        │     ├── Sección 02 (header + fields)
        │     ├── [1px] divider bg-primary/20
        │     └── Sección 03 opcional (header atenuado + fields)
        └── Footer bar (border-t bg-muted/20)
```

### Card container
```tsx
<form className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
  {/* Línea de marca — SIEMPRE la primera línea del card */}
  <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

  {/* Contenido del formulario */}
  <div className="p-8 space-y-10">
    {/* secciones + dividers */}
  </div>

  {/* Footer */}
  <div className="px-8 py-8 border-t border-border/10 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-6">
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
      <span className="text-primary mr-1">*</span> Campos obligatorios
    </p>
    <div className="flex items-center gap-4 w-full sm:w-auto">
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate(-1)}
        className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
      >
        Cancelar
      </Button>
      <PrimaryButton
        type="submit"
        label="Guardar"
        icon={Save}
        className="flex-1 sm:flex-none h-14 px-12 rounded-none"
      />
    </div>
  </div>
</form>
```

### Anchura de la página
| Caso | Clase |
|---|---|
| Formulario estándar (6+ campos) | `max-w-4xl` |
| Formulario simple (4 campos o menos) | `max-w-3xl` |
| Vista de configuración con tabla ancha | `max-w-7xl` |

---

## 14. DIVISORES HORIZONTALES ENTRE SECCIONES

Separan visualmente los bloques dentro del card sin agregar peso visual excesivo.

### Con color de marca (entre secciones obligatorias)
```tsx
{/* Divider entre secciones — usa color primario tenue */}
<div className="h-[1px] w-full bg-primary/20" />
```

### Neutro (entre secciones de detalle o modales)
```tsx
{/* Divider neutro — para separaciones suaves */}
<div className="h-[1px] w-full bg-border/10" />
```

### Cuándo usar cada uno
| Divider | Uso |
|---|---|
| `bg-primary/20` (teal tenue) | Entre secciones principales de un form de creación |
| `bg-border/10` (gris muy sutil) | En modales, dentro de detail views, entre sub-bloques |

### Sección opcional (border atenuado)
Cuando una sección completa es opcional, el header usa `border-primary/40` en vez de `border-primary` y el ícono es `text-muted-foreground`:
```tsx
{/* Sección obligatoria */}
<div className="flex items-center gap-2 border-l-4 border-primary pl-4">
  <Package className="w-4 h-4 text-primary" />
  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
    Datos Principales
  </h3>
</div>

{/* Sección opcional — border y icono atenuados */}
<div className="flex items-center gap-2 border-l-4 border-primary/40 pl-4">
  <FileText className="w-4 h-4 text-muted-foreground" />
  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
    Detalles Técnicos{" "}
    <span className="text-muted-foreground font-medium normal-case">(opcional)</span>
  </h3>
</div>
```

---

## 15. TEXTAREA (Campos de texto multilínea)

Para descripciones, notas, comentarios, plantillas de cotización.

### Regla general
```tsx
// rows={5} → altura cómoda para escribir (ajustar a 3 si es campo secundario)
// resize-none → sin redimensionado manual (el diseño define el alto)
// font-bold → consistente con inputs

<textarea
  {...field}
  rows={5}
  className="w-full bg-background/50 border border-border/50 rounded-none p-4 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground resize-none"
  placeholder="Descripción detallada..."
/>
```

### Variantes de alto
| Rows | Uso |
|---|---|
| `rows={3}` | Notas cortas, campos secundarios |
| `rows={5}` | Descripción técnica, detalles, comentarios |
| `rows={8}` | Plantillas de cotización, mensajes largos |

### Reglas
- Siempre `resize-none` — el alto lo define el diseño, no el usuario
- Siempre `rounded-none` — consistente con el sistema cuadrado
- Padding `p-4` (no `px-3 py-2` como Input)
- En sección de detalles: campo full-width, al final de la sección
- Nunca lado a lado con otro textarea (siempre ocupa el ancho completo)

---

## 16. HELPER TEXT (Notas de campo)

Texto auxiliar debajo de un campo para explicar su propósito, formato esperado o condiciones.

```tsx
{/* Debajo del FormControl, antes de FormMessage */}
<p className="text-[10px] text-muted-foreground italic">
  Dejar vacío para usar valor automático. Ej: +573001234567
</p>
```

### Reglas
- `text-[10px]` — mismo tamaño que los labels
- `text-muted-foreground italic` — más suave que el label, indica que es ayuda
- Va **entre** `FormControl` y `FormMessage` dentro del `FormItem`
- Usar para: formatos esperados, unidades, condiciones, explicar dónde aparece el dato

---

## 12. CHECKLIST — Antes de entregar cualquier formulario

Antes de cada nueva página de creación/edición, validar:

**Estructura general**
- [ ] Contenedor: `max-w-4xl`, `bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5`
- [ ] Línea de marca al tope: `h-1 bg-gradient-to-r from-primary/20 via-white to-primary/20`
- [ ] `CategoryHeader` con `onBack` apuntando a la ruta correcta
- [ ] Footer: `px-8 py-8 border-t border-border/10 bg-muted/20` + nota `* Campos obligatorios`

**Campos**
- [ ] Inputs: `h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold`
- [ ] Dropdowns Select: `!h-12 rounded-none border-border/50 bg-background font-bold` en trigger
- [ ] Textarea: `rounded-none p-4 text-sm font-bold resize-none`, `rows` según contexto
- [ ] Checkboxes: grid layout, `border-border/50`, `p-4`, hover state
- [ ] Radio buttons: custom styling con relleno, gap-4, vertical stack
- [ ] Placeholder: específico con ejemplo real (`Ej. Carlos Rodríguez`)
- [ ] Labels: `text-[10px] font-bold uppercase tracking-widest`
- [ ] Helper text: `text-[10px] text-muted-foreground italic` cuando sea necesario
- [ ] FormMessage: presente en cada FormControl

**Secciones y divisores**
- [ ] Sección obligatoria: `border-l-4 border-primary pl-4` + ícono `text-primary`
- [ ] Sección opcional: `border-l-4 border-primary/40 pl-4` + ícono `text-muted-foreground` + label `(opcional)`
- [ ] Divider entre secciones principales: `h-[1px] w-full bg-primary/20`
- [ ] Divider neutro en modales/detail: `h-[1px] w-full bg-border/10`
- [ ] Espaciado: `space-y-10` entre bloques, `space-y-6` dentro de sección, `gap-6` entre campos

**Grids**
- [ ] 2 campos iguales: `grid-cols-1 md:grid-cols-2 gap-6`
- [ ] Campo ancho + campo corto: `grid-cols-1 md:grid-cols-3 gap-6` + `md:col-span-2`
- [ ] Campo full-width: ocupa toda la fila, no en columna

**Botones**
- [ ] Primario: `PrimaryButton` `h-14 px-12 rounded-none`
- [ ] Cancelar: `Button variant="ghost"` `h-14 px-8 rounded-none border border-transparent hover:border-border/50`
- [ ] Botones inline/tabla: `h-9 rounded-none` variant outline

**Colores**
- [ ] CTAs/focus/accents: `text-primary`, `border-primary`, `bg-primary/5`
- [ ] Bordes de campos: `border-border/50`
- [ ] Fondos sutiles: `bg-muted/20`, `bg-background/50`
- [ ] Textos auxiliares: `text-muted-foreground`

---

## Referencias canónicas

| Patrón | Archivo | Descripción |
|---|---|---|
| Form de creación completo | `src/pages/LeadCreate.tsx` | Checkboxes, radio buttons, grid de 2 cols, selects |
| Form secciones apiladas + dividers | `src/pages/MaterialCreate.tsx` | Grid 3-cols, textarea, dividers primarios, sección opcional |
| Settings form + cards bancarios | `src/pages/settings/BankSettings.tsx` | Footer con nota obligatoria, billeteras opcionales |
| Settings view/edit toggle | `src/pages/settings/PaymentSettings.tsx` | Modo lectura → modo edición con draft state |

**Regla de evolución:** Cuando se establezca un nuevo patrón visual aprobado, documentarlo aquí **antes** de aplicarlo a otras páginas.

---

**Status:** 🟢 Actualizado 2026-05-24 — cubre todos los patrones de formulario del sistema  
**Próxima revisión:** Al introducir nuevos tipos de campo o nueva paleta de color
