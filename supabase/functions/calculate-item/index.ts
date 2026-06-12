/**
 * ============================================================
 * EDGE FUNCTION — calculate-item (motor de precios del cotizador)
 * ============================================================
 * Puerto del endpoint Express POST /api/quotations/calculate-item
 * (server/controllers/quotation.controller.ts) para que el
 * cotizador funcione en producción (Vercel solo sirve estáticos).
 *
 * Los engines (*.engine.ts) y quotation.schema.ts de esta carpeta
 * son copias AUTO-GENERADAS desde server/services/ por
 * scripts/sync-pricing-engines.mjs — editá los originales y re-sync.
 *
 * Contrato de respuesta (idéntico al server Express):
 *   { success: true, data: { calculated_total, metrajeResultante,
 *     desglose, precios_usados } }
 * ============================================================
 */
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import {
  KitchenConfigSchema,
  DoorsConfigSchema,
  TVCenterConfigSchema,
  SpecialFinishesConfigSchema,
  ClosetConfigSchema,
  InteriorDoorsConfigSchema,
  MesonesConfigSchema,
  CalculateItemRequestSchema,
} from './quotation.schema.ts';
import { calcularCocina, PriceCatalog } from './kitchen.engine.ts';
import { calcularTVCenter } from './tv-center.engine.ts';
import { calcularSpecialFinishes } from './special-finishes.engine.ts';
import { calcularCloset } from './closets.engine.ts';
import { calcularInteriorDoors } from './interior-doors.engine.ts';
import { calcularMesones } from './mesones.engine.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/**
 * Carga pricing_catalog (code, value). Si falla, retorna Map vacío:
 * cada engine tiene FALLBACK de precios hardcoded, así la cotización
 * sigue funcionando con precios de respaldo (mismo comportamiento
 * que PricingService.loadCatalog del server Express).
 */
async function loadCatalog(supabase: SupabaseClient): Promise<PriceCatalog> {
  try {
    const { data, error } = await supabase
      .from('pricing_catalog')
      .select('code, value');

    if (error) {
      console.error('[calculate-item] ⚠️ Error cargando catálogo, engines usarán FALLBACK:', error.message);
      return new Map();
    }

    const rows = (data ?? []) as Array<{ code: string | null; value: number | null }>;
    return new Map(
      rows
        .filter((r) => r.code !== null)
        .map((r) => [r.code as string, Number(r.value)] as [string, number]),
    );
  } catch (err) {
    console.error('[calculate-item] ⚠️ Excepción cargando catálogo, engines usarán FALLBACK:', err);
    return new Map();
  }
}

/**
 * Puertas y Tapas (cambios/repuestos, categoría 'puertas' plural).
 * Puerto de PricingService.calculateDoors — único cálculo que vivía
 * en pricing.service.ts en vez de un engine.
 */
async function calculateDoors(configData: unknown, supabase: SupabaseClient): Promise<{ subtotal: number }> {
  const config = DoorsConfigSchema.parse(configData);
  let subtotal = 0;

  let catalogMap = new Map<string, number>();
  try {
    const { data, error } = await supabase
      .from('pricing_catalog')
      .select('code, value')
      .eq('is_active', true);
    if (error) {
      console.error('[calculate-item] ⚠️ Catálogo puertas no disponible, usando fallbacks:', error.message);
    } else {
      catalogMap = new Map(
        (data ?? []).map((item: { code: string; value: number | null }) => [item.code, Number(item.value)] as [string, number]),
      );
    }
  } catch (err) {
    console.error('[calculate-item] ⚠️ Excepción catálogo puertas, usando fallbacks:', err);
  }

  // Fallbacks de Auditoría (precios oficiales si no están en BD)
  const doorFallbacks: Record<string, number> = {
    PUERTA_SUP_70: 120000,
    PUERTA_SUP_90: 150000,
    PUERTA_SUP_100: 180000,
    PUERTA_INF: 150000,
    PUERTA_ALACENA: 180000,
    TAPA_CAJON: 90000,
    TAPA_PEQUENA: 45000,
    PINTADO_SUP: 120000,
    PINTADO_INF: 150000,
    PINTADO_ALACENA: 250000,
    PINTADO_CAJON: 80000,
    PINTADO_ESPECIERO: 45000,
    PINTADO_GOLA: 45000,
  };

  for (const item of config.items) {
    if (item.cantidad > 0) {
      const unitPrice = catalogMap.get(item.codigo) ?? doorFallbacks[item.codigo];
      if (unitPrice !== undefined) {
        subtotal += unitPrice * item.cantidad;
      } else {
        console.warn(`[calculate-item] ⚠️ Código no encontrado: ${item.codigo}`);
      }
    }
  }

  return { subtotal };
}

