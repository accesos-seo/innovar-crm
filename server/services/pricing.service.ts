/**
 * ============================================================
 * PRICING SERVICE — Orquestador de motores de cotización
 * ============================================================
 * Responsabilidad:
 *   1. Cargar precios de Supabase pricing_catalog
 *   2. Construir el PriceCatalog (Map<code, value>)
 *   3. Delegar al motor de cálculo de cada categoría
 *   4. Retornar el resultado al controller
 *
 * NO contiene lógica de cálculo. Cada categoría tiene su
 * propio engine en server/services/<categoría>.engine.ts
 * ============================================================
 */

import { supabase as defaultSupabase } from '../../src/lib/supabaseClient';
import {
  KitchenConfigSchema,
  DoorsConfigSchema,
  TVCenterConfigSchema,
  SpecialFinishesConfigSchema,
  ClosetConfigSchema,
  InteriorDoorsConfigSchema,
  MesonesConfigSchema,
} from '../../src/schemas/quotation.schema';
import { calcularCocina, PriceCatalog } from './kitchen.engine';
import { calcularTVCenter } from './tv-center.engine';
import { calcularSpecialFinishes } from './special-finishes.engine';
import { calcularCloset } from './closets.engine';
import { calcularInteriorDoors } from './interior-doors.engine';
import { calcularMesones } from './mesones.engine';

export class PricingService {

  /**
   * Carga los precios de pricing_catalog y construye el mapa.
   * Solo lee `code` y `value` — las columnas que sí existen en BD.
   */
  private static async loadCatalog(supabaseClient = defaultSupabase): Promise<PriceCatalog> {
    console.log('[PricingService] 📦 Cargando catálogo de precios...');

    const { data, error } = await supabaseClient
      .from('pricing_catalog')
      .select('code, value');

    if (error) {
      console.error('[PricingService] ❌ Error cargando catálogo:', error.message);
      throw new Error('No se pudo cargar el catálogo de precios de Supabase');
    }

    const rows = (data ?? []) as Array<{ code: string | null; value: number | null }>;
    const catalog: PriceCatalog = new Map(
      rows
        .filter(item => item.code !== null)
        .map(item => [item.code as string, Number(item.value)] as [string, number])
    );

    console.log(`[PricingService] ✅ ${catalog.size} precios cargados`);
    return catalog;
  }

  /**
   * Calcula el precio de una cocina integral.
   * Valida el input, carga el catálogo y delega a kitchen.engine.ts
   */
  static async calculateKitchen(
    configData: any,
    supabaseClient = defaultSupabase
  ): Promise<{ subtotal: number; metrajeEfectivo: number; desglose: any; preciosUsados: any }> {

    // 1. Validar y tipar el input con Zod
    const config = KitchenConfigSchema.parse(configData);

    // 2. Cargar catálogo desde Supabase
    const catalog = await PricingService.loadCatalog(supabaseClient);

    // 3. Delegar al motor de cocinas (toda la matemática vive ahí)
    const result = calcularCocina(config, catalog);

    return {
      subtotal:       result.subtotal,
      metrajeEfectivo: result.metrajeResultante,
      desglose:        result.desglose,
      preciosUsados:   result.preciosUsados,
    };
  }

  /**
   * Calcula el precio de un Centro de TV.
   * Valida el input, carga el catálogo y delega a tv-center.engine.ts
   */
  static async calculateTVCenter(
    configData: any,
    supabaseClient = defaultSupabase
  ): Promise<{ subtotal: number; metrajeEfectivo: number | null; desglose: any; preciosUsados: any }> {
    const config  = TVCenterConfigSchema.parse(configData);
    const catalog = await PricingService.loadCatalog(supabaseClient);
    const result  = calcularTVCenter(config, catalog);

    return {
      subtotal:        result.subtotal,
      metrajeEfectivo: result.metrajeEfectivo,
      desglose:        result.desglose,
      preciosUsados:   result.preciosUsados,
    };
  }

  /**
   * Calcula el precio de un módulo de Mesones (standalone).
   * Valida el input, carga el catálogo y delega a mesones.engine.ts
   */
  static async calculateMesones(
    configData: any,
    supabaseClient = defaultSupabase
  ): Promise<{ subtotal: number; metrajeEfectivo: number | null; desglose: any; preciosUsados: any }> {
    const config  = MesonesConfigSchema.parse(configData);
    const catalog = await PricingService.loadCatalog(supabaseClient);
    const result  = calcularMesones(config, catalog);

    return {
      subtotal:        result.subtotal,
      metrajeEfectivo: result.metrajeEfectivo,
      desglose:        result.desglose,
      preciosUsados:   result.preciosUsados,
    };
  }

