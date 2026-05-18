import React from "react";
import { CardSkeleton } from "./CardSkeleton";
import { cn } from "@/lib/utils";

export function MetricGridSkeleton({ count = 4 }: { count?: number }) {
  const gridCols = count === 3 ? "lg:grid-cols-3" : count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-2";
  
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 w-full", gridCols)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
