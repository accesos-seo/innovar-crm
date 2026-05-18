import { z } from 'zod';

export const quotationLineItemSchema = z.object({
  item_type: z.enum(['material', 'accesorio', 'mano_obra', 'otro']),
  description: z.string().min(1, 'Descripción requerida').max(500),
  quantity: z.number().positive('Cantidad debe ser positiva'),
  unit_price: z.number().positive('Precio debe ser positivo'),
  discount_percent: z.number().min(0).max(100).default(0),
  total_line: z.number().positive(),
  specifications: z.object({
    material: z.string().optional(),
    color: z.string().optional(),
    marca: z.string().optional(),
    codigo_proveedor: z.string().optional(),
  }).optional(),
});

export const quotationSchema = z.object({
  client_id: z.string().uuid('Cliente requerido'),
  /**
   * Human-readable identifier (e.g. "COT-2026-0042").
   * Generated server-side by `generate_next_quotation_number()` RPC to avoid
   * race conditions. The frontend should NOT generate this manually.
   */
  quotation_number: z.string().min(1).optional(),
  version_number: z.number().int().min(1).default(1),

  subtotal: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  discount_type: z.enum(['percent', 'fixed', 'none']).default('none'),
  discount_value: z.number().nonnegative().default(0),
  transport_cost: z.number().nonnegative().default(600000),

  valid_until: z.string().datetime().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_locked: z.boolean().default(false),

  status: z.enum([
    'draft', 'sent', 'viewed', 'negotiation',
    'approved', 'rejected', 'expired', 'replaced'
  ]).default('draft'),
});

export const quotationInsertSchema = quotationSchema.extend({
});

export const quotationUpdateSchema = quotationSchema.partial().extend({
  id: z.string().uuid(),
});

export const quotationApproveSchema = z.object({
  quotation_id: z.string().uuid(),
  project_name: z.string().min(1, 'Nombre del proyecto requerido'),
  designer_id: z.string().uuid().optional(),
  design_deadline: z.string().datetime().optional(),
  adjusted_total: z.number().positive().optional(),
});

export type QuotationLineItem = z.infer<typeof quotationLineItemSchema>;
export type QuotationInsert = z.infer<typeof quotationInsertSchema>;
export type QuotationUpdate = z.infer<typeof quotationUpdateSchema>;
export type QuotationApprove = z.infer<typeof quotationApproveSchema>;
