// ⚠️ AUTO-GENERADO por scripts/sync-pricing-engines.mjs — NO EDITAR A MANO.
// Fuente de verdad: el archivo homónimo en server/services/ (o src/schemas/).

/**
 * ============================================================
 * MOTOR DE COTIZACIÓN — COCINAS INTEGRALES
 * ============================================================
 * Archivo:  server/services/kitchen.engine.ts
 * Doc:      cotizadores/MOTOR_COCINAS.md
 * Fuente:   Documento 1-COCINAS.docx (14/05/2026)
 *
 * RESPONSABILIDAD ÚNICA:
 *   Recibe la configuración del cliente + un mapa de precios
 *   del catálogo de Supabase, y retorna el subtotal detallado.
 *
 * REGLA DE ORO:
 *   Este archivo NO hace llamadas HTTP ni consultas a BD.
 *   Solo matemáticas puras. Eso lo hace PricingService.
 * ============================================================
 */

import { z } from 'npm:zod@4';
import { KitchenConfigSchema } from './quotation.schema.ts';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type KitchenConfig = z.infer<typeof KitchenConfigSchema>;

/** Mapa de precios leídos de pricing_catalog en Supabase */
export type PriceCatalog = Map<string, number>;

/** Desglose completo del cálculo (para trazabilidad en quotation_items.configuration) */
export interface KitchenDesglose {
  costoMuebles:     number;
  costoModulos:     number;
  costoMeson:       number;
  costoIsla:        number;
  costoBarra:       number;
  costoLED:         number;
  costoVidrio:      number;
  costoBisagras:    number;
  costoPintado:     number;
  costoTransporte:  number;
}

export interface KitchenResult {
  subtotal:          number;
  metrajeResultante: number;
  desglose:          KitchenDesglose;
  /** Snapshot de los precios efectivamente usados — para auditoría */
  preciosUsados: {
    inf_ml:                   number;
    sup_ml:                   number;
    meson_ml:                 number;
    multiplicador_profundidad: number;
    led_ml:                   number;
  };
}

// ─────────────────────────────────────────────────────────────
// FALLBACKS OFICIALES
// Si un código no está en pricing_catalog, se usa este valor.
// Deben mantenerse sincronizados con la migración 002_kitchen.sql
// ─────────────────────────────────────────────────────────────

const FALLBACK: Record<string, number> = {
  // Muebles Standard
  COCINA_INF_ML_STANDARD:   900_000,
  COCINA_SUP_ML_STANDARD:   900_000,
  // Muebles Premium
  COCINA_INF_ML_PREMIUM:  1_100_000,
  COCINA_SUP_ML_PREMIUM:  1_100_000,
  // Muebles Deluxe
  COCINA_INF_ML_DELUXE:   1_350_000,
  COCINA_SUP_ML_DELUXE:   1_350_000,
  // Frente Pollo
  COCINA_FRENTE_POLLO_ML:   750_000,
  // Módulos especiales — precios de referencia interna (NO se usan en el subtotal)
  // Solo se usan si en el futuro se decide cotizarlos como ítem independiente.
  NICHO_NEVECON:          1_200_000,
  NICHO_NEVERA:           1_100_000,
  ALACENA_ENTREPAÑOS:     1_250_000,
  ALACENA_HERRAJE:          900_000,
  TORRE_HORNOS:           1_350_000,
  // Mesones
  MESON_SINTERIZADO:      1_200_000,
  MESON_CUARZO:             850_000,
  MESON_GRANITO:            700_000,
  // Acabados
  LED_ML:                   220_000,
  VIDRIO_AHUMADO_M2:      1_200_000,
  BISAGRA_PAR:               15_000,
  // Pintado alto brillo
  PINTADO_PUERTA_SUP:       120_000,
  PINTADO_PUERTA_INF:       150_000,
  PINTADO_PUERTA_ALACENA:   250_000,
  PINTADO_TAPA_CAJON:        90_000,
  PINTADO_TAPA_ESPECIERO:   100_000,
  PINTADO_TAPA_GOLA:         45_000,
  // Costos fijos
  COSTO_TRANSPORTE:         600_000,
  HERRAJE_BARRA_ISLA:       350_000,
};

