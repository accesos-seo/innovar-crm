export type UserRole = 'admin' | 'super_admin' | 'comercial' | 'disenador' | 'jefe_taller' | 'operario';

export interface User {
  id: string;
  openId?: string;
  name: string;
  email: string;
  loginMethod?: string;
  role: UserRole;
  phone?: string;
  birthDate?: string;
  isTeamMember: boolean;
  createdAt: string;
  updatedAt: string;
  lastSignedIn?: string;
}

export interface Client {
  id: string;
  name: string;
  whatsapp_phone?: string;
  email?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type WorkType = 'cocina' | 'closet' | 'puertas' | 'centro_tv' | string;
export type ProjectStatus = 
  | 'contacto' 
  | 'medicion_tomada' 
  | 'cotizacion_enviada' 
  | 'cotizacion_aprobada' 
  | 'en_diseno' 
  | 'modelado_listo' 
  | 'renders_listos' 
  | 'aprobacion_cliente' 
  | 'en_produccion' 
  | 'instalacion_programada' 
  | 'instalando' 
  | 'entregado' 
  | 'garantia';

export interface Project {
  id: string;
  tracking_token: string;
  client_id: string;
  approved_quotation_id?: string | null;
  designer_id?: string | null;
  created_by?: string | null;
  accounting_closure_id?: string | null;
  name: string;
  work_type: WorkType;
  status: ProjectStatus;
  notes?: string | null;
  total_amount?: number | null;
  advance_amount?: number | null;
  client_approved_at?: string | null;
  client_approval_notes?: string | null;
  design_deadline?: string | null;
  design_delivered_at?: string | null;
  initial_measurements?: any;
  design_3d_files?: any[];
  despiece_files?: any[];
  modelado_approved_at?: string | null;
  renders_approved_at?: string | null;
  modelado_revision_number: number;
  render_revision_number: number;
  estimated_install_date?: string | null;
  scheduled_install_date?: string | null;
  install_duration_days?: number | null;
  delivered_at?: string | null;
  quotation_pdf_url?: string | null;
  is_archived: boolean;
  skip_design_process: boolean;
  data_origin: 'manual' | 'system';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type QuotationStatus = 'draft' | 'sent' | 'viewed' | 'negotiation' | 'approved' | 'rejected' | 'expired' | 'replaced';

export interface QuotationLineItem {
  item_type: 'material' | 'accesorio' | 'mano_obra' | 'otro';
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total_line: number;
  specifications?: {
    material?: string;
    color?: string;
    marca?: string;
    codigo_proveedor?: string;
  };
}

export interface Quotation {
  id: string;
  client_id: string;
  total_amount: number;
  status: QuotationStatus;
  is_locked: boolean;
  notes?: string | null;
  subtotal?: number;
  discount_type?: 'percent' | 'fixed' | 'none';
  discount_value?: number;
  transport_cost?: number;
  version_number?: number;
  parent_quotation_id?: string | null;
  is_historical_copy?: boolean;
  valid_until?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  calculated_total?: number;
  product_category?: string;
  base_catalog_id?: string | null;
  configuration?: any;
  created_at: string;
  updated_at: string;
}

export interface HardwareItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  price: number;
  stock: number;
}

export interface Payment {
  id: string;
  project_id?: string | null;
  client_id: string;
  amount: number;
  payment_method: 'efectivo' | 'transferencia' | 'credito' | 'cheque' | 'nequi' | 'daviplata' | 'pse' | string;
  payment_type: 'anticipo' | 'abono' | 'pago_final' | 'reembolso' | string;
  received_at: string;
  receipt_url?: string | null;
  registered_by: string;
  notes?: string | null;
  created_at: string;
  
  // Relations
  projects?: { id: string; name: string };
  clients?: { id: string; name: string };
  profiles?: { id: string; full_name: string };
}

export interface Expense {
  id: string;
  project_id?: string | null;
  client_id?: string | null;
  category: 'materiales' | 'operativo' | 'nomina' | 'transporte' | 'herramientas' | 'servicios_publicos' | 'arriendo' | 'subcontrato' | 'otro' | string;
  amount: number;
  expense_date: string;
  receipt_url?: string | null;
  description: string;
  registered_by: string;
  approved_by?: string | null;
  approval_status: 'pendiente' | 'aprobado' | 'rechazado';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  projects?: { id: string; name: string };
  register_user?: { id: string; full_name: string };
  approve_user?: { id: string; full_name: string };
}

export interface AccountingClosure {
  id: string;
  project_id: string;
  closed_by: string;
  closure_date: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  notes?: string | null;
  status: 'draft' | 'closed' | 'reviewed' | string;
  created_at: string;
  updated_at: string;
  
  // Relations
  project?: { id: string; name: string };
  closed_user?: { id: string; full_name: string };
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body?: string;
  is_read: boolean;
  related_table?: string;
  related_id?: string;
  notification_type: 'booking_new' | 'booking_reminder' | 'booking_completed' | 'booking_cancelled' | 'project_status' | 'system' | string;
  priority: number;
  action_url?: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id?: string | null;
  client_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  title: string;
  description?: string;
  status: 'pendiente' | 'en_progreso' | 'en_revision' | 'bloqueado' | 'completado' | 'cancelado';
  priority: number; // 0=normal, 1=alta, 2=urgente
  due_date?: string;
  time_slot?: string;
  appointment_type?: 'visita_tecnica' | 'cita_diseno' | string | null;
  task_category?: 'cita' | 'operativa' | 'diseno' | 'produccion' | 'administrativa' | 'seguimiento' | string;
  kanban_order?: number;
  tags?: string[];
  estimated_hours?: number;
  actual_hours?: number;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  
  // Referencias (for joints)
  clients?: { id: string; name: string; whatsapp_phone?: string; address?: string };
  project?: { id: string; name: string; status?: string }; // Not plural based on typical fetch
  projects?: { id: string; name: string; status?: string }; // keeping the old plural 
  profiles?: { id: string; full_name: string; role?: string; avatar_url?: string }; // assigned
  assigned_user?: { id: string; full_name: string; role?: string; avatar_url?: string };
  creator?: { id: string; full_name: string };
  
  comments?: { count: number }[];
  attachments?: { count: number }[];
}

export type SystemCategory = 'BUCKET' | 'EDGE_FUNCTION' | 'DB_TRIGGER' | 'CRON_JOB';

export interface SystemDictionaryEntry {
  id: string;
  category: SystemCategory;
  name: string;
  description: string;
  trigger_event?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string;
  };
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

