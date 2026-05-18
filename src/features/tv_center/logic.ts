/**
 * REGLA 1: Capa de Lógica Pura (Engine)
 * Módulo: Cotizador de Centro de TV
 */

export interface TVCenterInput {
  includeBase: boolean;
  highGloss: boolean;
  ledMetros: number;
  shelvesQuantity: number;
  includeTransport: boolean;
  manualDiscount: number;
}

export const TV_CENTER_PRICES = {
  BASE_FURNITURE: 2800000,
  HIGH_GLOSS_FINISH: 500000,
  LED_PER_METER: 180000,
  SHELF_UNIT: 150000,
  TRANSPORT: 150000,
};

export const calculateTVCenterTotal = (input: TVCenterInput) => {
  let subtotal = 0;

  if (input.includeBase) subtotal += TV_CENTER_PRICES.BASE_FURNITURE;
  if (input.highGloss) subtotal += TV_CENTER_PRICES.HIGH_GLOSS_FINISH;
  
  subtotal += (input.ledMetros || 0) * TV_CENTER_PRICES.LED_PER_METER;
  subtotal += (input.shelvesQuantity || 0) * TV_CENTER_PRICES.SHELF_UNIT;
  
  if (input.includeTransport) subtotal += TV_CENTER_PRICES.TRANSPORT;

  const discountAmount = subtotal * ((input.manualDiscount || 0) / 100);
  const total = subtotal - discountAmount;

  return {
    subtotal,
    discountAmount,
    total,
    specs: {
      material: 'RH 15mm o 18mm',
      includes: 'Incluye sistema de pasacables interno y herrajes de fijación a muro.',
      ledDetails: input.ledMetros > 0 ? `${input.ledMetros}m de Iluminación LED` : 'Sin LED',
      shelvesDetails: input.shelvesQuantity > 0 ? `${input.shelvesQuantity} Repisas Adicionales` : 'Sin repisas adicionales',
      finish: input.highGloss ? 'Acabado Alto Brillo' : 'Acabado Estándar',
      base: input.includeBase ? 'Incluye Mueble Base' : 'Sin Mueble Base'
    }
  };
};
