/**
 * ============================================================
 * MOTOR DE COTIZACIÓN — ACABADOS ESPECIALES
 * ============================================================
 * Archivo: server/services/special-finishes.engine.ts
 * Doc:     Cotizacioners/3-ACABADOS.docx
 *
 * RESPONSABILIDAD ÚNICA:
 *   Calcula el subtotal de un módulo de Acabados Especiales
 *   (puertas en perfilería de aluminio + LED + transporte).
 *
 * REGLA DE ORO: matemáticas puras. Sin IO. Sin descuentos
 * (manualDiscount es UI-only).
 * ============================================================
 */

import { z } from 'zod';
import { SpecialFinishesConfigSchema } from '../../src/schemas/quotation.schema';
import type { PriceCatalog } from './kitchen.engine';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type SpecialFinishesConfig = z.infer<typeof SpecialFinishesConfigSchema>;

export interface SpecialFinishesDoorDetail {
  id?:         string;
  height:      number;
  width:       number;
  area:        number;
  hingesPairs: number;
  hingesCost:  number;
  doorCost:    number;
  total:       number;
}

export interface SpecialFinishesDesglose {
  doorsCost:        number;
  ledCost:          number;
  transportCost:    number;
  totalM2:          number;
  totalHingesCount: number;
  detailedDoors:    SpecialFinishesDoorDetail[];
}

export interface SpecialFinishesResult {
  subtotal:        number;
  metrajeEfectivo: number | null;  // N/A
  desglose:        SpecialFinishesDesglose;
  preciosUsados: {
    door_m2:     number;
    hinge_pair:  number;
    led_ml:      number;
    transport:   number;
  };
}

// ─────────────────────────────────────────────────────────────
// FALLBACKS OFICIALES
// Mantener sincronizados con db/migrations/004_special_finishes_pricing.sql
// ─────────────────────────────────────────────────────────────

const FALLBACK: Record<string, number> = {
  FIN_DOOR_M2:    1_200_000,
  FIN_HINGE_PAIR:    15_000,
  FIN_LED_ML:       150_000,
  FIN_TRANSPORT:    150_000,
};

function precio(catalog: PriceCatalog, code: string): number {
  const fromDB = catalog.get(code);
  if (fromDB !== undefined) return fromDB;

  const fallback = FALLBACK[code];
  if (fallback !== undefined) {
    console.warn(`[special-finishes.engine] ⚠️  Código '${code}' no encontrado en BD. Usando fallback: $${fallback.toLocaleString()}`);
    return fallback;
  }

  console.error(`[special-finishes.engine] ❌  Código '${code}' sin fallback. Devolviendo 0.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// REGLA DE BISAGRAS POR ALTURA
// Fuente: 3-ACABADOS.docx
//   altura ≤ 0.80m → 1 par
//   0.80 < altura ≤ 1.40m → 2 pares
//   altura > 1.40m → 3 pares
// ─────────────────────────────────────────────────────────────

function hingesByHeight(heightM: number): number {
  if (heightM > 1.40) return 3;
  if (heightM > 0.80) return 2;
  return 1;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calcularSpecialFinishes(
  config: SpecialFinishesConfig,
  catalog: PriceCatalog
): SpecialFinishesResult {

  const priceDoorM2    = precio(catalog, 'FIN_DOOR_M2');
  const priceHingePair = precio(catalog, 'FIN_HINGE_PAIR');
  const priceLedMl     = precio(catalog, 'FIN_LED_ML');
  const priceTransport = precio(catalog, 'FIN_TRANSPORT');

  let doorsCost        = 0;
  let totalM2          = 0;
  let totalHingesCount = 0;
  const detailedDoors: SpecialFinishesDoorDetail[] = [];

  for (const door of config.doors ?? []) {
    const area        = door.height * door.width;
    const hingesPairs = hingesByHeight(door.height);
    const doorCost    = area * priceDoorM2;
    const hingesCost  = hingesPairs * priceHingePair;
    const total       = doorCost + hingesCost;

    doorsCost        += total;
    totalM2          += area;
    totalHingesCount += hingesPairs;

    detailedDoors.push({
      id: door.id,
      height: door.height,
      width:  door.width,
      area,
      hingesPairs,
      hingesCost,
      doorCost,
      total,
    });
  }

  const ledCost       = config.includeLed       ? (config.ledMl ?? 0) * priceLedMl : 0;
  const transportCost = config.includeTransport ? priceTransport                   : 0;

  const subtotal = Math.round(doorsCost + ledCost + transportCost);

  console.log(`[special-finishes.engine] ✨ ${detailedDoors.length} puertas · $${doorsCost.toLocaleString()} + LED $${ledCost.toLocaleString()} + transp $${transportCost.toLocaleString()} → subtotal $${subtotal.toLocaleString()}`);

  return {
    subtotal,
    metrajeEfectivo: null,
    desglose: {
      doorsCost:        Math.round(doorsCost),
      ledCost:          Math.round(ledCost),
      transportCost:    Math.round(transportCost),
      totalM2,
      totalHingesCount,
      detailedDoors,
    },
    preciosUsados: {
      door_m2:    priceDoorM2,
      hinge_pair: priceHingePair,
      led_ml:     priceLedMl,
      transport:  priceTransport,
    },
  };
}
