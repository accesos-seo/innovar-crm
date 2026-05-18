import { z } from 'zod';

// 1. ENUMS (Extraídos directamente de tu base de datos)
export const UserRoleSchema = z.enum(['admin', 'comercial', 'diseno', 'produccion']);
export const QuotationStatusSchema = z.enum([
  'draft', 'sent', 'viewed', 'negotiation',
  'approved', 'rejected', 'expired', 'replaced'
]);

// =============================================================
// 2. ESQUEMA DE CONFIGURACIÓN DE COCINA
// Motor: server/services/kitchen.engine.ts
// Doc:   cotizadores/MOTOR_COCINAS.md
// =============================================================

/** Tipo de cocina — determina qué se construye y el precio/ml base */
export const TipoCocinaSchema = z.enum([
  'COMPLETA_STANDARD',  // Inf + Sup a $900.000/ml c/u
  'COMPLETA_PREMIUM',   // Inf + Sup a $1.100.000/ml c/u
  'COMPLETA_DELUXE',    // Inf + Sup a $1.350.000/ml c/u
  'SOLO_SUPERIOR',      // Solo gabinetes superiores a $900.000/ml
  'SOLO_INFERIOR',      // Solo gabinetes inferiores a $900.000/ml
  'FRENTE_POLLO',       // Solo frente (puertas + cajoneros) a $750.000/ml
]);

/** Forma/layout — solo informativa para PDF y UI, no afecta precio */
export const FormaKitchenSchema = z.enum(['L', 'U', 'LINEAL', 'PARALELA', 'ISLA']);

/** Módulos especiales: precio fijo + descuentan metraje */
export const ModuloEspecialSchema = z.object({
  codigo: z.enum([
    'NICHO_NEVECON',      // −1.00ml | $1.200.000
    'NICHO_NEVERA',       // −0.75ml | $1.100.000
    'ALACENA_ENTREPAÑOS', // −0.50ml | $1.250.000
    'ALACENA_HERRAJE',    // −0.50ml | $  900.000
    'TORRE_HORNOS',       // −0.70ml | $1.350.000
  ]),
  cantidad: z.number().int().positive().default(1),
});

/** Material y profundidad del mesón — el recargo de profundidad lo aplica el engine */
export const MesonSchema = z.object({
  tipo: z.enum(['SINTERIZADO', 'CUARZO', 'GRANITO', 'NINGUNO']),
  profundidadCm: z.number().nonnegative().default(60),
  // ≤60cm → ×1.00 | 61-90cm → ×1.30 | 91-120cm → ×2.00
});

/** Isla independiente con laterales, regrueso y barra */
export const IslaSchema = z.object({
  material: z.enum(['SINTERIZADO', 'CUARZO', 'GRANITO']),
  largoMl: z.number().positive(),
  profundidadCm: z.number().nonnegative().default(60),
  regrueso: z.enum(['NINGUNO', 'UN_LADO', 'AMBOS_LADOS']).default('NINGUNO'),
  barra: z.object({
    profundidadCm: z.number().nonnegative(),
    // 35-45cm → 80% precio/ml | 50-60cm → 100% precio/ml
    incluyeHerraje: z.boolean().default(false), // +$350.000
  }).optional(),
});

/** Acabados opcionales sobre la cocina */
export const AcabadosKitchenSchema = z.object({
  ledMetros: z.number().nonnegative().default(0),
  puertasVidrio: z.array(z.object({
    altoCm:  z.number().positive(), // Bisagras automáticas: >80cm +1 par, >140cm +2 pares
    anchoCm: z.number().positive(),
  })).default([]),
  pintadoAltosBrillo: z.object({
    puertasSuperiores: z.number().int().nonnegative().default(0),
    puertasInferiores: z.number().int().nonnegative().default(0),
    puertasAlacena:    z.number().int().nonnegative().default(0),
    tapasCajon:        z.number().int().nonnegative().default(0),
    tapasEspeciero:    z.number().int().nonnegative().default(0),
    tapasGola:         z.number().int().nonnegative().default(0),
  }).optional(),
});

export const KitchenConfigSchema = z.object({
  tipoCocina:       TipoCocinaSchema,
  forma:            FormaKitchenSchema,
  metrajeTotal:     z.number()
                     .min(0.5, 'Metraje mínimo: 0.5 ml')
                     .max(10,  'Metraje máximo: 10 ml'),
  modulosEspeciales: z.array(ModuloEspecialSchema).default([]),
  meson:            MesonSchema,
  isla:             IslaSchema.optional(),
  acabados:         AcabadosKitchenSchema.optional(),
  costoTransporte:  z.boolean().default(false),
});

// 2.1 ESQUEMA DE PUERTAS Y TAPAS
export const DoorsConfigSchema = z.object({
  items: z.array(z.object({
    codigo: z.string(), // Ej: 'PUERTA_SUP_70'
    cantidad: z.number().int().nonnegative(),
    label: z.string().optional() // Para UI
  }))
});

// 3. ESQUEMA DEL REQUEST PARA CALCULAR ITEM (Lo que el Frontend le envía al Backend)
export const CalculateItemRequestSchema = z.object({
  category: z.enum(['cocina', 'closet', 'puertas', 'tv_center']),
  configuration: z.any() // Aquí vendrá KitchenConfigSchema, ClosetSchema, etc.
});

// ESQUEMA PARA GUARDAR LA COTIZACIÓN COMPLETA EN LA BD
export const SaveQuotationSchema = z.object({
  client_id: z.string().uuid({ message: "ID de cliente inválido" }),
  subtotal: z.number().nonnegative(),
  discount_type: z.enum(['percent', 'fixed', 'none']).default('none'),
  discount_value: z.number().nonnegative().default(0),
  transport_cost: z.number().nonnegative().default(600000),
  total_amount: z.number().nonnegative(),
  
  // Los items que componen la cotización
  items: z.array(z.object({
    product_category: z.string(),
    configuration: z.any(), // El JSONB con las medidas exactas
    calculated_total: z.number().nonnegative()
  })).min(1, { message: "Debe agregar al menos un espacio/item a la cotización" })
});
