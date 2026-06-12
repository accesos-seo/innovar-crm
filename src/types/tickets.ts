export type TicketPriority = "baja" | "media" | "alta" | "urgente";
export type TicketCategory =
  | "soporte-tecnico"
  | "consulta-general"
  | "reportar-problema"
  | "solicitud-mejora"
  | "otro";
export type TicketStatus = "Abierto" | "En Progreso" | "Cerrado";

export type TicketType = "ticket" | "solicitud";

export interface SupportTicket {
  id: number;
  ticket_id: string;
  subject: string;
  description: string | null;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  ticket_type: TicketType;
  created_by: string;
  assigned_to: string | null;
  file_urls: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  first_response_at: string | null;
  creator?: { full_name: string; avatar_url: string | null; role: string } | null;
  assignee?: { full_name: string; avatar_url: string | null } | null;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_id: string;
  content: string;
  is_internal: boolean;
  file_urls: string[];
  created_at: string;
  sender?: { full_name: string; avatar_url: string | null; role: string } | null;
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  "soporte-tecnico": "Soporte Técnico",
  "consulta-general": "Consulta General",
  "reportar-problema": "Reporte de Problema",
  "solicitud-mejora": "Solicitud de Mejora",
  otro: "Otro",
};
