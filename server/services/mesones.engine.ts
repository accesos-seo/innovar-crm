/**
 * ============================================================
 * MOTOR DE COTIZACIÓN — MESONES (standalone)
 * ============================================================
 * Archivo: server/services/mesones.engine.ts
 * Doc:     Cotizacioners/5-MESONES.docx
 *
 * Diferencia con kitchen.engine.ts:
 *   El mesón dentro de una cocina lo calcula `calcularCocina()`.
 *   Aquí se cotizan mesones standalone (sin cocina), incluyendo
 *   tipos Mesón Estándar, Isla y Barra con sus opcionales.
 *
 * Reutiliza los códigos MESON_GRANITO, MESON_CUARZO, MESON_SINTERIZADO
 * (profundidad estándar) ya presentes en migración 002. Añade los
 * códigos de barra angosta y lavaplatos vía migración 007.
 *
 * REGLA DE ORO: matemáticas puras. Sin IO. Sin descuentos
 * (discountPercent es UI-only).
 * ============================================================
 */

import { z } from 'zod';
import { MesonesConfigSchema } from '../../src/schemas/quotation.schema';
import type { PriceCatalog } from './kitchen.engine';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type MesonesConfig = z.infer<typeof MesonesConfigSchema>;
export type MesonMaterial = 'granito' | 'cuarzo' | 'sinterizado';
export type MesonTipo     = 'meson' | 'isla' | 'barra';

export interface MesonItemCalc {
  id:                       string;
  precioBase:               number;
  multiplicador:            number;
  subtotalMeson:            number;
  subtotalLavaplatos:       number;
  subtotalLaterales:        number;
  subtotalRegrueso:         number;
  subtotalSalpicaderoAlto:  number;
  subtotal:                 number;
}

export interface MesonesDesglose {
  items:             MesonItemCalc[];
  subtotalProductos: number;
  transport:         number;
}

