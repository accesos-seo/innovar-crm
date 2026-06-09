import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import type { BankDetails } from '@/components/quotations/public/BankDetailsCard';

const BANK_KEYS = [
  'bank_name',
  'bank_account_number',
  'bank_account_type',
  'bank_holder_name',
  'bank_holder_id',
  'nequi_phone',
  'daviplata_phone',
] as const;

export function useBankDetails() {
  return useQuery({
    queryKey: ['system_settings', 'bank_details'],
    queryFn: async (): Promise<BankDetails> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [...BANK_KEYS]);
      if (error) throw mapSupabaseError(error);
      const map = Object.fromEntries(
        (data ?? []).map((row) => [row.key, row.value as string | undefined])
      );
      return {
        bank_name: map.bank_name,
        bank_account_number: map.bank_account_number,
        bank_account_type: map.bank_account_type,
        bank_holder_name: map.bank_holder_name,
        bank_holder_id: map.bank_holder_id,
        nequi_phone: map.nequi_phone,
        daviplata_phone: map.daviplata_phone,
      };
    },
    staleTime: 60_000,
  });
}
