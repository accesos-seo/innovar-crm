import { z } from 'zod';

export const acceptQuotationSchema = z.object({
  note: z
    .string()
    .max(500, 'Máximo 500 caracteres.')
    .optional()
    .or(z.literal('')),
});

export type AcceptQuotationFormValues = z.infer<typeof acceptQuotationSchema>;

export const REJECTION_REASONS = [
  { value: 'price', label: 'El precio supera mi presupuesto' },
  { value: 'timing', label: 'No es el momento adecuado' },
  { value: 'design', label: 'No me convenció el diseño' },
  { value: 'other_provider', label: 'Decidí ir con otro proveedor' },
  { value: 'other', label: 'Otro motivo' },
] as const;

export const rejectQuotationSchema = z
  .object({
    reason_code: z.enum(['price', 'timing', 'design', 'other_provider', 'other']),
    reason_extra: z.string().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.reason_code === 'other' && !val.reason_extra?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Contanos brevemente el motivo.',
        path: ['reason_extra'],
      });
    }
  });

export type RejectQuotationFormValues = z.infer<typeof rejectQuotationSchema>;

export const requestAdjustmentsSchema = z.object({
  reason: z
    .string()
    .min(10, 'Contanos en al menos 10 caracteres qué te gustaría cambiar.')
    .max(1000, 'Máximo 1000 caracteres.'),
});

export type RequestAdjustmentsFormValues = z.infer<typeof requestAdjustmentsSchema>;

export const unlockQuotationSchema = z.object({
  change_reason: z
    .string()
    .min(10, 'Mínimo 10 caracteres explicando el motivo.')
    .max(500, 'Máximo 500 caracteres.'),
});

export type UnlockQuotationFormValues = z.infer<typeof unlockQuotationSchema>;
