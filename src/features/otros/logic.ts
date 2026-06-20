/**
 * features/otros/logic.ts
 * Motor puro del módulo "Otros" — líneas libres para anexar trabajos fuera de catálogo.
 * A diferencia del resto de módulos, el precio es MANUAL (lo escribe el cotizador), por lo que el
 * cálculo es client-side y NO pasa por la Edge Function calculate-item.
 */

export interface OtroLinea {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface OtrosConfig {
  lineas: OtroLinea[];
}

export interface OtroLineaResult extends OtroLinea {
  subtotal: number;
}

export interface OtrosResult {
  lineas: OtroLineaResult[];
  total: number;
}

/** Total por línea = cantidad × precio unitario (nunca negativo). Total = Σ líneas. */
export function calcularOtros(lineas: OtroLinea[]): OtrosResult {
  const detalladas: OtroLineaResult[] = lineas.map((l) => {
    const cantidad = Number(l.cantidad) || 0;
    const precio = Number(l.precioUnitario) || 0;
    return { ...l, subtotal: Math.max(0, cantidad * precio) };
  });
  const total = detalladas.reduce((sum, l) => sum + l.subtotal, 0);
  return { lineas: detalladas, total };
}

/** Fila lista para insertar en quotation_items (sin quotation_id, que pone el llamador). */
export interface OtroFilaPersistida {
  product_category: 'otro';
  description: string;
  unit_price: number;
  quantity: number;
}

/**
 * Expande las líneas libres a filas de quotation_items: una fila por línea con total > 0.
 * Descripción de respaldo si está vacía. La Σ(unit_price × quantity) iguala el total del módulo,
 * por lo que los totales de la cotización quedan consistentes.
 */
export function expandirLineasAFilas(lineas: OtroLinea[]): OtroFilaPersistida[] {
  return lineas
    .map((l) => ({
      descripcion: (l?.descripcion ?? '').trim(),
      cantidad: Number(l?.cantidad) || 0,
      precioUnitario: Number(l?.precioUnitario) || 0,
    }))
    .filter((l) => l.cantidad > 0 && l.precioUnitario > 0)
    .map((l) => ({
      product_category: 'otro' as const,
      description: l.descripcion || 'Producto adicional',
      unit_price: l.precioUnitario,
      quantity: l.cantidad,
    }));
}
