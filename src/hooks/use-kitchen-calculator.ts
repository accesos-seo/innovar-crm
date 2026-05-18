/**
 * REGLA 2: Capa Adaptadora (Hooks)
 * Recibe el formData de la UI, lo formatea y se lo pasa a la Regla 1.
 */

import { useMemo } from 'react';
import { calculateKitchen, KitchenInput, KitchenResult } from '../features/kitchen/logic';
import { usePricing } from './usePricing';

export function useKitchenCalculator(config: KitchenInput): KitchenResult {
  const { items } = usePricing();

  // Mapear el catálogo de precios a un record por código para acceso rápido
  const pricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(item => {
      map[item.code] = item.value;
    });
    return map;
  }, [items]);

  return useMemo(() => {
    return calculateKitchen(config, pricesMap);
  }, [config, pricesMap]);
}
