import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  HandCoins,
  FileText,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { DesignerPicker } from "@/components/finanzas/DesignerPicker";
import { useVerifyPayment } from "@/hooks/finanzas/useVerifyPayment";
import { useRejectPayment } from "@/hooks/finanzas/useRejectPayment";
import {
  PAYMENT_METHOD_LABELS_ES,
  PAYMENT_TYPE_LABELS_ES,
  paymentTypeSchema,
  type PaymentType,
} from "@/schemas/payment";
import { Payment } from "@/types/database";

interface PaymentVerifyModalProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatCurrency = (val?: number | null) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val ?? 0);

const isPdf = (url?: string | null) => !!url && /\.pdf(\?|$)/i.test(url);

export function PaymentVerifyModal({
  payment,
  isOpen,
  onClose,
}: PaymentVerifyModalProps) {
  const verify = useVerifyPayment();
  const reject = useRejectPayment();

  const [mode, setMode] = React.useState<"choose" | "reject">("choose");
  const [designerId, setDesignerId] = React.useState<string | null>(null);
  const [paymentType, setPaymentType] = React.useState<PaymentType>("advance");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (isOpen && payment) {
      setMode("choose");
      setDesignerId(null);
      setPaymentType(
        (payment.payment_type as PaymentType) ?? "advance"
      );
      setReason("");
    }
  }, [isOpen, payment?.id]);

  if (!payment) return null;

  const quotationTotal = payment.quotations?.total_amount ?? null;
  const belowSuggested =
    quotationTotal != null && payment.amount < quotationTotal * 0.3;

  const handleVerify = async () => {
    try {
      await verify.mutateAsync({
        payment_id: payment.id,
        designer_id: designerId,
        payment_type: paymentType,
      });
      onClose();
    } catch {
      // Toast handled in hook
    }
  };

  const handleReject = async () => {
    if (reason.trim().length < 10) return;
    try {
      await reject.mutateAsync({
        payment_id: payment.id,
        reason: reason.trim(),
      });
      onClose();
    } catch {
      // Toast handled in hook
    }
  };

  const isPending = verify.isPending || reject.isPending;

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && !isPending && onClose()}
      title="VERIFICAR COMPROBANTE"
      subtitle="FINANZAS > VERIFICACIÓN DE PAGO"
      icon={HandCoins}
      status={{
        label: mode === "reject" ? "Modo rechazo" : "Por verificar",
        variant: mode === "reject" ? "error" : "warning",
      }}
      footer={
        mode === "choose" ? (
          <div className="flex gap-4 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("reject")}
              disabled={isPending}
              className="flex-1 h-14 rounded-none border-destructive/40 text-destructive text-[10px] font-black uppercase tracking-[0.2em] hover:bg-destructive/10 transition-all"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rechazar con motivo
            </Button>
            <Button
              type="button"
              onClick={handleVerify}
              disabled={isPending}
              className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
            >
              {verify.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Verificar y crear proyecto
            </Button>
          </div>
        ) : (
          <div className="flex gap-4 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("choose")}
              disabled={isPending}
              className="flex-1 h-14 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em]"
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || reason.trim().length < 10}
              className="flex-1 h-14 rounded-none text-[10px] font-black uppercase tracking-[0.2em]"
            >
              {reject.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar rechazo
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-8">
        {/* Datos del pago */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-6 border border-border/10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Cliente
            </p>
            <p className="text-base font-bold text-foreground mt-1">
              {payment.clients?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Cotización
            </p>
            <p className="text-base font-bold text-foreground mt-1">
              {payment.quotations?.quotation_number ??
                payment.quotation_id?.split("-")[0]?.toUpperCase() ??
                "—"}
              {quotationTotal != null && (
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  ({formatCurrency(quotationTotal)})
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Monto reportado
            </p>
            <p className="text-2xl font-black text-primary mt-1">
              {formatCurrency(payment.amount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Método
            </p>
            <p className="text-base font-bold text-foreground mt-1">
              {PAYMENT_METHOD_LABELS_ES[
                payment.payment_method as keyof typeof PAYMENT_METHOD_LABELS_ES
              ] ?? payment.payment_method}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Recibido
            </p>
            <p className="text-base font-bold text-foreground mt-1">
              {payment.received_at
                ? format(parseISO(payment.received_at), "d MMM yyyy", {
                    locale: es,
                  })
                : "—"}
            </p>
          </div>
          {payment.notes && (
            <div className="md:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Notas del cliente
              </p>
              <p className="text-sm text-foreground/90 mt-1 leading-relaxed">
                {payment.notes}
              </p>
            </div>
          )}
        </div>

        {/* Aviso monto bajo */}
        {belowSuggested && (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/30 rounded-sm">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-200/80 font-medium">
              El monto es menor al 30% sugerido del total cotizado. Verificá
              que sea un anticipo válido antes de aprobar.
            </p>
          </div>
        )}

        {/* Preview comprobante */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">
                Comprobante
              </h3>
            </div>
            {payment.receipt_url && (
              <a
                href={payment.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="bg-muted/5 border border-border/10 p-2 min-h-[240px] flex items-center justify-center">
            {!payment.receipt_url ? (
              <p className="text-xs text-muted-foreground italic">
                Sin comprobante adjunto.
              </p>
            ) : isPdf(payment.receipt_url) ? (
              <iframe
                src={payment.receipt_url}
                className="w-full h-[400px] bg-white"
                title="Comprobante PDF"
              />
            ) : (
              <img
                src={payment.receipt_url}
                alt="Comprobante de pago"
                className="max-h-[400px] object-contain"
              />
            )}
          </div>
        </div>

        {mode === "choose" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-6 border border-border/10">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Tipo de pago <span className="text-primary">*</span>
              </label>
              <Select
                value={paymentType}
                onValueChange={(v) => {
                  if (v === null) return;
                  setPaymentType(v as PaymentType);
                }}
              >
                <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                  <SelectValue>
                    {PAYMENT_TYPE_LABELS_ES[paymentType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  {paymentTypeSchema.options.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PAYMENT_TYPE_LABELS_ES[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Diseñador asignado
              </label>
              <DesignerPicker value={designerId} onChange={setDesignerId} />
              <p className="text-[10px] text-muted-foreground italic">
                Si elegís "Asignar después" se crea el proyecto sin diseñador.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-destructive pl-4">
              <XCircle className="w-4 h-4 text-destructive" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">
                Motivo de rechazo
              </h3>
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mínimo 10 caracteres. El cliente recibirá este motivo por WhatsApp."
              className="bg-background border-border/50 min-h-[140px] rounded-none focus-visible:ring-destructive font-medium resize-none p-4"
              maxLength={2000}
            />
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{reason.trim().length} / 2000</span>
              <Badge
                variant="outline"
                className={
                  reason.trim().length >= 10
                    ? "border-emerald-500/50 text-emerald-400"
                    : "border-yellow-500/50 text-yellow-400"
                }
              >
                {reason.trim().length >= 10
                  ? "Listo para enviar"
                  : "Falta detalle"}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </DetailModal>
  );
}
