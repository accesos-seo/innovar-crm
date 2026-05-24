import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Pencil,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAcceptQuotation } from '@/hooks/quotations/useAcceptQuotation';
import { useRejectQuotation } from '@/hooks/quotations/useRejectQuotation';
import {
  acceptQuotationSchema,
  type AcceptQuotationFormValues,
  rejectQuotationSchema,
  type RejectQuotationFormValues,
  requestAdjustmentsSchema,
  type RequestAdjustmentsFormValues,
  REJECTION_REASONS,
} from '@/lib/schemas/quotation-public';

interface Props {
  token: string;
}

type OpenModal = null | 'accept' | 'adjustments' | 'reject';

export function QuotationActionButtons({ token }: Props) {
  const [open, setOpen] = useState<OpenModal>(null);

  return (
    <>
      <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
        <div className="h-[2px] w-full bg-gradient-to-r from-primary/20 via-primary/80 to-primary/20" />
        <div className="px-6 sm:px-10 py-7">
          <h2 className="text-[10px] font-black uppercase tracking-[0.35em] text-primary/80 mb-1">
            Tu decisión
          </h2>
          <p className="text-sm text-muted-foreground/80 mb-6">
            Cuando estés listo, elegí una opción. Recibimos tu respuesta al instante.
          </p>

          <PrimaryAction onClick={() => setOpen('accept')} />

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SecondaryAction
              tone="warning"
              icon={<Pencil className="w-3.5 h-3.5" />}
              label="Solicitar ajustes"
              onClick={() => setOpen('adjustments')}
            />
            <SecondaryAction
              tone="muted"
              icon={<XCircle className="w-3.5 h-3.5" />}
              label="Rechazar"
              onClick={() => setOpen('reject')}
            />
          </div>
        </div>
      </div>

      <AcceptModal open={open === 'accept'} onClose={() => setOpen(null)} token={token} />
      <AdjustmentsModal
        open={open === 'adjustments'}
        onClose={() => setOpen(null)}
        token={token}
      />
      <RejectModal open={open === 'reject'} onClose={() => setOpen(null)} token={token} />
    </>
  );
}

function PrimaryAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full h-14 relative overflow-hidden group/btn transition-all duration-500',
        'bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em]',
        'hover:bg-primary/90 rounded-sm shadow-lg shadow-primary/20 active:scale-[0.98]',
      )}
    >
      <div className="relative z-10 flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Aceptar propuesta
        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

function SecondaryAction({
  tone,
  icon,
  label,
  onClick,
}: {
  tone: 'warning' | 'muted';
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-12 px-4 flex items-center justify-center gap-2 border transition-all',
        'text-[11px] font-black uppercase tracking-[0.2em] rounded-sm',
        tone === 'warning'
          ? 'border-amber-500/40 text-amber-300/90 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60'
          : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 hover:bg-muted/20',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell común — grande, con header + cuerpo + footer separados
// ─────────────────────────────────────────────────────────────────────────────

function PremiumModalShell({
  open,
  onClose,
  eyebrow,
  title,
  description,
  accent,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description: string;
  accent: 'primary' | 'amber' | 'destructive';
  children: React.ReactNode;
}) {
  const accentClass =
    accent === 'primary'
      ? 'via-primary/80'
      : accent === 'amber'
      ? 'via-amber-400/80'
      : 'via-red-500/80';
  const eyebrowClass =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'amber'
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[92vw] sm:max-w-2xl p-0 overflow-hidden gap-0 bg-card border-border/40">
        {/* Top accent */}
        <div
          className={`h-1 w-full bg-gradient-to-r from-transparent ${accentClass} to-transparent`}
        />

        {/* Header — bien espaciado */}
        <DialogHeader className="px-7 sm:px-10 pt-8 pb-2 space-y-3 text-left">
          <span
            className={`text-[10px] font-black uppercase tracking-[0.35em] ${eyebrowClass}`}
          >
            {eyebrow}
          </span>
          <DialogTitle className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Cuerpo */}
        <div className="px-7 sm:px-10 py-7">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function ModalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7 pt-6 border-t border-border/20 flex flex-col sm:flex-row gap-3 justify-end">
      {children}
    </div>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 px-5 text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
    >
      Cancelar
    </button>
  );
}

