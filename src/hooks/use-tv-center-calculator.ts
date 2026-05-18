/**
 * REGLA 2: Capa Adaptadora (Hooks)
 * Módulo: Cotizador de Centro de TV
 */

import { useMemo } from 'react';
import { calculateTVCenterTotal, TVCenterInput } from '@/features/tv_center/logic';

export const useTVCenterCalculator = (input: TVCenterInput) => {
  return useMemo(() => calculateTVCenterTotal(input), [
    input.includeBase,
    input.highGloss,
    input.ledMetros,
    input.shelvesQuantity,
    input.includeTransport,
    input.manualDiscount
  ]);
};
