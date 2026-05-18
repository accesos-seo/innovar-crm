import { useMemo } from 'react';
import { calculateDoorsTotal, DoorsInput } from '@/features/doors/logic';
import { usePricing } from './usePricing';

export const useDoorsCalculator = (input: DoorsInput) => {
  const { items } = usePricing();

  const pricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(item => {
      map[item.code] = item.value;
    });
    return map;
  }, [items]);

  return useMemo(() => calculateDoorsTotal(input, pricesMap), [
    input.type,
    input.quantity,
    input.includeDintel,
    input.manualDiscount,
    pricesMap
  ]);
};
