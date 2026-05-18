import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError, notifyError, AppError } from "@/lib/errors";
import { paymentInsertSchema, type PaymentInsert } from "@/schemas/payment";
import { toast } from "sonner";

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      paymentData,
      file,
    }: {
      paymentData: PaymentInsert;
      file?: File;
    }) => {
      assertSupabase(supabase);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión para registrar pagos.");
      }

      // Validate user-provided data BEFORE we upload anything (avoid orphan files).
      const validated = paymentInsertSchema.parse(paymentData);

      let receiptUrl: string | null = null;
      if (file) {
        const path = `receipts/payments/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("task-attachments")
          .upload(path, file);
        if (uploadError) throw mapSupabaseError(uploadError);

        const {
          data: { publicUrl },
        } = supabase.storage.from("task-attachments").getPublicUrl(path);
        receiptUrl = publicUrl;
      }

      const { data, error } = await supabase
        .from("payments")
        .insert({
          ...validated,
          registered_by: user.id,
          receipt_url: receiptUrl,
        })
        .select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["project_balance"] });
      queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
      toast.success("Pago registrado correctamente");
    },
    onError: (error) => notifyError(error, "Error al registrar pago"),
  });
}
