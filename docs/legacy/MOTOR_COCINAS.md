# Motor de Cotización — Cocinas Integrales INNOVAR
## Versión 1.0 | 17/05/2026

---

## ÍNDICE

1. [Visión General y Decisión de Arquitectura](#1-visión-general)
2. [Fuente de Verdad: Reglas de Negocio](#2-reglas-de-negocio)
3. [Modelo de Datos: Schema de Entrada](#3-schema-de-entrada)
4. [Catálogo de Precios Requerido en BD](#4-catálogo-de-precios)
5. [Flujo Completo de Cálculo](#5-flujo-de-cálculo)
6. [Arquitectura de Archivos](#6-arquitectura)
7. [API: Contrato Frontend ↔ Backend](#7-api-contrato)
8. [Errores Corregidos vs. Estado Anterior](#8-correcciones)
9. [Guía para Duplicar al Resto de Categorías](#9-duplicar)

---

## 1. Visión General

### Decisión de Arquitectura

**El frontend SOLO recoge la configuración del usuario y la envía al backend.**
**El backend es el único que sabe calcular precios.** No hay lógica de cálculo en el frontend.

```
[Frontend UI]
      │
      │ POST /api/quotations/calculate-item
      │ { category: 'cocina', configuration: { ... } }
      ▼
[Express Backend — kitchen.engine.ts]
      │
      ├── Lee precios de Supabase pricing_catalog
      ├── Aplica reglas de negocio (este archivo)
      └── Retorna { subtotal, metrajeEfectivo, desglose }
      │
      ▼
[Frontend] muestra resultado + permite guardar
      │
      │ POST /api/quotations/save
      ▼
[Express Backend] valida y persiste en Supabase
```

### Por qué se movió al backend
- **Integridad:** Un precio calculado en el frontend puede ser manipulado. El backend es la fuente de verdad.
- **Mantenibilidad:** Cuando cambien los precios, solo se actualiza `pricing_catalog` en Supabase — cero cambios de código.
- **Escalabilidad:** El mismo motor sirve para web, app móvil, PDF server-side, WhatsApp bot, etc.
- **Auditoría:** Cada cotización guardada tiene trazabilidad completa del cálculo en `quotation_items.configuration` (JSONB).

---

## 2. Reglas de Negocio

> Fuente: Documento `1-COCINAS.docx` entregado por el cliente — 14/05/2026.

### 2.1 Tipos de Cocina (`tipoCocina`)

| Código | Descripción | Qué se construye | Cálculo base |
|--------|-------------|-----------------|--------------|
| `COMPLETA_STANDARD` | Cocina Completa Estándar | Mueble inferior + superior | 2 × $900.000/ml |
| `COMPLETA_PREMIUM` | Cocina Completa Premium | Mueble inferior + superior | 2 × $1.100.000/ml |
| `COMPLETA_DELUXE` | Cocina Completa Deluxe | Mueble inferior + superior | 2 × $1.350.000/ml |
| `SOLO_SUPERIOR` | Solo Muebles Superiores | Gabinetes superiores | 1 × $900.000/ml |
| `SOLO_INFERIOR` | Solo Muebles Inferiores | Gabinetes inferiores | 1 × $900.000/ml |
| `FRENTE_POLLO` | Frente PLL | Frente con puertas y cajoneros (cocinas vaciadas en concreto) | 1 × $750.000/ml |

> **Nota:** `SOLO_SUPERIOR` y `FRENTE_POLLO` **NO llevan mesón**. El motor lo valida automáticamente.

### 2.2 Forma (Layout) — Solo visual, no afecta precio

| Código | Descripción |
|--------|-------------|
| `L` | Cocina en L |
| `U` | Cocina en U |
| `LINEAL` | Cocina lineal |
| `PARALELA` | Cocina paralela |
| `ISLA` | Cocina con isla |

### 2.3 Módulos Especiales — Solo descuentan metraje. Sin cargo adicional.

> **Fuente de verdad:** Ejemplos numéricos de PASO 8 + texto "Precio: Incluido en muebles".
>
> Los precios listados ($1.200.000, $1.350.000, etc.) son **referencia interna de producción**.
> **No se suman al subtotal de la cotización.**

Estos son muebles de piso a techo que se fabrican con precio propio, pero ese precio está **absorbido** en la estructura de la cocina. Su único efecto en el cálculo es **descontar metros lineales** del metraje base.

| Código (`codigo`) | Nombre | Descuento ML | Cargo al cliente |
|-------------------|--------|:------------:|:----------------:|
| `NICHO_NEVECON` | Nicho Nevecón (Refrigerador integrado) | −1.00 ml | $0 (incluido) |
| `NICHO_NEVERA` | Nicho Nevera | −0.75 ml | $0 (incluido) |
| `ALACENA_ENTREPAÑOS` | Alacena con Entrepaños | −0.50 ml | $0 (incluido) |
| `ALACENA_HERRAJE` | Alacena con Herraje | −0.50 ml | $0 (incluido) |
| `TORRE_HORNOS` | Torre de Hornos | −0.70 ml | $0 (incluido) |

**Fórmula:**
```
metrajeResultante = metrajeTotal − Σ(descuentoML de cada módulo seleccionado)
metrajeResultante ≥ 0 (nunca negativo)
costoModulos = $0  ← siempre
```

**Verificación con los ejemplos del documento:**
```
Ejemplo: 4.5ml + Nicho Nevecon (−1.0ml) + Torre Hornos (−0.7ml)
  metrajeResultante = 4.5 − 1.0 − 0.7 = 2.8ml
  Muebles:  2.8 × $900.000 × 2  = $5.040.000
  Mesón:    2.8 × $1.200.000    = $3.360.000
  Subtotal: $5.040.000 + $3.360.000 = $8.400.000  ✅ (sin cargo por módulos)
```

### 2.4 Muebles Lineales

```
costoMuebles = metrajeResultante × precioPorML(tipoCocina)
```

Donde `precioPorML`:
- `COMPLETA_*`: precio_inferior/ml + precio_superior/ml (ambos en paralelo sobre el mismo metraje)
- `SOLO_SUPERIOR` | `SOLO_INFERIOR`: solo un componente × $900.000/ml
- `FRENTE_POLLO`: $750.000/ml

### 2.5 Mesón (Countertop)

#### Materiales disponibles

| Código (`tipo`) | Material | Precio Base COP/ml |
|-----------------|----------|--------------------|
| `SINTERIZADO` | Piedra Sinterizada | $1.200.000 |
| `CUARZO` | Cuarzo / Quarzone | $850.000 |
| `GRANITO` | Granito Natural | $700.000 |
| `NINGUNO` | Sin mesón | $0 |

#### Reglas de profundidad (recargo sobre precio base)

| Profundidad (cm) | Recargo | Multiplicador |
|:----------------:|:-------:|:-------------:|
| ≤ 60 cm | Sin recargo | × 1.00 |
| 61 – 90 cm | +30% | × 1.30 |
| 91 – 120 cm | Doble (backsplash/isla) | × 2.00 |

```
costoMeson = metrajeResultante × precioBase × multiplicadorProfundidad
```

#### Casos donde NO se aplica mesón (validación backend)
- `tipoCocina === 'SOLO_SUPERIOR'`
- `tipoCocina === 'FRENTE_POLLO'`

### 2.6 Mesón de Isla

La isla tiene su propio cálculo independiente del mesón principal.

```
metrajeIsla = largoIsla
            + (regrueso === 'UN_LADO'   ? 0.90 : 0)
            + (regrueso === 'AMBOS_LADOS' ? 1.80 : 0)
            + (regrueso !== 'NINGUNO'   ? 0.60 : 0)   // regrueso lateral

costoIsla = metrajeIsla × precioMaterial × multiplicadorProfundidad
```

> **Ejemplo del documento:** Isla 2ml + regrueso ambos lados + 90cm profundidad en Cuarzo:
> `2.0 + 1.80 + 0.60 = 4.40ml × $850.000 × 1.30 = $4.862.000`

### 2.7 Barra de Isla

| Profundidad barra | Factor |
|:-----------------:|:------:|
| 35 – 45 cm | 80% del precio/ml del material |
| 50 – 60 cm | 100% del precio/ml del material |

```
costoBarra = metraje × precioPorML × factor
           + (incluyeHerraje ? 350.000 : 0)

// Si tiene lateral:
costoBarra += altoBarra × 2 × precioPorML × factor
```

### 2.8 Acabados Especiales

| Concepto | Unidad | Precio COP |
|----------|--------|:----------:|
| Luz LED bajo mueble | por metro lineal | $220.000 |
| Puerta vidrio ahumado + marco aluminio negro | por M² (alto × ancho) | $1.200.000 |
| Bisagra adicional (alto > 80 cm) | +1 par | $15.000/par |
| Bisagra adicional (alto > 140 cm) | +2 pares | $15.000/par |

### 2.9 Pintado Alto Brillo (Cambio de acabado en puertas)

| Tipo pieza | Precio COP/unidad |
|------------|:-----------------:|
| Puerta superior | $120.000 |
| Puerta inferior | $150.000 |
| Puerta alacena | $250.000 |
| Tapa cajón | $90.000 |
| Tapa especiero | $100.000 |
| Tapa pequeña / gola | $45.000 |

### 2.10 Costos Fijos y Transporte

| Concepto | Valor COP | Estado default |
|----------|:---------:|:--------------:|
| Transporte e imprevistos | $600.000 | Activable por proyecto |
| Diseño 3D (si no compra cocina) | $350.000 | Opcional |

### 2.11 Fórmula Final de Cotización

```
SUBTOTAL = costoMuebles
         + Σ(precio de cada módulo especial)
         + costoMeson
         + costoIsla           (si aplica)
         + costoBarra          (si aplica)
         + costoLED            (si aplica)
         + costoPuertasVidrio  (si aplica)
         + costoPintado        (si aplica)
         + costoTransporte     (si aplica)

DESCUENTO = SUBTOTAL × (descuentoPorcentaje / 100)   [si tipo === 'PORCENTAJE']
          | valorFijo                                  [si tipo === 'FIJO']

TOTAL = SUBTOTAL − DESCUENTO

// Validación: DESCUENTO máximo = 50% del SUBTOTAL
// Redondeo: Math.round() — sin decimales en cotizaciones finales
```

---

## 3. Schema de Entrada

> Archivo: `src/schemas/kitchen.schema.ts`

Este es el objeto JSON que el frontend envía al endpoint `POST /api/quotations/calculate-item`.

```typescript
{
  tipoCocina: 'COMPLETA_STANDARD' | 'COMPLETA_PREMIUM' | 'COMPLETA_DELUXE'
            | 'SOLO_SUPERIOR' | 'SOLO_INFERIOR' | 'FRENTE_POLLO',

  forma: 'L' | 'U' | 'LINEAL' | 'PARALELA' | 'ISLA',  // Solo para UI/PDF

  metrajeTotal: number,  // Metros lineales totales. Rango: 0.5 – 10 ml

  // Módulos que descuentan metraje y tienen precio fijo
  modulosEspeciales: Array<{
    codigo: 'NICHO_NEVECON' | 'NICHO_NEVERA' | 'ALACENA_ENTREPAÑOS'
          | 'ALACENA_HERRAJE' | 'TORRE_HORNOS',
    cantidad: number  // Normalmente 1, pero puede haber 2 torres, etc.
  }>,

  meson: {
    tipo: 'SINTERIZADO' | 'CUARZO' | 'GRANITO' | 'NINGUNO',
    profundidadCm: number,  // Determina el recargo (≤60, 61-90, 91-120)
  },

  isla?: {
    material: 'SINTERIZADO' | 'CUARZO' | 'GRANITO',
    largoMl: number,
    profundidadCm: number,
    regrueso: 'NINGUNO' | 'UN_LADO' | 'AMBOS_LADOS',
    barra?: {
      profundidadCm: number,    // 35-45 = 80%, 50-60 = 100%
      incluyeHerraje: boolean,  // +$350.000 herraje electrostático
    }
  },

  acabados?: {
    ledMetros: number,          // ML de tira LED
    puertasVidrio?: Array<{     // Una entrada por cada puerta de vidrio
      altoCm: number,
      anchoCm: number,
    }>,
    pintadoAltosBrillo?: {
      puertasSuperiores: number,
      puertasInferiores: number,
      puertasAlacena: number,
      tapasCajon: number,
      tapasEspeciero: number,
      tapasGola: number,
    }
  },

  costoTransporte: boolean,   // true = suma $600.000
}
```

---

## 4. Catálogo de Precios Requerido en BD

> Tabla: `public.pricing_catalog` — columnas usadas: `code` (TEXT), `value` (NUMERIC), `category` (TEXT), `name` (TEXT)

El motor lee estos códigos de Supabase. Si un código no está en BD, usa el fallback hardcodeado en `kitchen.engine.ts` (mismo valor).

### 4.1 Muebles Lineales

| `code` | `name` | `value` | `category` |
|--------|--------|:-------:|:----------:|
| `COCINA_INF_ML_STANDARD` | Mueble Inferior Standard /ml | 900000 | cocina |
| `COCINA_SUP_ML_STANDARD` | Mueble Superior Standard /ml | 900000 | cocina |
| `COCINA_INF_ML_PREMIUM` | Mueble Inferior Premium /ml | 1100000 | cocina |
| `COCINA_SUP_ML_PREMIUM` | Mueble Superior Premium /ml | 1100000 | cocina |
| `COCINA_INF_ML_DELUXE` | Mueble Inferior Deluxe /ml | 1350000 | cocina |
| `COCINA_SUP_ML_DELUXE` | Mueble Superior Deluxe /ml | 1350000 | cocina |
| `COCINA_FRENTE_POLLO_ML` | Frente PLL /ml | 750000 | cocina |

### 4.2 Módulos Especiales

| `code` | `name` | `value` | `category` |
|--------|--------|:-------:|:----------:|
| `NICHO_NEVECON` | Nicho Nevecón | 1200000 | cocina_modulo |
| `NICHO_NEVERA` | Nicho Nevera | 1100000 | cocina_modulo |
| `ALACENA_ENTREPAÑOS` | Alacena con Entrepaños | 1250000 | cocina_modulo |
| `ALACENA_HERRAJE` | Alacena con Herraje | 900000 | cocina_modulo |
| `TORRE_HORNOS` | Torre de Hornos | 1350000 | cocina_modulo |

### 4.3 Mesones

| `code` | `name` | `value` | `category` |
|--------|--------|:-------:|:----------:|
| `MESON_SINTERIZADO` | Mesón Sinterizado /ml | 1200000 | cocina_meson |
| `MESON_CUARZO` | Mesón Cuarzo /ml | 850000 | cocina_meson |
| `MESON_GRANITO` | Mesón Granito /ml | 700000 | cocina_meson |

### 4.4 Acabados

| `code` | `name` | `value` | `category` |
|--------|--------|:-------:|:----------:|
| `LED_ML` | Iluminación LED /ml | 220000 | cocina_acabado |
| `VIDRIO_AHUMADO_M2` | Puerta Vidrio Ahumado Marco Negro /m² | 1200000 | cocina_acabado |
| `BISAGRA_PAR` | Bisagra adicional /par | 15000 | cocina_acabado |
| `PINTADO_PUERTA_SUP` | Pintado Alto Brillo — Puerta Superior | 120000 | cocina_pintado |
| `PINTADO_PUERTA_INF` | Pintado Alto Brillo — Puerta Inferior | 150000 | cocina_pintado |
| `PINTADO_PUERTA_ALACENA` | Pintado Alto Brillo — Puerta Alacena | 250000 | cocina_pintado |
| `PINTADO_TAPA_CAJON` | Pintado Alto Brillo — Tapa Cajón | 90000 | cocina_pintado |
| `PINTADO_TAPA_ESPECIERO` | Pintado Alto Brillo — Tapa Especiero | 100000 | cocina_pintado |
| `PINTADO_TAPA_GOLA` | Pintado Alto Brillo — Tapa Gola | 45000 | cocina_pintado |

### 4.5 Costos Fijos

| `code` | `name` | `value` | `category` |
|--------|--------|:-------:|:----------:|
| `COSTO_TRANSPORTE` | Transporte e Imprevistos | 600000 | fijo |
| `DISEÑO_3D` | Diseño 3D (sin compra cocina) | 350000 | fijo |
| `HERRAJE_BARRA_ISLA` | Herraje Barra Isla (electrostático) | 350000 | cocina_isla |

---

## 5. Flujo de Cálculo

```
RECIBIR configuración del frontend
│
├─ PASO 1: Calcular metrajeResultante
│   metrajeResultante = metrajeTotal
│   Para cada módulo especial:
│     metrajeResultante -= descuentoML[modulo.codigo] × modulo.cantidad
│   metrajeResultante = MAX(0, metrajeResultante)
│
├─ PASO 2: Calcular costo de muebles lineales
│   Si tipoCocina es COMPLETA_*:
│     costoMuebles = metrajeResultante × (precioInf + precioSup)
│   Si tipoCocina es SOLO_SUPERIOR o SOLO_INFERIOR:
│     costoMuebles = metrajeResultante × $900.000
│   Si tipoCocina es FRENTE_POLLO:
│     costoMuebles = metrajeResultante × $750.000
│
├─ PASO 3: Sumar módulos especiales (precio fijo por cada uno)
│   costoModulos = Σ(precioFijo[codigo] × cantidad)
│
├─ PASO 4: Calcular mesón principal
│   Si tipoCocina es SOLO_SUPERIOR o FRENTE_POLLO → costoMeson = 0
│   Si meson.tipo es NINGUNO → costoMeson = 0
│   Si no:
│     multiplicador = fn(meson.profundidadCm)
│     costoMeson = metrajeResultante × precioMaterial × multiplicador
│
├─ PASO 5: Calcular isla (si aplica)
│   metrajeIslaEfectivo = largoMl
│     + (regrueso UN_LADO:   0.90 + 0.60)
│     + (regrueso AMBOS_LADOS: 1.80 + 0.60)
│   multiplicadorIsla = fn(isla.profundidadCm)
│   costoIsla = metrajeIslaEfectivo × precioMaterial × multiplicadorIsla
│   Si lleva barra:
│     factorBarra = 0.80 si prof 35-45, 1.00 si prof 50-60
│     costoBarra = metrajeIsla × precioMaterial × factorBarra
│              + (incluyeHerraje ? $350.000 : 0)
│
├─ PASO 6: Calcular acabados
│   costoLED = acabados.ledMetros × $220.000
│   Para cada puerta de vidrio:
│     m2 = (altoCm / 100) × (anchoCm / 100)
│     costoVidrio += m2 × $1.200.000
│     bisagras += (altoCm > 140 ? 2 : altoCm > 80 ? 1 : 0) pares × $15.000
│   costoPintado = Σ(cantidad × precio por tipo pieza)
│
├─ PASO 7: Calcular costo fijo
│   costoTransporte = costoTransporte ? $600.000 : 0
│
├─ PASO 8: Sumar subtotal
│   SUBTOTAL = costoMuebles + costoModulos + costoMeson
│            + costoIsla + costoBarra
│            + costoLED + costoVidrio + bisagras
│            + costoPintado + costoTransporte
│
└─ PASO 9: Retornar resultado detallado
    {
      subtotal,
      metrajeResultante,
      desglose: { costoMuebles, costoModulos, costoMeson, ... },
      precios: { ... }   // snapshot de precios usados (para auditoría)
    }
```

---

## 6. Arquitectura de Archivos

```
CRM-INNOVAR-APP-main/
│
├── cotizadores/
│   └── MOTOR_COCINAS.md              ← Este archivo (documentación)
│
├── db/
│   └── migrations/
│       ├── 001_generate_quotation_number.sql
│       └── 002_kitchen_pricing_catalog.sql  ← NUEVO: seed precios correctos
│
├── server/
│   ├── controllers/
│   │   └── quotation.controller.ts   ← ACTUALIZADO: llama a kitchen.engine
│   └── services/
│       ├── pricing.service.ts        ← ACTUALIZADO: delega a kitchen.engine
│       └── kitchen.engine.ts         ← NUEVO: motor puro de cocinas
│
└── src/
    └── schemas/
        └── quotation.schema.ts       ← ACTUALIZADO: KitchenConfigSchema expandido
```

### Responsabilidades por archivo

| Archivo | Responsabilidad |
|---------|----------------|
| `kitchen.engine.ts` | Toda la matemática de cocinas. Recibe config + precios del catálogo → retorna subtotal + desglose. Es la única fuente de verdad del cálculo. |
| `pricing.service.ts` | Orquesta: carga el catálogo de Supabase, llama al engine, retorna resultado. |
| `quotation.controller.ts` | Recibe HTTP request, valida, llama al service, retorna JSON al frontend. |
| `quotation.schema.ts` | Define y valida la forma exacta del JSON que acepta el backend. |
| `002_kitchen_pricing_catalog.sql` | Puebla `pricing_catalog` con los valores oficiales del documento. |

---

## 7. API: Contrato Frontend ↔ Backend

### 7.1 Calcular precio de cocina

```
POST /api/quotations/calculate-item
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "category": "cocina",
  "configuration": { ... }   ← Ver Schema sección 3
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "calculated_total": 12150000,
    "metrajeResultante": 2.8,
    "desglose": {
      "costoMuebles": 5040000,
      "costoModulos": 2550000,
      "costoMeson": 3360000,
      "costoIsla": 0,
      "costoBarra": 0,
      "costoLED": 0,
      "costoVidrio": 0,
      "costoPintado": 0,
      "costoTransporte": 0
    },
    "precios_usados": {
      "inf_ml": 900000,
      "sup_ml": 900000,
      "meson_ml": 1200000,
      "multiplicador_profundidad": 1.0
    }
  }
}
```

**Error de validación (400):**
```json
{
  "success": false,
  "error": "Datos inválidos",
  "details": [ { "path": ["metrajeTotal"], "message": "El metraje no puede ser negativo" } ]
}
```

### 7.2 Guardar cotización completa

```
POST /api/quotations/save
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "client_id": "uuid",
  "subtotal": 12150000,
  "discount_type": "percent",
  "discount_value": 5,
  "transport_cost": 0,
  "total_amount": 11542500,
  "items": [
    {
      "product_category": "cocina",
      "configuration": { ... },   ← El mismo JSON enviado al calculate-item
      "calculated_total": 12150000
    }
  ]
}
```

---

## 8. Correcciones vs. Estado Anterior

| Problema | Estado anterior | Estado nuevo |
|----------|----------------|--------------|
| `pricing_catalog` no tiene columna `is_active` | Se consultaba y fallaba silenciosamente | Eliminado. Query solo usa `code` y `value` |
| `pricing_catalog` no tiene columna `pricing_rules` | Se consultaba y fallaba silenciosamente | Eliminado. Reglas viven en `kitchen.engine.ts` |
| Fallback `ML_BASE_COCINA = $2.800.000` | Incorrecto (debería ser $1.800.000 para standard) | Separado en INF $900K + SUP $900K |
| Fallback `MESON_CUARZO = $1.200.000` | Incorrecto (es el precio del sinterizado) | Corregido a $850.000 |
| Fallback `MESON_SINTERIZADO = $2.500.000` | Incorrecto | Corregido a $1.200.000 |
| Fallback `MESON_GRANITO = $950.000` | Incorrecto | Corregido a $700.000 |
| `TORRE_HORNOS` descuenta −0.6ml | Incorrecto | Corregido a −0.70ml |
| Faltan módulos: `NICHO_NEVERA`, `ALACENA_ENTREPAÑOS`, `ALACENA_HERRAJE` | No existían | Implementados |
| Isla sin lógica de laterales ni regrueso | Incompleto | Implementado completamente |
| LED a $180.000/ml (fallback) o $85.000 (logic.ts) | Incorrecto | Corregido a $220.000/ml |
| Pintado alto brillo | No existía | Implementado |
| Puerta vidrio ahumado | No existía | Implementado |
| Save endpoint bypassed (frontend directo a Supabase) | `QuotationBuilder.tsx` hacía insert directo | Debe usarse `POST /api/quotations/save` |

---

## 9. Guía para Duplicar al Resto de Categorías

Una vez que cocinas funcione perfectamente, seguir este patrón exacto:

1. **Crear** `server/services/closets.engine.ts` (o la categoría que corresponda)
2. **Crear** la migración SQL con los códigos de `pricing_catalog` de esa categoría
3. **Agregar** el schema de entrada en `quotation.schema.ts`
4. **Agregar** el `case 'closet':` en el `switch` del `pricing.service.ts`
5. **Agregar** el `case 'closet':` en el `switch` del `quotation.controller.ts`
6. **Documentar** en `cotizadores/MOTOR_CLOSETS.md` (copiar estructura de este archivo)

Cada categoría es **independiente** — el fallo de una no afecta las demás.

---

*Documento generado el 17/05/2026. Actualizar cuando cambien precios o reglas de negocio.*
