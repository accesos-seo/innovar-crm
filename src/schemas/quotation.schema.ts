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

// =============================================================
// 2.2 ESQUEMA DE CENTRO DE TV
// Motor: server/services/tv-center.engine.ts
// Doc:   docs/legacy/Cotizacioners/2-CENTRO_DE_TV.docx
// =============================================================
// `width` sin min/max — el engine hace el clamp [1.20, 2.40].
// `manualDiscount` NO está aquí: vive solo en UI, se aplica
// en el hook adaptador post-cálculo.
export const TVCenterConfigSchema = z.object({
  width:            z.number(),
  hasHighGloss:     z.boolean().default(false),
  hasLedLights:     z.boolean().default(false),
  floatingShelves:  z.number().int().nonnegative().default(2),
  equipmentSpaces:  z.number().int().nonnegative().default(0),
  includeTransport: z.boolean().default(false),
});

// =============================================================
// 2.2.3 ESQUEMA DE MESONES (standalone)
// Motor:    server/services/mesones.engine.ts
// Doc:      docs/legacy/Cotizacioners/5-MESONES.docx
// Categoría: 'mesones'
// =============================================================
// `discountPercent` UI-only. `transport` raw number (compat UI).
export const MesonItemSchema = z.object({
  id:                       z.string().optional(),
  tipo:                     z.enum(['meson', 'isla', 'barra']),
  material:                 z.enum(['granito', 'cuarzo', 'sinterizado']),
  metrosLineales:           z.number().nonnegative(),
  fondo:                    z.number().nonnegative(),  // cm
  incluyeSalpicaderoAlto:   z.boolean().optional(),
  incluyeLaterales:         z.boolean().optional(),
  incluyeRegrueso:          z.boolean().optional(),
  alturaLateral:            z.union([z.literal(0), z.literal(90), z.literal(100), z.literal(110)]).optional(),
});

export const MesonesConfigSchema = z.object({
  mesones:   z.array(MesonItemSchema).default([]),
  transport: z.number().nonnegative().default(0),
});

// =============================================================
// 2.2.2 ESQUEMA DE PUERTAS INTERIORES
// Motor:    server/services/interior-doors.engine.ts
// Doc:      docs/legacy/Cotizacioners/6-PUERTAS.docx
// Categoría: 'puerta' (singular) — NO confundir con 'puertas'
//            (plural = repuestos de cocina, DoorsConfigSchema).
// =============================================================
// `discountPercent` UI-only. `hardwareColor` y `hasLintel` no
// afectan precio (UI-only). `transport` viene del toggle UI.
export const InteriorDoorItemSchema = z.object({
  id:            z.string().optional(),
  type:          z.enum(['batiente', 'corrediza']),
  width:         z.number().nonnegative(),          // cm
  height:        z.number().nonnegative(),          // m
  quantity:      z.number().int().nonnegative(),
  hardwareColor: z.enum(['aluminio', 'negro']).optional(),
  hasLintel:     z.boolean().optional(),
  location:      z.string().optional(),
  notes:         z.string().optional(),
});

export const InteriorDoorsConfigSchema = z.object({
  doors:     z.array(InteriorDoorItemSchema).default([]),
  transport: z.number().nonnegative().default(0),
});

// =============================================================
// 2.2.1 ESQUEMA DE CLOSETS A MEDIDA
// Motor: server/services/closets.engine.ts
// Doc:   docs/legacy/Cotizacioners/4-CLOSETS.docx
// =============================================================
// `transport` es un número editable por el usuario (compat UI):
// el motor lo añade tal cual al subtotal.
// `discountPercent` UI-only — no viaja al backend.
export const ClosetConfigSchema = z.object({
  type:      z.enum(['estandar', 'especial', 'empotrado']),
  width:     z.number().nonnegative(),
  height:    z.number().nonnegative(),
  doorType:  z.enum(['corrediza', 'batiente']).optional(),
  transport: z.number().nonnegative().default(0),
});

// =============================================================
// 2.3 ESQUEMA DE ACABADOS ESPECIALES
// Motor: server/services/special-finishes.engine.ts
// Doc:   docs/legacy/Cotizacioners/3-ACABADOS.docx
// =============================================================
// Categoría wire-level: 'especiales' (no 'acabados_especiales')
// — alineada con QuotationDesignStep.tsx y useQuotationBuilder.ts.
// `manualDiscount` UI-only, no viaja al backend.
export const SpecialFinishDoorSchema = z.object({
  id:     z.string().optional(),
  height: z.number().nonnegative(),
  width:  z.number().nonnegative(),
});

export const SpecialFinishesConfigSchema = z.object({
  description:      z.string().optional(),
  doors:            z.array(SpecialFinishDoorSchema).default([]),
  includeLed:       z.boolean().default(false),
  ledMl:            z.number().nonnegative().default(0),
  includeTransport: z.boolean().default(false),
});

// 3. ESQUEMA DEL REQUEST PARA CALCULAR ITEM (Lo que el Frontend le envía al Backend)
// Nota: 'puerta' (singular) = puertas interiores (módulo doors). 'puertas' (plural) = puertas/tapas repuestos de cocina.
export const CalculateItemRequestSchema = z.object({
  category: z.enum(['cocina', 'closet', 'puerta', 'puertas', 'tv_center', 'especiales', 'mesones', 'herrajes']),
  configuration: z.any() // Aquí vendrá KitchenConfigSchema, ClosetSchema, TVCenterConfigSchema, SpecialFinishesConfigSchema, etc.
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
