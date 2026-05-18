/**
 * Tipos generados manualmente desde el schema de Supabase.
 * Source of truth: `db/supabase_schema.sql` + `db/migrations/*.sql`.
 *
 * 🔄 Cómo regenerar automáticamente (preferido a largo plazo):
 *   npx supabase login
 *   npx supabase gen types typescript --project-id xdzbjptozeqcbnaqhtye > src/types/database.types.ts
 *
 * 📝 Convención: cada tabla expone tres tipos:
 *   - `Row`     : la fila tal como viene de SELECT
 *   - `Insert`  : payload para INSERT (campos auto-generados son opcionales)
 *   - `Update`  : payload para UPDATE (todo opcional)
 *
 * Para validación de input, usa los schemas Zod en `src/schemas/` — son
 * la fuente de verdad de las reglas de negocio (longitudes, formatos, enums).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─────────────────────────────────────────────────────────────────────────────
// Enum-like string literals (mirror schema check constraints)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole =
  | "super_admin"
  | "admin"
  | "comercial"
  | "disenador"
  | "jefe_taller"
  | "operario";

export type ProjectStatus =
  | "contacto"
  | "medicion_tomada"
  | "cotizacion_enviada"
  | "cotizacion_aprobada"
  | "en_diseno"
  | "modelado_listo"
  | "renders_listos"
  | "aprobacion_cliente"
  | "en_produccion"
  | "instalacion_programada"
  | "instalando"
  | "entregado"
  | "garantia";

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "negotiation"
  | "approved"
  | "rejected"
  | "expired"
  | "replaced";

export type WorkType = "cocina" | "closet" | "puertas" | "centro_tv";

export type DataOrigin = "manual" | "system" | "whatsapp" | "import";

// ─────────────────────────────────────────────────────────────────────────────
// Database shape
// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      // ── profiles ─────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          role: UserRole | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: UserRole | null;
          phone?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      // ── clients (also serves as "leads") ────────────────────────────────
      clients: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          whatsapp_phone: string | null;
          address: string | null;
          notes: string | null;
          data_origin: DataOrigin;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          name: string;
          email?: string | null;
          whatsapp_phone?: string | null;
          address?: string | null;
          notes?: string | null;
          data_origin?: DataOrigin;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
      };

      // ── projects ─────────────────────────────────────────────────────────
      projects: {
        Row: {
          id: string;
          tracking_token: string;
          client_id: string | null;
          approved_quotation_id: string | null;
          designer_id: string | null;
          created_by: string | null;
          accounting_closure_id: string | null;
          name: string;
          work_type: WorkType;
          status: ProjectStatus;
          notes: string | null;
          total_amount: number | null;
          advance_amount: number | null;
          client_approved_at: string | null;
          client_approval_notes: string | null;
          design_deadline: string | null;
          design_delivered_at: string | null;
          initial_measurements: Json | null;
          design_3d_files: Json;
          despiece_files: Json;
          modelado_approved_at: string | null;
          renders_approved_at: string | null;
          modelado_revision_number: number;
          render_revision_number: number;
          estimated_install_date: string | null;
          scheduled_install_date: string | null;
          install_duration_days: number | null;
          delivered_at: string | null;
          quotation_pdf_url: string | null;
          is_archived: boolean;
          skip_design_process: boolean;
          data_origin: DataOrigin;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          name: string;
          work_type: WorkType;
          client_id?: string | null;
          approved_quotation_id?: string | null;
          designer_id?: string | null;
          created_by?: string | null;
          status?: ProjectStatus;
          notes?: string | null;
          total_amount?: number | null;
          advance_amount?: number | null;
          design_deadline?: string | null;
          initial_measurements?: Json | null;
          estimated_install_date?: string | null;
          scheduled_install_date?: string | null;
          install_duration_days?: number | null;
          skip_design_process?: boolean;
          data_origin?: DataOrigin;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]> & {
          id?: string;
          status?: ProjectStatus;
          client_approved_at?: string | null;
          design_delivered_at?: string | null;
          modelado_approved_at?: string | null;
          renders_approved_at?: string | null;
          delivered_at?: string | null;
          quotation_pdf_url?: string | null;
          is_archived?: boolean;
          design_3d_files?: Json;
          despiece_files?: Json;
        };
      };

      // ── quotations ───────────────────────────────────────────────────────
      quotations: {
        Row: {
          id: string;
          quotation_number: string;
          client_id: string | null;
          project_id: string | null;
          status: QuotationStatus;
          total_amount: number;
          subtotal: number | null;
          discount_type: "percent" | "fixed" | "none";
          discount_value: number;
          transport_cost: number;
          notes: string | null;
          is_locked: boolean;
          version_number: number;
          parent_quotation_id: string | null;
          is_historical_copy: boolean;
          valid_until: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          quotation_number?: string;
          client_id?: string | null;
          project_id?: string | null;
          status?: QuotationStatus;
          total_amount?: number;
          subtotal?: number | null;
          discount_type?: "percent" | "fixed" | "none";
          discount_value?: number;
          transport_cost?: number;
          notes?: string | null;
          is_locked?: boolean;
          version_number?: number;
          parent_quotation_id?: string | null;
          is_historical_copy?: boolean;
          valid_until?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quotations"]["Insert"]>;
      };

      // ── quotation_items ──────────────────────────────────────────────────
      quotation_items: {
        Row: {
          id: string;
          quotation_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          calculated_total: number | null;
          product_category: string | null;
          base_catalog_id: string | null;
          configuration: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          quotation_id: string;
          description: string;
          quantity?: number;
          unit_price?: number;
          calculated_total?: number | null;
          product_category?: string | null;
          base_catalog_id?: string | null;
          configuration?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["quotation_items"]["Insert"]>;
      };

      // ── payments ─────────────────────────────────────────────────────────
      payments: {
        Row: {
          id: string;
          project_id: string | null;
          client_id: string;
          amount: number;
          payment_method: string;
          payment_type: string;
          received_at: string;
          receipt_url: string | null;
          registered_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          client_id: string;
          amount: number;
          payment_method: string;
          payment_type: string;
          received_at?: string;
          project_id?: string | null;
          receipt_url?: string | null;
          registered_by?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };

      // ── expenses ─────────────────────────────────────────────────────────
      expenses: {
        Row: {
          id: string;
          project_id: string | null;
          client_id: string | null;
          category: string;
          amount: number;
          expense_date: string;
          receipt_url: string | null;
          description: string;
          registered_by: string | null;
          approved_by: string | null;
          approval_status: "pendiente" | "aprobado" | "rechazado";
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          amount: number;
          expense_date: string;
          description: string;
          project_id?: string | null;
          client_id?: string | null;
          receipt_url?: string | null;
          registered_by?: string | null;
          approved_by?: string | null;
          approval_status?: "pendiente" | "aprobado" | "rechazado";
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };

      // ── accounting_closures ──────────────────────────────────────────────
      accounting_closures: {
        Row: {
          id: string;
          project_id: string;
          closed_by: string | null;
          closure_date: string;
          total_income: number;
          total_expenses: number;
          net_profit: number;
          profit_margin: number;
          notes: string | null;
          status: "draft" | "closed" | "reviewed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          project_id: string;
          closure_date: string;
          closed_by?: string | null;
          total_income?: number;
          total_expenses?: number;
          net_profit?: number;
          profit_margin?: number;
          notes?: string | null;
          status?: "draft" | "closed" | "reviewed";
        };
        Update: Partial<Database["public"]["Tables"]["accounting_closures"]["Insert"]>;
      };

      // ── notifications ────────────────────────────────────────────────────
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          is_read: boolean;
          related_table: string | null;
          related_id: string | null;
          notification_type: string;
          priority: number;
          action_url: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title: string;
          notification_type: string;
          body?: string | null;
          is_read?: boolean;
          related_table?: string | null;
          related_id?: string | null;
          priority?: number;
          action_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };

      // ── tasks (también citas de agenda) ──────────────────────────────────
      tasks: {
        Row: {
          id: string;
          project_id: string | null;
          client_id: string | null;
          assigned_to: string | null;
          created_by: string | null;
          title: string;
          description: string | null;
          status: string;
          priority: number;
          due_date: string | null;
          time_slot: string | null;
          appointment_type: string | null;
          task_category: string | null;
          kanban_order: number;
          tags: string[] | null;
          estimated_hours: number | null;
          actual_hours: number | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          project_id?: string | null;
          client_id?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          description?: string | null;
          status?: string;
          priority?: number;
          due_date?: string | null;
          time_slot?: string | null;
          appointment_type?: string | null;
          task_category?: string | null;
          kanban_order?: number;
          tags?: string[] | null;
          estimated_hours?: number | null;
          actual_hours?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]> & {
          completed_at?: string | null;
        };
      };

      // ── task_comments ────────────────────────────────────────────────────
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string | null;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          task_id: string;
          content: string;
          author_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["task_comments"]["Insert"]>;
      };

      // ── task_attachments ─────────────────────────────────────────────────
      task_attachments: {
        Row: {
          id: string;
          task_id: string;
          uploaded_by: string | null;
          file_name: string;
          file_url: string;
          file_size: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          task_id: string;
          file_name: string;
          file_url: string;
          uploaded_by?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["task_attachments"]["Insert"]>;
      };

      // ── system_dictionary ────────────────────────────────────────────────
      system_dictionary: {
        Row: {
          id: string;
          category: string;
          name: string;
          description: string | null;
          trigger_event: string | null;
          status: "active" | "inactive" | "deprecated";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          name: string;
          description?: string | null;
          trigger_event?: string | null;
          status?: "active" | "inactive" | "deprecated";
        };
        Update: Partial<Database["public"]["Tables"]["system_dictionary"]["Insert"]>;
      };

      // ── materials ────────────────────────────────────────────────────────
      // ⚠️ Mixed casing: photoUrl, sortOrder are camelCase in the DB.
      materials: {
        Row: {
          id: string;
          category: string;
          name: string;
          description: string | null;
          photoUrl: string | null;
          price: number;
          unit: string;
          active: boolean;
          sortOrder: number;
          brand: string | null;
          stock: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          name: string;
          description?: string | null;
          photoUrl?: string | null;
          price?: number;
          unit?: string;
          active?: boolean;
          sortOrder?: number;
          brand?: string | null;
          stock?: number;
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
      };

      // ── pricing_catalog ──────────────────────────────────────────────────
      // ⚠️ Mixed casing: previousValue, lastUpdated are camelCase in the DB.
      pricing_catalog: {
        Row: {
          id: string;
          category: string;
          code: string | null;
          name: string;
          description: string | null;
          value: number;
          unit: string;
          previousValue: number | null;
          lastUpdated: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          name: string;
          code?: string | null;
          description?: string | null;
          value?: number;
          unit?: string;
          previousValue?: number | null;
          lastUpdated?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_catalog"]["Insert"]>;
      };

      // ── holidays ─────────────────────────────────────────────────────────
      holidays: {
        Row: {
          id: string;
          date: string;
          name: string;
          year: number;
          created_at: string;
        };
        Insert: {
          date: string;
          name: string;
          year: number;
        };
        Update: Partial<Database["public"]["Tables"]["holidays"]["Insert"]>;
      };

      // ── notification_queue (WhatsApp outbox) ─────────────────────────────
      notification_queue: {
        Row: {
          id: string;
          event_type: string;
          recipient_name: string | null;
          recipient_phone: string;
          template_name: string | null;
          template_language: string;
          template_parameters: Json | null;
          status: string;
          delivery_status: string | null;
          provider_message_id: string | null;
          error_message: string | null;
          failed_reason: string | null;
          attempt_count: number;
          processing_at: string | null;
          sent_at: string | null;
          failed_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          last_delivery_status_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_type: string;
          recipient_phone: string;
          recipient_name?: string | null;
          template_name?: string | null;
          template_language?: string;
          template_parameters?: Json | null;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_queue"]["Insert"]> & {
          delivery_status?: string | null;
          provider_message_id?: string | null;
          error_message?: string | null;
          failed_reason?: string | null;
          attempt_count?: number;
          processing_at?: string | null;
          sent_at?: string | null;
          failed_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
        };
      };

      // ── meta_whatsapp_status_events (WhatsApp webhook log) ───────────────
      meta_whatsapp_status_events: {
        Row: {
          id: string;
          provider_message_id: string;
          recipient_id: string | null;
          status: string | null;
          status_timestamp: string | null;
          raw_payload: Json | null;
          errors: Json | null;
          conversation: Json | null;
          pricing: Json | null;
          created_at: string;
        };
        Insert: {
          provider_message_id: string;
          recipient_id?: string | null;
          status?: string | null;
          status_timestamp?: string | null;
          raw_payload?: Json | null;
          errors?: Json | null;
          conversation?: Json | null;
          pricing?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["meta_whatsapp_status_events"]["Insert"]>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_next_quotation_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_financial_summary: {
        Args: {
          p_date_from?: string | null;
          p_date_to?: string | null;
        };
        Returns: {
          total_income: number;
          total_expenses: number;
          net_profit: number;
          pending_balance: number;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience type aliases — preferred for hook return types
// ─────────────────────────────────────────────────────────────────────────────

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
