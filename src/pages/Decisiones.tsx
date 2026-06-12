import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, CheckCircle2, Clock, CircleDashed, ChevronRight } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatSentenceCase } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { useDecisionQuestionnaires, type DecisionQuestionnaire } from "@/hooks/useDecisiones";

const STATUS_META: Record<DecisionQuestionnaire["status"], { label: string; icon: any; className: string }> = {
  pendiente: { label: "Pendiente", icon: CircleDashed, className: "text-muted-foreground bg-muted/30 border-border/30" },
  en_progreso: { label: "En progreso", icon: Clock, className: "text-amber-400 bg-amber-950/30 border-amber-500/40" },
  completado: { label: "Completado", icon: CheckCircle2, className: "text-emerald-400 bg-emerald-950/30 border-emerald-500/40" },
};

function answeredCount(q: DecisionQuestionnaire) {
  return q.questions.filter((x) => x.answer && x.answer.trim() !== "").length;
}

export default function DecisionesPage() {
  const navigate = useNavigate();
  const { data: questionnaires = [], isLoading } = useDecisionQuestionnaires();

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 pb-20">
      <CategoryHeader
        title={formatSentenceCase("CENTRO DE DECISIONES")}
        subtitle={formatSentenceCase("Sus respuestas definen lo que construiremos. El equipo técnico las lee directamente desde aquí — no hay respuestas incorrectas.")}
        icon={ClipboardCheck}
      />

      {isLoading ? (
        <div className="h-[40vh] flex items-center justify-center">
          <PremiumLoader text="Cargando cuestionarios..." />
        </div>
      ) : questionnaires.length === 0 ? (
        <EmptyState
          title="Sin cuestionarios activos"
          description="Cuando haya decisiones pendientes de su parte, aparecerán aquí."
          icon={ClipboardCheck}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {questionnaires.map((q) => {
            const meta = STATUS_META[q.status] ?? STATUS_META.pendiente;
            const answered = answeredCount(q);
            const total = q.questions.length;
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

            return (
              <button
                key={q.id}
                onClick={() => navigate(`/decisiones/${q.slug}`)}
                className="text-left bg-card border border-border/10 rounded-sm p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-black uppercase tracking-tight leading-snug">
                    {q.title}
                  </h3>
                  <span className={cn("shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-sm text-[10px] font-bold uppercase tracking-widest", meta.className)}>
                    <meta.icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>

                {q.context && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {q.context}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>{answered} de {total} respondidas</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", q.status === "completado" ? "bg-emerald-500" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-widest">
                  {q.status === "completado" ? "Revisar respuestas" : "Responder"}
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
