# 🧠 Reglas de Ingeniería de UI Innovar

Este archivo contiene patrones de diseño obligatorios para mantener la coherencia en todo el sistema.

## 🔢 1. Patrón: Inputs Numéricos que Permiten Borrado (Empty-able)

### El Problema
Los inputs de tipo `number` en React forzan un `0` cuando están vacíos o contienen caracteres no válidos, lo que arruina la experiencia de usuario al intentar borrar y reescribir valores.

### La Solución (Pattern displayData)
Usar un estado de visualización de tipo `string` que actúe como buffer antes de enviar el dato a la lógica matemática.

```tsx
// 1. Definir estados espejo
const [displayData, setDisplayData] = React.useState({
  campo: "100" // Siempre string
});

// 2. Sincronizar con el estado funcional (Engine)
React.useEffect(() => {
  setRealData(prev => ({
    ...prev,
    campo: Number(displayData.campo) || 0 // Si está vacío, la lógica usa 0
  }));
}, [displayData.campo]);

// 3. Renderizar Input como tipo "text"
<Input 
  type="text" 
  value={displayData.campo}
  onChange={(e) => setDisplayData(prev => ({ ...prev, campo: e.target.value }))}
/>
```

### Prompt para IAs (Instrucción de Sistema)
> "Cuando implementes o modifiques un configurador con inputs numéricos (medidas, precios, porcentajes), NUNCA uses `type='number'` directamente con el estado de cálculo. Siempre implementa un estado `displayData` intermedio de tipo string. Esto debe permitir que el usuario borre completamente el contenido del input (backspace) sin que el sistema fuerce un '0'. La lógica de cálculo debe tratar el string vacío como 0 de forma silenciosa."

---

## 📐 2. Estructura Unificada de Módulos (Master Layout)

Todos los módulos de cotización (Cocina, Closet, Puertas, etc.) DEBEN seguir esta estructura exacta:

1.  **Contenedor Principal**: Un `Card` con `border-l-4 border-l-primary`.
2.  **Header Unificado**:
    *   **Izquierda**: Icono en caja `primary/10` + Título (Uppercase Italic) + Subtítulo (Small caps tracking).
    *   **Derecha**: Caja de subtotal con fondo `[#1e3a35]` y borde `primary/20`.
3.  **Cuerpo**: Formulario en ancho completo sin sidebars paralelos.

---

## 🎨 3. Estilo de Dropdowns
- **Title Case**: Solo primera letra en mayúscula.
- **Min Width**: 240px.
- **Max Content**: El menú debe expandirse al contenido más largo sin cortarse.

---

## 🌎 4. Patrón: Garantía de Traducción en Selects (Mapeo Explícito)

### El Problema
Al usar componentes `Select` donde el ID técnico (ej: `pending`) difiere de la etiqueta visual (ej: `Nuevo`), el motor de UI a veces pierde la etiqueta al cerrar el menú, mostrando el valor en inglés/técnico en lugar del traducido.

### La Solución (Explicit Label Mapping)
NUNCA dejes el `SelectValue` vacío. Siempre mapea explícitamente el valor seleccionado a su etiqueta legible mediante búsqueda en el array de opciones original.

```tsx
// 1. Array de opciones con Value y Label
const OPTIONS = [
  { value: "technical_id", label: "Texto Legible en Español" }
];

// 2. Implementación en el Select
<Select value={field.value} onValueChange={field.onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar...">
      {/* REGLA DE ORO: Mapeo manual para evitar fallback a inglés/ID */}
      {field.value 
        ? OPTIONS.find(opt => opt.value === field.value)?.label 
        : undefined}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {OPTIONS.map(opt => (
      <SelectItem key={opt.value} value={opt.value}>
        {opt.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Prompt para IAs (Instrucción de Sistema)
> "Cuando generes o edites componentes Select (desplegables) en este proyecto, es OBLIGATORIO usar mapeo explícito dentro de `SelectValue`. Si el valor interno del campo es diferente a lo que ve el usuario, realiza una búsqueda (`.find()`) en el array de constantes para renderizar la etiqueta traducida manualmente como hijo de `SelectValue`. Esto previene que el componente muestre IDs técnicos o palabras en inglés después de cerrar el menú."
