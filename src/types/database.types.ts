export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_closures: {
        Row: {
          closed_by: string
          closure_date: string
          created_at: string | null
          id: string
          net_profit: number
          notes: string | null
          profit_margin: number | null
          project_id: string
          status: string | null
          total_expenses: number
          total_income: number
          updated_at: string | null
        }
        Insert: {
          closed_by: string
          closure_date?: string
          created_at?: string | null
          id?: string
          net_profit?: number
          notes?: string | null
          profit_margin?: number | null
          project_id: string
          status?: string | null
          total_expenses?: number
          total_income?: number
          updated_at?: string | null
        }
        Update: {
          closed_by?: string
          closure_date?: string
          created_at?: string | null
          id?: string
          net_profit?: number
          notes?: string | null
          profit_margin?: number | null
          project_id?: string
          status?: string | null
          total_expenses?: number
          total_income?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_closures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_actions_log: {
        Row: {
          agent_id: string
          created_at: string
          error_msg: string | null
          id: string
          intent: string
          payload: Json
          result: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          error_msg?: string | null
          id?: string
          intent: string
          payload?: Json
          result?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          error_msg?: string | null
          id?: string
          intent?: string
          payload?: Json
          result?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changesSummary: string | null
          id: string
          ipAddress: string | null
          recordId: string | null
          tableName: string
          timestamp: string | null
          userAgent: string | null
          userId: string | null
          userName: string | null
        }
        Insert: {
          action: string
          changesSummary?: string | null
          id?: string
          ipAddress?: string | null
          recordId?: string | null
          tableName: string
          timestamp?: string | null
          userAgent?: string | null
          userId?: string | null
          userName?: string | null
        }
        Update: {
          action?: string
          changesSummary?: string | null
          id?: string
          ipAddress?: string | null
          recordId?: string | null
          tableName?: string
          timestamp?: string | null
          userAgent?: string | null
          userId?: string | null
          userName?: string | null
        }
        Relationships: []
      }
      automation_project_docs: {
        Row: {
          confirmed_findings: Json
          created_at: string
          current_phase: string
          current_state: string
          id: string
          is_active: boolean
          module: string
          next_analysis_focus: Json
          open_decisions: Json
          project_key: string
          project_name: string
          recommended_automations: Json
          recommended_data_model: Json
          risks: Json
          scope_summary: string
          source_system: string
          status: string
          target_database: string | null
          updated_at: string
          version: number
        }
        Insert: {
          confirmed_findings?: Json
          created_at?: string
          current_phase: string
          current_state: string
          id?: string
          is_active?: boolean
          module: string
          next_analysis_focus?: Json
          open_decisions?: Json
          project_key: string
          project_name: string
          recommended_automations?: Json
          recommended_data_model?: Json
          risks?: Json
          scope_summary: string
          source_system?: string
          status?: string
          target_database?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          confirmed_findings?: Json
          created_at?: string
          current_phase?: string
          current_state?: string
          id?: string
          is_active?: boolean
          module?: string
          next_analysis_focus?: Json
          open_decisions?: Json
          project_key?: string
          project_name?: string
          recommended_automations?: Json
          recommended_data_model?: Json
          risks?: Json
          scope_summary?: string
          source_system?: string
          status?: string
          target_database?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          created_at: string | null
          date: string
          end_time: string
          id: string
          is_booked: boolean | null
          staff_id: string
          start_time: string
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          is_booked?: boolean | null
          staff_id: string
          start_time: string
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          is_booked?: boolean | null
          staff_id?: string
          start_time?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_dictionary: {
        Row: {
          access_level: string
          bucket_id: string
          created_at: string | null
          description: string
        }
        Insert: {
          access_level: string
          bucket_id: string
          created_at?: string | null
          description: string
        }
        Update: {
          access_level?: string
          bucket_id?: string
          created_at?: string | null
          description?: string
        }
        Relationships: []
      }
      calendar_sync_queue: {
        Row: {
          action: string
          calendar_id: string
          created_at: string
          error_msg: string | null
          google_event_id: string | null
          id: string
          payload: Json | null
          status: string
          synced_at: string | null
          task_id: string | null
        }
        Insert: {
          action: string
          calendar_id?: string
          created_at?: string
          error_msg?: string | null
          google_event_id?: string | null
          id?: string
          payload?: Json | null
          status?: string
          synced_at?: string | null
          task_id?: string | null
        }
        Update: {
          action?: string
          calendar_id?: string
          created_at?: string
          error_msg?: string | null
          google_event_id?: string | null
          id?: string
          payload?: Json | null
          status?: string
          synced_at?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_queue_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          assigned_at: string | null
          assigned_to: string | null
          city: string | null
          converted_to_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          lead_score: number | null
          lead_score_details: Json | null
          lead_scored_at: string | null
          name: string
          services: string | null
          status: string
          updated_at: string
          urgency: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          city?: string | null
          converted_to_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          lead_score?: number | null
          lead_score_details?: Json | null
          lead_scored_at?: string | null
          name: string
          services?: string | null
          status?: string
          updated_at?: string
          urgency?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          city?: string | null
          converted_to_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          lead_score?: number | null
          lead_score_details?: Json | null
          lead_scored_at?: string | null
          name?: string
          services?: string | null
          status?: string
          updated_at?: string
          urgency?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string | null
          approved_by: string | null
          category: Database["public"]["Enums"]["expense_category"]
          client_id: string | null
          created_at: string
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          project_id: string | null
          receipt_url: string | null
          registered_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approval_status?: string | null
          approved_by?: string | null
          category: Database["public"]["Enums"]["expense_category"]
          client_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          receipt_url?: string | null
          registered_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_status?: string | null
          approved_by?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          client_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          receipt_url?: string | null
          registered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          date: string
          id: string
          name: string
          year: number
        }
        Insert: {
          date: string
          id?: string
          name: string
          year: number
        }
        Update: {
          date?: string
          id?: string
          name?: string
          year?: number
        }
        Relationships: []
      }
      materials: {
        Row: {
          active: boolean | null
          category: string
          description: string | null
          id: string
          name: string
          photoUrl: string | null
          price: number | null
          sortOrder: number | null
          unit: string | null
        }
        Insert: {
          active?: boolean | null
          category: string
          description?: string | null
          id?: string
          name: string
          photoUrl?: string | null
          price?: number | null
          sortOrder?: number | null
          unit?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          description?: string | null
          id?: string
          name?: string
          photoUrl?: string | null
          price?: number | null
          sortOrder?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      meta_whatsapp_status_events: {
        Row: {
          conversation: Json | null
          created_at: string
          errors: Json | null
          id: string
          pricing: Json | null
          provider_message_id: string | null
          raw_payload: Json
          recipient_id: string | null
          status: string | null
          status_timestamp: string | null
        }
        Insert: {
          conversation?: Json | null
          created_at?: string
          errors?: Json | null
          id?: string
          pricing?: Json | null
          provider_message_id?: string | null
          raw_payload: Json
          recipient_id?: string | null
          status?: string | null
          status_timestamp?: string | null
        }
        Update: {
          conversation?: Json | null
          created_at?: string
          errors?: Json | null
          id?: string
          pricing?: Json | null
          provider_message_id?: string | null
          raw_payload?: Json
          recipient_id?: string | null
          status?: string | null
          status_timestamp?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          alert_channel: string | null
          alert_payload: Json | null
          alert_sent_at: string | null
          attempt_count: number
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          entity_reference_id: string | null
          entity_type: string | null
          error_message: string | null
          event_reference_id: string | null
          event_type: string
          failed_at: string | null
          failed_reason: string | null
          id: string
          last_delivery_status_at: string | null
          payload: Json
          processing_at: string | null
          provider: string
          provider_message_id: string | null
          provider_response: Json | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          recipient_reference_id: string | null
          recipient_type: string | null
          sent_at: string | null
          status: string
          template_language: string
          template_name: string
          template_parameters: Json
          updated_at: string
          webhook_payload: Json | null
        }
        Insert: {
          alert_channel?: string | null
          alert_payload?: Json | null
          alert_sent_at?: string | null
          attempt_count?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          entity_reference_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_reference_id?: string | null
          event_type: string
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          last_delivery_status_at?: string | null
          payload?: Json
          processing_at?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          recipient_reference_id?: string | null
          recipient_type?: string | null
          sent_at?: string | null
          status?: string
          template_language?: string
          template_name: string
          template_parameters?: Json
          updated_at?: string
          webhook_payload?: Json | null
        }
        Update: {
          alert_channel?: string | null
          alert_payload?: Json | null
          alert_sent_at?: string | null
          attempt_count?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          entity_reference_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_reference_id?: string | null
          event_type?: string
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          last_delivery_status_at?: string | null
          payload?: Json
          processing_at?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          recipient_reference_id?: string | null
          recipient_type?: string | null
          sent_at?: string | null
          status?: string
          template_language?: string
          template_name?: string
          template_parameters?: Json
          updated_at?: string
          webhook_payload?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          notification_type: string | null
          priority: number | null
          related_id: string | null
          related_table: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_type?: string | null
          priority?: number | null
          related_id?: string | null
          related_table?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_type?: string | null
          priority?: number | null
          related_id?: string | null
          related_table?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          client_id: string
          created_at: string
          created_by: string | null
          data_origin: string
          deleted_at: string | null
          id: string
          is_dormant: boolean
          last_activity_at: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          priority: string
          public_token: string
          services: string[]
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          data_origin: string
          deleted_at?: string | null
          id?: string
          is_dormant?: boolean
          last_activity_at?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          priority?: string
          public_token?: string
          services: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          data_origin?: string
          deleted_at?: string | null
          id?: string
          is_dormant?: boolean
          last_activity_at?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          priority?: string
          public_token?: string
          services?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_assignment_history: {
        Row: {
          changed_at: string
          changed_by: string
          from_user: string | null
          id: string
          opportunity_id: string
          reason: string | null
          to_user: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_user?: string | null
          id?: string
          opportunity_id: string
          reason?: string | null
          to_user: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_user?: string | null
          id?: string
          opportunity_id?: string
          reason?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_assignment_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_assignment_history_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_assignment_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_assignment_history_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          below_suggested: boolean | null
          client_id: string | null
          created_at: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_type: string | null
          project_id: string | null
          proof_url: string | null
          quotation_id: string | null
          receipt_url: string | null
          received_at: string
          registered_by: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          below_suggested?: boolean | null
          client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_type?: string | null
          project_id?: string | null
          proof_url?: string | null
          quotation_id?: string | null
          receipt_url?: string | null
          received_at?: string
          registered_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          below_suggested?: boolean | null
          client_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_type?: string | null
          project_id?: string | null
          proof_url?: string | null
          quotation_id?: string | null
          receipt_url?: string | null
          received_at?: string
          registered_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_generation_queue: {
        Row: {
          completed_at: string | null
          error_msg: string | null
          id: string
          pdf_url: string | null
          quotation_id: string
          requested_at: string
          requested_by: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_msg?: string | null
          id?: string
          pdf_url?: string | null
          quotation_id: string
          requested_at?: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_msg?: string | null
          id?: string
          pdf_url?: string | null
          quotation_id?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_generation_queue_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_generation_queue_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_catalog: {
        Row: {
          category: string
          code: string
          description: string | null
          id: string
          lastUpdated: string | null
          name: string
          previousValue: number | null
          unit: string | null
          value: number | null
        }
        Insert: {
          category: string
          code: string
          description?: string | null
          id?: string
          lastUpdated?: string | null
          name: string
          previousValue?: number | null
          unit?: string | null
          value?: number | null
        }
        Update: {
          category?: string
          code?: string
          description?: string | null
          id?: string
          lastUpdated?: string | null
          name?: string
          previousValue?: number | null
          unit?: string | null
          value?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          notification_preferences: Json
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          notification_preferences?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notification_preferences?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      project_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          photo_url: string
          project_id: string
          stage: Database["public"]["Enums"]["photo_stage"]
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url: string
          project_id: string
          stage: Database["public"]["Enums"]["photo_stage"]
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          photo_url?: string
          project_id?: string
          stage?: Database["public"]["Enums"]["photo_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          accounting_closure_id: string | null
          advance_amount: number | null
          approved_quotation_id: string | null
          client_approval_notes: string | null
          client_approved_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          data_origin: string | null
          deleted_at: string | null
          delivered_at: string | null
          design_3d_files: Json | null
          design_deadline: string | null
          design_delivered_at: string | null
          designer_id: string | null
          despiece_files: Json | null
          estimated_install_date: string | null
          fabrication_started_at: string | null
          id: string
          initial_measurements: Json | null
          install_duration_days: number | null
          is_archived: boolean | null
          materials_purchased_at: string | null
          modelado_approved_at: string | null
          modelado_revision_number: number | null
          name: string
          notes: string | null
          opportunity_id: string | null
          quotation_pdf_url: string | null
          render_revision_number: number | null
          renders_approved_at: string | null
          scheduled_install_date: string | null
          skip_design_process: boolean | null
          status: Database["public"]["Enums"]["project_status"]
          total_amount: number | null
          tracking_token: string
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Insert: {
          accounting_closure_id?: string | null
          advance_amount?: number | null
          approved_quotation_id?: string | null
          client_approval_notes?: string | null
          client_approved_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          data_origin?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          design_3d_files?: Json | null
          design_deadline?: string | null
          design_delivered_at?: string | null
          designer_id?: string | null
          despiece_files?: Json | null
          estimated_install_date?: string | null
          fabrication_started_at?: string | null
          id?: string
          initial_measurements?: Json | null
          install_duration_days?: number | null
          is_archived?: boolean | null
          materials_purchased_at?: string | null
          modelado_approved_at?: string | null
          modelado_revision_number?: number | null
          name: string
          notes?: string | null
          opportunity_id?: string | null
          quotation_pdf_url?: string | null
          render_revision_number?: number | null
          renders_approved_at?: string | null
          scheduled_install_date?: string | null
          skip_design_process?: boolean | null
          status?: Database["public"]["Enums"]["project_status"]
          total_amount?: number | null
          tracking_token?: string
          updated_at?: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Update: {
          accounting_closure_id?: string | null
          advance_amount?: number | null
          approved_quotation_id?: string | null
          client_approval_notes?: string | null
          client_approved_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          data_origin?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          design_3d_files?: Json | null
          design_deadline?: string | null
          design_delivered_at?: string | null
          designer_id?: string | null
          despiece_files?: Json | null
          estimated_install_date?: string | null
          fabrication_started_at?: string | null
          id?: string
          initial_measurements?: Json | null
          install_duration_days?: number | null
          is_archived?: boolean | null
          materials_purchased_at?: string | null
          modelado_approved_at?: string | null
          modelado_revision_number?: number | null
          name?: string
          notes?: string | null
          opportunity_id?: string | null
          quotation_pdf_url?: string | null
          render_revision_number?: number | null
          renders_approved_at?: string | null
          scheduled_install_date?: string | null
          skip_design_process?: boolean | null
          status?: Database["public"]["Enums"]["project_status"]
          total_amount?: number | null
          tracking_token?: string
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_accounting_closure_id_fkey"
            columns: ["accounting_closure_id"]
            isOneToOne: false
            referencedRelation: "accounting_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_approved_quotation_id_fkey"
            columns: ["approved_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          configuration: Json | null
          created_at: string
          description: string
          id: string
          product_category: string | null
          quantity: number
          quotation_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          description: string
          id?: string
          product_category?: string | null
          quantity?: number
          quotation_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          description?: string
          id?: string
          product_category?: string | null
          quantity?: number
          quotation_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          bypass_reason: string | null
          bypassed_visit: boolean
          change_reason: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          is_historical_copy: boolean | null
          is_locked: boolean
          notes: string | null
          opportunity_id: string | null
          parent_quotation_id: string | null
          public_token: string | null
          quotation_number: string | null
          quotation_type: string
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number | null
          total_amount: number
          transport_cost: number | null
          updated_at: string
          valid_until: string | null
          version_number: number | null
        }
        Insert: {
          bypass_reason?: string | null
          bypassed_visit?: boolean
          change_reason?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_historical_copy?: boolean | null
          is_locked?: boolean
          notes?: string | null
          opportunity_id?: string | null
          parent_quotation_id?: string | null
          public_token?: string | null
          quotation_number?: string | null
          quotation_type?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          total_amount?: number
          transport_cost?: number | null
          updated_at?: string
          valid_until?: string | null
          version_number?: number | null
        }
        Update: {
          bypass_reason?: string | null
          bypassed_visit?: boolean
          change_reason?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_historical_copy?: boolean | null
          is_locked?: boolean
          notes?: string | null
          opportunity_id?: string | null
          parent_quotation_id?: string | null
          public_token?: string | null
          quotation_number?: string | null
          quotation_type?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          total_amount?: number
          transport_cost?: number | null
          updated_at?: string
          valid_until?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_parent_quotation_id_fkey"
            columns: ["parent_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          client_id: string
          comments: string | null
          created_at: string
          id: string
          project_id: string
          rating_overall: number | null
          rating_punctuality: number | null
          rating_quality: number | null
          rating_service: number | null
          responded_at: string | null
          sent_at: string | null
          status: string
          would_recommend: boolean | null
        }
        Insert: {
          client_id: string
          comments?: string | null
          created_at?: string
          id?: string
          project_id: string
          rating_overall?: number | null
          rating_punctuality?: number | null
          rating_quality?: number | null
          rating_service?: number | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          would_recommend?: boolean | null
        }
        Update: {
          client_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          project_id?: string
          rating_overall?: number | null
          rating_punctuality?: number | null
          rating_quality?: number | null
          rating_service?: number | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_job_log: {
        Row: {
          error_msg: string | null
          finished_at: string | null
          id: string
          job_name: string
          rows_affected: number | null
          started_at: string
          status: string | null
        }
        Insert: {
          error_msg?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          rows_affected?: number | null
          started_at?: string
          status?: string | null
        }
        Update: {
          error_msg?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          rows_affected?: number | null
          started_at?: string
          status?: string | null
        }
        Relationships: []
      }
      system_dictionary: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          name: string
          status: string | null
          trigger_event: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          id?: string
          name: string
          status?: string | null
          trigger_event?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          name?: string
          status?: string | null
          trigger_event?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          appointment_type: string | null
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          kanban_order: number | null
          priority: number
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          task_category: Database["public"]["Enums"]["task_category"] | null
          time_slot: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          appointment_type?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          kanban_order?: number | null
          priority?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          task_category?: Database["public"]["Enums"]["task_category"] | null
          time_slot?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          appointment_type?: string | null
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          kanban_order?: number | null
          priority?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          task_category?: Database["public"]["Enums"]["task_category"] | null
          time_slot?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          client_confirmed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_minutes: number
          exception_reason: string | null
          id: string
          is_exception: boolean
          measurements: Json | null
          modality: string
          notes: string | null
          opportunity_id: string
          photos: Json
          public_token: string
          realized_at: string | null
          reschedule_count: number
          scheduled_at: string
          scheduled_via: string | null
          status: string
          updated_at: string
          visited_by: string | null
        }
        Insert: {
          client_confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_minutes?: number
          exception_reason?: string | null
          id?: string
          is_exception?: boolean
          measurements?: Json | null
          modality?: string
          notes?: string | null
          opportunity_id: string
          photos?: Json
          public_token?: string
          realized_at?: string | null
          reschedule_count?: number
          scheduled_at: string
          scheduled_via?: string | null
          status?: string
          updated_at?: string
          visited_by?: string | null
        }
        Update: {
          client_confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_minutes?: number
          exception_reason?: string | null
          id?: string
          is_exception?: boolean
          measurements?: Json | null
          modality?: string
          notes?: string | null
          opportunity_id?: string
          photos?: Json
          public_token?: string
          realized_at?: string | null
          reschedule_count?: number
          scheduled_at?: string
          scheduled_via?: string | null
          status?: string
          updated_at?: string
          visited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_visited_by_fkey"
            columns: ["visited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          notes: string | null
          project_id: string
          starts_at: string
          status: string
          updated_at: string
          warranty_months: number
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          notes?: string | null
          project_id: string
          starts_at: string
          status?: string
          updated_at?: string
          warranty_months?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          warranty_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "warranties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_leads_ranked"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          reported_at: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          status: string
          updated_at: string
          warranty_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          id?: string
          reported_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
          warranty_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          reported_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          updated_at?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          error_msg: string | null
          event_type: string
          id: string
          message: string
          phone: string
          related_id: string | null
          related_table: string | null
          sent_at: string
          status: string | null
        }
        Insert: {
          error_msg?: string | null
          event_type: string
          id?: string
          message: string
          phone: string
          related_id?: string | null
          related_table?: string | null
          sent_at?: string
          status?: string | null
        }
        Update: {
          error_msg?: string | null
          event_type?: string
          id?: string
          message?: string
          phone?: string
          related_id?: string | null
          related_table?: string | null
          sent_at?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_leads_ranked: {
        Row: {
          assigned_at: string | null
          assigned_to_name: string | null
          city: string | null
          email: string | null
          id: string | null
          lead_score: number | null
          lead_score_details: Json | null
          lead_scored_at: string | null
          lead_temperature: string | null
          name: string | null
          quotation_count: number | null
          services: string | null
          status: string | null
          urgency: string | null
          whatsapp_phone: string | null
        }
        Relationships: []
      }
      v_whatsapp_notification_alerts: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          delivered_at: string | null
          entity_reference_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string | null
          failed_at: string | null
          failed_reason: string | null
          id: string | null
          last_delivery_status_at: string | null
          meta_status: string | null
          needs_attention: boolean | null
          operational_status: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_reference_id: string | null
          recipient_type: string | null
          sent_at: string | null
          system_status: string | null
          template_language: string | null
          template_name: string | null
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          entity_reference_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string | null
          last_delivery_status_at?: string | null
          meta_status?: string | null
          needs_attention?: never
          operational_status?: never
          provider_message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_reference_id?: string | null
          recipient_type?: string | null
          sent_at?: string | null
          system_status?: string | null
          template_language?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          entity_reference_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string | null
          last_delivery_status_at?: string | null
          meta_status?: string | null
          needs_attention?: never
          operational_status?: never
          provider_message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_reference_id?: string | null
          recipient_type?: string | null
          sent_at?: string | null
          system_status?: string | null
          template_language?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_whatsapp_notification_dashboard: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          delivered_at: string | null
          entity_reference_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string | null
          failed_at: string | null
          failed_reason: string | null
          id: string | null
          last_delivery_status_at: string | null
          meta_status: string | null
          needs_attention: boolean | null
          operational_status: string | null
          provider_message_id: string | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string | null
          recipient_reference_id: string | null
          recipient_type: string | null
          sent_at: string | null
          system_status: string | null
          template_language: string | null
          template_name: string | null
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          entity_reference_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string | null
          last_delivery_status_at?: string | null
          meta_status?: string | null
          needs_attention?: never
          operational_status?: never
          provider_message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_reference_id?: string | null
          recipient_type?: string | null
          sent_at?: string | null
          system_status?: string | null
          template_language?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          entity_reference_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string | null
          last_delivery_status_at?: string | null
          meta_status?: string | null
          needs_attention?: never
          operational_status?: never
          provider_message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          recipient_reference_id?: string | null
          recipient_type?: string | null
          sent_at?: string | null
          system_status?: string | null
          template_language?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_first_name: { Args: { full_name: string }; Returns: string }
      book_appointment: {
        Args: {
          p_appointment_type?: string
          p_client_id: string
          p_slot_id: string
        }
        Returns: Json
      }
      calculate_lead_score: { Args: { p_client_id: string }; Returns: number }
      calculate_refund_percentage: {
        Args: { p_project_id: string }
        Returns: number
      }
      create_accounting_closure: {
        Args: { p_closed_by: string; p_notes?: string; p_project_id: string }
        Returns: Json
      }
      create_quotation_version: {
        Args: { p_quotation_id: string }
        Returns: string
      }
      enqueue_notification: {
        Args: {
          p_entity_reference_id: string
          p_entity_type: string
          p_event_reference_id: string
          p_event_type: string
          p_payload?: Json
          p_recipient_name: string
          p_recipient_phone: string
          p_recipient_reference_id: string
          p_recipient_type: string
          p_template_language?: string
          p_template_name: string
          p_template_parameters?: Json
        }
        Returns: string
      }
      escalate_overdue_and_blocked_tasks: { Args: never; Returns: number }
      fn_profile_wants_wa: {
        Args: { p_event: string; p_profile_id: string }
        Returns: boolean
      }
      fn_wa_enqueue_for_profile: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_params: Json
          p_payload: Json
          p_pref_key: string
          p_profile_id: string
          p_template_name: string
        }
        Returns: string
      }
      fn_wa_quotation_expiry_3d_scan: { Args: never; Returns: number }
      fn_wa_recordatorio_24h_scan: { Args: never; Returns: number }
      generate_next_quotation_number: { Args: never; Returns: string }
      generate_weekly_report: { Args: never; Returns: Json }
      get_available_slots: {
        Args: { p_date_from: string; p_date_to: string; p_staff_id: string }
        Returns: {
          end_time: string
          slot_date: string
          slot_id: string
          staff_id: string
          start_time: string
        }[]
      }
      get_financial_summary: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: Json
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_project_balance: { Args: { p_project_id: string }; Returns: Json }
      get_suggested_advance_pct: { Args: never; Returns: number }
      get_visit_slots: {
        Args: { p_commercial_id: string; p_from: string; p_to: string }
        Returns: {
          is_available: boolean
          slot_start: string
        }[]
      }
      normalize_phone: { Args: { input: string }; Returns: string }
      normalize_whatsapp_phone: { Args: { p_phone: string }; Returns: string }
      recalculate_quotation_totals: {
        Args: { p_quotation_id: string }
        Returns: undefined
      }
      reorder_kanban: {
        Args: { p_new_order: number; p_new_status: string; p_task_id: string }
        Returns: Json
      }
      run_archive_inactive_projects: { Args: never; Returns: Json }
      run_daily_task_escalation: { Args: never; Returns: Json }
      run_payment_reminders: { Args: never; Returns: Json }
      send_whatsapp_notification: {
        Args: {
          p_event_type: string
          p_id?: string
          p_message: string
          p_phone: string
          p_table?: string
        }
        Returns: string
      }
      validate_public_token: {
        Args: { p_scope: string; p_token: string }
        Returns: string
      }
    }
    Enums: {
      approval_status: "pendiente" | "aprobado" | "rechazado"
      expense_category:
        | "materiales"
        | "subcontrato"
        | "transporte"
        | "herramientas"
        | "operativo"
        | "dietas"
        | "arriendo"
        | "luz_energia"
        | "agua"
        | "internet"
        | "insumos_aseo"
        | "insumos_papeleria"
        | "cortesia_atencion_cliente"
        | "gasolina_vehiculos"
        | "mantenimiento_moto"
        | "mantenimiento_bodega"
        | "mantenimiento_maquinaria"
        | "nomina"
        | "otro"
      payment_method:
        | "efectivo"
        | "transferencia"
        | "credito"
        | "cheque"
        | "nequi"
        | "daviplata"
        | "pse"
      payment_type: "advance" | "installment" | "final" | "refund"
      photo_stage: "diseno" | "produccion" | "final"
      project_status:
        | "contacto"
        | "cotizacion_aprobada"
        | "en_diseno"
        | "aprobacion_final"
        | "en_produccion"
        | "listo_instalacion"
        | "entregado"
      quotation_status:
        | "draft"
        | "sent"
        | "approved"
        | "rejected"
        | "client_approved"
        | "pending_payment_verification"
        | "expired"
      task_category:
        | "cita"
        | "operativa"
        | "diseno"
        | "produccion"
        | "administrativa"
        | "seguimiento"
      task_status:
        | "pendiente"
        | "en_progreso"
        | "en_revision"
        | "bloqueado"
        | "completado"
        | "cancelado"
      user_role: "admin" | "comercial" | "diseno" | "produccion" | "super_admin"
      work_type: "cocina" | "closet" | "puertas" | "centro_tv" | "otro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pendiente", "aprobado", "rechazado"],
      expense_category: [
        "materiales",
        "subcontrato",
        "transporte",
        "herramientas",
        "operativo",
        "dietas",
        "arriendo",
        "luz_energia",
        "agua",
        "internet",
        "insumos_aseo",
        "insumos_papeleria",
        "cortesia_atencion_cliente",
        "gasolina_vehiculos",
        "mantenimiento_moto",
        "mantenimiento_bodega",
        "mantenimiento_maquinaria",
        "nomina",
        "otro",
      ],
      payment_method: [
        "efectivo",
        "transferencia",
        "credito",
        "cheque",
        "nequi",
        "daviplata",
        "pse",
      ],
      payment_type: ["advance", "installment", "final", "refund"],
      photo_stage: ["diseno", "produccion", "final"],
      project_status: [
        "contacto",
        "cotizacion_aprobada",
        "en_diseno",
        "aprobacion_final",
        "en_produccion",
        "listo_instalacion",
        "entregado",
      ],
      quotation_status: [
        "draft",
        "sent",
        "approved",
        "rejected",
        "client_approved",
        "pending_payment_verification",
        "expired",
      ],
      task_category: [
        "cita",
        "operativa",
        "diseno",
        "produccion",
        "administrativa",
        "seguimiento",
      ],
      task_status: [
        "pendiente",
        "en_progreso",
        "en_revision",
        "bloqueado",
        "completado",
        "cancelado",
      ],
      user_role: ["admin", "comercial", "diseno", "produccion", "super_admin"],
      work_type: ["cocina", "closet", "puertas", "centro_tv", "otro"],
    },
  },
} as const
