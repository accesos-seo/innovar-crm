export type DoorType = 'batiente' | 'corrediza';
export type WidthRange = '50-85' | '85-110';
export type HardwareColor = 'aluminio' | 'negro';

export interface DoorItem {
  id: string;
  type: DoorType;
  width: number;        // cm — 50-110
  height: number;       // m  — 1.80-2.40
  quantity: number;
  hardwareColor: HardwareColor;
  hasLintel: boolean;
  location?: string;
  notes?: string;
}

export interface DoorsInput {
  doors: DoorItem[];
  transport?: number;
  discountPercent?: number;
  notes?: string;
}

// Precios oficiales (documento 6-PUERTAS.docx)
export const DOOR_PRICES: Record<DoorType, Record<WidthRange, number>> = {
  batiente:  { '50-85': 890_000,   '85-110': 950_000   },
  corrediza: { '50-85': 1_250_000, '85-110': 1_350_000 },
};

export const DOORS_DEFAULTS = {
  transport:     150_000,
  minWidth:      50,
  maxWidth:      110,
  minHeight:     1.80,
  maxHeight:     2.40,
  minQuantity:   1,
  maxQuantity:   20,
  defaultWidth:  80,
  defaultHeight: 2.10,
};

export const HARDWARE_COLORS: { value: HardwareColor; label: string }[] = [
  { value: 'aluminio', label: 'Aluminio' },
  { value: 'negro',    label: 'Negro' },
];

// Determinación del rango de ancho según documento:
//   ancho <= 85cm → "50-85"
//   ancho >  85cm → "85-110"
export function getWidthRange(width: number): WidthRange {
  return width <= 85 ? '50-85' : '85-110';
}

export function getDoorPrice(type: DoorType, width: number): number {
  return DOOR_PRICES[type][getWidthRange(width)];
}

export interface DoorItemCalc {
  id: string;
  widthRange: WidthRange;
  pricePerUnit: number;
  lineTotal: number;
}

export interface DoorsCalculation {
  items: DoorItemCalc[];
  totalUnits: number;
  subtotalProductos: number;
  transport: number;
  discountAmount: number;
  total: number;
}

export function calculateDoorItem(item: DoorItem): DoorItemCalc {
  const widthRange   = getWidthRange(item.width);
  const pricePerUnit = DOOR_PRICES[item.type][widthRange];
  const qty          = Math.max(0, item.quantity || 0);
  return {
    id: item.id,
    widthRange,
    pricePerUnit,
    lineTotal: pricePerUnit * qty,
  };
}

export function calculateDoors(input: DoorsInput): DoorsCalculation {
  const { doors, transport = 0, discountPercent = 0 } = input;
  const items             = doors.map(calculateDoorItem);
  const subtotalProductos = items.reduce((s, i) => s + i.lineTotal, 0);
  const totalUnits        = doors.reduce((s, d) => s + (d.quantity || 0), 0);
  const base              = subtotalProductos + transport;
  const discountAmount    = base * (discountPercent / 100);

  return {
    items,
    totalUnits,
    subtotalProductos,
    transport,
    discountAmount,
    total: base - discountAmount,
  };
}
