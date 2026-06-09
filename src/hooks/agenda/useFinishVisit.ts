import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';
import {
  visitMeasurementsV1Schema,
  type VisitMeasurementsV1,
} from '@/lib/schemas/visit-measurements';

interface FinishVisitInput {
  visitId: string;
  measurements: VisitMeasurementsV1;
  /** Lista final de paths en el bucket `visit_photos`. Ya subidos previamente
   *  por `VisitPhotoUploader`. Mínimo 3 (enforced por trigger DB). */
  photoPaths: string[];
  notes?: string;
}

/**
 * Cierra una visita técnica:
 *   1. Valida measurements con Zod.
 *   2. UPDATE visits SET status='realizada', measurements, photos, notes, realized_at.
 *
 * Triggers en cadena (intactos):
 *   - validate_visit_completion → exige photos.length>=3 + measurements no vacío
 *   - visit_to_task_mirror (UPDATE) → tasks.status='completado'
 *   - trg_visit_auto_quotation → crea cotización draft + mueve opp a 'quoted'
 *   - notify_visit_summary_client (S5) → encola template visit_summary_client_v1
 */
export function useFinishVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, measurements, photoPaths, notes }: FinishVisitInput) => {
      assertSupabase(supabase);

      const parsed = visitMeasurementsV1Schema.parse(measurements);

      if (photoPaths.length < 3) {
        throw new Error('Se requieren al menos 3 fotos para finalizar la visita');
      }

      const { data, error } = await supabase
        .from('visits')
        .update({
          status: 'realizada',
          measurements: parsed,
          photos: photoPaths,
          notes: notes ?? null,
          realized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', visitId)
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      toast.success('Visita finalizada', {
        description: 'Se generó el borrador de cotización automáticamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['myVisitsToday'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
    onError: (error) => notifyError(error, 'No se pudo finalizar la visita'),
  });
}
