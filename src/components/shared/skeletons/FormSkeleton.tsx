import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6 bg-card p-8 rounded-sm border border-border/10">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24 bg-muted/50" />
          <Skeleton className="h-10 w-full bg-muted/30 rounded-none" />
        </div>
      ))}
      <div className="pt-4">
        <Skeleton className="h-12 w-full bg-primary/20 rounded-none" />
      </div>
    </div>
  );
}
