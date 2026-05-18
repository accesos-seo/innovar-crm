import * as React from "react";
import { LucideIcon } from "lucide-react";
import { PrimaryButton } from "./PrimaryButton";
import { formatSentenceCase } from "@/lib/format-utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6 w-full max-w-lg mx-auto text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <Icon className="w-20 h-20 text-primary relative z-10 opacity-80" strokeWidth={1} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold tracking-tight text-foreground">
          {formatSentenceCase(title)}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {formatSentenceCase(description)}
        </p>
      </div>
      {action && (
        <PrimaryButton 
          label={action.label}
          icon={action.icon}
          onClick={action.onClick}
        />
      )}
    </div>
  );
}
