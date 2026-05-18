import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface SortIconProps {
  columnKey: string;
  currentSort: SortConfig;
  className?: string;
}

export function SortIcon({ columnKey, currentSort, className }: SortIconProps) {
  const isActive = currentSort.key === columnKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <div className={cn("flex items-center justify-center transition-colors", className)}>
      {direction === "asc" ? (
        <ChevronUp className="w-3 h-3 text-primary animate-in fade-in zoom-in duration-200" />
      ) : direction === "desc" ? (
        <ChevronDown className="w-3 h-3 text-primary animate-in fade-in zoom-in duration-200" />
      ) : (
        <ChevronsUpDown className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      )}
    </div>
  );
}
