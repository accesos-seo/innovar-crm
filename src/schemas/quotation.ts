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

// Quotation lifecycle statuses — superset of the DB enum at any point in time.
// Slice 3 adds `client_approved`, `pending_payment_verification`, `cancelled`,
// `superseded` (the first two existed in prod since S2 but were missing here).
export const quotationStatusSchema = z.enum([
  'draft',
  'sent',
  'viewed',
  'negotiation',
  'approved',
  'rejected',
  'expired',
  'replaced',
  'client_approved',
  'pending_payment_verification',
  'cancelled',
  'superseded',
]);

export type QuotationStatus = z.infer<typeof quotationStatusSchema>;

export const QUOTATION_STATUS_LABELS_ES: Record<QuotationStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  viewed: 'Vista',
  negotiation: 'En negociación',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  replaced: 'Reemplazada',
  client_approved: 'Aceptada por cliente',
  pending_payment_verification: 'Pago en verificación',
  cancelled: 'Cancelada',
  superseded: 'Reemplazada por V2',
};

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

  status: quotationStatusSchema.default('draft'),
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

// ─── Slice 3 RPC payload schemas ─────────────────────────────────────────────

export const cancelQuotationAcceptanceSchema = z.object({
  quotation_id: z.string().uuid(),
  reason: z.string().min(10, 'Mínimo 10 caracteres').max(2000),
});

export type CancelQuotationAcceptanceInput = z.infer<typeof cancelQuotationAcceptanceSchema>;

export const createQuotationRevisionSchema = z.object({
  quotation_id: z.string().uuid(),
});

export type CreateQuotationRevisionInput = z.infer<typeof createQuotationRevisionSchema>;

export const reactivateExpiredQuotationSchema = z.object({
  quotation_id: z.string().uuid(),
});

export type ReactivateExpiredQuotationInput = z.infer<typeof reactivateExpiredQuotationSchema>;

export type QuotationLineItem = z.infer<typeof quotationLineItemSchema>;
export type QuotationInsert = z.infer<typeof quotationInsertSchema>;
export type QuotationUpdate = z.infer<typeof quotationUpdateSchema>;
export type QuotationApprove = z.infer<typeof quotationApproveSchema>;
