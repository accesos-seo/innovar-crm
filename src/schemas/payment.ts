import { z } from "zod";

/**
 * Schema for the `payments` table.
 *
 * IMPORTANT: `payment_type` lives in INGLÉS in the DB CHECK constraint
 * (advance/installment/final/refund). UI labels in Spanish are exported
 * separately as PAYMENT_TYPE_LABELS_ES — never hardcode them in callers.
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
  "advance",
  "installment",
  "final",
  "refund",
]);

export const paymentSourceSchema = z.enum(["client_upload", "admin_manual"]);

export const verificationStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentType = z.infer<typeof paymentTypeSchema>;
export type PaymentSource = z.infer<typeof paymentSourceSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

// ─── UI labels (display only — validation always uses the schema) ────────────

export const PAYMENT_TYPE_LABELS_ES: Record<PaymentType, string> = {
  advance: "Anticipo",
  installment: "Abono",
  final: "Pago final",
  refund: "Reembolso",
};

export const PAYMENT_METHOD_LABELS_ES: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  credito: "Crédito",
  cheque: "Cheque",
  nequi: "Nequi",
  daviplata: "Daviplata",
  pse: "PSE",
};

// ─── Neon color classes for payment types (Tailwind) ───────────────────────────
export const PAYMENT_TYPE_NEON_COLORS: Record<PaymentType, { bg: string; text: string; border: string }> = {
  advance: { bg: "bg-cyan-950/30", text: "text-cyan-400", border: "border-cyan-500/50" },
  installment: { bg: "bg-pink-950/30", text: "text-pink-400", border: "border-pink-500/50" },
  final: { bg: "bg-emerald-950/30", text: "text-emerald-400", border: "border-emerald-500/50" },
  refund: { bg: "bg-amber-950/30", text: "text-amber-400", border: "border-amber-500/50" },
};

// ─── Neon color classes for payment methods (Tailwind) ─────────────────────────
export const PAYMENT_METHOD_NEON_COLORS: Record<PaymentMethod, { bg: string; text: string; border: string }> = {
  transferencia: { bg: "bg-cyan-950/30", text: "text-cyan-400", border: "border-cyan-500/50" },
  efectivo: { bg: "bg-amber-950/30", text: "text-amber-400", border: "border-amber-500/50" },
  credito: { bg: "bg-pink-950/30", text: "text-pink-400", border: "border-pink-500/50" },
  cheque: { bg: "bg-purple-950/30", text: "text-purple-400", border: "border-purple-500/50" },
  nequi: { bg: "bg-emerald-950/30", text: "text-emerald-400", border: "border-emerald-500/50" },
  daviplata: { bg: "bg-indigo-950/30", text: "text-indigo-400", border: "border-indigo-500/50" },
  pse: { bg: "bg-rose-950/30", text: "text-rose-400", border: "border-rose-500/50" },
};

export const VERIFICATION_STATUS_LABELS_ES: Record<VerificationStatus, string> = {
  pending: "Por verificar",
  verified: "Verificado",
  rejected: "Rechazado",
};

export const PAYMENT_SOURCE_LABELS_ES: Record<PaymentSource, string> = {
  client_upload: "Subido por cliente",
  admin_manual: "Registrado manualmente",
};

// ─── Entity schemas ──────────────────────────────────────────────────────────

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

export type PaymentInsert = z.infer<typeof paymentInsertSchema>;
export type PaymentUpdate = z.infer<typeof paymentUpdateSchema>;

// ─── Slice 3 RPC payload schemas ─────────────────────────────────────────────

// Subset of payment_method allowed when the client uploads a proof
// (in-person methods like efectivo/cheque/credito don't make sense here).
export const clientFacingPaymentMethodSchema = z.enum([
  "transferencia",
  "nequi",
  "daviplata",
  "pse",
]);

export const submitPaymentProofSchema = z.object({
  amount: z
    .number()
    .positive("El monto debe ser mayor a cero")
    .max(99_999_999_999.99, "Monto fuera de rango"),
  payment_method: clientFacingPaymentMethodSchema,
  notes: z.string().max(2000).nullable().optional(),
});

export type SubmitPaymentProofInput = z.infer<typeof submitPaymentProofSchema>;

export const verifyPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  designer_id: z.string().uuid().nullable(),
  payment_type: paymentTypeSchema.optional(),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const rejectPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.string().min(10, "Mínimo 10 caracteres").max(2000),
});

export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;

export const registerManualPaymentSchema = z.object({
  quotation_id: z.string().uuid(),
  amount: z
    .number()
    .positive("El monto debe ser mayor a cero")
    .max(99_999_999_999.99, "Monto fuera de rango"),
  payment_method: paymentMethodSchema,
  payment_type: paymentTypeSchema,
  designer_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type RegisterManualPaymentInput = z.infer<typeof registerManualPaymentSchema>;
