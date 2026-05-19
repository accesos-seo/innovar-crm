
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
  CLOSET_ESTANDAR: 750000,   // profundidad 0.60m — nivel básico
  CLOSET_ESPECIAL: 650000,   // profundidad 0.45m — económico para espacios reducidos
  CLOSET_EMPOTRADO: 900000,  // profundidad 0.60m — premium con espaldar y laterales
};

// Profundidad informativa por tipo (en metros)
export const CLOSET_DEPTHS: Record<ClosetType, number> = {
  estandar: 0.60,
  especial: 0.45,
  empotrado: 0.60,
};

export const CLOSET_DEFAULTS = {
  transport: 150000,
  minWidth: 0.5,
  maxWidth: 5.0,
  minHeight: 1.5,
  maxHeight: 3.0,
};

export interface ClosetCalculation {
  area: number;
  pricePerMeter: number;
  productSubtotal: number;
  discountAmount: number;
  total: number;
  depth: number;
}

export function calculateCloset(input: ClosetInput, dbPrices: Record<string, number> = {}): ClosetCalculation {
  const { width, height, type, transport = 0, discountPercent = 0 } = input;

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
    depth: CLOSET_DEPTHS[type],
  };
}
