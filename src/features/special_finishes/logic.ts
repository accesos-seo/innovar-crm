/**
 * REGLA 1: Capa de Lógica Pura (Engine)
 * Módulo: Cotizador de Acabados Especiales
 */

export interface SpecialDoor {
  id: string;
  height: number; // Alto en metros
  width: number;  // Ancho en metros
}

export interface SpecialFinishesInput {
  description: string;
  doors: SpecialDoor[];
  includeLed: boolean;
  ledMl: number;
  includeTransport: boolean;
  manualDiscount: number;
}

export const SPECIAL_FINISH_PRICES = {
  DOOR_M2: 1200000,
  HINGE_PAIR: 15000,
  LED_ML: 180000,
  TRANSPORT_BASE: 150000
};

export interface SpecialFinishesResults {
  doorsCost: number;
  ledCost: number;
  transportCost: number;
  acabadosSubtotal: number;
  discountAmount: number;
  total: number;
  totalM2: number;
  totalHingesCount: number;
  detailedDoors: Array<SpecialDoor & { area: number; cost: number; hingesCost: number }>;
}

export const calculateSpecialFinishes = (input: SpecialFinishesInput): SpecialFinishesResults => {
  let doorsCost = 0;
  let totalM2 = 0;
  let totalHingesCount = 0;
  const detailedDoors: SpecialFinishesResults['detailedDoors'] = [];

  input.doors.forEach(door => {
    const area = door.height * door.width;
    const doorBaseCost = area * SPECIAL_FINISH_PRICES.DOOR_M2;
    
    let hingesCost = 0;
    let hingesMultiplier = 0;
    
    if (door.height > 1.40) {
      hingesCost = 2 * SPECIAL_FINISH_PRICES.HINGE_PAIR;
      hingesMultiplier = 2;
    } else if (door.height > 0.80) {
      hingesCost = 1 * SPECIAL_FINISH_PRICES.HINGE_PAIR;
      hingesMultiplier = 1;
    }

    const doorTotal = doorBaseCost + hingesCost;
    doorsCost += doorTotal;
    totalM2 += area;
    totalHingesCount += hingesMultiplier;

    detailedDoors.push({
      ...door,
      area,
      cost: doorTotal,
      hingesCost
    });
  });

  const ledCost = input.includeLed ? input.ledMl * SPECIAL_FINISH_PRICES.LED_ML : 0;
  const transportCost = input.includeTransport ? SPECIAL_FINISH_PRICES.TRANSPORT_BASE : 0;
  
  const acabadosSubtotal = doorsCost + ledCost + transportCost;
  const discountAmount = acabadosSubtotal * (input.manualDiscount / 100);
  const total = acabadosSubtotal - discountAmount;

  return {
    doorsCost,
    ledCost,
    transportCost,
    acabadosSubtotal,
    discountAmount,
    total,
    totalM2,
    totalHingesCount,
    detailedDoors
  };
};

export const SPECIAL_FINISH_LEGAL_NOTE = "Puertas en perfilería de Aluminio con Vidrio Ahumado.";
