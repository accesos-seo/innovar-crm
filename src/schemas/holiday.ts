import { z } from "zod";

/**
 * Schema for the `holidays` table.
 * Days off / festivos colombianos para cálculo de plazos.
 */
export const holidaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD"),
  name: z.string().min(1, "Nombre del festivo requerido").max(255),
  year: z.number().int().min(2020).max(2100),
});

export const holidayInsertSchema = holidaySchema;

export const holidayUpdateSchema = holidaySchema.partial().extend({
  id: z.string().uuid(),
});

export type HolidayInsert = z.infer<typeof holidayInsertSchema>;
export type HolidayUpdate = z.infer<typeof holidayUpdateSchema>;

export interface Holiday {
  id: string;
  date: string;
  name: string;
  year: number;
}
