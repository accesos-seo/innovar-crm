# Estructura Maestra de Cotizaciones (Mapeo Frontend-DB)

Este documento define los códigos obligatorios que debe tener la tabla `pricing_catalog` en Supabase para que el cotizador inteligente funcione correctamente.

## 1. Cocina Integral (`KitchenModule`)

La lógica de cocina calcula muebles base (Superior + Inferior) y añade extras según metraje.

| Código en DB | Descripción Sugerida | Unidad | Valor Fallback |
| :--- | :--- | :--- | :--- |
| `ML_BASE_COCINA` | Combo mueble superior e inferior estándar | ML | $2.800.000 |
| `MESON_CUARZO` | Mesón en Cuarzo (Profundidad std 60cm) | ML | $1.200.000 |
| `MESON_GRANITO` | Mesón en Granito Natural | ML | $950.000 |
| `MESON_SINTERIZADO` | Mesón en Piedra Sinterizada (Dekton/similar) | ML | $2.500.000 |
| `INST_LAVAPLATOS` | Instalación y sellado de lavaplatos | Global | $130.000 |
| `METRO_LED` | Iluminación LED bajo mueble superior | M | $85.000 |
| `ML_BARRA` | Barra adicional o desayunador | ML | $650.000 |

## 2. Closets (`ClosetModule`)

El sistema calcula por área (Ancho x Alto) según el tipo de complejidad.

| Código en DB | Descripción Sugerida | Unidad | Valor Fallback |
| :--- | :--- | :--- | :--- |
| `CLOSET_ESTANDAR` | Closet básico (Blanco/Madera clara) | M2 | $650.000 |
| `CLOSET_ESPECIAL` | Closet con herrajes de lujo o colores texturizados | M2 | $750.000 |
| `CLOSET_EMPOTRADO` | Vestier o closet de gran formato con accesorios | M2 | $900.000 |

## 3. Puertas (`DoorsModule`)

| Código en DB | Descripción Sugerida | Unidad | Valor Fallback |
| :--- | :--- | :--- | :--- |
| `DOOR_CORREDIZA_SENCILLA` | Puerta corrediza de una hoja | Unid | $890.000 |
| `DOOR_CORREDIZA_DOBLE` | Puerta corrediza de doble hoja | Unid | $1.500.000 |
| `DOOR_BATIENTE` | Puerta batiente estándar | Unid | $750.000 |

## 4. Centros de TV (`TVCenterModule`) - *Pendiente de Implementar*

| Código en DB | Descripción Sugerida | Unidad |
| :--- | :--- | :--- |
| `PANEL_ALISTONADO` | Panel decorativo para fondo de TV | M2 |
| `MODULO_FLOTANTE` | Gabinete inferior suspendido | ML |

## Instrucciones para el Cliente:
1. El cliente debe asegurarse de que los códigos coincidan **exactamente** (Case Sensitive) con la columna `code` de la tabla `pricing_catalog`.
2. Si un código no existe en la base de datos, el sistema usará el "Valor Fallback" definido en el código, pero se recomienda llenarlos todos para control total.
3. El campo `category` en la base de datos debe usarse para organizar el tarifario pero el frontend busca específicamente por `code`.
