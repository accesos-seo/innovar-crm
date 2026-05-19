/**
 * REGLA 2: Capa Adaptadora (Hook) — server-side
 * Módulo: Cotizador de Puertas Interiores
 *
 * Llama al backend (POST /api/quotations/calculate-item, category='puerta')
 * vía useCalculatePrice. `discountPercent` es UI-only.
 *
 * NOTA: la categoría es 'puerta' (singular) — para puertas interiores.
 * NO confundir con 'puertas' (plural) que es para repuestos de cocina
 * (DoorsConfigSchema + PricingService.calculateDoors).
 *
 * Mantiene la shape de retorno (DoorsCalculation) consumida por
 * DoorsModule.tsx para no tocar la UI.
 */

import { useMemo } from 'react';
import {
  DoorsInput,
  DoorsCalculation,
  DoorItemCalc,
  WidthRange,
} from '@/features/doors/logic';
import { useCalculatePrice } from './useCalculatePrice';

const EMPTY: DoorsCalculation = {
  items:             [],
  totalUnits:        0,
  subtotalProductos: 0,
  transport:         0,
  discountAmount:    0,
  total:             0,
};

export function useDoorsCalculator(input: DoorsInput): DoorsCalculation {

  // Sanitizar: solo campos que el backend acepta. discountPercent y notes
  // son UI-only. hardwareColor / hasLintel / location no afectan precio
  // pero se mantienen en el payload por trazabilidad si el backend los echara.
  const sanitizedConfig = useMemo(() => ({
    doors: (input.doors ?? []).map(d => ({
      id:            d.id,
      type:          d.type,
      width:         d.width,
      height:        d.height,
      quantity:      d.quantity,
      hardwareColor: d.hardwareColor,
      hasLintel:     d.hasLintel,
      location:      d.location,
    })),
    transport: input.transport ?? 0,
  }), [JSON.stringify(input.doors), input.transport]);

  // Si no hay puertas con type seleccionado, evitamos disparar al backend (Zod rebotaría con 400)
  const hasValidDoors = (input.doors ?? []).some(d => d.type);
  const enabled       = hasValidDoors;

  const { data: response, isLoading, error } = useCalculatePrice(
    'puerta',
    enabled ? sanitizedConfig : undefined,
  );

  return useMemo<DoorsCalculation>(() => {
    if (!enabled || isLoading || error || !response?.data) {
      return EMPTY;
    }

    const apiData  = response.data;
    const desglose = apiData.desglose ?? {};

    const itemsBackend: Array<{
      id: string;
      widthRange: WidthRange;
      pricePerUnit: number;
      lineTotal: number;
    }> = desglose.items ?? [];

    const items: DoorItemCalc[] = itemsBackend.map(it => ({
      id:           it.id,
      widthRange:   it.widthRange,
      pricePerUnit: Number(it.pricePerUnit),
      lineTotal:    Number(it.lineTotal),
    }));

    const totalUnits        = Number(desglose.totalUnits        ?? 0);
    const subtotalProductos = Number(desglose.subtotalProductos ?? 0);
    const transport         = Number(desglose.transport         ?? 0);

    const baseSubtotal     = Number(apiData.calculated_total ?? 0);
    const discountAmount   = baseSubtotal * ((input.discountPercent || 0) / 100);
    const total            = baseSubtotal - discountAmount;

    return {
      items,
      totalUnits,
      subtotalProductos,
      transport,
      discountAmount,
      total,
    };
  }, [response, isLoading, error, enabled, input.discountPercent]);
}
