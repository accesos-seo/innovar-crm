/**
 * REGLA 1: Capa de Lógica Pura (Engine)
 * Módulo: Cotizador de Herrajes (Selección Múltiple Dinámica)
 */

export interface HardwareItem {
  id: string;
  category: 'cocinas' | 'closets' | 'puertas';
  name: string;
  description: string;
  price: number;
}

export const HARDWARE_CATALOG: HardwareItem[] = [
  // CATEGORÍA: COCINAS
  { id: 'h-c-1', category: 'cocinas', name: 'Platero extraíble (600 mm)', description: 'Incluye sistema de extracción y bandeja', price: 1130000 },
  { id: 'h-c-2', category: 'cocinas', name: 'Lavaplatos Socoda', description: 'Acero inoxidable estándar', price: 150000 },
  { id: 'h-c-3', category: 'cocinas', name: 'Bisagra acero 304', description: 'Inoxidable cierre lento', price: 22000 },
  { id: 'h-c-4', category: 'cocinas', name: 'Rieles montaje bajo', description: 'Precio por par', price: 55000 },
  { id: 'h-c-5', category: 'cocinas', name: 'Esquina mágica', description: 'Cierre suave optimizado', price: 995000 },
  { id: 'h-c-6', category: 'cocinas', name: 'Cubertero metacrilato', description: 'Color gris técnico', price: 90000 },
  { id: 'h-c-7', category: 'cocinas', name: 'Canasta platero (Ref. 3089)', description: 'Accesorio interior', price: 1 }, // Precio simbólico según brief (dice $1)
  { id: 'h-c-8', category: 'cocinas', name: 'Bisagras puertas cocina', description: 'Cierre lento estándar', price: 15000 },
  { id: 'h-c-9', category: 'cocinas', name: 'Rieles de cajón', description: 'Extensión total', price: 40000 },
  { id: 'h-c-10', category: 'cocinas', name: 'Platero inoxidable', description: 'Medidas variables', price: 80000 },
  { id: 'h-c-11', category: 'cocinas', name: 'Pistones a gas', description: 'Brazo hidráulico', price: 1 }, // Precio simbólico según brief
  { id: 'h-c-12', category: 'cocinas', name: 'Herraje puerta partida', description: 'Apertura hacia arriba', price: 35000 },
  { id: 'h-c-13', category: 'cocinas', name: 'Patas zócalo', description: 'Niveladoras', price: 30000 },
  { id: 'h-c-14', category: 'cocinas', name: 'Basurero integrado', description: 'Cierre lento', price: 350000 },
  { id: 'h-c-15', category: 'cocinas', name: 'Alacena despensa doble', description: 'Abatible máxima capacidad', price: 1020000 },
  { id: 'h-c-16', category: 'cocinas', name: 'Especiero extraíble', description: 'Carro lateral', price: 350000 },

  // CATEGORÍA: CLOSETS
  { id: 'h-cl-1', category: 'closets', name: 'Mesa de planchar batiente', description: 'Escualizable ahorra espacio', price: 1 },
  { id: 'h-cl-2', category: 'closets', name: 'Rieles montaje bajo cajón', description: 'Precio por juego', price: 55000 },
  { id: 'h-cl-3', category: 'closets', name: 'Tubo de colgar ropa', description: 'Precio por metro/unidad', price: 1 },
  { id: 'h-cl-4', category: 'closets', name: 'Sistema puertas correderas', description: 'Kit completo', price: 30000 },
  { id: 'h-cl-5', category: 'closets', name: 'Manijas puertas/cajones', description: 'Diseño minimalista', price: 1 },
  { id: 'h-cl-6', category: 'closets', name: 'Pantaloneros (Módulo 70cm)', description: 'Máxima organización', price: 1 },
  { id: 'h-cl-7', category: 'closets', name: 'Joyero-Relojero', description: 'Acabado elegante', price: 1 },
  { id: 'h-cl-8', category: 'closets', name: 'Organizador Objetos', description: 'Gafas y corbatas', price: 1 },
  { id: 'h-cl-9', category: 'closets', name: 'Colgadero elevador', description: 'Acceso superior cómodo', price: 350000 },

  // CATEGORÍA: PUERTAS
  { id: 'h-p-1', category: 'puertas', name: 'Chapas gama alta', description: 'Seguridad y diseño', price: 100000 },
  { id: 'h-p-2', category: 'puertas', name: 'Bisagras CR CAL 14', description: 'Lámina alta resistencia', price: 20000 },
  { id: 'h-p-3', category: 'puertas', name: 'Topes de puerta', description: 'Protección de impacto', price: 10000 },
];

export interface SelectedHardware {
  hardwareId: string;
  quantity: number;
}

export interface HardwareInput {
  selectedItems: SelectedHardware[];
  manualDiscount: number;
}

export interface HardwareCalculationResults {
  hardwareCost: number;
  discountAmount: number;
  total: number;
  detailedItems: Array<HardwareItem & { quantity: number; subtotal: number }>;
}

export const calculateHardwareTotal = (input: HardwareInput): HardwareCalculationResults => {
  let hardwareCost = 0;
  const detailedItems: HardwareCalculationResults['detailedItems'] = [];

  input.selectedItems.forEach(item => {
    const hardware = HARDWARE_CATALOG.find(h => h.id === item.hardwareId);
    if (hardware) {
      const subtotal = item.quantity * hardware.price;
      hardwareCost += subtotal;
      detailedItems.push({
        ...hardware,
        quantity: item.quantity,
        subtotal
      });
    }
  });

  const discountAmount = hardwareCost * (input.manualDiscount / 100);
  const total = hardwareCost - discountAmount;

  return {
    hardwareCost,
    discountAmount,
    total,
    detailedItems
  };
};

export const HARDWARE_LEGAL_NOTE = "El precio unitario estipulado para cada herraje en esta cotización INCLUYE el servicio de instalación.";
