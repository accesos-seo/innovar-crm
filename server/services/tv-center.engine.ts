/**
 * ============================================================
 * MOTOR DE COTIZACIÓN — CENTRO DE TV
 * ============================================================
 * Archivo: server/services/tv-center.engine.ts
 * Doc:     Cotizacioners/2-CENTRO_DE_TV.docx
 *
 * RESPONSABILIDAD ÚNICA:
 *   Recibe la configuración del cliente + un mapa de precios
 *   cargado desde pricing_catalog y retorna el subtotal con
 *   desglose. Sin IO. Sin descuentos (manualDiscount es UI-only).
 *
 * REGLA DE ORO:
 *   Este archivo NO hace llamadas HTTP ni consultas a BD.
 *   Solo matemáticas puras. Eso lo orquesta PricingService.
 * ============================================================
 */

import { z } from 'zod';
import { TVCenterConfigSchema } from '../../src/schemas/quotation.schema';
import type { PriceCatalog } from './kitchen.engine';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type TVCenterConfig = z.infer<typeof TVCenterConfigSchema>;

export interface TVCenterDesglose {
  basePrice:    number;
  glossPrice:   number;
  ledPrice:     number;
  shelvesPrice: number;
  equipPrice:   number;
  transpPrice:  number;
  increments:   number;  // pasos de 20cm respecto a la base 1.60m
  widthClamped: number;  // ancho efectivo tras clamp
}

export interface TVCenterResult {
  subtotal:        number;
  metrajeEfectivo: number | null;  // N/A para TV Center
  desglose:        TVCenterDesglose;
  preciosUsados: {
    base_price:        number;
    increment_20cm:    number;
    high_gloss:        number;
    led:               number;
    extra_shelf:       number;
    equipment_space:   number;
    transport:         number;
  };
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES DE NEGOCIO (NO monetarias — viven en el engine)
// ─────────────────────────────────────────────────────────────

const BASE_WIDTH    = 1.60;  // m
const BASE_SHELVES  = 2;     // las 2 primeras van incluidas en BASE_PRICE
const MIN_WIDTH     = 1.20;  // m
const MAX_WIDTH     = 2.40;  // m

// ─────────────────────────────────────────────────────────────
// FALLBACKS OFICIALES
// Si un código no está en pricing_catalog, se usa este valor.
// Mantener sincronizados con db/migrations/003_tv_center_pricing.sql
// ─────────────────────────────────────────────────────────────

const FALLBACK: Record<string, number> = {
  TV_BASE_PRICE:      2_800_000,
  TV_INCREMENT_20CM:    500_000,
  TV_HIGH_GLOSS:        350_000,
  TV_LED:               250_000,
  TV_EXTRA_SHELF:       100_000,
  TV_EQUIPMENT_SPACE:   150_000,
  TV_TRANSPORT:         150_000,
};

function precio(catalog: PriceCatalog, code: string): number {
  const fromDB = catalog.get(code);
  if (fromDB !== undefined) return fromDB;

  const fallback = FALLBACK[code];
  if (fallback !== undefined) {
    console.warn(`[tv-center.engine] ⚠️  Código '${code}' no encontrado en BD. Usando fallback: $${fallback.toLocaleString()}`);
    return fallback;
  }

  console.error(`[tv-center.engine] ❌  Código '${code}' sin fallback definido. Devolviendo 0.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calcularTVCenter(
  config: TVCenterConfig,
  catalog: PriceCatalog
): TVCenterResult {

  // 1. Resolver precios desde catálogo (con fallback)
  const tvBase            = precio(catalog, 'TV_BASE_PRICE');
  const tvIncrement       = precio(catalog, 'TV_INCREMENT_20CM');
  const tvHighGloss       = precio(catalog, 'TV_HIGH_GLOSS');
  const tvLed             = precio(catalog, 'TV_LED');
  const tvExtraShelf      = precio(catalog, 'TV_EXTRA_SHELF');
  const tvEquipmentSpace  = precio(catalog, 'TV_EQUIPMENT_SPACE');
  const tvTransport       = precio(catalog, 'TV_TRANSPORT');

  // 2. Clamp del ancho al rango válido (defensa: el Schema no valida rango)
  const widthClamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, config.width ?? BASE_WIDTH));

  // 3. Precio base ajustado por ancho: cada 20cm de diferencia = ±$500.000
  const diffCm     = Math.round((widthClamped - BASE_WIDTH) * 100);
  const increments = Math.round(diffCm / 20);
  const basePrice  = tvBase + increments * tvIncrement;

  // 4. Opcionales
  const glossPrice = config.hasHighGloss ? tvHighGloss : 0;
  const ledPrice   = config.hasLedLights ? tvLed       : 0;

  // 5. Repisas: 2 incluidas en el precio base
  //    Menos de 2 → descuento (puede ser negativo) | Más de 2 → recargo
  const shelvesAdj   = (config.floatingShelves ?? BASE_SHELVES) - BASE_SHELVES;
  const shelvesPrice = shelvesAdj * tvExtraShelf;

  // 6. Espacios para equipos
  const equipPrice = (config.equipmentSpaces ?? 0) * tvEquipmentSpace;

  // 7. Transporte
  const transpPrice = config.includeTransport ? tvTransport : 0;

  // 8. Subtotal final (sin descuento — manualDiscount es UI-only)
  const subtotal = Math.round(
    basePrice + glossPrice + ledPrice + shelvesPrice + equipPrice + transpPrice
  );

  console.log(`[tv-center.engine] 📺 Centro TV ${widthClamped.toFixed(2)}m · base $${basePrice.toLocaleString()} · gloss $${glossPrice.toLocaleString()} · led $${ledPrice.toLocaleString()} · repisas $${shelvesPrice.toLocaleString()} · equip $${equipPrice.toLocaleString()} · transp $${transpPrice.toLocaleString()} → subtotal $${subtotal.toLocaleString()}`);

  return {
    subtotal,
    metrajeEfectivo: null,
    desglose: {
      basePrice,
      glossPrice,
      ledPrice,
      shelvesPrice,
      equipPrice,
      transpPrice,
      increments,
      widthClamped,
    },
    preciosUsados: {
      base_price:      tvBase,
      increment_20cm:  tvIncrement,
      high_gloss:      tvHighGloss,
      led:             tvLed,
      extra_shelf:     tvExtraShelf,
      equipment_space: tvEquipmentSpace,
      transport:       tvTransport,
    },
  };
}
