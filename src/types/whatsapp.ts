
export interface NotificationQueueRow {
  id: string;
  event_type: string;
  recipient_name: string;
  recipient_phone: string;
  template_name: string;
  template_language: string;
  template_parameters: any;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  delivery_status: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  provider_message_id: string | null;
  error_message: string | null;
  failed_reason: string | null;
  attempt_count: number;
  created_at: string;
  processing_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  last_delivery_status_at: string | null;
  updated_at: string;
}

export interface MetaWhatsappStatusEvent {
  id: string;
  provider_message_id: string;
  recipient_id: string;
  status: string;
  status_timestamp: string;
  raw_payload: any;
  errors: any;
  conversation: any;
  pricing: any;
  created_at: string;
}

export interface ProcessWhatsappNotificationsResponse {
  ok: boolean;
  dry_run: boolean;
  processed: number;
  results: Array<{
    id: string;
    status: string;
    delivery_status: string;
    provider_message_id?: string;
    reason?: string;
    error?: string;
    provider_response?: any;
  }>;
}
