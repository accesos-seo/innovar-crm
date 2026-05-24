import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface PriceHistoryEntry {
  id: string;
  material_id: string;
  previous_price: number;
  new_price: number;
  changed_at: string;
}

export function useMaterialPriceHistory(materialId: string | null) {
  return useQuery({
    queryKey: ["material-price-history", materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_price_history")
        .select("*")
        .eq("material_id", materialId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data as PriceHistoryEntry[];
    },
    enabled: !!materialId,
    staleTime: 2 * 60 * 1000,
  });
}
