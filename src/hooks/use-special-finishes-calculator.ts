/**
 * REGLA 2: Capa Adaptadora (Hook) — server-side
 * Módulo: Cotizador de Acabados Especiales
 *
 * Llama al backend (POST /api/quotations/calculate-item, category='especiales')
 * vía useCalculatePrice. `manualDiscount` y `description` son UI-only: el
 * subtotal y el desglose vienen del servidor; el descuento se aplica
 * localmente sobre el subtotal.
 *
 * Mantiene la shape de retorno (SpecialFinishesResults) consumida por
 * SpecialFinishesModule.tsx para no tocar la UI.
 */

import { useMemo } from 'react';
import { SpecialFinishesInput, SpecialFinishesResults } from '@/features/special_finishes/logic';
import { useCalculatePrice } from './useCalculatePrice';

const EMPTY_RESULT: SpecialFinishesResults = {
  doorsCost:        0,
  ledCost:          0,
  transportCost:    0,
  acabadosSubtotal: 0,
  discountAmount:   0,
  total:            0,
  totalM2:          0,
  totalHingesCount: 0,
  detailedDoors:    [],
};

export const useSpecialFinishesCalculator = (input: SpecialFinishesInput): SpecialFinishesResults => {

  // Sanitizar: solo campos que el backend acepta. manualDiscount y description
  // se quedan en cliente. Memoizado para evitar refetch innecesarios.
  const sanitizedConfig = useMemo(() => ({
    doors: (input.doors ?? []).map(d => ({
      id:     d.id,
      height: d.height,
      width:  d.width,
    })),
    includeLed:       input.includeLed,
    ledMl:            input.ledMl,
    includeTransport: input.includeTransport,
  }), [
    input.doors,
    input.includeLed,
    input.ledMl,
    input.includeTransport,
  ]);

  const { data: response, isLoading, error } = useCalculatePrice('especiales', sanitizedConfig);

  return useMemo<SpecialFinishesResults>(() => {
    if (isLoading || error || !response?.data) {
      return EMPTY_RESULT;
    }

    const apiData  = response.data;
    const desglose = apiData.desglose ?? {};

    const doorsCost        = Number(desglose.doorsCost        ?? 0);
    const ledCost          = Number(desglose.ledCost          ?? 0);
    const transportCost    = Number(desglose.transportCost    ?? 0);
    const totalM2          = Number(desglose.totalM2          ?? 0);
    const totalHingesCount = Number(desglose.totalHingesCount ?? 0);

    // Reconstruir detailedDoors con la shape histórica que la UI consume
    const backendDoors: Array<{
      id?: string;
      height: number;
      width: number;
      area: number;
      hingesCost: number;
      total: number;
    }> = desglose.detailedDoors ?? [];

    const detailedDoors = backendDoors.map(d => ({
      id:         d.id ?? '',
      height:     Number(d.height),
      width:      Number(d.width),
      area:       Number(d.area),
      cost:       Number(d.total),
      hingesCost: Number(d.hingesCost),
    }));

    const acabadosSubtotal = Number(apiData.calculated_total ?? 0);
    const discountAmount   = acabadosSubtotal * ((input.manualDiscount || 0) / 100);
    const total            = acabadosSubtotal - discountAmount;

    return {
      doorsCost,
      ledCost,
      transportCost,
      acabadosSubtotal,
      discountAmount,
      total,
      totalM2,
      totalHingesCount,
      detailedDoors,
    };
  }, [response, isLoading, error, input.manualDiscount]);
};