// ─────────────────────────────────────────────────────────────
// CONSTANTES DE REGLAS DE NEGOCIO
// Fuente: cotizadores/MOTOR_COCINAS.md — Sección 2
// ─────────────────────────────────────────────────────────────

/** Descuento en metros lineales que cada módulo especial aplica al metraje base */
const MODULO_DESCUENTO_ML: Record<string, number> = {
  NICHO_NEVECON:      1.00,
  NICHO_NEVERA:       0.75,
  ALACENA_ENTREPAÑOS: 0.50,
  ALACENA_HERRAJE:    0.50,
  TORRE_HORNOS:       0.70,
};

/** Multiplicador de precio del mesón según la profundidad en cm */
function multiplicadorProfundidad(profundidadCm: number): number {
  if (profundidadCm <= 60)  return 1.00; // Sin recargo
  if (profundidadCm <= 90)  return 1.30; // +30%
  return 2.00;                            // Doble (salpicadero alto / isla)
}

/** Factor de precio para barra de isla según su profundidad en cm */
function factorBarra(profundidadCm: number): number {
  if (profundidadCm >= 35 && profundidadCm <= 45) return 0.80; // 80%
  if (profundidadCm >= 50 && profundidadCm <= 60) return 1.00; // 100%
  // Fuera de rango documentado: 100% por defecto
  return 1.00;
}

// ─────────────────────────────────────────────────────────────
// HELPER — leer precio del catálogo con fallback
// ─────────────────────────────────────────────────────────────

