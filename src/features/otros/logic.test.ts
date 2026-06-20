import { describe, it, expect } from 'vitest';
import { calcularOtros, expandirLineasAFilas, OtroLinea } from './logic';

const linea = (over: Partial<OtroLinea> = {}): OtroLinea => ({
  id: Math.random().toString(36).slice(2),
  descripcion: 'Trabajo X',
  cantidad: 1,
  precioUnitario: 100000,
  ...over,
});

describe('calcularOtros', () => {
  it('total = Σ cantidad × precio unitario', () => {
    const r = calcularOtros([
      linea({ cantidad: 2, precioUnitario: 100000 }), // 200000
      linea({ cantidad: 3, precioUnitario: 50000 }),  // 150000
    ]);
    expect(r.total).toBe(350000);
    expect(r.lineas[0].subtotal).toBe(200000);
    expect(r.lineas[1].subtotal).toBe(150000);
  });

  it('líneas sin precio o sin cantidad aportan 0', () => {
    const r = calcularOtros([
      linea({ cantidad: 0, precioUnitario: 100000 }),
      linea({ cantidad: 2, precioUnitario: 0 }),
      linea({ cantidad: 2, precioUnitario: 100000 }), // 200000
    ]);
    expect(r.total).toBe(200000);
  });

  it('nunca produce subtotales negativos', () => {
    const r = calcularOtros([linea({ cantidad: -5, precioUnitario: 100000 })]);
    expect(r.total).toBe(0);
  });

  it('tolera valores no numéricos sin romper', () => {
    const r = calcularOtros([linea({ cantidad: NaN as any, precioUnitario: 'x' as any })]);
    expect(r.total).toBe(0);
  });
});

describe('expandirLineasAFilas', () => {
  it('una fila por línea con total > 0, con descripción y cantidad/precio intactos', () => {
    const filas = expandirLineasAFilas([
      linea({ descripcion: 'Desmonte', cantidad: 2, precioUnitario: 80000 }),
      linea({ descripcion: 'Flete especial', cantidad: 1, precioUnitario: 120000 }),
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ product_category: 'otro', description: 'Desmonte', quantity: 2, unit_price: 80000 });
    expect(filas[1]).toMatchObject({ description: 'Flete especial', quantity: 1, unit_price: 120000 });
  });

  it('descarta líneas vacías o sin precio', () => {
    const filas = expandirLineasAFilas([
      linea({ descripcion: '', cantidad: 0, precioUnitario: 0 }),
      linea({ descripcion: 'Sin precio', cantidad: 5, precioUnitario: 0 }),
      linea({ descripcion: 'Válida', cantidad: 1, precioUnitario: 50000 }),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0].description).toBe('Válida');
  });

  it('usa descripción de respaldo cuando está vacía pero tiene precio', () => {
    const filas = expandirLineasAFilas([linea({ descripcion: '   ', cantidad: 1, precioUnitario: 30000 })]);
    expect(filas).toHaveLength(1);
    expect(filas[0].description).toBe('Producto adicional');
  });

  it('INVARIANTE: Σ(unit_price × quantity) de las filas == total del módulo', () => {
    const lineas = [
      linea({ descripcion: 'A', cantidad: 2, precioUnitario: 100000 }),
      linea({ descripcion: '', cantidad: 3, precioUnitario: 70000 }), // se persiste con respaldo
      linea({ descripcion: 'Ignorada', cantidad: 0, precioUnitario: 99999 }), // se ignora
    ];
    const totalModulo = calcularOtros(lineas).total;
    const totalFilas = expandirLineasAFilas(lineas).reduce((s, f) => s + f.unit_price * f.quantity, 0);
    expect(totalFilas).toBe(totalModulo);
  });
});
