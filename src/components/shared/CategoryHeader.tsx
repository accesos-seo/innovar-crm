import * as React from "react";
import { LucideIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { formatSentenceCase } from "@/lib/format-utils";

import { StatusBadge } from "@/components/ui/status-badge";

import { PrimaryButton } from "@/components/shared/PrimaryButton";

interface CategoryHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onBack?: () => void;
  hideBack?: boolean;
  status?: {
    label: string;
    variant?: "success" | "info" | "warning" | "error" | "purple" | "primary";
    className?: string;
  };
  action?: {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    className?: string;
  };
  className?: string;
}

export const CategoryHeader = React.memo(function CategoryHeader({
  title,
  subtitle,
  icon: Icon,
  onBack,
  hideBack = false,
  status,
  action,
  className,
}: CategoryHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8", className)}>
      <div className="flex items-center gap-4">
        {!hideBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-10 w-10 rounded-sm border border-border/50 hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="p-3 bg-primary/10 rounded-sm border border-primary/20 shrink-0">
          <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {status && (
              <StatusBadge variant={status.variant || "primary"} dot animate="scale" className={status.className}>
                {status.label}
              </StatusBadge>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <PrimaryButton 
          label={action.label}
          icon={action.icon}
          onClick={action.onClick}
          className={action.className}
        />
      )}
    </div>
  );
});
