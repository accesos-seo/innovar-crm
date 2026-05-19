/**
 * REGLA 2: Capa Adaptadora (Hook) — server-side
 * Módulo: Cotizador de Closets a medida
 *
 * Llama al backend (POST /api/quotations/calculate-item, category='closet')
 * vía useCalculatePrice. `discountPercent` es UI-only: el subtotal viene
 * del servidor; el descuento se aplica localmente.
 *
 * Mantiene la shape de retorno (ClosetCalculation) consumida por
 * ClosetCotizador.tsx para no tocar la UI.
 */

import { useMemo } from 'react';
import { ClosetInput, ClosetCalculation, CLOSET_DEPTHS } from '@/features/closets/logic';
import { useCalculatePrice } from './useCalculatePrice';

const EMPTY: ClosetCalculation = {
  area:            0,
  pricePerMeter:   0,
  productSubtotal: 0,
  discountAmount:  0,
  total:           0,
  depth:           0,
};

export function useClosetCalculator(input: ClosetInput): ClosetCalculation {

  // Sanitizar: solo lo que el backend acepta. discountPercent NO viaja.
  // doorType y observations son UI-only (no afectan precio).
  const sanitizedConfig = useMemo(() => ({
    type:      input.type,
    width:     input.width,
    height:    input.height,
    doorType:  input.doorType,
    transport: input.transport ?? 0,
  }), [
    input.type,
    input.width,
    input.height,
    input.doorType,
    input.transport,
  ]);

  // Si type no está seleccionado, evitamos llamar al backend (400 garantizado)
  const enabled = !!input.type;

  const { data: response, isLoading, error } = useCalculatePrice(
    'closet',
    enabled ? sanitizedConfig : undefined,
  );

  return useMemo<ClosetCalculation>(() => {
    if (!enabled || isLoading || error || !response?.data) {
      // Mantener depth localmente para que la UI siga renderizando el chip
      return {
        ...EMPTY,
        depth: input.type ? CLOSET_DEPTHS[input.type] : 0,
      };
    }

    const apiData  = response.data;
    const desglose = apiData.desglose ?? {};

    const area            = Number(desglose.area            ?? 0);
    const pricePerMeter   = Number(desglose.pricePerMeter   ?? 0);
    const productSubtotal = Number(desglose.productSubtotal ?? 0);
    const depth           = Number(desglose.depth           ?? (input.type ? CLOSET_DEPTHS[input.type] : 0));

    const subtotal       = Number(apiData.calculated_total ?? 0);
    const discountAmount = subtotal * ((input.discountPercent || 0) / 100);
    const total          = subtotal - discountAmount;

    return {
      area,
      pricePerMeter,
      productSubtotal,
      discountAmount,
      total,
      depth,
    };
  }, [response, isLoading, error, enabled, input.type, input.discountPercent]);
}
