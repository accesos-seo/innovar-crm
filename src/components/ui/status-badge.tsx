import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-none px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md border transition-all duration-300",
  {
    variants: {
      variant: {
        primary: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]",
        success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]",
        warning: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]",
        error: "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]",
        info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)]",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]",
      },
      animate: {
        none: "",
        pulse: "animate-pulse",
        scale: "hover:scale-105 active:scale-95",
      }
    },
    defaultVariants: {
      variant: "primary",
      animate: "none",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
}

function StatusBadge({
  className,
  variant,
  animate,
  dot,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <div
      className={cn(statusBadgeVariants({ variant, animate }), className)}
      {...props}
    >
      {dot && (
        <span className={cn(
          "mr-2 h-1.5 w-1.5 rounded-full ring-2 ring-background",
          variant === "primary" && "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]",
          variant === "success" && "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
          variant === "warning" && "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
          variant === "error" && "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]",
          variant === "info" && "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
          variant === "purple" && "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]",
        )} />
      )}
      {children}
    </div>
  );
}

export { StatusBadge, statusBadgeVariants };
