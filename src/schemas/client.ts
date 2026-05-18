import { z } from "zod";

/**
 * Schema for the `clients` table.
 * Note: this table also serves as the "leads" entity — a lead is a client
 * with no projects associated.
 */
export const clientSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(255),
  email: z.string().email("Email inválido").nullable().optional(),
  whatsapp_phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Teléfono inválido")
    .nullable()
    .optional(),
  address: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  data_origin: z.enum(["manual", "system", "whatsapp", "import"]).default("manual"),
});

export const clientInsertSchema = clientSchema;

export const clientUpdateSchema = clientSchema.partial().extend({
  id: z.string().uuid(),
});

export type ClientInsert = z.infer<typeof clientInsertSchema>;
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;
