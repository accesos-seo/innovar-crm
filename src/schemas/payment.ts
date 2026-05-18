import { z } from "zod";

/**
 * Schema for the `payments` table.
 */
export const paymentMethodSchema = z.enum([
  "efectivo",
  "transferencia",
  "credito",
  "cheque",
  "nequi",
  "daviplata",
  "pse",
]);

export const paymentTypeSchema = z.enum([
  "anticipo",
  "abono",
  "pago_final",
  "reembolso",
]);

export const paymentSchema = z.object({
  client_id: z.string().uuid("Cliente requerido"),
  project_id: z.string().uuid().nullable().optional(),
  amount: z
    .number()
    .positive("El monto debe ser mayor a cero")
    .max(99_999_999_999.99, "Monto fuera de rango"),
  payment_method: paymentMethodSchema,
  payment_type: paymentTypeSchema,
  received_at: z.string().datetime("Fecha de recepción inválida"),
  receipt_url: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const paymentInsertSchema = paymentSchema;

export const paymentUpdateSchema = paymentSchema.partial().extend({
  id: z.string().uuid(),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentType = z.infer<typeof paymentTypeSchema>;
export type PaymentInsert = z.infer<typeof paymentInsertSchema>;
export type PaymentUpdate = z.infer<typeof paymentUpdateSchema>;
