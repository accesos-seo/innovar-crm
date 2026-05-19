import { useMemo } from 'react';
import { MesonesInput, MesonesCalculation, calculateMesones } from '../features/mesones/logic';

export function useMesonesCalculator(input: MesonesInput): MesonesCalculation {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => calculateMesones(input), [
    // JSON.stringify permite comparación profunda del array de mesones
    JSON.stringify(input.mesones),
    input.transport,
    input.discountPercent,
  ]);
}
