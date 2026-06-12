import { z } from "zod";

/**
 * Schema for the `expenses` table.
 */
export const expenseCategorySchema = z.enum([
  "materiales",
  "operativo",
  "nomina",
  "dietas",
  "transporte",
  "herramientas",
  "servicios_publicos",
  "arriendo",
  "subcontrato",
  "otro",
]);

export const expenseApprovalStatusSchema = z.enum([
  "pendiente",
  "aprobado",
  "rechazado",
]);

export const expenseSchema = z.object({
  category: expenseCategorySchema,
  amount: z
    .number()
    .positive("El monto debe ser mayor a cero")
    .max(99_999_999_999.99, "Monto fuera de rango"),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD"),
  description: z.string().min(1, "Descripción requerida").max(2000),
  receipt_url: z.string().url().nullable().optional(),
  approval_status: expenseApprovalStatusSchema.default("pendiente"),
  project_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const expenseInsertSchema = expenseSchema;

export const expenseUpdateSchema = expenseSchema.partial().extend({
  id: z.string().uuid(),
});

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type ExpenseApprovalStatus = z.infer<typeof expenseApprovalStatusSchema>;
export type ExpenseInsert = z.infer<typeof expenseInsertSchema>;
export type ExpenseUpdate = z.infer<typeof expenseUpdateSchema>;
