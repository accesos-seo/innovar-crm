/**
 * REGLA 1: Capa de Lógica Pura (Engine) - Varios Productos
 */

// 1. CLOSET
export interface ClosetInput {
  ancho: number;
  alto: number;
  profundidad: number;
  maletero: boolean;
  cajones: number;
}

export const calculateCloset = (input: ClosetInput) => {
  const metroCuadrado = (input.ancho / 100) * (input.alto / 100);
  const basePrice = metroCuadrado * 850000;
  const totalCajones = input.cajones * 120000;
  return {
    subtotal: basePrice + totalCajones,
    detalles: [`Área: ${metroCuadrado.toFixed(2)}m2`, `Cajones (${input.cajones}): $${totalCajones.toLocaleString()}`]
  };
};

// 2. PUERTA
export interface DoorInput {
  tipo: 'ENTRADA' | 'INTERIOR';
  ancho: number;
  alto: number;
  incluyeMarco: boolean;
}

export const calculateDoor = (input: DoorInput) => {
  const basePrice = input.tipo === 'ENTRADA' ? 1200000 : 650000;
  const total = basePrice + (input.incluyeMarco ? 150000 : 0);
  return {
    subtotal: total,
    detalles: [`Tipo: ${input.tipo}`, `Marco: ${input.incluyeMarco ? 'Sí' : 'No'}`]
  };
};

// 3. CENTRO TV
export interface TvCenterInput {
  pulgadas: number;
  conLed: boolean;
  flotante: boolean;
}

export const calculateTvCenter = (input: TvCenterInput) => {
  const basePrice = 450000 + (input.pulgadas * 10000);
  const total = basePrice + (input.conLed ? 80000 : 0);
  return {
    subtotal: total,
    detalles: [`TV: ${input.pulgadas}"`, `LED: ${input.conLed}`]
  };
};

// 4. MESONES (Standalone)
export interface CountertopInput {
  material: string;
  metros: number;
}
export const calculateCountertop = (input: CountertopInput) => {
  const price = input.material === 'CUARZO' ? 1200000 : 800000;
  return { subtotal: price * input.metros, detalles: [`Material: ${input.material}`] };
};
