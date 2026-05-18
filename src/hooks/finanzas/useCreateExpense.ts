import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError, notifyError, AppError } from "@/lib/errors";
import { expenseInsertSchema, type ExpenseInsert } from "@/schemas/expense";
import { toast } from "sonner";

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      expenseData,
      file,
    }: {
      expenseData: ExpenseInsert;
      file?: File;
    }) => {
      assertSupabase(supabase);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión para registrar gastos.");
      }

      // Validate user-provided data BEFORE we upload anything (avoid orphan files).
      const validated = expenseInsertSchema.parse(expenseData);

      let receiptUrl: string | null = null;
      if (file) {
        const path = `receipts/expenses/${Date.now()}_${file.name}`;
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
        .from("expenses")
        .insert({
          ...validated,
          registered_by: user.id,
          receipt_url: receiptUrl,
          approval_status: "pendiente",
        })
        .select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["project_balance"] });
      queryClient.invalidateQueries({ queryKey: ["financial_summary"] });
      toast.success("Gasto registrado correctamente");
    },
    onError: (error) => notifyError(error, "Error al registrar gasto"),
  });
}
