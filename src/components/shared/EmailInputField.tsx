import * as React from "react";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { formatSentenceCase } from "@/lib/format-utils";

// 1. Esquema de Validación Global (Zod)
export const emailSchema = z.string().email("Correo electrónico inválido");

// 2. Componente Reutilizable
export const EmailInputField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">
            {label}
          </label>
        )}
        <div className="relative group">
          <Mail className={cn(
            "absolute left-3 top-2.5 w-4 h-4 transition-colors",
            error ? "text-rose-500" : "text-zinc-600 group-focus-within:text-primary"
          )} />
          <Input
            ref={ref}
            type="email"
            placeholder="ejemplo@correo.com"
            className={cn(
              "pl-10 h-10 bg-zinc-950/50 border-zinc-800 focus:border-primary/50 transition-all rounded-none",
              error && "border-rose-500/50 focus:border-rose-500 focus:ring-rose-500/20",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-[10px] font-bold text-rose-500 uppercase ml-1 animate-in fade-in slide-in-from-top-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);

EmailInputField.displayName = "EmailInputField";