  /**
   * Calcula el precio de Puertas Interiores (categoría 'puerta', singular).
   * NO confundir con calculateDoors (categoría 'puertas', plural = repuestos cocina).
   */
  static async calculateInteriorDoors(
    configData: any,
    supabaseClient = defaultSupabase
  ): Promise<{ subtotal: number; metrajeEfectivo: number | null; desglose: any; preciosUsados: any }> {
    const config  = InteriorDoorsConfigSchema.parse(configData);
    const catalog = await PricingService.loadCatalog(supabaseClient);
    const result  = calcularInteriorDoors(config, catalog);

    return {
      subtotal:        result.subtotal,
      metrajeEfectivo: result.metrajeEfectivo,
      desglose:        result.desglose,
      preciosUsados:   result.preciosUsados,
    };
  }

  /**
   * Calcula el precio de un Closet a medida.
   * Valida el input, carga el catálogo y delega a closets.engine.ts
   */
  static async calculateCloset(
    configData: any,
    supabaseClient = defaultSupabase
  ): Promise<{ subtotal: number; metrajeEfectivo: number | null; desglose: any; preciosUsados: any }> {
    const config  = ClosetConfigSchema.parse(configData);
    const catalog = await PricingService.loadCatalog(supabaseClient);
    const result  = calcularCloset(config, catalog);

    return {
      subtotal:        result.subtotal,
      metrajeEfectivo: result.metrajeEfectivo,
      desglose:        result.desglose,
      preciosUsados:   result.preciosUsados,
    };
  }

  /**
   * Calcula el precio de un módulo de Acabados Especiales.
   * Valida el input, carga el catálogo y delega a special-finishes.engine.ts
   */
  static async calculateSpecialFinishes(
    configData: any,
    supabaseClient = defaultSupabase
  ): Promise<{ subtotal: number; metrajeEfectivo: number | null; desglose: any; preciosUsados: any }> {
    const config  = SpecialFinishesConfigSchema.parse(configData);
    const catalog = await PricingService.loadCatalog(supabaseClient);
    const result  = calcularSpecialFinishes(config, catalog);

    return {
      subtotal:        result.subtotal,
      metrajeEfectivo: result.metrajeEfectivo,
      desglose:        result.desglose,
      preciosUsados:   result.preciosUsados,
    };
  }

  /**
   * Calcula el precio de Puertas y Tapas (Cambios/Repuestos)
   * Basado en catálogo de códigos oficiales (AUDITORÍA E y F)
   */
  static async calculateDoors(configData: any, supabaseClient = defaultSupabase): Promise<{ subtotal: number }> {
    const config = DoorsConfigSchema.parse(configData);
    let subtotal = 0;

    const { data: catalog, error } = await supabaseClient
      .from('pricing_catalog')
      .select('code, value')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Pricing Catalog Error:', error);
      throw new Error('Error al cargar catálogo de precios');
    }

    const catalogMap = new Map<string, number>(
      (catalog ?? []).map((item: { code: string; value: number | null }) => [item.code, Number(item.value)] as [string, number])
    );

    // Fallbacks de Auditoría (Precios oficiales si no están en BD)
    const doorFallbacks: Record<string, number> = {
      'PUERTA_SUP_70': 120000,
      'PUERTA_SUP_90': 150000,
      'PUERTA_SUP_100': 180000,
      'PUERTA_INF': 150000,
      'PUERTA_ALACENA': 180000,
      'TAPA_CAJON': 90000,
      'TAPA_PEQUENA': 45000,
      'PINTADO_SUP': 120000,
      'PINTADO_INF': 150000,
      'PINTADO_ALACENA': 250000,
      'PINTADO_CAJON': 80000,
      'PINTADO_ESPECIERO': 45000,
      'PINTADO_GOLA': 45000
    };

    console.log('🚪 Calculating Doors Price...', { configItemsCount: config.items.length });

    for (const item of config.items) {
      if (item.cantidad > 0) {
        let unitPrice = catalogMap.get(item.codigo);
        
        // Si no está en BD, usamos el fallback
        if (unitPrice === undefined) {
          unitPrice = doorFallbacks[item.codigo];
          if (unitPrice !== undefined) {
            console.log(`  ℹ️ Fallback: ${item.codigo} = ${unitPrice}`);
          }
        }

        if (unitPrice !== undefined) {
          const itemTotal = unitPrice * item.cantidad;
          subtotal += itemTotal;
          console.log(`  ➕ ${item.codigo}: ${unitPrice} * ${item.cantidad} = ${itemTotal}`);
        } else {
          console.warn(`  ⚠️ Code not found: ${item.codigo}`);
        }
      }
    }

    console.log('🏁 DOORS SUBTOTAL:', subtotal);
    return { subtotal };
  }
}
