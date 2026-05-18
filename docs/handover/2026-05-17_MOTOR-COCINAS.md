# HAND OVER — Motor de Cotización: Cocinas Integrales
**Fecha:** 17/05/2026
**Agente saliente:** Claude Code (Sesión motor de cocinas)
**Proyecto:** CRM-INNOVAR-APP — `CRM-INNOVAR-APP-main`
**Estado al cierre:** ✅ Motor funcional y testeado. Detenido para no interferir con agente paralelo.

---

## 1. CONTEXTO — ¿Por qué se detiene?

Se suspende el trabajo de este agente porque otro agente de CODE está trabajando en paralelo sobre el mismo repositorio. Para evitar conflictos de archivos y pérdida de productividad, se levanta este Hand Over y se congela la sesión hasta nueva instrucción.

---

## 2. QUÉ SE HIZO — Trabajo completado

### 2.1 Fuente de verdad leída
- Archivo: `Cotizacioners/1-COCINAS.docx`
- Contenido: Reglas completas de cotización de cocinas integrales (10 pasos), precios base, módulos especiales, mesones, isla, recargos, acabados, pintado alto brillo.

### 2.2 Diagnóstico del codebase previo
Se detectaron los siguientes problemas en el estado anterior:

| Problema | Archivo | Estado |
|----------|---------|--------|
| `pricing_catalog` consultaba columnas inexistentes (`is_active`, `pricing_rules`) | `pricing.service.ts` | ✅ Corregido |
| Mesón Cuarzo fallback: $1.200.000 (era el precio del Sinterizado) | `logic.ts` + `pricing.service.ts` | ✅ Corregido |
| Mesón Sinterizado fallback: $2.500.000 (incorrecto) | `logic.ts` | ✅ Corregido |
| Mesón Granito fallback: $950.000 (incorrecto) | `logic.ts` | ✅ Corregido |
| Torre Hornos descontaba −0.6ml (correcto es −0.7ml) | `logic.ts` | ✅ Corregido |
| LED fallback: $85.000–$180.000/ml (correcto es $220.000) | `logic.ts` | ✅ Corregido |
| Módulos especiales se cobraban como cargo adicional (error de lógica) | `pricing.service.ts` | ✅ Corregido |
| Isla sin lógica de laterales ni regrueso | `pricing.service.ts` | ✅ Implementado |
| Pintado alto brillo no existía | — | ✅ Implementado |
| Save endpoint bypassed (frontend insertaba directo a Supabase) | `QuotationBuilder.tsx` | ⏳ Pendiente |

### 2.3 Archivos creados (nuevos)

| Archivo | Descripción |
|---------|-------------|
| `server/services/kitchen.engine.ts` | Motor puro de cálculo. Toda la matemática de cocinas. Sin dependencias HTTP. |
| `db/migrations/002_kitchen_pricing_catalog.sql` | Migración que puebla `pricing_catalog` con precios correctos del documento. |
| `cotizadores/MOTOR_COCINAS.md` | Documentación completa del motor: reglas, schema, API, flujo, correcciones. |
| `docs/handover/2026-05-17_MOTOR-COCINAS.md` | Este archivo. |

### 2.4 Archivos modificados

| Archivo | Qué cambió |
|---------|------------|
| `src/schemas/quotation.schema.ts` | `KitchenConfigSchema` completamente reescrito. Nuevos campos: `tipoCocina`, `modulosEspeciales` (objetos), `meson.tipo`, `meson.profundidadCm`, `isla` con regrueso, `acabados`, `costoTransporte`. Eliminados: `forma` como tipo de cocina, `mueblesEspeciales` (string[]), `meson.codigo`, `meson.profundidad`, `barrasML`, `ledMetros` top-level, `instalacionLavaplatos`. |
| `server/services/pricing.service.ts` | Reescrito como orquestador. Solo carga catálogo de Supabase (`code`, `value`) y delega al engine. Eliminada toda la lógica de cálculo de este archivo. |
| `server/controllers/quotation.controller.ts` | Actualizado switch de categorías. Devuelve `desglose` y `precios_usados` completos. Slots comentados para futuras categorías. |
| `src/features/kitchen/KitchenModule.tsx` | Reescrito. Ahora llama al backend (`useCalculatePrice`) en lugar del hook local. Usa nuevos nombres de campos del schema. |
| `src/components/quotations/KitchenConfigurator.tsx` | Reescrito. Mismos cambios que KitchenModule. Agrega selector de `tipoCocina` y módulos especiales como objetos. |

