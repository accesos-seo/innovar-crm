import * as React from "react";
import { ArrowRight, History } from "lucide-react";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import type { OpportunityFull } from "@/hooks/useOpportunity";

export function OpportunityTimeline({
  history,
}: {
  history: OpportunityFull["history"];
}) {
  if (!history?.length) {
    return (
      <div className="text-xs italic text-muted-foreground/60">
        {formatSentenceCase("Sin reasignaciones registradas todavía.")}
      </div>
    );
  }

  const sorted = [...history].sort(
    (a, b) =>
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );

  return (
    <ol className="space-y-4 border-l border-border/40 pl-4">
      {sorted.map((h) => {
        const fromLabel =
          h.from_profile?.full_name || h.from_profile?.email || "—";
        const toLabel = h.to_profile?.full_name || h.to_profile?.email || "—";
        return (
          <li key={h.id} className="relative">
            <span className="absolute -left-[18px] top-1 w-2 h-2 rounded-full bg-primary" />
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              {fromLabel === "—" ? (
                <span>{formatSentenceCase("Asignación inicial")}</span>
              ) : (
                <>
                  <span className="text-muted-foreground">{fromLabel}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                </>
              )}
              <span className="text-primary">{toLabel}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <History className="w-3 h-3" />
              <DateDisplay date={h.changed_at} showTime />
            </div>
            {h.reason && (
              <p className="mt-2 text-[11px] text-muted-foreground italic">
                "{h.reason}"
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
