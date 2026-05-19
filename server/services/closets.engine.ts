/**
 * ============================================================
 * MOTOR DE COTIZACIÓN — CLOSETS A MEDIDA
 * ============================================================
 * Archivo: server/services/closets.engine.ts
 * Doc:     Cotizacioners/4-CLOSETS.docx
 *
 * Cálculo: área (m²) × precio/m² del tipo + transporte (raw del cliente).
 * El tipo de puerta (corrediza/batiente) NO afecta precio.
 *
 * REGLA DE ORO: matemáticas puras. Sin IO. Sin descuentos
 * (discountPercent es UI-only).
 * ============================================================
 */

import { z } from 'zod';
import { ClosetConfigSchema } from '../../src/schemas/quotation.schema';
import type { PriceCatalog } from './kitchen.engine';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type ClosetConfig = z.infer<typeof ClosetConfigSchema>;

export interface ClosetDesglose {
  area:            number;  // m²
  pricePerMeter:   number;  // $/m²
  productSubtotal: number;  // área × precio/m²
  transport:       number;
  depth:           number;  // metros — profundidad informativa
}

export interface ClosetResult {
  subtotal:        number;
  metrajeEfectivo: number | null;  // área en m² (informativo)
  desglose:        ClosetDesglose;
  preciosUsados: {
    closet_estandar:  number;
    closet_especial:  number;
    closet_empotrado: number;
  };
}

// ─────────────────────────────────────────────────────────────
// FALLBACKS OFICIALES
// Mantener sincronizados con db/migrations/005_closets_pricing.sql
// ─────────────────────────────────────────────────────────────

const FALLBACK: Record<string, number> = {
  CLOSET_ESTANDAR:  750_000,
  CLOSET_ESPECIAL:  650_000,
  CLOSET_EMPOTRADO: 900_000,
};

function precio(catalog: PriceCatalog, code: string): number {
  const fromDB = catalog.get(code);
  if (fromDB !== undefined) return fromDB;

  const fallback = FALLBACK[code];
  if (fallback !== undefined) {
    console.warn(`[closets.engine] ⚠️  Código '${code}' no encontrado en BD. Usando fallback: $${fallback.toLocaleString()}`);
    return fallback;
  }

  console.error(`[closets.engine] ❌  Código '${code}' sin fallback. Devolviendo 0.`);
  return 0;
}

// Profundidad informativa por tipo (en metros)
const CLOSET_DEPTHS: Record<ClosetConfig['type'], number> = {
  estandar:  0.60,
  especial:  0.45,
  empotrado: 0.60,
};

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calcularCloset(
  config: ClosetConfig,
  catalog: PriceCatalog
): ClosetResult {

  const priceEstandar  = precio(catalog, 'CLOSET_ESTANDAR');
  const priceEspecial  = precio(catalog, 'CLOSET_ESPECIAL');
  const priceEmpotrado = precio(catalog, 'CLOSET_EMPOTRADO');

  const priceByType: Record<ClosetConfig['type'], number> = {
    estandar:  priceEstandar,
    especial:  priceEspecial,
    empotrado: priceEmpotrado,
  };

  const pricePerMeter   = priceByType[config.type];
  const area            = (config.width ?? 0) * (config.height ?? 0);
  const productSubtotal = area * pricePerMeter;
  const transport       = config.transport ?? 0;

  const subtotal = Math.round(productSubtotal + transport);

  console.log(`[closets.engine] 👕 Closet ${config.type} · ${config.width}m × ${config.height}m = ${area.toFixed(2)}m² × $${pricePerMeter.toLocaleString()} + transp $${transport.toLocaleString()} → subtotal $${subtotal.toLocaleString()}`);

  return {
    subtotal,
    metrajeEfectivo: area,
    desglose: {
      area,
      pricePerMeter,
      productSubtotal: Math.round(productSubtotal),
      transport,
      depth: CLOSET_DEPTHS[config.type],
    },
    preciosUsados: {
      closet_estandar:  priceEstandar,
      closet_especial:  priceEspecial,
      closet_empotrado: priceEmpotrado,
    },
  };
}
