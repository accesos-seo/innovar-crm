import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="rounded-sm border border-border/10 bg-card p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-1/3 bg-muted/50" />
        <Skeleton className="h-4 w-4 rounded-full bg-muted/50" />
      </div>
      <Skeleton className="h-8 w-1/2 bg-muted/50" />
      <Skeleton className="h-3 w-2/3 bg-muted/30" />
    </div>
  );
}
