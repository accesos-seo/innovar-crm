import { z } from "zod";

/**
 * Schema for the `clients` table.
 * Note: this table also serves as the "leads" entity — a lead is a client
 * with no projects associated.
 *
 * Fields present in DB but accepted via passthrough (no validation here):
 *   city, services, status, urgency, assigned_to, assigned_at,
 *   converted_to_id, lead_score, lead_score_details, lead_scored_at
 * These are populated by the lead/conversion flows and should not be
 * validated by this insert schema.
 *
 * NOTE: `data_origin` was previously declared here with a default of "manual",
 * but that column does NOT exist in the production `clients` table. Including
 * it caused every insert from the "Nuevo lead" form to fail with PG 42703
 * (column "data_origin" does not exist). It is intentionally omitted.
 */
export const clientSchema = z
  .object({
    name: z.string().min(1, "Nombre requerido").max(255),
    email: z.string().email("Email inválido").nullable().optional(),
    whatsapp_phone: z
      .string()
      .regex(/^\+?[0-9\s\-()]{7,20}$/, "Teléfono inválido")
      .nullable()
      .optional(),
    address: z.string().max(500).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .passthrough();

export const clientInsertSchema = clientSchema;

export const clientUpdateSchema = clientSchema.partial().extend({
  id: z.string().uuid(),
});

export type ClientInsert = z.infer<typeof clientInsertSchema>;
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;
