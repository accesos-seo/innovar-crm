import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface CreateBankDetailInput {
  bank_name: string;
  account_number: string;
  account_type: 'ahorro' | 'corriente';
  holder_name: string;
  holder_id: string;
  nequi_phone?: string | null;
  daviplata_phone?: string | null;
}

export function useCreateBankDetail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBankDetailInput) => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('bank_details')
        .insert([input])
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_details'] });
    },
  });
}

export function useDeleteBankDetail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from('bank_details')
        .delete()
        .eq('id', id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_details'] });
    },
  });
}

export function useSetActiveBankDetail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertSupabase(supabase);
      // Deactivate all others
      await supabase
        .from('bank_details')
        .update({ is_active: false })
        .neq('id', id);
      // Activate this one
      const { data, error } = await supabase
        .from('bank_details')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank_details'] });
    },
  });
}
