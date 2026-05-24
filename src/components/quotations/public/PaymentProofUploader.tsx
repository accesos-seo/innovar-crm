import * as React from 'react';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { useSubmitPaymentProof } from '@/hooks/finanzas/useSubmitPaymentProof';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clientFacingPaymentMethodSchema,
  PAYMENT_METHOD_LABELS_ES,
  type PaymentMethod,
  type SubmitPaymentProofInput,
} from '@/schemas/payment';
import { cn } from '@/lib/utils';

interface PaymentProofUploaderProps {
  token: string;
  quotationId: string;
  quotationTotal: number;
  suggestedMinAdvancePct?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function PaymentProofUploader({
  token,
  quotationId,
  quotationTotal,
  suggestedMinAdvancePct = 30,
}: PaymentProofUploaderProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<SubmitPaymentProofInput['payment_method'] | ''>('');
  const [notes, setNotes] = React.useState('');
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);

  const mutation = useSubmitPaymentProof();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFileError(null);

    if (f.size > 5 * 1024 * 1024) {
      setFileError('El archivo no puede superar 5 MB.');
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError('Solo aceptamos JPG, PNG, WEBP o PDF.');
      setFile(null);
      return;
    }

    setFile(f);
  };

  const suggestedMin = Math.ceil((quotationTotal * suggestedMinAdvancePct) / 100);
  const numAmount = amount ? parseFloat(amount) : 0;
  const isBelowSuggested = numAmount > 0 && numAmount < suggestedMin;

  const isValid =
    file &&
    amount &&
    method &&
    numAmount > 0 &&
    numAmount <= quotationTotal &&
    !fileError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !file) return;

    mutation.mutate({
      token,
      quotationId,
      file,
      amount: numAmount,
      payment_method: method as SubmitPaymentProofInput['payment_method'],
      notes: notes || null,
    });
  };

  const displayMethods = clientFacingPaymentMethodSchema.options;

  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

      <form onSubmit={handleSubmit} className="px-6 sm:px-10 py-8 space-y-6">
        <div>
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-primary/80 mb-2">
            Subir Comprobante de Pago
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Comparte una imagen o PDF del comprobante de tu transferencia.
          </p>
        </div>

        {/* File Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Comprobante (JPG, PNG, WEBP o PDF)
          </label>
          <div className="relative">
            <input
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileSelect}
              disabled={mutation.isPending}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div
              className={cn(
                'border-2 border-dashed rounded-sm p-6 flex flex-col items-center justify-center gap-3 transition-all',
                file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border/40 bg-background/50 hover:border-primary/50'
              )}
            >
              {file ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">
                      Arrastra o haz clic
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Máx 5 MB
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          {fileError && (
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-xs">{fileError}</span>
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Monto
            </label>
            <span className="text-[10px] text-muted-foreground">
              Máx: ${quotationTotal.toLocaleString('es-CO')}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
              $
            </span>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={mutation.isPending}
              step="0.01"
              min="0"
              max={quotationTotal}
              className="bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-medium pl-8"
            />
          </div>
          {isBelowSuggested && (
            <p className="text-[10px] text-amber-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Por debajo del anticipo sugerido (${suggestedMin.toLocaleString('es-CO')})
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Método de Pago
          </label>
          <Select value={method} onValueChange={(v) => setMethod(v as SubmitPaymentProofInput['payment_method'])}>
            <SelectTrigger
              disabled={mutation.isPending}
              className="rounded-none border-border/50 font-medium h-10"
            >
              <SelectValue placeholder="Seleccionar método" />
            </SelectTrigger>
            <SelectContent>
              {displayMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS_ES[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Notas (opcional)
          </label>
          <textarea
            placeholder="Ej: Transferencia enviada desde otro banco"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={mutation.isPending}
            maxLength={2000}
            className="w-full h-24 bg-background border border-border/50 rounded-none p-3 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {notes.length} / 2000
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-border/10 flex gap-3">
          <Button
            type="submit"
            disabled={!isValid || mutation.isPending}
            className="flex-1 h-12 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Enviar Comprobante
              </>
            )}
          </Button>
        </div>

        {mutation.isError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-sm text-red-400 text-xs">
            {mutation.error?.message || 'Error al enviar el comprobante'}
          </div>
        )}
      </form>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}
