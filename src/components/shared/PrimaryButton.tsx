import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function PrimaryButton({
  label,
  icon: Icon,
  className,
  loading,
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <Button 
      className={cn(
        "bg-gradient-to-r from-primary to-primary-dark",
        "hover:from-primary-dark hover:to-primary",
        "px-8 py-6 text-sm font-bold",
        "text-primary-foreground shadow-lg shadow-primary/20",
        "rounded-md transition-all duration-300",
        "active:scale-95 hover:-translate-y-0.5",
        "border-none flex items-center gap-3",
        className
      )}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5" />}
          {formatSentenceCase(label)}
        </>
      )}
    </Button>
  );
}
