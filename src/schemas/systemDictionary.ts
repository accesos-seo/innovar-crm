import { z } from "zod";

/**
 * Schema for the `system_dictionary` table.
 * Documents internal Supabase components: buckets, edge functions, triggers, crons.
 */
export const dictionaryCategorySchema = z.enum([
  "BUCKET",
  "EDGE_FUNCTION",
  "DB_TRIGGER",
  "CRON_JOB",
  "WEBHOOK",
  "RPC",
]);

export const dictionaryStatusSchema = z.enum(["active", "inactive", "deprecated"]);

export const systemDictionarySchema = z.object({
  category: dictionaryCategorySchema,
  name: z.string().min(1, "Nombre requerido").max(255),
  description: z.string().max(5000).nullable().optional(),
  trigger_event: z.string().max(255).nullable().optional(),
  status: dictionaryStatusSchema.default("active"),
});

export const systemDictionaryInsertSchema = systemDictionarySchema;

export const systemDictionaryUpdateSchema = systemDictionarySchema.partial().extend({
  id: z.string().uuid(),
});

export type DictionaryCategory = z.infer<typeof dictionaryCategorySchema>;
export type DictionaryStatus = z.infer<typeof dictionaryStatusSchema>;
export type SystemDictionaryInsert = z.infer<typeof systemDictionaryInsertSchema>;
export type SystemDictionaryUpdate = z.infer<typeof systemDictionaryUpdateSchema>;