---

## 3. ARQUITECTURA IMPLEMENTADA

```
Frontend (UI — KitchenConfigurator / KitchenModule)
    │
    │  POST /api/quotations/calculate-item
    │  { category: "cocina", configuration: { ... } }
    ▼
quotation.controller.ts        ← Valida request con Zod
    │
    ▼
pricing.service.ts             ← Carga pricing_catalog de Supabase (code + value)
    │                             Construye Map<string, number>
    ▼
kitchen.engine.ts              ← Matemática pura
    │   PASO 1: metrajeResultante = metrajeTotal − Σ(descuentos módulos)
    │   PASO 2: costoMuebles según tipoCocina
    │   PASO 3: costoModulos = $0 (incluido en muebles, doc PASO 8)
    │   PASO 4: costoMeson × multiplicadorProfundidad
    │   PASO 5: costoIsla con laterales y regrueso
    │   PASO 6: costoBarra de isla
    │   PASO 7: acabados (LED, vidrio, bisagras, pintado)
    │   PASO 8: costoTransporte (opcional)
    │   PASO 9: subtotal = Σ todo
    ▼
Response: { calculated_total, metrajeResultante, desglose, precios_usados }
```

---

## 4. SCHEMA DE ENTRADA (v2) — Lo que el frontend envía

```typescript
{
  tipoCocina:  'COMPLETA_STANDARD' | 'COMPLETA_PREMIUM' | 'COMPLETA_DELUXE'
             | 'SOLO_SUPERIOR' | 'SOLO_INFERIOR' | 'FRENTE_POLLO',
  forma:       'L' | 'U' | 'LINEAL' | 'PARALELA' | 'ISLA',  // solo visual
  metrajeTotal: number,   // 0.5 – 10 ml
  modulosEspeciales: Array<{
    codigo:   'NICHO_NEVECON' | 'NICHO_NEVERA' | 'ALACENA_ENTREPAÑOS'
            | 'ALACENA_HERRAJE' | 'TORRE_HORNOS',
    cantidad: number
  }>,
  meson: {
    tipo:          'SINTERIZADO' | 'CUARZO' | 'GRANITO' | 'NINGUNO',
    profundidadCm: number,   // ≤60 sin recargo | 61-90 +30% | 91-120 ×2
  },
  isla?: { material, largoMl, profundidadCm, regrueso, barra? },
  acabados?: { ledMetros, puertasVidrio?, pintadoAltosBrillo? },
  costoTransporte: boolean
}
```

---

## 5. REGLA CRÍTICA — Módulos Especiales

> **Los módulos especiales NO generan cargo adicional al cliente.**
> Solo descuentan metraje. `costoModulos = $0` siempre.
> Fuente: Ejemplos numéricos PASO 8 del documento + texto "Precio: Incluido en muebles."

Los precios listados en `pricing_catalog` para los módulos son **referencia interna de producción**, no cargos al cliente.

---

## 6. TESTS CORRIDOS Y VERIFICADOS

Servidor corrido en `http://localhost:3000` via `npx tsx server.ts`.

