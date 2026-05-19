export type MesonMaterial = 'granito' | 'cuarzo' | 'sinterizado';
export type MesonTipo = 'meson' | 'isla' | 'barra';
export type BarraLateralAltura = 0 | 90 | 100 | 110;

export interface MesonItem {
  id: string;
  tipo: MesonTipo;
  material: MesonMaterial;
  metrosLineales: number;
  fondo: number; // cm
  // mesón y barra
  incluyeSalpicaderoAlto?: boolean;
  // isla
  incluyeLaterales?: boolean;
  incluyeRegrueso?: boolean;
  // barra
  alturaLateral?: BarraLateralAltura;
}

export interface MesonesInput {
  mesones: MesonItem[];
  transport?: number;
  discountPercent?: number;
  notes?: string;
}

export const BASE_PRICES: Record<MesonMaterial, { standard: number; barraAngosta: number }> = {
  granito:     { standard: 700_000,   barraAngosta: 490_000   },
  cuarzo:      { standard: 850_000,   barraAngosta: 600_000   },
  sinterizado: { standard: 1_200_000, barraAngosta: 1_000_000 },
};

export const LAVAPLATOS_COST   = 130_000;
export const ISLA_LATERALES_ML = 1.8;
export const ISLA_REGRUESO_ML  = 0.9;

export const BARRA_LATERAL_HEIGHTS: BarraLateralAltura[] = [0, 90, 100, 110];

export const MESONES_DEFAULTS = {
  transport: 150_000,
  minML:     0.5,
  maxML:     10.0,
  minFondo:  35,  // barra angosta
  maxFondo:  120,
};

// Una barra es "angosta" cuando su fondo es 35-45cm → precio y multiplicador especiales
export function isBarraAngosta(tipo: MesonTipo, fondo: number): boolean {
  return tipo === 'barra' && fondo >= 35 && fondo <= 45;
}

export function getMultiplicador(tipo: MesonTipo, fondo: number): number {
  if (isBarraAngosta(tipo, fondo)) return 1.0;
  if (fondo <= 65) return 1.0;
  if (fondo <= 90) return 1.3;
  return 2.0; // 91-120cm
}

export function getPrecioBase(material: MesonMaterial, tipo: MesonTipo, fondo: number): number {
  return isBarraAngosta(tipo, fondo)
    ? BASE_PRICES[material].barraAngosta
    : BASE_PRICES[material].standard;
}

export interface MesonItemCalc {
  id: string;
  precioBase: number;
  multiplicador: number;
  subtotalMeson: number;
  subtotalLavaplatos: number;
  subtotalLaterales: number;
  subtotalRegrueso: number;
  subtotalSalpicaderoAlto: number;
  subtotal: number;
}

export interface MesonesCalculation {
  items: MesonItemCalc[];
  subtotalProductos: number;
  transport: number;
  discountAmount: number;
  total: number;
}

export function calculateMesonItem(item: MesonItem): MesonItemCalc {
  const { tipo, material, metrosLineales: ml, fondo } = item;
  const precioBase    = getPrecioBase(material, tipo, fondo);
  const multiplicador = getMultiplicador(tipo, fondo);

  const subtotalMeson = ml * precioBase * multiplicador;

  let subtotalLavaplatos      = 0;
  let subtotalLaterales       = 0;
  let subtotalRegrueso        = 0;
  let subtotalSalpicaderoAlto = 0;

  if (tipo === 'meson') {
    subtotalLavaplatos = LAVAPLATOS_COST; // flat, sin multiplicador (confirmado en todos los ejemplos)
    if (item.incluyeSalpicaderoAlto) {
      subtotalSalpicaderoAlto = ml * precioBase * multiplicador;
    }
  } else if (tipo === 'isla') {
    if (item.incluyeLaterales) {
      subtotalLaterales = ISLA_LATERALES_ML * precioBase * multiplicador;
    }
    if (item.incluyeRegrueso) {
      // El regrueso de isla siempre usa multiplicador 1.0 (siempre a 60cm)
      subtotalRegrueso = ISLA_REGRUESO_ML * precioBase;
    }
  } else if (tipo === 'barra') {
    const altura = item.alturaLateral ?? 0;
    if (altura > 0) {
      subtotalLaterales = (altura / 100) * precioBase * multiplicador;
    }
    if (item.incluyeSalpicaderoAlto) {
      subtotalSalpicaderoAlto = ml * precioBase * multiplicador;
    }
  }

  return {
    id: item.id,
    precioBase,
    multiplicador,
    subtotalMeson,
    subtotalLavaplatos,
    subtotalLaterales,
    subtotalRegrueso,
    subtotalSalpicaderoAlto,
    subtotal:
      subtotalMeson +
      subtotalLavaplatos +
      subtotalLaterales +
      subtotalRegrueso +
      subtotalSalpicaderoAlto,
  };
}

export function calculateMesones(input: MesonesInput): MesonesCalculation {
  const { mesones, transport = 0, discountPercent = 0 } = input;
  const items             = mesones.map(calculateMesonItem);
  const subtotalProductos = items.reduce((s, i) => s + i.subtotal, 0);
  const base              = subtotalProductos + transport;
  const discountAmount    = base * (discountPercent / 100);

  return {
    items,
    subtotalProductos,
    transport,
    discountAmount,
    total: base - discountAmount,
  };
}
