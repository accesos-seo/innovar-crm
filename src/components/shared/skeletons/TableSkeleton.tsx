import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-3 bg-card rounded-sm border border-border/10 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-4 border-b border-border/10 bg-muted/20">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 bg-muted/50" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 px-4 py-4 border-b border-border/5 last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1 bg-muted/30"
              style={{ opacity: 1 - rowIndex * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
