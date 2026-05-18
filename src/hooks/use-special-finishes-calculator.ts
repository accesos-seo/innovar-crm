/**
 * REGLA 2: Capa Adaptadora (Hooks)
 * Módulo: Cotizador de Acabados Especiales
 */

import { useMemo } from 'react';
import { SpecialFinishesInput, calculateSpecialFinishes, SpecialFinishesResults } from '@/features/special_finishes/logic';

export const useSpecialFinishesCalculator = (input: SpecialFinishesInput): SpecialFinishesResults => {
  return useMemo(() => {
    return calculateSpecialFinishes(input);
  }, [input]);
};
