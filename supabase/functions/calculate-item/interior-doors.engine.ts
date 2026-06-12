// ⚠️ AUTO-GENERADO por scripts/sync-pricing-engines.mjs — NO EDITAR A MANO.
// Fuente de verdad: el archivo homónimo en server/services/ (o src/schemas/).

/**
 * ============================================================
 * MOTOR DE COTIZACIÓN — PUERTAS INTERIORES
 * ============================================================
 * Archivo: server/services/interior-doors.engine.ts
 * Doc:     Cotizacioners/6-PUERTAS.docx
 *
 * Categoría: 'puerta' (singular). NO confundir con la otra
 * categoría 'puertas' (plural) que es para repuestos de cocina
 * y vive en pricing.service.ts::calculateDoors.
 *
 * Cálculo: Σ (cantidad × precio[tipo][rangoAncho]) + transport.
 *
 * REGLA DE ORO: matemáticas puras. Sin IO. Sin descuentos
 * (discountPercent es UI-only).
 * ============================================================
 */

import { z } from 'npm:zod@4';
import { InteriorDoorsConfigSchema } from './quotation.schema.ts';
import type { PriceCatalog } from './kitchen.engine.ts';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type InteriorDoorsConfig = z.infer<typeof InteriorDoorsConfigSchema>;
export type DoorType  = 'batiente' | 'corrediza';
export type WidthRange = '50-85' | '85-110';

export interface InteriorDoorCalc {
  id:           string;
  widthRange:   WidthRange;
  pricePerUnit: number;
  lineTotal:    number;
}

export interface InteriorDoorsDesglose {
  items:             InteriorDoorCalc[];
  totalUnits:        number;
  subtotalProductos: number;
  transport:         number;
}

export interface InteriorDoorsResult {
  subtotal:        number;
  metrajeEfectivo: number | null;
  desglose:        InteriorDoorsDesglose;
  preciosUsados: {
    batiente_50_85:   number;
    batiente_85_110:  number;
    corrediza_50_85:  number;
    corrediza_85_110: number;
    transport:        number;
  };
}

// ─────────────────────────────────────────────────────────────
// FALLBACKS OFICIALES
// Mantener sincronizados con db/migrations/006_interior_doors_pricing.sql
// ─────────────────────────────────────────────────────────────

const FALLBACK: Record<string, number> = {
  DOOR_BATIENTE_50_85:    890_000,
  DOOR_BATIENTE_85_110:   950_000,
  DOOR_CORREDIZA_50_85: 1_250_000,
  DOOR_CORREDIZA_85_110:1_350_000,
  DOOR_TRANSPORT:         150_000,
};

function precio(catalog: PriceCatalog, code: string): number {
  const fromDB = catalog.get(code);
  if (fromDB !== undefined) return fromDB;

  const fallback = FALLBACK[code];
  if (fallback !== undefined) {
    console.warn(`[interior-doors.engine] ⚠️  Código '${code}' no encontrado en BD. Usando fallback: $${fallback.toLocaleString()}`);
    return fallback;
  }

  console.error(`[interior-doors.engine] ❌  Código '${code}' sin fallback. Devolviendo 0.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// RANGO DE ANCHO según documento:
//   ancho ≤ 85cm → "50-85"
//   ancho >  85cm → "85-110"
// ─────────────────────────────────────────────────────────────

function getWidthRange(widthCm: number): WidthRange {
  return widthCm <= 85 ? '50-85' : '85-110';
}

function codeFor(type: DoorType, range: WidthRange): string {
  if (type === 'batiente')  return range === '50-85' ? 'DOOR_BATIENTE_50_85'  : 'DOOR_BATIENTE_85_110';
  /* corrediza */            return range === '50-85' ? 'DOOR_CORREDIZA_50_85' : 'DOOR_CORREDIZA_85_110';
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calcularInteriorDoors(
  config: InteriorDoorsConfig,
  catalog: PriceCatalog
): InteriorDoorsResult {

  const pBat50  = precio(catalog, 'DOOR_BATIENTE_50_85');
  const pBat85  = precio(catalog, 'DOOR_BATIENTE_85_110');
  const pCor50  = precio(catalog, 'DOOR_CORREDIZA_50_85');
  const pCor85  = precio(catalog, 'DOOR_CORREDIZA_85_110');
  const pTrans  = precio(catalog, 'DOOR_TRANSPORT');

  const items: InteriorDoorCalc[] = (config.doors ?? []).map((d, idx) => {
    const widthRange   = getWidthRange(d.width);
    const pricePerUnit = precio(catalog, codeFor(d.type as DoorType, widthRange));
    const qty          = Math.max(0, d.quantity ?? 0);
    return {
      id:         d.id ?? `door-${idx}`,
      widthRange,
      pricePerUnit,
      lineTotal:  pricePerUnit * qty,
    };
  });

  const subtotalProductos = items.reduce((acc, it) => acc + it.lineTotal, 0);
  const totalUnits        = (config.doors ?? []).reduce((acc, d) => acc + (d.quantity ?? 0), 0);
  const transport         = config.transport ?? 0;
  const subtotal          = Math.round(subtotalProductos + transport);

  console.log(`[interior-doors.engine] 🚪 ${items.length} ítems · ${totalUnits} ud · prod $${subtotalProductos.toLocaleString()} + transp $${transport.toLocaleString()} → subtotal $${subtotal.toLocaleString()}`);

  return {
    subtotal,
    metrajeEfectivo: null,
    desglose: {
      items,
      totalUnits,
      subtotalProductos: Math.round(subtotalProductos),
      transport,
    },
    preciosUsados: {
      batiente_50_85:   pBat50,
      batiente_85_110:  pBat85,
      corrediza_50_85:  pCor50,
      corrediza_85_110: pCor85,
      transport:        pTrans,
    },
  };
}
