
/**
 * REGLA 1: Capa de Lógica Pura (Engine)
 * Módulo: Closets a medida
 */

export type ClosetType = 'estandar' | 'especial' | 'empotrado';
export type DoorType = 'corrediza' | 'batiente';

export interface ClosetInput {
  type: ClosetType;
  width: number;
  height: number;
  doorType: DoorType;
  observations?: string;
  transport?: number;
  discountPercent?: number;
}

export const FALLBACK_CLOSET_PRICES: Record<string, number> = {
  CLOSET_ESTANDAR: 650000,
  CLOSET_ESPECIAL: 750000,
  CLOSET_EMPOTRADO: 900000,
};

export const CLOSET_DEFAULTS = {
  depth: 0.60, // Profundidad fija (informativo)
  transport: 150000,
  minWidth: 1,
  minHeight: 1,
};

export interface ClosetCalculation {
  area: number;
  pricePerMeter: number;
  productSubtotal: number;
  discountAmount: number;
  total: number;
}

/**
 * Calcula la matemática completa del closet
 */
export function calculateCloset(input: ClosetInput, dbPrices: Record<string, number> = {}): ClosetCalculation {
  const { width, height, type, transport = 0, discountPercent = 0 } = input;
  
  // Mapeo de tipos a códigos de base de datos
  const priceKey = `CLOSET_${type.toUpperCase()}`;
  const pricePerMeter = dbPrices[priceKey] || FALLBACK_CLOSET_PRICES[priceKey] || 0;
  
  const area = width * height;
  const productSubtotal = area * pricePerMeter;
  
  const baseForDiscount = productSubtotal + transport;
  const discountAmount = baseForDiscount * (discountPercent / 100);
  
  const total = baseForDiscount - discountAmount;

  return {
    area,
    pricePerMeter,
    productSubtotal,
    discountAmount,
    total,
  };
}
