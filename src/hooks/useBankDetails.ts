import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface BankDetail {
  id: string;
  bank_name: string;
  account_number: string;
  account_type: 'ahorro' | 'corriente';
  holder_name: string;
  holder_id: string;
  nequi_phone: string | null;
  daviplata_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export function useBankDetails() {
  return useQuery({
    queryKey: ['bank_details'],
    queryFn: async (): Promise<BankDetail[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('bank_details')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw mapSupabaseError(error);
      return (data as BankDetail[]) ?? [];
    },
    staleTime: 60_000,
  });
}

export function useBankDetailsActive() {
  return useQuery({
    queryKey: ['bank_details', 'active'],
    queryFn: async (): Promise<BankDetail | null> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('bank_details')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return (data as BankDetail) ?? null;
    },
    staleTime: 60_000,
  });
}
