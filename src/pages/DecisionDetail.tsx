import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardCheck, CheckCircle2, Info, Save, Loader2 } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/components/ui/PremiumToast";
import { formatSentenceCase } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import {
  useDecisionQuestionnaire,
  useSaveDecisionAnswer,
  type DecisionQuestion,
} from "@/hooks/useDecisiones";

function QuestionCard({ question, index }: { question: DecisionQuestion; index: number }) {
  const saveAnswer = useSaveDecisionAnswer();
  const [draft, setDraft] = React.useState(question.answer ?? "");

  // El draft solo se re-inicializa al cambiar de pregunta; tras guardar,
  // question.answer pasa a igualar el draft y isDirty vuelve a false solo.
  const isDirty = draft !== (question.answer ?? "");
  React.useEffect(() => {
    setDraft(question.answer ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const isAnswered = !!question.answer && question.answer.trim() !== "";

  const handleSave = async () => {
    try {
      await saveAnswer.mutateAsync({ questionId: question.id, answer: draft });
      notify.success(formatSentenceCase("Respuesta guardada"), formatSentenceCase("Su respuesta quedó registrada."));
    } catch {
      /* notifyError ya corre en el hook */
    }
  };

  return (
    <div
      className={cn(
        "bg-card border rounded-sm p-6 space-y-4 transition-colors",
        isAnswered ? "border-emerald-500/30" : "border-border/10"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "shrink-0 w-8 h-8 rounded-sm flex items-center justify-center text-xs font-black",
            isAnswered ? "bg-emerald-950/40 text-emerald-400" : "bg-primary/10 text-primary"
          )}
        >
          {isAnswered ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
        </div>
        <div className="space-y-2 flex-1">
          <p className="text-sm font-bold leading-relaxed">{question.question}</p>
          {question.why_matters && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
              {question.why_matters}
            </p>
          )}
        </div>
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Escriba su respuesta con el detalle que usa en el día a día..."
        className="min-h-28 rounded-none border-border/50 bg-background text-sm leading-relaxed focus-visible:ring-primary"
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {isAnswered
            ? `Respondida${question.answered_at ? ` · ${new Date(question.answered_at).toLocaleDateString("es-CO")}` : ""}`
            : "Sin responder"}
        </span>
        <Button
          onClick={handleSave}
          disabled={saveAnswer.isPending || !isDirty}
          className="h-10 rounded-none font-bold uppercase text-[10px] tracking-widest gap-2"
        >
          {saveAnswer.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isAnswered ? "Actualizar respuesta" : "Guardar respuesta"}
        </Button>
      </div>
    </div>
  );
}

export default function DecisionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: questionnaire, isLoading } = useDecisionQuestionnaire(slug);

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <PremiumLoader text="Cargando cuestionario..." />
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-2xl font-bold">Cuestionario no encontrado</h2>
        <Button onClick={() => navigate("/decisiones")} className="rounded-none">
          Volver al Centro de Decisiones
        </Button>
      </div>
    );
  }

  const answered = questionnaire.questions.filter((q) => q.answer && q.answer.trim() !== "").length;
  const total = questionnaire.questions.length;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-20">
      <CategoryHeader
        title={questionnaire.title}
        subtitle={formatSentenceCase(`${answered} de ${total} preguntas respondidas — puede guardar cada respuesta por separado y volver cuando quiera.`)}
        icon={ClipboardCheck}
        onBack={() => navigate("/decisiones")}
      />

      {questionnaire.context && (
        <div className="bg-primary/5 border border-primary/20 rounded-sm p-6">
          <p className="text-sm text-foreground/90 leading-relaxed">{questionnaire.context}</p>
        </div>
      )}

      <div className="space-y-6">
        {questionnaire.questions.map((q, idx) => (
          <QuestionCard key={q.id} question={q} index={idx} />
        ))}
      </div>

      {answered === total && total > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-sm p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-200/90 leading-relaxed">
            Cuestionario completo. El equipo técnico tomará estas respuestas como base para construir la funcionalidad — gracias por el detalle.
          </p>
        </div>
      )}
    </div>
  );
}
