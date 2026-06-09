import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface QuotationVersionRow {
  id: string;
  version_number: number | null;
  status: string;
  total_amount: number;
  is_historical_copy: boolean;
  created_at: string;
  public_token: string;
}

export interface QuotationVersionItem {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

/**
 * Devuelve TODAS las versiones que comparten el mismo `quotation_number`
 * (o están conectadas vía `parent_quotation_id`), ordenadas de la más
 * reciente a la más antigua.
 *
 * Útil para el diff visual entre V[N] y V[N-1] en la URL pública.
 */
export function useQuotationVersions(quotationId: string | undefined) {
  return useQuery({
    queryKey: ['quotation-versions', quotationId],
    enabled: !!quotationId,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<{
      versions: QuotationVersionRow[];
      itemsByVersion: Record<string, QuotationVersionItem[]>;
    }> => {
      assertSupabase(supabase);

      const baseQ = await supabase
        .from('quotations')
        .select('id, parent_quotation_id, quotation_number')
        .eq('id', quotationId)
        .maybeSingle();
      if (baseQ.error) throw mapSupabaseError(baseQ.error);
      if (!baseQ.data) return { versions: [], itemsByVersion: {} };

      const rootId = baseQ.data.parent_quotation_id ?? baseQ.data.id;

      const versionsQ = await supabase
        .from('quotations')
        .select('id, version_number, status, total_amount, is_historical_copy, created_at, public_token')
        .or(`id.eq.${rootId},parent_quotation_id.eq.${rootId}`)
        .order('version_number', { ascending: false, nullsFirst: false });
      if (versionsQ.error) throw mapSupabaseError(versionsQ.error);

      const versions = (versionsQ.data ?? []) as QuotationVersionRow[];
      const ids = versions.map((v) => v.id);

      const itemsQ = await supabase
        .from('quotation_items')
        .select('id, quotation_id, description, quantity, unit_price')
        .in('quotation_id', ids);
      if (itemsQ.error) throw mapSupabaseError(itemsQ.error);

      const itemsByVersion: Record<string, QuotationVersionItem[]> = {};
      for (const it of (itemsQ.data ?? []) as QuotationVersionItem[]) {
        if (!itemsByVersion[it.quotation_id]) itemsByVersion[it.quotation_id] = [];
        itemsByVersion[it.quotation_id].push(it);
      }

      return { versions, itemsByVersion };
    },
  });
}