function SubmitButton({
  pending,
  pendingLabel,
  label,
  tone,
}: {
  pending: boolean;
  pendingLabel: string;
  label: string;
  tone: 'primary' | 'amber' | 'destructive';
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
      : tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-500/90 text-black shadow-amber-500/20'
      : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20';
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'h-11 px-7 rounded-sm text-xs font-black uppercase tracking-[0.25em] transition-all',
        'flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]',
        toneClass,
        'disabled:opacity-60 disabled:cursor-not-allowed',
      )}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/80">
        {children}
      </span>
      {required && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/80">
          Obligatorio
        </span>
      )}
    </div>
  );
}

const TEXTAREA_CLS =
  'w-full rounded-sm border border-border/40 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none transition-colors';

// ─────────────────────────────────────────────────────────────────────────────
// Modal: ACEPTAR
// ─────────────────────────────────────────────────────────────────────────────

function AcceptModal({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
}) {
  const accept = useAcceptQuotation();
  const { register, handleSubmit, formState, reset } = useForm<AcceptQuotationFormValues>({
    resolver: zodResolver(acceptQuotationSchema),
    defaultValues: { note: '' },
  });

  const onSubmit = async (values: AcceptQuotationFormValues) => {
    await accept.mutateAsync({ token, note: values.note });
    reset();
    onClose();
  };

  return (
    <PremiumModalShell
      open={open}
      onClose={onClose}
      eyebrow="Confirmar aceptación"
      title="Aceptar esta propuesta"
      description="Confirmás los términos y el alcance. Te llegará un WhatsApp con los datos bancarios para el abono inicial."
      accent="primary"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <FieldLabel>¿Querés dejar un comentario para el equipo?</FieldLabel>
          <Textarea
            placeholder="Ejemplo: «¿Cuándo viene el diseñador a hacer las medidas finales?»"
            rows={4}
            className={TEXTAREA_CLS}
            {...register('note')}
          />
          {formState.errors.note && (
            <p className="mt-2 text-xs text-red-400">{formState.errors.note.message}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground/60">
            Es opcional. Si lo dejás vacío, igual avanza el proceso.
          </p>
        </div>

        <ModalFooter>
          <CancelButton onClick={onClose} />
          <SubmitButton
            pending={accept.isPending}
            pendingLabel="Confirmando..."
            label="Sí, acepto la propuesta"
            tone="primary"
          />
        </ModalFooter>
      </form>
    </PremiumModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: SOLICITAR AJUSTES
// ─────────────────────────────────────────────────────────────────────────────

function AdjustmentsModal({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
}) {
  const reject = useRejectQuotation();
  const { register, handleSubmit, formState, reset } = useForm<RequestAdjustmentsFormValues>({
    resolver: zodResolver(requestAdjustmentsSchema),
    defaultValues: { reason: '' },
  });

  const onSubmit = async (values: RequestAdjustmentsFormValues) => {
    await reject.mutateAsync({
      token,
      subtype: 'adjustments_requested',
      reason: values.reason,
    });
    reset();
    onClose();
  };

  return (
    <PremiumModalShell
      open={open}
      onClose={onClose}
      eyebrow="Pedir nueva versión"
      title="Solicitar ajustes"
      description="Contanos qué te gustaría cambiar. Tu asesor recibe tu mensaje y prepara una nueva versión basada en tu feedback."
      accent="amber"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <FieldLabel required>¿Qué te gustaría ajustar?</FieldLabel>
          <Textarea
            placeholder="Ejemplo: «Saquen la isla central, no la voy a usar. Necesito que apliquen un descuento del 10% sobre el subtotal.»"
            rows={6}
            className={TEXTAREA_CLS}
            {...register('reason')}
          />
          {formState.errors.reason && (
            <p className="mt-2 text-xs text-red-400">{formState.errors.reason.message}</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground/60">
            Sé específico: ítems, precios, plazos, materiales. Mientras más detalle, mejor la
            próxima versión.
          </p>
        </div>

        <ModalFooter>
          <CancelButton onClick={onClose} />
          <SubmitButton
            pending={reject.isPending}
            pendingLabel="Enviando..."
            label="Enviar mis ajustes"
            tone="amber"
          />
        </ModalFooter>
      </form>
    </PremiumModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: RECHAZAR — incluye reason picker custom (no Radix Select, full control)
// ─────────────────────────────────────────────────────────────────────────────

function RejectModal({
  open,
  onClose,
  token,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
}) {
  const reject = useRejectQuotation();
  const [reasonOpen, setReasonOpen] = useState(false);
  const { register, handleSubmit, formState, setValue, watch, reset } =
    useForm<RejectQuotationFormValues>({
      resolver: zodResolver(rejectQuotationSchema),
      defaultValues: { reason_code: 'price', reason_extra: '' },
    });
  const reasonCode = watch('reason_code');
  const selectedReason = REJECTION_REASONS.find((r) => r.value === reasonCode);

  const onSubmit = async (values: RejectQuotationFormValues) => {
    const reasonLabel =
      REJECTION_REASONS.find((r) => r.value === values.reason_code)?.label ??
      values.reason_code;
    const composedReason = [reasonLabel, values.reason_extra?.trim()]
      .filter(Boolean)
      .join(' — ');
    await reject.mutateAsync({
      token,
      subtype: 'declined',
      reason: composedReason,
    });
    setReasonOpen(false);
    reset();
    onClose();
  };

  return (
    <PremiumModalShell
      open={open}
      onClose={() => {
        setReasonOpen(false);
        onClose();
      }}
      eyebrow="No vamos a avanzar"
      title="Rechazar propuesta"
      description="Elegí el motivo principal. Tu respuesta nos ayuda a mejorar futuras propuestas."
      accent="destructive"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Reason picker custom (más legible que Radix Select) */}
        <div>
          <FieldLabel required>Motivo principal</FieldLabel>
          <div className="relative">
            <button
              type="button"
              onClick={() => setReasonOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 h-12 px-4 rounded-sm border border-border/40 bg-background/60 text-left transition-colors hover:border-border/70 focus-visible:outline-none focus-visible:border-primary/50"
            >
              <span className="text-sm font-medium text-foreground">
                {selectedReason?.label ?? 'Elegí un motivo'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  reasonOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {reasonOpen && (
              <ul
                className="absolute z-50 left-0 right-0 mt-1 rounded-sm border border-border/40 bg-card shadow-xl overflow-hidden"
                role="listbox"
              >
                {REJECTION_REASONS.map((r) => (
                  <li key={r.value}>
                    <button
                      type="button"
                      onClick={() => {
                        setValue('reason_code', r.value, { shouldValidate: true });
                        setReasonOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm transition-colors',
                        r.value === reasonCode
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-foreground hover:bg-muted/30',
                      )}
                      role="option"
                      aria-selected={r.value === reasonCode}
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input type="hidden" {...register('reason_code')} />
        </div>

        <div>
          <FieldLabel>Comentario adicional</FieldLabel>
          <Textarea
            placeholder="Ejemplo: «Encontré otra opción más cerca de mi presupuesto.» (opcional)"
            rows={4}
            className={TEXTAREA_CLS}
            {...register('reason_extra')}
          />
          {formState.errors.reason_extra && (
            <p className="mt-2 text-xs text-red-400">
              {formState.errors.reason_extra.message}
            </p>
          )}
        </div>

        <ModalFooter>
          <CancelButton
            onClick={() => {
              setReasonOpen(false);
              onClose();
            }}
          />
          <SubmitButton
            pending={reject.isPending}
            pendingLabel="Enviando..."
            label="Rechazar propuesta"
            tone="destructive"
          />
        </ModalFooter>
      </form>
    </PremiumModalShell>
  );
}
