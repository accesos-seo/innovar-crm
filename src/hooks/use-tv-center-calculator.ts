/**
 * REGLA 2: Capa Adaptadora (Hook) — server-side
 * Módulo: Cotizador de Centro de TV
 *
 * Llama al backend (POST /api/quotations/calculate-item, category='tv_center')
 * vía useCalculatePrice. El `manualDiscount` es UI-only: el subtotal y el
 * desglose vienen del servidor; el descuento se aplica localmente.
 *
 * Mantiene la shape de retorno consumida por TVCenterModule.tsx para no
 * tocar la UI.
 */

import { useMemo } from 'react';
import { TVCenterInput } from '@/features/tv_center/logic';
import { useCalculatePrice } from './useCalculatePrice';

export interface TVCenterCalculatorResult {
  basePrice:     number;
  glossPrice:    number;
  ledPrice:      number;
  shelvesPrice:  number;
  equipPrice:    number;
  transpPrice:   number;
  subtotal:      number;
  discountAmount: number;
  total:         number;
  specs: {
    material:        string;
    includes:        string;
    base:            string;
    finish:          string;
    ledDetails:      string;
    shelvesDetails:  string;
    equipDetails:    string;
  };
}

const EMPTY_RESULT = (input: TVCenterInput): TVCenterCalculatorResult => ({
  basePrice:     0,
  glossPrice:    0,
  ledPrice:      0,
  shelvesPrice:  0,
  equipPrice:    0,
  transpPrice:   0,
  subtotal:      0,
  discountAmount: 0,
  total:         0,
  specs: buildSpecs(input, 0, 0),
});

function buildSpecs(input: TVCenterInput, basePrice: number, widthClamped: number): TVCenterCalculatorResult['specs'] {
  const shelvesAdj = (input.floatingShelves ?? 2) - 2;
  return {
    material: 'RH 15mm o 18mm',
    includes: 'Incluye sistema de pasacables interno y herrajes de fijación a muro.',
    base: `Centro TV ${(widthClamped || input.width || 1.60).toFixed(2)}m — Base $${basePrice.toLocaleString('es-CO')}`,
    finish:  input.hasHighGloss ? 'Acabado Alto Brillo' : 'Acabado Estándar',
    ledDetails: input.hasLedLights ? 'Con Iluminación LED' : 'Sin LED',
    shelvesDetails: `${input.floatingShelves ?? 2} repisas${shelvesAdj > 0 ? ` (${shelvesAdj} adicionales)` : ' (incluidas en base)'}`,
    equipDetails: (input.equipmentSpaces ?? 0) > 0
      ? `${input.equipmentSpaces} espacio(s) para equipos`
      : 'Sin espacios para equipos',
  };
}

export const useTVCenterCalculator = (input: TVCenterInput): TVCenterCalculatorResult => {

  // Sanitizar: solo campos que el backend acepta. manualDiscount NO viaja.
  // Memoizado para no disparar refetch cuando solo cambia manualDiscount.
  const sanitizedConfig = useMemo(() => ({
    width:            input.width,
    hasHighGloss:     input.hasHighGloss,
    hasLedLights:     input.hasLedLights,
    floatingShelves:  input.floatingShelves,
    equipmentSpaces:  input.equipmentSpaces,
    includeTransport: input.includeTransport,
  }), [
    input.width,
    input.hasHighGloss,
    input.hasLedLights,
    input.floatingShelves,
    input.equipmentSpaces,
    input.includeTransport,
  ]);

  const { data: response, isLoading, error } = useCalculatePrice('tv_center', sanitizedConfig);

  return useMemo(() => {
    if (isLoading || error || !response?.data) {
      return EMPTY_RESULT(input);
    }

    const apiData  = response.data;
    const desglose = apiData.desglose ?? {};

    const basePrice    = Number(desglose.basePrice    ?? 0);
    const glossPrice   = Number(desglose.glossPrice   ?? 0);
    const ledPrice     = Number(desglose.ledPrice     ?? 0);
    const shelvesPrice = Number(desglose.shelvesPrice ?? 0);
    const equipPrice   = Number(desglose.equipPrice   ?? 0);
    const transpPrice  = Number(desglose.transpPrice  ?? 0);
    const widthClamped = Number(desglose.widthClamped ?? input.width ?? 1.60);

    const subtotal       = Number(apiData.calculated_total ?? 0);
    const discountAmount = subtotal * ((input.manualDiscount || 0) / 100);
    const total          = subtotal - discountAmount;

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
      specs: buildSpecs(input, basePrice, widthClamped),
    };
  }, [response, isLoading, error, input]);
};
