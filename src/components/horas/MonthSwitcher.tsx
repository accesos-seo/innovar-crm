import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthSwitcherProps {
  label: string;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthSwitcher({ label, canGoNext, onPrev, onNext }: MonthSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 border border-border/50 bg-card">
      <button
        type="button"
        onClick={onPrev}
        className="p-2 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Período anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="min-w-[190px] text-center text-sm font-bold tracking-tight text-foreground select-none">
        {label}
      </span>
      <button
        type="button"
        onClick={() => canGoNext && onNext()}
        disabled={!canGoNext}
        className={cn(
          "p-2 transition-colors",
          !canGoNext
            ? "text-muted-foreground/20 cursor-not-allowed"
            : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
        )}
        aria-label="Período siguiente"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