export interface MesonesResult {
  subtotal:        number;
  metrajeEfectivo: number | null;
  desglose:        MesonesDesglose;
  preciosUsados: {
    granito_standard:     number;
    granito_barra:        number;
    cuarzo_standard:      number;
    cuarzo_barra:         number;
    sinterizado_standard: number;
    sinterizado_barra:    number;
    lavaplatos:           number;
  };
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES DE NEGOCIO
// ─────────────────────────────────────────────────────────────

const ISLA_LATERALES_ML = 1.8;
const ISLA_REGRUESO_ML  = 0.9;

// ─────────────────────────────────────────────────────────────
// FALLBACKS OFICIALES
// Mantener sincronizados con db/migrations/002 (estándar) + 007 (barra/lavaplatos)
// ─────────────────────────────────────────────────────────────

const FALLBACK: Record<string, number> = {
  // estándar (también vive en migration 002 con category 'cocina_meson')
  MESON_GRANITO:             700_000,
  MESON_CUARZO:              850_000,
  MESON_SINTERIZADO:       1_200_000,
  // barra angosta (migration 007)
  MESON_GRANITO_BARRA:       490_000,
  MESON_CUARZO_BARRA:        600_000,
  MESON_SINTERIZADO_BARRA: 1_000_000,
  // lavaplatos (migration 007)
  MESON_LAVAPLATOS:          130_000,
};

function precio(catalog: PriceCatalog, code: string): number {
  const fromDB = catalog.get(code);
  if (fromDB !== undefined) return fromDB;

  const fallback = FALLBACK[code];
  if (fallback !== undefined) {
    console.warn(`[mesones.engine] ⚠️  Código '${code}' no encontrado en BD. Usando fallback: $${fallback.toLocaleString()}`);
    return fallback;
  }

  console.error(`[mesones.engine] ❌  Código '${code}' sin fallback. Devolviendo 0.`);
  return 0;
}

// ─────────────────────────────────────────────────────────────
// REGLAS DE NEGOCIO
// ─────────────────────────────────────────────────────────────

function isBarraAngosta(tipo: MesonTipo, fondo: number): boolean {
  return tipo === 'barra' && fondo >= 35 && fondo <= 45;
}

function getMultiplicador(tipo: MesonTipo, fondo: number): number {
  if (isBarraAngosta(tipo, fondo)) return 1.0;
  if (fondo <= 65) return 1.0;
  if (fondo <= 90) return 1.3;
  return 2.0; // 91-120cm
}

function getPrecioBase(catalog: PriceCatalog, material: MesonMaterial, tipo: MesonTipo, fondo: number): number {
  const angosta = isBarraAngosta(tipo, fondo);
  const suffix  = angosta ? '_BARRA' : '';
  const code    = `MESON_${material.toUpperCase()}${suffix}`;
  return precio(catalog, code);
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calcularMesones(
  config: MesonesConfig,
  catalog: PriceCatalog
): MesonesResult {

  // Snapshot de precios usados (auditoría)
  const granitoStd      = precio(catalog, 'MESON_GRANITO');
  const granitoBarra    = precio(catalog, 'MESON_GRANITO_BARRA');
  const cuarzoStd       = precio(catalog, 'MESON_CUARZO');
  const cuarzoBarra     = precio(catalog, 'MESON_CUARZO_BARRA');
  const sinterizadoStd  = precio(catalog, 'MESON_SINTERIZADO');
  const sinterizadoBarra= precio(catalog, 'MESON_SINTERIZADO_BARRA');
  const lavaplatosPrice = precio(catalog, 'MESON_LAVAPLATOS');

  const items: MesonItemCalc[] = (config.mesones ?? []).map((m, idx) => {
    const tipo          = m.tipo as MesonTipo;
    const material      = m.material as MesonMaterial;
    const ml            = m.metrosLineales ?? 0;
    const fondo         = m.fondo ?? 60;
    const precioBase    = getPrecioBase(catalog, material, tipo, fondo);
    const multiplicador = getMultiplicador(tipo, fondo);

    const subtotalMeson = ml * precioBase * multiplicador;

    let subtotalLavaplatos      = 0;
    let subtotalLaterales       = 0;
    let subtotalRegrueso        = 0;
    let subtotalSalpicaderoAlto = 0;

    if (tipo === 'meson') {
      // Lavaplatos plano (NO se multiplica) — Fuente: Casos 1-5 del 5-MESONES.docx
      subtotalLavaplatos = lavaplatosPrice;
      if (m.incluyeSalpicaderoAlto) {
        subtotalSalpicaderoAlto = ml * precioBase * multiplicador;
      }
    } else if (tipo === 'isla') {
      if (m.incluyeLaterales) {
        subtotalLaterales = ISLA_LATERALES_ML * precioBase * multiplicador;
      }
      if (m.incluyeRegrueso) {
        // El regrueso de isla siempre usa multiplicador 1.0 (siempre a 60cm)
        subtotalRegrueso = ISLA_REGRUESO_ML * precioBase;
      }
    } else if (tipo === 'barra') {
      const altura = m.alturaLateral ?? 0;
      if (altura > 0) {
        subtotalLaterales = (altura / 100) * precioBase * multiplicador;
      }
      if (m.incluyeSalpicaderoAlto) {
        subtotalSalpicaderoAlto = ml * precioBase * multiplicador;
      }
    }

    const subtotalItem =
      subtotalMeson + subtotalLavaplatos + subtotalLaterales + subtotalRegrueso + subtotalSalpicaderoAlto;

    return {
      id:                      m.id ?? `meson-${idx}`,
      precioBase,
      multiplicador,
      subtotalMeson:           Math.round(subtotalMeson),
      subtotalLavaplatos:      Math.round(subtotalLavaplatos),
      subtotalLaterales:       Math.round(subtotalLaterales),
      subtotalRegrueso:        Math.round(subtotalRegrueso),
      subtotalSalpicaderoAlto: Math.round(subtotalSalpicaderoAlto),
      subtotal:                Math.round(subtotalItem),
    };
  });

  const subtotalProductos = items.reduce((acc, it) => acc + it.subtotal, 0);
  const transport         = config.transport ?? 0;
  const subtotal          = Math.round(subtotalProductos + transport);

  console.log(`[mesones.engine] 🪨 ${items.length} mesones · prod $${subtotalProductos.toLocaleString()} + transp $${transport.toLocaleString()} → subtotal $${subtotal.toLocaleString()}`);

  return {
    subtotal,
    metrajeEfectivo: null,
    desglose: {
      items,
      subtotalProductos,
      transport,
    },
    preciosUsados: {
      granito_standard:     granitoStd,
      granito_barra:        granitoBarra,
      cuarzo_standard:      cuarzoStd,
      cuarzo_barra:         cuarzoBarra,
      sinterizado_standard: sinterizadoStd,
      sinterizado_barra:    sinterizadoBarra,
      lavaplatos:           lavaplatosPrice,
    },
  };
}
