/**
 * @deprecated for production — moved to server-side.
 *
 * Producción: server/services/tv-center.engine.ts + pricing_catalog (DB).
 * Este archivo se mantiene solo para:
 *   - Tipos/interfaces compartidos (TVCenterInput)
 *   - Constantes NO monetarias usadas por la UI (MIN_WIDTH, MAX_WIDTH, BASE_SHELVES, etc.)
 *   - Tests unitarios de regresión matemática
 *
 * NO usar calculateTVCenterTotal() en runtime de producción. La UI debe
 * consumir useTVCenterCalculator() (server-side via useCalculatePrice).
 *
 * REGLA 1 original: Capa de Lógica Pura (Engine)
 * Módulo: Cotizador de Centro de TV
 * Fuente de verdad: 2-CENTRO_DE_TV.docx
 */

export interface TVCenterInput {
  width: number;           // 1.20 a 2.40m en pasos de 0.20
  hasHighGloss: boolean;
  hasLedLights: boolean;
  floatingShelves: number; // 0–5 (2 están incluidas en el precio base)
  equipmentSpaces: number; // 0–4
  includeTransport: boolean;
  manualDiscount: number;
}

export const TV_CENTER_PRICES = {
  BASE_WIDTH: 1.60,
  BASE_PRICE: 2_800_000,
  INCREMENT_PER_20CM: 500_000,
  HIGH_GLOSS: 350_000,
  LED: 250_000,
  EXTRA_SHELF: 100_000,
  EQUIPMENT_SPACE: 150_000,
  TRANSPORT: 150_000,
  BASE_SHELVES: 2,
  MIN_WIDTH: 1.20,
  MAX_WIDTH: 2.40,
} as const;

export const calculateTVCenterTotal = (input: TVCenterInput) => {
  // Clamping del ancho al rango válido
  const width = Math.min(TV_CENTER_PRICES.MAX_WIDTH, Math.max(TV_CENTER_PRICES.MIN_WIDTH, input.width ?? 1.60));

  // Precio base según ancho: cada 20cm de diferencia = ±$500.000
  const diffCm = Math.round((width - TV_CENTER_PRICES.BASE_WIDTH) * 100);
  const increments = Math.round(diffCm / 20);
  const basePrice = TV_CENTER_PRICES.BASE_PRICE + increments * TV_CENTER_PRICES.INCREMENT_PER_20CM;

  // Opcionales
  const glossPrice  = input.hasHighGloss ? TV_CENTER_PRICES.HIGH_GLOSS : 0;
  const ledPrice    = input.hasLedLights ? TV_CENTER_PRICES.LED        : 0;

  // Repisas: 2 incluidas en el precio base
  // Menos de 2 → descuento | Más de 2 → recargo
  const shelvesAdj   = (input.floatingShelves ?? TV_CENTER_PRICES.BASE_SHELVES) - TV_CENTER_PRICES.BASE_SHELVES;
  const shelvesPrice = shelvesAdj * TV_CENTER_PRICES.EXTRA_SHELF;

  // Espacios para equipos
  const equipPrice  = (input.equipmentSpaces ?? 0) * TV_CENTER_PRICES.EQUIPMENT_SPACE;
  const transpPrice = input.includeTransport ? TV_CENTER_PRICES.TRANSPORT : 0;

  const subtotal      = basePrice + glossPrice + ledPrice + shelvesPrice + equipPrice + transpPrice;
  const discountAmount = subtotal * ((input.manualDiscount || 0) / 100);
  const total         = subtotal - discountAmount;

  return {
    basePrice,
    glossPrice,
    ledPrice,
    shelvesPrice,
    equipPrice,
    transpPrice,
    subtotal,
    discountAmount,
    total,
    specs: {
      material:      'RH 15mm o 18mm',
      includes:      'Incluye sistema de pasacables interno y herrajes de fijación a muro.',
      base:          `Centro TV ${width.toFixed(2)}m — Base $${basePrice.toLocaleString('es-CO')}`,
      finish:        input.hasHighGloss ? 'Acabado Alto Brillo' : 'Acabado Estándar',
      ledDetails:    input.hasLedLights ? 'Con Iluminación LED' : 'Sin LED',
      shelvesDetails:`${input.floatingShelves ?? 2} repisas${shelvesAdj > 0 ? ` (${shelvesAdj} adicionales)` : ' (incluidas en base)'}`,
      equipDetails:  (input.equipmentSpaces ?? 0) > 0
                       ? `${input.equipmentSpaces} espacio(s) para equipos`
                       : 'Sin espacios para equipos',
    },
  };
};
