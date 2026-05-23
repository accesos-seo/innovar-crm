import { z } from "zod";

// Valores válidos del CHECK constraint en `public.opportunities` (migración 008).
// Mantener sincronizado con db/migrations/008_lead_to_project_schema.sql §4.
export const OPPORTUNITY_STATUSES = [
  "new",
  "contacted",
  "visit_scheduled",
  "visit_completed",
  "quoted",
  "sent_to_client",
  "client_approved",
  "pending_payment_verification",
  "approved",
  "converted_to_project",
  "lost",
  "cancelled_after_approval",
] as const;

export const OPPORTUNITY_PRIORITIES = ["ASAP", "SHORT", "LON"] as const;

export const OPPORTUNITY_DATA_ORIGINS = [
  "wordpress",
  "referido",
  "walk-in",
  "whatsapp",
  "manual",
] as const;

export const opportunityStatusEnum = z.enum(OPPORTUNITY_STATUSES);
export const opportunityPriorityEnum = z.enum(OPPORTUNITY_PRIORITIES);
export const opportunityDataOriginEnum = z.enum(OPPORTUNITY_DATA_ORIGINS);

export type OpportunityStatus = z.infer<typeof opportunityStatusEnum>;
export type OpportunityPriority = z.infer<typeof opportunityPriorityEnum>;
export type OpportunityDataOrigin = z.infer<typeof opportunityDataOriginEnum>;

export const opportunityInsertSchema = z.object({
  client_id: z.string().uuid(),
  status: opportunityStatusEnum.default("new"),
  services: z.array(z.string().min(1)).min(1, "Selecciona al menos un servicio"),
  priority: opportunityPriorityEnum.default("SHORT"),
  data_origin: opportunityDataOriginEnum,
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
});

export type OpportunityInsert = z.infer<typeof opportunityInsertSchema>;

export const opportunityUpdateSchema = opportunityInsertSchema.partial().extend({
  is_dormant: z.boolean().optional(),
  lost_reason: z.string().nullable().optional(),
  lost_at: z.string().nullable().optional(),
});

export type OpportunityUpdate = z.infer<typeof opportunityUpdateSchema>;

// UI helpers — display config para badges/labels.
export const opportunityStatusConfig: Record<
  OpportunityStatus,
  { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "primary" }
> = {
  new: { label: "Nuevo", variant: "warning" },
  contacted: { label: "En contacto", variant: "info" },
  visit_scheduled: { label: "Visita agendada", variant: "primary" },
  visit_completed: { label: "Visita realizada", variant: "info" },
  quoted: { label: "Cotizado", variant: "info" },
  sent_to_client: { label: "Enviado", variant: "primary" },
  client_approved: { label: "Aprobado cliente", variant: "success" },
  pending_payment_verification: { label: "Pago en revisión", variant: "warning" },
  approved: { label: "Aprobado", variant: "success" },
  converted_to_project: { label: "Convertido", variant: "purple" },
  lost: { label: "Perdido", variant: "error" },
  cancelled_after_approval: { label: "Cancelado", variant: "error" },
};

export const opportunityPriorityConfig: Record<
  OpportunityPriority,
  { label: string; variant: "success" | "warning" | "error" | "info"; dot: string }
> = {
  ASAP: { label: "Alta", variant: "error", dot: "bg-red-500" },
  SHORT: { label: "Media", variant: "warning", dot: "bg-amber-500" },
  LON: { label: "Baja", variant: "info", dot: "bg-blue-500" },
};

export const opportunityDataOriginLabels: Record<OpportunityDataOrigin, string> = {
  wordpress: "Sitio web",
  referido: "Referido",
  "walk-in": "Visita en showroom",
  whatsapp: "WhatsApp",
  manual: "Carga manual",
};
