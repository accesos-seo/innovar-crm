import { useMemo } from 'react';
import { DoorsInput, DoorsCalculation, calculateDoors } from '@/features/doors/logic';

export function useDoorsCalculator(input: DoorsInput): DoorsCalculation {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => calculateDoors(input), [
    JSON.stringify(input.doors),
    input.transport,
    input.discountPercent,
  ]);
}
