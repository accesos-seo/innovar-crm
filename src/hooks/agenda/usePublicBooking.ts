import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface BookingContext {
  opportunity_id: string;
  client_name: string;
  client_phone: string | null;
  staff_id: string | null;
  staff_name: string | null;
  expires_at: string | null;
}

export interface PublicSlot {
  slot_start: string;
  is_available: boolean;
}

export interface BookPublicVisitResult {
  visit_id: string;
  scheduled_at: string;
  staff_name: string | null;
  client_name: string;
}

// 0. Resuelve un short_code (URL corta /v/:code) a su public_token (32 chars).
//    Devuelve null si el código no existe, expiró, o la opp ya no es agendable.
export function useResolveShortCode(code: string | undefined) {
  return useQuery({
    queryKey: ['public-resolve-short', code],
    enabled: !!code,
    staleTime: 1000 * 60 * 5,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('resolve_short_code', { p_code: code });
      if (error) throw mapSupabaseError(error);
      return (data as string | null) ?? null;
    },
  });
}

// 1. Contexto del booking (cliente + comercial asignado) desde un token público.
//    Se ejecuta sin auth — la RPC valida el token y la expiración internamente.
export function useBookingContext(token: string | undefined) {
  return useQuery({
    queryKey: ['public-booking-context', token],
    enabled: !!token,
    staleTime: 1000 * 60,
    retry: false,
    queryFn: async (): Promise<BookingContext | null> => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('get_public_booking_context', { p_token: token });
      if (error) throw mapSupabaseError(error);
      const row = Array.isArray(data) ? data[0] : data;
      return (row as BookingContext) ?? null;
    },
  });
}

// 2. Slots disponibles para el rango from-to, ya filtrados por holidays
//    y por las visitas existentes del comercial asignado al token.
export function usePublicVisitSlots(token: string | undefined, from: string | undefined, to: string | undefined) {
  return useQuery({
    queryKey: ['public-visit-slots', token, from, to],
    enabled: !!token && !!from && !!to,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<PublicSlot[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('get_public_visit_slots', {
        p_token: token,
        p_from: from,
        p_to: to,
      });
      if (error) throw mapSupabaseError(error);
      return (data ?? []) as PublicSlot[];
    },
  });
}

// 3. Mutation que agenda la visita desde el flujo público.
export function useBookPublicVisit() {
  return useMutation({
    mutationFn: async (input: { token: string; scheduledAt: string }): Promise<BookPublicVisitResult> => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('book_public_visit', {
        p_token: input.token,
        p_scheduled_at: input.scheduledAt,
      });
      if (error) throw mapSupabaseError(error);
      return data as BookPublicVisitResult;
    },
  });
}
