import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmVariant = "destructive" | "warning" | "default";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  /**
   * Tono visual del confirm dialog:
   * - "destructive" (rojo): acciones IRREVERSIBLES (DELETE permanente, force-push).
   * - "warning" (ámbar):   acciones REVERSIBLES con impacto (archivar, suspender).
   * - "default" (verde):   acciones rutinarias positivas.
   *
   * Default cambió a "warning" porque casi todos los usos del diálogo son
   * archivar/desactivar (reversibles). Las acciones destructive reales son raras
   * y se piden explícitamente.
   */
  variant?: ConfirmVariant;
}

const VARIANT_STYLES: Record<ConfirmVariant, {
  bar: string;
  iconBg: string;
  iconColor: string;
  button: string;
}> = {
  destructive: {
    bar: "bg-red-500",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-400",
    button: "bg-red-500 text-white hover:bg-red-600",
  },
  warning: {
    bar: "bg-amber-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    button: "bg-amber-500 text-black hover:bg-amber-400",
  },
  default: {
    bar: "bg-primary",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    button: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "warning",
}: ConfirmationDialogProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border/10 sm:max-w-[400px] p-0 overflow-hidden gap-0">
        <div className={cn("h-1 w-full shrink-0", s.bar)} />

        <div className="p-8 space-y-6">
          <DialogHeader className="space-y-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
              s.iconBg, s.iconColor,
            )}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2 text-center">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-col gap-2 sm:space-x-0">
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "w-full h-12 font-bold uppercase text-xs tracking-widest rounded-none transition-colors duration-200",
                s.button,
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                confirmText
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full h-12 font-bold uppercase text-xs tracking-widest rounded-none text-muted-foreground hover:text-foreground hover:bg-muted/40"
            >
              {cancelText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
