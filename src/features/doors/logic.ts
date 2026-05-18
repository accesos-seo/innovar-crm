export type DoorType = 'CORREDIZA_SENCILLA' | 'CORREDIZA_DOBLE' | 'BATIENTE';

export interface DoorsInput {
  type: DoorType;
  quantity: number;
  includeDintel: boolean;
  manualDiscount: number;
}

export const FALLBACK_DOOR_PRICES: Record<string, number> = {
  DOOR_CORREDIZA_SENCILLA: 890000,
  DOOR_CORREDIZA_DOBLE: 1500000,
  DOOR_BATIENTE: 750000,
};

export const calculateDoorsTotal = (input: DoorsInput, dbPrices: Record<string, number> = {}) => {
  const priceKey = `DOOR_${input.type}`;
  const basePrice = dbPrices[priceKey] || FALLBACK_DOOR_PRICES[priceKey] || 0;
  
  const subtotal = basePrice * (input.quantity || 0);
  const discountAmount = subtotal * ((input.manualDiscount || 0) / 100);
  const total = subtotal - discountAmount;

  return {
    subtotal,
    discountAmount,
    total,
    // Informativo para PDF
    specs: {
      typeLabel: input.type.replace(/_/g, ' '),
      dintel: input.includeDintel ? 'Incluye Dintel' : 'Sin Dintel',
      altoMax: '2.20m',
      includes: 'Incluye marco, bisagras o rieles según corresponda, y chapa estándar. No incluye pintura de pared ni desmonte de puerta anterior.'
    }
  };
};
