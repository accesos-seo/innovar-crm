import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";

/**
 * Centro de Decisiones (migración 057): cuestionarios que la gerencia responde
 * dentro del CRM. Las respuestas quedan en la DB para que el equipo técnico
 * construya los PRDs sobre ellas. Solo admin/super_admin (RLS).
 */

export interface DecisionQuestion {
  id: string;
  questionnaire_id: string;
  position: number;
  question: string;
  why_matters: string | null;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
}

export interface DecisionQuestionnaire {
  id: string;
  slug: string;
  title: string;
  context: string | null;
  status: "pendiente" | "en_progreso" | "completado";
  created_at: string;
  completed_at: string | null;
  questions: DecisionQuestion[];
}

const KEY = "decision-questionnaires";

export function useDecisionQuestionnaires() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async (): Promise<DecisionQuestionnaire[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("decision_questionnaires")
        .select("*, questions:decision_questions(id, questionnaire_id, position, question, why_matters, answer, answered_at, answered_by)")
        .order("created_at", { ascending: true });
      if (error) throw mapSupabaseError(error);
      return (data ?? []).map((q: any) => ({
        ...q,
        questions: [...(q.questions ?? [])].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

export function useDecisionQuestionnaire(slug: string | undefined) {
  return useQuery({
    queryKey: [KEY, slug],
    enabled: !!slug,
    queryFn: async (): Promise<DecisionQuestionnaire | null> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("decision_questionnaires")
        .select("*, questions:decision_questions(id, questionnaire_id, position, question, why_matters, answer, answered_at, answered_by)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      return {
        ...data,
        questions: [...(data.questions ?? [])].sort((a: any, b: any) => a.position - b.position),
      };
    },
  });
}

export function useSaveDecisionAnswer() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      assertSupabase(supabase);
      const trimmed = answer.trim();
      const { data, error } = await supabase
        .from("decision_questions")
        .update({
          answer: trimmed || null,
          answered_at: trimmed ? new Date().toISOString() : null,
          answered_by: trimmed ? user?.id ?? null : null,
        })
        .eq("id", questionId)
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
    onError: (error) => notifyError(error, "Error al guardar la respuesta"),
  });
}
