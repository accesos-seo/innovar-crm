import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, XCircle } from "lucide-react";
import { useCancelQuotationAcceptance } from "@/hooks/quotations/useCancelQuotationAcceptance";

interface QuotationCancelModalProps {
  quotationId: string;
  isOpen: boolean;
  onClose: () => void;
}

const MIN_REASON = 10;
const MAX_REASON = 2000;

/**
 * Modal admin para cancelar una cotización ya aceptada por el cliente.
 * Pide un motivo (10-2000 chars) y llama `cancel_quotation_acceptance`.
 */
export function QuotationCancelModal({
  quotationId,
  isOpen,
  onClose,
}: QuotationCancelModalProps) {
  const cancel = useCancelQuotationAcceptance();
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) setReason("");
  }, [isOpen]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON;

  const handleConfirm = async () => {
    if (!valid) return;
    try {
      await cancel.mutateAsync({
        quotation_id: quotationId,
        reason: trimmed,
      });
      onClose();
    } catch {
      // Toast handled in hook
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !cancel.isPending && onClose()}
    >
      <DialogContent className="max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Cancelar aceptación de cotización
          </DialogTitle>
          <DialogDescription className="text-xs">
            La oportunidad vuelve a estado <strong>perdida</strong>, el enlace
            público se invalida y le avisamos al cliente por WhatsApp con tu
            motivo. Esta acción es reversible (podés reactivar después).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Motivo (mínimo {MIN_REASON} caracteres)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: el cliente pidió pausar el proyecto por motivos personales..."
            maxLength={MAX_REASON}
            className="min-h-[140px] bg-background border-border/50 rounded-none focus-visible:ring-destructive font-medium resize-none p-4"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>
              {trimmed.length} / {MAX_REASON}
            </span>
            <span
              className={valid ? "text-emerald-400" : "text-yellow-400"}
            >
              {valid ? "Listo" : `Faltan ${MIN_REASON - trimmed.length}`}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={cancel.isPending}
            className="rounded-none"
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!valid || cancel.isPending}
            className="rounded-none"
          >
            {cancel.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            Confirmar cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
