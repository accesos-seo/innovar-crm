import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HandCoins,
  Search,
  Loader2,
  CheckCircle2,
  Receipt,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";
import { DesignerPicker } from "@/components/finanzas/DesignerPicker";
import { useRegisterManualPayment } from "@/hooks/finanzas/useRegisterManualPayment";
import {
  PAYMENT_METHOD_LABELS_ES,
  PAYMENT_TYPE_LABELS_ES,
  paymentMethodSchema,
  paymentTypeSchema,
  type PaymentMethod,
  type PaymentType,
} from "@/schemas/payment";

interface QuotationOption {
  id: string;
  quotation_number: string | null;
  total_amount: number | null;
  status: string;
  client_name: string;
}

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ELIGIBLE_STATUSES = [
  "client_approved",
  "pending_payment_verification",
  "approved",
];

const formatCurrency = (val?: number | null) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val ?? 0);

function useEligibleQuotations(search: string) {
  return useQuery({
    queryKey: ["quotations", "manual_payment_eligible", search],
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<QuotationOption[]> => {
      assertSupabase(supabase);
      const term = `%${search.trim()}%`;
      const { data, error } = await supabase
        .from("quotations")
        .select(
          `id, quotation_number, total_amount, status,
           client:clients!quotations_client_id_fkey(name)`
        )
        .is("deleted_at", null)
        .in("status", ELIGIBLE_STATUSES)
        .or(
          `quotation_number.ilike.${term},client.name.ilike.${term}`
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw mapSupabaseError(error);
      return (data ?? []).map((q: any) => ({
        id: q.id,
        quotation_number: q.quotation_number ?? null,
        total_amount: q.total_amount ?? null,
        status: q.status,
        client_name: q.client?.name ?? "—",
      }));
    },
  });
}

export function ManualPaymentModal({
  isOpen,
  onClose,
}: ManualPaymentModalProps) {
  const register = useRegisterManualPayment();

  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<QuotationOption | null>(null);
  const [displayAmount, setDisplayAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod | "">("");
  const [paymentType, setPaymentType] = React.useState<PaymentType | "">("");
  const [designerId, setDesignerId] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSelected(null);
      setDisplayAmount("");
      setMethod("");
      setPaymentType("");
      setDesignerId(null);
      setNotes("");
    }
  }, [isOpen]);

  const { data: options = [], isLoading: searching } =
    useEligibleQuotations(search);

  const amount = parseFloat(displayAmount.replace(/[^0-9]/g, "")) || 0;
  const isFirstPayment = selected?.status !== "approved";

  const canSubmit =
    !!selected && amount > 0 && !!method && !!paymentType && !register.isPending;

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    try {
      await register.mutateAsync({
        quotation_id: selected.id,
        amount,
        payment_method: method as PaymentMethod,
        payment_type: paymentType as PaymentType,
        designer_id: isFirstPayment ? designerId : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch {
      // Toast handled in hook
    }
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && !register.isPending && onClose()}
      title="REGISTRAR PAGO MANUAL"
      subtitle="FINANZAS > PAGO RECIBIDO POR CANAL EXTERNO"
      icon={Receipt}
      footer={
        <div className="flex gap-4 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={register.isPending}
            className="flex-1 h-14 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            {register.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Registrar pago
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Quotation picker */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
            <Search className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">
              Cotización
            </h3>
          </div>

          {selected ? (
            <div className="bg-muted/5 p-6 border border-primary/30 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Seleccionada
                </p>
                <p className="text-base font-bold text-foreground">
                  {selected.quotation_number ??
                    selected.id.split("-")[0].toUpperCase()}{" "}
                  · {selected.client_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {formatCurrency(selected.total_amount)} · Estado:{" "}
                  {selected.status}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setSearch("");
                }}
                className="text-xs font-bold text-primary"
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por número o cliente (mínimo 2 caracteres)"
                  className="pl-10 bg-background border-border/50 h-12 rounded-none font-medium"
                />
              </div>
              {search.trim().length >= 2 && (
                <div className="border border-border/30 bg-card max-h-[240px] overflow-y-auto">
                  {searching ? (
                    <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                    </div>
                  ) : options.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground italic">
                      Sin resultados. Solo se listan cotizaciones aceptadas, en
                      verificación o ya aprobadas.
                    </div>
                  ) : (
                    options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelected(opt)}
                        className="w-full text-left px-4 py-3 border-b border-border/10 last:border-b-0 hover:bg-primary/5 transition-colors"
                      >
                        <p className="text-sm font-bold text-foreground">
                          {opt.quotation_number ??
                            opt.id.split("-")[0].toUpperCase()}{" "}
                          · {opt.client_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                          {formatCurrency(opt.total_amount)} · {opt.status}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Payment form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-6 border border-border/10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Monto (COP) <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">
                $
              </span>
              <Input
                type="text"
                value={displayAmount}
                onChange={(e) =>
                  setDisplayAmount(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
                className="pl-8 bg-background border-border/50 h-14 rounded-none focus-visible:ring-primary font-black text-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Método <span className="text-primary">*</span>
            </label>
            <Select
              value={method}
              onValueChange={(v) => {
                if (v === null) return;
                setMethod(v as PaymentMethod);
              }}
            >
              <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                <SelectValue placeholder="Seleccionar">
                  {method
                    ? PAYMENT_METHOD_LABELS_ES[method as PaymentMethod]
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                {paymentMethodSchema.options.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS_ES[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Tipo <span className="text-primary">*</span>
            </label>
            <Select
              value={paymentType}
              onValueChange={(v) => {
                if (v === null) return;
                setPaymentType(v as PaymentType);
              }}
            >
              <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                <SelectValue placeholder="Seleccionar">
                  {paymentType
                    ? PAYMENT_TYPE_LABELS_ES[paymentType as PaymentType]
                    : undefined}
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

          {isFirstPayment && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Diseñador (si crea proyecto)
              </label>
              <DesignerPicker
                value={designerId}
                onChange={setDesignerId}
              />
            </div>
          )}

          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Notas
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Canal externo, referencia bancaria, etc."
              className="bg-background border-border/50 min-h-[100px] rounded-none focus-visible:ring-primary font-medium resize-none p-4"
              maxLength={2000}
            />
          </div>
        </div>

        {selected?.total_amount != null && amount > selected.total_amount && (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/30 rounded-sm">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-200/80 font-medium">
              El monto registrado ({formatCurrency(amount)}) supera el total de
              la cotización ({formatCurrency(selected.total_amount)}). Confirmá
              antes de registrar.
            </p>
          </div>
        )}
      </div>
    </DetailModal>
  );
}
