import { z } from "zod";

/**
 * Schema for the `tasks` table.
 *
 * The same table holds two types of items:
 *  - Tareas Kanban: `appointment_type IS NULL`
 *  - Citas de agenda: `appointment_type IS NOT NULL` (with `time_slot`)
 */
export const taskStatusSchema = z.enum([
  "pendiente",
  "en_progreso",
  "en_revision",
  "bloqueado",
  "completado",
  "cancelado",
]);

export const taskCategorySchema = z.enum([
  "cita",
  "operativa",
  "diseno",
  "produccion",
  "administrativa",
  "seguimiento",
]);

export const appointmentTypeSchema = z.enum([
  "visita_tecnica",
  "cita_diseno",
  "instalacion",
  "entrega",
  "garantia",
]);

export const taskSchema = z.object({
  title: z.string().min(1, "Título requerido").max(255),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.default("pendiente"),
  priority: z.number().int().min(0).max(2).default(0),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  time_slot: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora en formato HH:MM")
    .nullable()
    .optional(),
  appointment_type: appointmentTypeSchema.nullable().optional(),
  task_category: taskCategorySchema.nullable().optional(),
  kanban_order: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
  estimated_hours: z.number().nonnegative().nullable().optional(),
  actual_hours: z.number().nonnegative().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const taskInsertSchema = taskSchema;

export const taskUpdateSchema = taskSchema.partial().extend({
  id: z.string().uuid(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskCategory = z.infer<typeof taskCategorySchema>;
export type AppointmentType = z.infer<typeof appointmentTypeSchema>;
export type TaskInsert = z.infer<typeof taskInsertSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
