# Branding & Design System — Especificaciones Técnicas

Este documento detalla la identidad visual y los elementos reutilizables del sistema para garantizar consistencia en futuras implementaciones.

## 🎨 Paleta de Colores (Neon Dark)

El sistema utiliza un esquema de alto contraste basado en tonos oscuros arquitectónicos y acentos en verde neón (Teal).

| Elemento | Valor Hex | Variable CSS | Uso Principal |
| :--- | :--- | :--- | :--- |
| **Primary (Teal)** | `#44ddc1` | `--primary` | Botones principales, acentos, iconos activos, estados hover. |
| **Background** | `#131313` | `--background` | Fondo principal de la aplicación. |
| **Card / Surface** | `#1c1b1b` | `--card` | Contenedores, modales, hojas laterales (sheets). |
| **Border** | `#3c4a46` | `--border` | Líneas divisorias, bordes de inputs y tablas. |
| **Muted** | `#2a2a2a` | `--muted` | Fondos de inputs, estados deshabilitados. |
| **Foreground** | `#e5e2e1` | `--foreground` | Texto principal (blanco roto). |
| **Muted Foreground**| `#bbcac4` | `--muted-foreground`| Texto secundario, descripciones, placeholders. |

## ✍️ Tipografía

| Capa | Fuente | Estilo | Uso |
| :--- | :--- | :--- | :--- |
| **Heading** | `Plus Jakarta Sans` | `font-black`, `tracking-tighter` | Títulos principales (H1, H2), encabezados de sección. |
| **Body / UI** | `Inter` | `font-medium`, `tracking-normal` | Texto de lectura, tablas, formularios, botones. |
| **Accents** | `Inter` | `font-bold`, `uppercase`, `tracking-widest` | Etiquetas, labels de inputs, subtítulos técnicos. |

## 📐 Estructura de Contenedores (Layout)

Para mantener el orden y evitar que el diseño se rompa en pantallas grandes:

- **Max-Width Global**: `max-w-7xl` (1280px).
- **Padding Estándar**: `px-8` (32px) para contenedores internos.
- **Bordes**: `rounded-none` o `rounded-sm` (0.125rem) para mantener una estética técnica/industrial.

## 🧩 Elementos Reutilizables (Componentes Core)

### 1. FilterSheet (Estructura Genérica)
Ubicación: `src/components/shared/FilterSheet.tsx`
- **Uso**: Siempre que se requiera segmentar datos.
- **Regla**: Debe incluir un gradiente superior, padding de `px-8` y un footer fijo con botón de acción `Zap`.

### 2. CategoryHeader
Ubicación: `src/components/shared/CategoryHeader.tsx`
- **Uso**: Encabezado de todas las páginas principales.
- **Regla**: Título en `uppercase`, icono a la izquierda y acción principal a la derecha.

### 3. DetailModal (Inline Edit)
Ubicación: `src/components/shared/DetailModalInlineEdit.tsx`
- **Uso**: Visualización de detalles de registros con edición rápida.
- **Regla**: Permite editar campos sin cambiar de página.

### 4. Calendar Component System
Ubicación: `src/components/ui/calendar-*`
- **Uso**: Selección de fechas, rangos y horas.
- **Regla**: Usar `CalendarPopover` para formularios compactos.

## 💡 Indicaciones para el Sistema (Prompting)

Al solicitar nuevos elementos, asegúrate de incluir estas reglas:
- "Usa el sistema de colores global (`--primary`, `--border`)."
- "Aplica `uppercase` y `tracking-widest` a los labels."
- "Mantén los bordes rectos (`rounded-none`)."
- "El contenido debe estar contenido en `max-w-7xl mx-auto px-8`."
- "Usa iconos de `lucide-react` con tamaño `w-4 h-4` para acciones secundarias."