function precio(catalog: PriceCatalog, code: string): number {
  const fromDB = catalog.get(code);
  if (fromDB !== undefined) return fromDB;

  const fallback = FALLBACK[code];
  if (fallback !== undefined) {
    console.warn(`[kitchen.engine] ⚠️  Código '${code}' no encontrado en BD. Usando fallback: $${fallback.toLocaleString()}`);
    return fallback;
  }

  console.error(`[kitchen.engine] ❌  Código '${code}' sin fallback definido. Devolviendo 0.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calcularCocina(
  config: KitchenConfig,
  catalog: PriceCatalog
): KitchenResult {

  console.log(`[kitchen.engine] 🍳 Iniciando cálculo — tipoCocina: ${config.tipoCocina} | metraje: ${config.metrajeTotal}ml`);

  const desglose: KitchenDesglose = {
    costoMuebles:    0,
    costoModulos:    0,
    costoMeson:      0,
    costoIsla:       0,
    costoBarra:      0,
    costoLED:        0,
    costoVidrio:     0,
    costoBisagras:   0,
    costoPintado:    0,
    costoTransporte: 0,
  };

  // ── PASO 1: Metraje Resultante ────────────────────────────
  // Descontar los metros que ocupan los módulos especiales
  let metrajeResultante = config.metrajeTotal;

  for (const modulo of config.modulosEspeciales) {
    const descuento = (MODULO_DESCUENTO_ML[modulo.codigo] ?? 0) * modulo.cantidad;
    metrajeResultante -= descuento;
    console.log(`[kitchen.engine]   ➖ ${modulo.codigo} (×${modulo.cantidad}): −${descuento}ml`);
  }

  metrajeResultante = Math.max(0, metrajeResultante);
  console.log(`[kitchen.engine]   📏 Metraje resultante: ${metrajeResultante}ml`);

  // ── PASO 2: Costo de Muebles Lineales ────────────────────
  let precioInfML = 0;
  let precioSupML = 0;

  switch (config.tipoCocina) {
    case 'COMPLETA_STANDARD':
      precioInfML = precio(catalog, 'COCINA_INF_ML_STANDARD');
      precioSupML = precio(catalog, 'COCINA_SUP_ML_STANDARD');
      desglose.costoMuebles = metrajeResultante * (precioInfML + precioSupML);
      break;

    case 'COMPLETA_PREMIUM':
      precioInfML = precio(catalog, 'COCINA_INF_ML_PREMIUM');
      precioSupML = precio(catalog, 'COCINA_SUP_ML_PREMIUM');
      desglose.costoMuebles = metrajeResultante * (precioInfML + precioSupML);
      break;

    case 'COMPLETA_DELUXE':
      precioInfML = precio(catalog, 'COCINA_INF_ML_DELUXE');
      precioSupML = precio(catalog, 'COCINA_SUP_ML_DELUXE');
      desglose.costoMuebles = metrajeResultante * (precioInfML + precioSupML);
      break;

    case 'SOLO_SUPERIOR':
      // Solo gabinetes superiores. No lleva mueble inferior ni mesón.
      precioSupML = precio(catalog, 'COCINA_SUP_ML_STANDARD');
      desglose.costoMuebles = metrajeResultante * precioSupML;
      break;

    case 'SOLO_INFERIOR':
      // Solo gabinetes inferiores.
      precioInfML = precio(catalog, 'COCINA_INF_ML_STANDARD');
      desglose.costoMuebles = metrajeResultante * precioInfML;
      break;

    case 'FRENTE_POLLO':
      // Frente con puertas y cajoneros. No lleva mesón.
      precioInfML = precio(catalog, 'COCINA_FRENTE_POLLO_ML');
      desglose.costoMuebles = metrajeResultante * precioInfML;
      break;
  }

  console.log(`[kitchen.engine]   🪵 Costo muebles: $${desglose.costoMuebles.toLocaleString()}`);

  // ── PASO 3: Módulos Especiales ───────────────────────────
  // REGLA ACTUALIZADA: cada módulo cobra su precio de referencia del catálogo
  // Y descuenta los metros que ocupa del metraje base (PASO 1 ya lo hizo).
  for (const modulo of config.modulosEspeciales) {
    const precioModulo = precio(catalog, modulo.codigo);
    desglose.costoModulos += Math.round(precioModulo * modulo.cantidad);
    console.log(`[kitchen.engine]   📦 ${modulo.codigo} ×${modulo.cantidad}: $${(precioModulo * modulo.cantidad).toLocaleString()}`);
  }
  console.log(`[kitchen.engine]   📦 Total módulos: $${desglose.costoModulos.toLocaleString()}`);

  // ── PASO 4: Mesón Principal ───────────────────────────────
  // SOLO_SUPERIOR y FRENTE_POLLO no llevan mesón (validación de negocio)
  const tieneMeson = config.tipoCocina !== 'SOLO_SUPERIOR' && config.tipoCocina !== 'FRENTE_POLLO';
  let precioMesonML = 0;
  let multProfundidad = 1.0;

  if (tieneMeson && config.meson.tipo !== 'NINGUNO') {
    const codigoMeson = `MESON_${config.meson.tipo}`; // MESON_SINTERIZADO, MESON_CUARZO, etc.
    precioMesonML    = precio(catalog, codigoMeson);
    multProfundidad  = multiplicadorProfundidad(config.meson.profundidadCm);
    desglose.costoMeson = Math.round(metrajeResultante * precioMesonML * multProfundidad);

    console.log(`[kitchen.engine]   🪨 Mesón ${config.meson.tipo}: ${metrajeResultante}ml × $${precioMesonML.toLocaleString()} × ${multProfundidad} = $${desglose.costoMeson.toLocaleString()}`);
  }

  // ── PASO 5: Isla ──────────────────────────────────────────
  if (config.isla) {
    const isla = config.isla;
    const precioIslaML = precio(catalog, `MESON_${isla.material}`);
    const multIsla     = multiplicadorProfundidad(isla.profundidadCm);

    // Metraje efectivo de la isla: largo + laterales + regrueso
    let metrajeIsla = isla.largoMl;
    if (isla.regrueso === 'UN_LADO') {
      metrajeIsla += 0.90 + 0.60; // 90cm lateral + 60cm regrueso
    } else if (isla.regrueso === 'AMBOS_LADOS') {
      metrajeIsla += 1.80 + 0.60; // 2×90cm laterales + 60cm regrueso
    }

    desglose.costoIsla = Math.round(metrajeIsla * precioIslaML * multIsla);
    console.log(`[kitchen.engine]   🏝️  Isla ${isla.material}: ${metrajeIsla}ml (efectivo) × $${precioIslaML.toLocaleString()} × ${multIsla} = $${desglose.costoIsla.toLocaleString()}`);

    // Barra de isla (opcional)
    if (isla.barra) {
      const factor        = factorBarra(isla.barra.profundidadCm);
      const costoHerraje  = isla.barra.incluyeHerraje ? precio(catalog, 'HERRAJE_BARRA_ISLA') : 0;
      // La barra usa el largo de la isla (no el metraje efectivo con regrueso)
      desglose.costoBarra = Math.round(isla.largoMl * precioIslaML * factor) + costoHerraje;
      console.log(`[kitchen.engine]   🍻 Barra isla: ${isla.largoMl}ml × $${precioIslaML.toLocaleString()} × ${factor} + herraje $${costoHerraje.toLocaleString()} = $${desglose.costoBarra.toLocaleString()}`);
    }
  }

  // ── PASO 6: Acabados ─────────────────────────────────────
  if (config.acabados) {
    const acabados = config.acabados;

    // 6.1 LED
    if (acabados.ledMetros > 0) {
      const precioLED   = precio(catalog, 'LED_ML');
      desglose.costoLED = Math.round(acabados.ledMetros * precioLED);
      console.log(`[kitchen.engine]   💡 LED: ${acabados.ledMetros}ml × $${precioLED.toLocaleString()} = $${desglose.costoLED.toLocaleString()}`);
    }

    // 6.2 Puertas de vidrio ahumado
    if (acabados.puertasVidrio && acabados.puertasVidrio.length > 0) {
      const precioVidrio  = precio(catalog, 'VIDRIO_AHUMADO_M2');
      const precioBisagra = precio(catalog, 'BISAGRA_PAR');

      for (const puerta of acabados.puertasVidrio) {
        const m2 = (puerta.altoCm / 100) * (puerta.anchoCm / 100);
        desglose.costoVidrio += Math.round(m2 * precioVidrio);

        // Bisagras adicionales automáticas según altura
        const paresExtra = puerta.altoCm > 140 ? 2 : puerta.altoCm > 80 ? 1 : 0;
        desglose.costoBisagras += paresExtra * precioBisagra;

        console.log(`[kitchen.engine]   🪟 Vidrio ${puerta.altoCm}×${puerta.anchoCm}cm = ${m2.toFixed(3)}m² | +${paresExtra} pares bisagras`);
      }
    }

    // 6.3 Pintado alto brillo
    if (acabados.pintadoAltosBrillo) {
      const p = acabados.pintadoAltosBrillo;
      const pintado =
        p.puertasSuperiores * precio(catalog, 'PINTADO_PUERTA_SUP')    +
        p.puertasInferiores * precio(catalog, 'PINTADO_PUERTA_INF')    +
        p.puertasAlacena    * precio(catalog, 'PINTADO_PUERTA_ALACENA') +
        p.tapasCajon        * precio(catalog, 'PINTADO_TAPA_CAJON')     +
        p.tapasEspeciero    * precio(catalog, 'PINTADO_TAPA_ESPECIERO') +
        p.tapasGola         * precio(catalog, 'PINTADO_TAPA_GOLA');

      desglose.costoPintado = Math.round(pintado);
      console.log(`[kitchen.engine]   🎨 Pintado alto brillo: $${desglose.costoPintado.toLocaleString()}`);
    }
  }

  // ── PASO 7: Transporte ────────────────────────────────────
  if (config.costoTransporte) {
    desglose.costoTransporte = precio(catalog, 'COSTO_TRANSPORTE');
    console.log(`[kitchen.engine]   🚚 Transporte: $${desglose.costoTransporte.toLocaleString()}`);
  }

  // ── PASO 8: Subtotal Final ────────────────────────────────
  const subtotal = Math.round(
    desglose.costoMuebles   +
    desglose.costoModulos   +
    desglose.costoMeson     +
    desglose.costoIsla      +
    desglose.costoBarra     +
    desglose.costoLED       +
    desglose.costoVidrio    +
    desglose.costoBisagras  +
    desglose.costoPintado   +
    desglose.costoTransporte
  );

  console.log(`[kitchen.engine] ✅ SUBTOTAL FINAL: $${subtotal.toLocaleString()} COP`);

  return {
    subtotal,
    metrajeResultante,
    desglose,
    preciosUsados: {
      inf_ml:                    precioInfML,
      sup_ml:                    precioSupML,
      meson_ml:                  precioMesonML,
      multiplicador_profundidad: multProfundidad,
      led_ml:                    precio(catalog, 'LED_ML'),
    },
  };
}
