/**
 * REGLA 2: Capa Adaptadora (Hook) — server-side
 * Módulo: Cotizador de Mesones (standalone)
 *
 * Llama al backend (POST /api/quotations/calculate-item, category='mesones')
 * vía useCalculatePrice. `discountPercent` es UI-only.
 *
 * Mantiene la shape de retorno (MesonesCalculation) consumida por
 * MesonesModule.tsx para no tocar la UI.
 */

import { useMemo } from 'react';
import { MesonesInput, MesonesCalculation, MesonItemCalc } from '@/features/mesones/logic';
import { useCalculatePrice } from './useCalculatePrice';

const EMPTY: MesonesCalculation = {
  items:             [],
  subtotalProductos: 0,
  transport:         0,
  discountAmount:    0,
  total:             0,
};

export function useMesonesCalculator(input: MesonesInput): MesonesCalculation {

  // Sanitizar: solo lo que el backend acepta. discountPercent y notes no viajan.
  const sanitizedConfig = useMemo(() => ({
    mesones: (input.mesones ?? []).map(m => ({
      id:                     m.id,
      tipo:                   m.tipo,
      material:               m.material,
      metrosLineales:         m.metrosLineales,
      fondo:                  m.fondo,
      incluyeSalpicaderoAlto: m.incluyeSalpicaderoAlto,
      incluyeLaterales:       m.incluyeLaterales,
      incluyeRegrueso:        m.incluyeRegrueso,
      alturaLateral:          m.alturaLateral,
    })),
    transport: input.transport ?? 0,
  }), [JSON.stringify(input.mesones), input.transport]);

  // Evita disparar al backend con array vacío o tipos/materiales sin escoger
  const hasValidItems = (input.mesones ?? []).some(m => m.tipo && m.material);
  const enabled       = hasValidItems;

  const { data: response, isLoading, error } = useCalculatePrice(
    'mesones',
    enabled ? sanitizedConfig : undefined,
  );

  return useMemo<MesonesCalculation>(() => {
    if (!enabled || isLoading || error || !response?.data) {
      return EMPTY;
    }

    const apiData  = response.data;
    const desglose = apiData.desglose ?? {};

    const itemsBackend: MesonItemCalc[] = (desglose.items ?? []).map((it: any) => ({
      id:                      it.id,
      precioBase:              Number(it.precioBase),
      multiplicador:           Number(it.multiplicador),
      subtotalMeson:           Number(it.subtotalMeson),
      subtotalLavaplatos:      Number(it.subtotalLavaplatos),
      subtotalLaterales:       Number(it.subtotalLaterales),
      subtotalRegrueso:        Number(it.subtotalRegrueso),
      subtotalSalpicaderoAlto: Number(it.subtotalSalpicaderoAlto),
      subtotal:                Number(it.subtotal),
    }));

    const subtotalProductos = Number(desglose.subtotalProductos ?? 0);
    const transport         = Number(desglose.transport         ?? 0);

    const baseSubtotal   = Number(apiData.calculated_total ?? 0);
    const discountAmount = baseSubtotal * ((input.discountPercent || 0) / 100);
    const total          = baseSubtotal - discountAmount;

    return {
      items:             itemsBackend,
      subtotalProductos,
      transport,
      discountAmount,
      total,
    };
  }, [response, isLoading, error, enabled, input.discountPercent]);
}
