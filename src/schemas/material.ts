import { z } from "zod";

/**
 * Schema for the `materials` table.
 *
 * ⚠️ This table uses camelCase column names (`photoUrl`, `sortOrder`)
 * for historical reasons. The schema mirrors them as-is.
 */
export const materialCategorySchema = z.enum([
  "cocinas",
  "closets",
  "puertas",
  "herrajes",
  "accesorios",
  "otros",
]);

// Schema alineado contra el schema real de la tabla `materials` en producción
// (columnas: id, category, name, description, photoUrl, price, unit, active, sortOrder).
// Las columnas `brand` y `stock` NO existen en la BD real — fueron removidas del
// schema para evitar el mismo bug que `data_origin` en clients (PG 42703 al INSERT).
// Si el negocio necesita estos campos en el futuro, primero agregar las columnas
// vía migración SQL y después restaurarlos aquí.
export const materialSchema = z.object({
  category: materialCategorySchema,
  name: z.string().min(1, "Nombre requerido").max(255),
  description: z.string().max(2000).nullable().optional(),
  photoUrl: z.string().url("URL inválida").nullable().optional(),
  price: z.number().nonnegative("Precio no puede ser negativo").default(0),
  unit: z.string().min(1).default("unidad"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
}).passthrough();

export const materialInsertSchema = materialSchema;

export const materialUpdateSchema = materialSchema.partial().extend({
  id: z.string().uuid(),
});

export type MaterialCategory = z.infer<typeof materialCategorySchema>;
export type MaterialInsert = z.infer<typeof materialInsertSchema>;
export type MaterialUpdate = z.infer<typeof materialUpdateSchema>;