```
POST /api/quotations/calculate-item

TEST 1 — 4.5ml Standard + Nicho Nevecon + Torre Hornos + Sinterizado 60cm
  Input:    metrajeTotal=4.5, módulos=[NICHO_NEVECON, TORRE_HORNOS], meson=SINTERIZADO 60cm
  Esperado: 8.400.000 COP  (Ejemplo Práctico Final del documento)
  Obtenido: 8.400.000 COP  ✅

TEST 2 — 5ml Standard + Nicho Nevecon + Sinterizado 60cm
  Input:    metrajeTotal=5.0, módulos=[NICHO_NEVECON], meson=SINTERIZADO 60cm
  Esperado: 12.000.000 COP  (PASO 8 del documento)
  Obtenido: 12.000.000 COP  ✅

TEST 3 — 2ml Standard + Sinterizado 75cm (recargo +30%)
  Input:    metrajeTotal=2.0, módulos=[], meson=SINTERIZADO 75cm
  Esperado: 6.720.000 COP
  Obtenido: 6.720.000 COP  ✅  (multiplicador_profundidad: 1.3 confirmado)
```

---

## 7. PENDIENTES — Lo que queda por hacer

### Alta prioridad (siguiente sesión)
- [ ] **Ejecutar migración SQL en Supabase:** Correr `db/migrations/002_kitchen_pricing_catalog.sql` en el SQL Editor de Supabase. El motor actualmente usa fallbacks hardcodeados (mismos valores). Funciona, pero los precios deben vivir en BD para poder actualizarlos sin código.
- [ ] **Desconectar `QuotationBuilder.tsx` del insert directo a Supabase:** Actualmente tiene un comentario `"Inserción Real Directa a Supabase para evitar errores de API Router"`. Debe usar `POST /api/quotations/save` del backend.

### Media prioridad (después de cocinas estable)
- [ ] **Duplicar patrón para las demás categorías** — en este orden recomendado:
  1. Closets (`server/services/closets.engine.ts`)
  2. Mesones / Puertas y Tapas
  3. TV Center
  4. Acabados especiales

### Baja prioridad
- [ ] Errores TS pre-existentes sin relación: `App.tsx(69)` y `ErrorBoundary.tsx` — existían antes de esta sesión.

---

## 8. ZONA DE ARCHIVOS — Para el agente que retome

### ✅ Puede continuar en estas zonas sin leer nada más
- `server/services/kitchen.engine.ts` — bien documentado internamente
- `cotizadores/MOTOR_COCINAS.md` — documentación completa con reglas, flujo y API

### ⚠️ Leer este Hand Over antes de tocar
- `src/schemas/quotation.schema.ts`
- `server/services/pricing.service.ts`
- `server/controllers/quotation.controller.ts`
- `src/features/kitchen/KitchenModule.tsx`
- `src/components/quotations/KitchenConfigurator.tsx`

### 🔴 NO tocar sin coordinar con el otro agente paralelo
- `src/components/quotations/QuotationBuilder.tsx`
- Cualquier archivo de categorías no-cocinas hasta confirmar que el otro agente no está ahí

---

## 9. COMANDOS ÚTILES PARA RETOMAR

```bash
# Arrancar servidor
cd CRM-INNOVAR-APP-main
npx tsx server.ts

# Verificar TypeScript
npx tsc --noEmit

# Test rápido del motor de cocinas
curl -s -X POST http://localhost:3000/api/quotations/calculate-item \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -d '{
    "category": "cocina",
    "configuration": {
      "tipoCocina": "COMPLETA_STANDARD",
      "forma": "L",
      "metrajeTotal": 4.5,
      "modulosEspeciales": [{"codigo":"NICHO_NEVECON","cantidad":1},{"codigo":"TORRE_HORNOS","cantidad":1}],
      "meson": {"tipo":"SINTERIZADO","profundidadCm":60},
      "costoTransporte": false
    }
  }'
# Respuesta esperada: { "data": { "calculated_total": 8400000 } }
```

---

*Hand Over generado el 17/05/2026. El trabajo puede retomarse en cualquier momento desde este punto sin pérdida de contexto.*
