import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, minutesToHours } from "@/lib/horas/calc";
import type { MonthSummary } from "@/lib/horas/types";

interface ProgressHeroProps {
  summary: MonthSummary;
  accumulatedMinutes: number;
  monthLabel: string;
}

export function ProgressHero({ summary, accumulatedMinutes, monthLabel }: ProgressHeroProps) {
  const netH = minutesToHours(summary.netMinutes);
  const targetH = minutesToHours(summary.targetMinutes);
  const pct = summary.targetMinutes > 0 ? Math.min(100, (summary.netMinutes / summary.targetMinutes) * 100) : 0;
  const reached = summary.targetMinutes > 0 && summary.netMinutes >= summary.targetMinutes;
  const neutral = accumulatedMinutes === 0;
  const favor = accumulatedMinutes > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Barra del mes */}
      <div className="lg:col-span-2 border border-border/50 bg-card p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Horas del período — {monthLabel}
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight text-foreground">
              {netH.toLocaleString("es", { maximumFractionDigits: 1 })}
              {summary.hasTarget ? (
                <span className="text-muted-foreground/50 text-xl"> / {targetH} h</span>
              ) : (
                <span className="text-muted-foreground/50 text-xl"> h</span>
              )}
            </p>
          </div>
          {summary.hasTarget ? (
            <span className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 border",
              reached
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : "text-primary border-primary/30 bg-primary/10"
            )}>
              {reached ? "Objetivo cumplido ✓" : `${Math.round(pct)}%`}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 border text-muted-foreground/60 border-border/50">
              Histórico informativo
            </span>
          )}
        </div>

        {summary.hasTarget ? (
          <div className="h-4 w-full bg-muted/40 overflow-hidden">
            <div
              className={cn("h-full transition-all duration-700", reached ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : (
          <div className="h-4 w-full bg-muted/20" />
        )}

        {summary.hasTarget && (
          <p className="mt-3 text-xs text-muted-foreground/70">
            Resultado del mes:{" "}
            <span className={cn("font-bold", summary.resultMinutes >= 0 ? "text-emerald-400" : "text-red-400")}>
              {summary.resultMinutes >= 0 ? "+" : ""}
              {formatMinutes(summary.resultMinutes)}
            </span>{" "}
            sobre el objetivo.
          </p>
        )}
      </div>

      {/* Saldo acumulado */}
      <div className={cn(
        "border p-6 flex flex-col justify-between",
        neutral
          ? "border-border/50 bg-card"
          : favor
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/30 bg-red-500/5"
      )}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            Saldo acumulado
          </p>
          {neutral ? (
            <Minus className="w-4 h-4 text-muted-foreground/60" />
          ) : favor ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
        </div>
        <p className={cn(
          "mt-2 text-3xl font-black tracking-tight",
          neutral ? "text-foreground" : favor ? "text-emerald-400" : "text-red-400"
        )}>
          {formatMinutes(accumulatedMinutes)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          {neutral
            ? "Al día: sin horas arrastradas de períodos anteriores."
            : favor
            ? "Horas trabajadas de más en períodos anteriores."
            : "Horas pendientes de períodos anteriores."}{" "}
          {!neutral && "Solo cuenta períodos ya cerrados."}
        </p>
      </div>
    </div>
  );
}
