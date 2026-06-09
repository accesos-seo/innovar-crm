import { z } from "zod";

/**
 * Schema for the `pricing_catalog` table (Tarifario).
 *
 * ⚠️ This table uses camelCase column names (`previousValue`, `lastUpdated`)
 * for historical reasons. Schema mirrors them as-is.
 */
export const pricingCategorySchema = z.enum([
  "cocina",
  "closet",
  "puerta",
  "centro_tv",
  "meson",
  "herraje",
  "otro",
]);

export const pricingSchema = z.object({
  category: pricingCategorySchema,
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1, "Nombre requerido").max(255),
  description: z.string().max(2000).nullable().optional(),
  value: z.number().nonnegative("Valor no puede ser negativo").default(0),
  unit: z.string().min(1).default("ml"),
  previousValue: z.number().nonnegative().nullable().optional(),
  lastUpdated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD")
    .optional(),
});

export const pricingInsertSchema = pricingSchema;

export const pricingUpdateSchema = pricingSchema.partial().extend({
  id: z.string().uuid(),
});

export type PricingCategory = z.infer<typeof pricingCategorySchema>;
export type PricingInsert = z.infer<typeof pricingInsertSchema>;
export type PricingUpdate = z.infer<typeof pricingUpdateSchema>;

export interface PricingItem {
  id: string;
  category: PricingCategory;
  code: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  previousValue?: number;
  lastUpdated: string;
}
