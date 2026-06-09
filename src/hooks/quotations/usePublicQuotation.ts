import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export type PublicQuotationStatus =
  | 'draft'
  | 'sent'
  | 'client_approved'
  | 'pending_payment_verification'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface PublicQuotationItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  product_category: string | null;
  configuration: Record<string, unknown> | null;
}

export interface PublicQuotationBankInfo {
  bank_name: string;
  bank_account_number: string;
  bank_account_type: string;
  bank_holder_name: string;
  bank_holder_id: string;
  nequi_phone: string;
  daviplata_phone: string;
}

export interface PublicQuotationData {
  id: string;
  quotation_number: string | null;
  version_number: number | null;
  parent_quotation_id: string | null;
  /** Código corto 6-char para URL compartible /c/<code> (Slice 2.5) */
  short_code: string | null;
  status: PublicQuotationStatus;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  transport_cost: number;
  total_amount: number;
  valid_until: string | null;
  notes: string | null;
  view_count: number;
  viewed_at: string | null;
  client_approved_at: string | null;
  client_rejected_at: string | null;
  is_expired: boolean;
  pdf_url_available: boolean;
  client: { name: string };
  items: PublicQuotationItem[];
  bank: PublicQuotationBankInfo | null;
}

export type PublicQuotationResponse =
  | PublicQuotationData
  | { error: 'not_found' }
  | { redirect_to_token: string; reason: string };

export function isRedirectResponse(
  r: PublicQuotationResponse | undefined,
): r is { redirect_to_token: string; reason: string } {
  return !!r && 'redirect_to_token' in r && typeof r.redirect_to_token === 'string';
}

export function isErrorResponse(
  r: PublicQuotationResponse | undefined,
): r is { error: 'not_found' } {
  return !!r && 'error' in r;
}

export function isQuotationData(
  r: PublicQuotationResponse | undefined,
): r is PublicQuotationData {
  return !!r && 'id' in r && 'items' in r;
}

/**
 * Lee la cotización pública por token. SIN auth.
 * - Si el token es válido y vigente → devuelve datos completos.
 * - Si el token es de una versión histórica → devuelve { redirect_to_token }.
 * - Si el token no existe → devuelve { error: 'not_found' }.
 *
 * Cada llamada incrementa `view_count` (y setea `viewed_at` la primera vez).
 */
export function usePublicQuotation(token: string | undefined) {
  return useQuery<PublicQuotationResponse>({
    queryKey: ['public-quotation', token],
    enabled: !!token && token.length >= 16,
    staleTime: 1000 * 30,
    retry: false,
    queryFn: async () => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('get_public_quotation', { p_token: token });
      if (error) throw mapSupabaseError(error);
      return data as PublicQuotationResponse;
    },
  });
}
