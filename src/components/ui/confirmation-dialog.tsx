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

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "destructive",
}: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border/10 sm:max-w-[400px] p-0 overflow-hidden gap-0">
        <div className={cn(
          "h-1 w-full shrink-0",
          variant === "destructive" ? "bg-destructive/50" : "bg-primary/50"
        )} />
        
        <div className="p-8 space-y-6">
          <DialogHeader className="space-y-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
              variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
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
              variant={variant}
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                "w-full h-12 font-bold uppercase text-xs tracking-widest rounded-none transition-all duration-300",
                variant === "destructive" ? "hover:bg-destructive/90" : "hover:bg-primary/90"
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
              className="w-full h-12 font-bold uppercase text-xs tracking-widest rounded-none text-muted-foreground hover:text-foreground"
            >
              {cancelText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