type EngineResult = {
  subtotal: number;
  metrajeEfectivo: number | null;
  desglose: unknown;
  preciosUsados: unknown;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Método no permitido' });
  }

  try {
    const body = await req.json();
    const { category, configuration } = CalculateItemRequestSchema.parse(body);

    // Cliente anon con el JWT del usuario (si viene) para RLS en pricing_catalog
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    let result: EngineResult;

    switch (category) {
      case 'cocina': {
        const config = KitchenConfigSchema.parse(configuration);
        const r = calcularCocina(config, await loadCatalog(supabase));
        result = {
          subtotal: r.subtotal,
          metrajeEfectivo: r.metrajeResultante,
          desglose: r.desglose,
          preciosUsados: r.preciosUsados,
        };
        break;
      }
      case 'puertas': {
        const r = await calculateDoors(configuration, supabase);
        result = { subtotal: r.subtotal, metrajeEfectivo: null, desglose: null, preciosUsados: null };
        break;
      }
      case 'tv_center': {
        const config = TVCenterConfigSchema.parse(configuration);
        const r = calcularTVCenter(config, await loadCatalog(supabase));
        result = { subtotal: r.subtotal, metrajeEfectivo: r.metrajeEfectivo, desglose: r.desglose, preciosUsados: r.preciosUsados };
        break;
      }
      case 'especiales': {
        const config = SpecialFinishesConfigSchema.parse(configuration);
        const r = calcularSpecialFinishes(config, await loadCatalog(supabase));
        result = { subtotal: r.subtotal, metrajeEfectivo: r.metrajeEfectivo, desglose: r.desglose, preciosUsados: r.preciosUsados };
        break;
      }
      case 'closet': {
        const config = ClosetConfigSchema.parse(configuration);
        const r = calcularCloset(config, await loadCatalog(supabase));
        result = { subtotal: r.subtotal, metrajeEfectivo: r.metrajeEfectivo, desglose: r.desglose, preciosUsados: r.preciosUsados };
        break;
      }
      case 'puerta': {
        // Puertas interiores (batiente/corrediza). Singular intencional.
        const config = InteriorDoorsConfigSchema.parse(configuration);
        const r = calcularInteriorDoors(config, await loadCatalog(supabase));
        result = { subtotal: r.subtotal, metrajeEfectivo: r.metrajeEfectivo, desglose: r.desglose, preciosUsados: r.preciosUsados };
        break;
      }
      case 'mesones': {
        const config = MesonesConfigSchema.parse(configuration);
        const r = calcularMesones(config, await loadCatalog(supabase));
        result = { subtotal: r.subtotal, metrajeEfectivo: r.metrajeEfectivo, desglose: r.desglose, preciosUsados: r.preciosUsados };
        break;
      }
      case 'herrajes': {
        // Items operativos sin motor de precios — el comercial los maneja a mano.
        result = { subtotal: 0, metrajeEfectivo: null, desglose: null, preciosUsados: null };
        break;
      }
      default:
        return json(400, { success: false, error: `Categoría '${category}' no soportada aún` });
    }

    return json(200, {
      success: true,
      data: {
        calculated_total: result.subtotal,
        metrajeResultante: result.metrajeEfectivo,
        desglose: result.desglose ?? null,
        precios_usados: result.preciosUsados ?? null,
      },
    });
  } catch (error) {
    console.error('[calculate-item] Error en motor de precios:', error);
    const message = error instanceof Error ? error.message : String(error);
    return json(400, { success: false, error: message });
  }
});
