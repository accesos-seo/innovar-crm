/**
 * REGLA 1: Capa de Lógica Pura (Engine)
 * Solo matemáticas. Nada de React.
 */

export interface KitchenInput {
  forma: string;
  metrajeTotal: number;
  mueblesEspeciales: string[];
  instalacionLavaplatos: boolean;
  meson?: {
    codigo: string;
    profundidad: number;
    backsplashAlto: boolean;
  };
  isla?: {
    enabled: boolean;
    metraje: number;
    profundidad: number;
    incluyeLaterales: boolean;
  };
  barrasML: number;
  ledMetros: number;
}

export interface KitchenResult {
  subtotal: number;
  areaMuebles: number;
  areaMeson: number;
  detalles: string[];
}

// CONSTANTES DE FALLBACK (Valores por defecto si no existen en BD)
const FALLBACK_PRECIOS = {
  ML_BASE_COCINA: 2800000, 
  MESON_CUARZO: 1200000,
  MESON_SINTERIZADO: 2500000,
  MESON_GRANITO: 950000,
  INST_LAVAPLATOS: 130000,
  METRO_LED: 85000,
  ML_BARRA: 650000,
  RECARGO_PROFUNDIDAD_MESON: 0.15, 
};

export function calculateKitchen(input: KitchenInput, dbPrices: Record<string, number> = {}): KitchenResult {
  let subtotal = 0;
  const detalles: string[] = [];

  // Resolver precio con prioridad: DB > Fallback
  const getP = (key: keyof typeof FALLBACK_PRECIOS) => dbPrices[key] || FALLBACK_PRECIOS[key];

  // 1. Cálculo de Muebles Base
  let metrajeEfectivo = input.metrajeTotal;
  input.mueblesEspeciales.forEach(esp => {
    if (esp === 'NICHO_NEVECON') metrajeEfectivo -= 1.0;
    if (esp === 'TORRE_HORNOS' || esp === 'DESPENSA') metrajeEfectivo -= 0.6;
  });

  const costoMuebles = Math.max(0, metrajeEfectivo) * getP('ML_BASE_COCINA');
  subtotal += costoMuebles;
  detalles.push(`Muebles Base (${metrajeEfectivo.toFixed(2)} ML): $${costoMuebles.toLocaleString()}`);

  // 2. Cálculo de Mesón
  if (input.meson) {
    let precioMLMeson = 0;
    switch (input.meson.codigo) {
      case 'MESON_CUARZO': precioMLMeson = getP('MESON_CUARZO'); break;
      case 'MESON_SINTERIZADO': precioMLMeson = getP('MESON_SINTERIZADO'); break;
      case 'MESON_GRANITO': precioMLMeson = getP('MESON_GRANITO'); break;
    }

    let costoMeson = input.metrajeTotal * precioMLMeson;
    
    // Recargo por profundidad
    if (input.meson.profundidad > 65) {
      costoMeson *= (1 + getP('RECARGO_PROFUNDIDAD_MESON'));
      detalles.push(`Recargo profundidad mesón (>65cm): 15%`);
    }

    if (input.meson.backsplashAlto) {
      costoMeson += (input.metrajeTotal * 0.6 * precioMLMeson); 
      detalles.push(`Backsplash alto incluido`);
    }

    subtotal += costoMeson;
    detalles.push(`Mesón (${input.meson.codigo}): $${costoMeson.toLocaleString()}`);
  }

  // 3. Adicionales
  if (input.instalacionLavaplatos) {
    const instCost = getP('INST_LAVAPLATOS');
    subtotal += instCost;
    detalles.push(`Instalación Lavaplatos: $${instCost.toLocaleString()}`);
  }

  if (input.ledMetros > 0) {
    const costoLed = input.ledMetros * getP('METRO_LED');
    subtotal += costoLed;
    detalles.push(`Iluminación LED (${input.ledMetros}m): $${costoLed.toLocaleString()}`);
  }

  if (input.barrasML > 0) {
    const costoBarras = input.barrasML * getP('ML_BARRA');
    subtotal += costoBarras;
    detalles.push(`Barras adicionales (${input.barrasML} ML): $${costoBarras.toLocaleString()}`);
  }

  return {
    subtotal,
    areaMuebles: metrajeEfectivo,
    areaMeson: input.metrajeTotal,
    detalles
  };
}
