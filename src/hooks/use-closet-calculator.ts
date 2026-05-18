
import { useMemo } from 'react';
import { ClosetInput, calculateCloset, ClosetCalculation } from '../features/closets/logic';
import { usePricing } from './usePricing';

/**
 * REGLA 2: Capa Adaptadora (Hooks)
 * Puente entre UI y Motor Lógico
 */
export function useClosetCalculator(input: ClosetInput): ClosetCalculation {
  const { items } = usePricing();

  const pricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(item => {
      map[item.code] = item.value;
    });
    return map;
  }, [items]);

  return useMemo(() => {
    return calculateCloset(input, pricesMap);
  }, [
    input.type,
    input.width,
    input.height,
    input.transport,
    input.discountPercent,
    pricesMap
  ]);
}
