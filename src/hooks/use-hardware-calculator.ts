/**
 * REGLA 2: Capa Adaptadora (Hooks)
 * Módulo: Cotizador de Herrajes
 */

import { useMemo } from 'react';
import { HardwareInput, calculateHardwareTotal, HardwareCalculationResults } from '@/features/hardware/logic';

export const useHardwareCalculator = (input: HardwareInput): HardwareCalculationResults => {
  return useMemo(() => {
    return calculateHardwareTotal(input);
  }, [input]);
};
