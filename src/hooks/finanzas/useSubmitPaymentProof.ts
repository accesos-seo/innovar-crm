import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError, AppError } from '@/lib/errors';
import {
  submitPaymentProofSchema,
  type SubmitPaymentProofInput,
} from '@/schemas/payment';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export interface UseSubmitPaymentProofVars extends SubmitPaymentProofInput {
  /** Token público de la cotización (resuelto vía /c/<short_code> → token UUID). */
  token: string;
  /** ID de la cotización — requerido para construir el path del bucket. */
  quotationId: string;
  /** Archivo a subir (imagen o PDF, ≤5MB). */
  file: File;
}

export interface SubmitPaymentProofResult {
  ok: boolean;
  payment_id: string;
  quotation_status: string;
  below_suggested: boolean;
}

/**
 * Public mutation — el cliente sube comprobante desde /c/<code>.
 * Pasos: validar → subir a `payment-receipts/<quotation_id>/<file>` →
 * llamar RPC `submit_quotation_payment_proof` con el path.
 *
 * Si la RPC falla DESPUÉS del upload, intenta borrar el objeto huérfano
 * (best-effort; el cron de cleanup también lo barre eventualmente).
 */
export function useSubmitPaymentProof() {
  const qc = useQueryClient();
  return useMutation<SubmitPaymentProofResult, Error, UseSubmitPaymentProofVars>({
    mutationFn: async ({ token, quotationId, file, amount, payment_method, notes }) => {
      assertSupabase(supabase);

      if (file.size > MAX_BYTES) {
        throw new AppError('VALIDATION', 'El archivo supera el máximo de 5 MB.');
      }
      if (!ALLOWED_MIME.has(file.type)) {
        throw new AppError(
          'VALIDATION',
          'Solo aceptamos imágenes (JPG/PNG/WEBP) o PDF.'
        );
      }

      const payload = submitPaymentProofSchema.parse({ amount, payment_method, notes });

      const ext = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
      const objectPath = `${quotationId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('payment-receipts')
        .upload(objectPath, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw mapSupabaseError(uploadErr);

      const { data, error } = await supabase.rpc('submit_quotation_payment_proof', {
        p_token: token,
        p_amount: payload.amount,
        p_method: payload.payment_method,
        p_proof_url: objectPath,
        p_notes: payload.notes ?? null,
      });

      if (error) {
        // Compensar el upload huérfano. No bloqueante si falla.
        await supabase.storage.from('payment-receipts').remove([objectPath]).catch(() => {});
        throw mapSupabaseError(error);
      }

      return data as SubmitPaymentProofResult;
    },
    onSuccess: (_, { token }) => {
      qc.invalidateQueries({ queryKey: ['public-quotation', token] });
      toast.success('Comprobante enviado', {
        description: 'Nuestro equipo lo verificará pronto.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos enviar el comprobante', { description: err.message });
    },
  });
}
