import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Pencil, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          onClick={() => setOpen('accept')}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Aceptar propuesta
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="border-amber-500 text-amber-700 hover:bg-amber-50 font-semibold"
          onClick={() => setOpen('adjustments')}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Solicitar ajustes
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold"
          onClick={() => setOpen('reject')}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Rechazar
        </Button>
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aceptar esta cotización</DialogTitle>
          <DialogDescription>
            Confirmás que aceptás los términos y precios. Te llegará un WhatsApp con los
            datos bancarios para hacer el abono inicial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="accept-note">¿Querés dejar un comentario? (opcional)</Label>
            <Textarea
              id="accept-note"
              placeholder="Por ejemplo: «¿cuándo viene el diseñador?»"
              rows={3}
              {...register('note')}
            />
            {formState.errors.note && (
              <p className="mt-1 text-xs text-red-600">{formState.errors.note.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={accept.isPending}
            >
              {accept.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar aceptación'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar ajustes</DialogTitle>
          <DialogDescription>
            Contanos qué te gustaría cambiar. El asesor recibirá tu mensaje y te prepara una
            nueva versión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="adj-reason">¿Qué te gustaría ajustar?</Label>
            <Textarea
              id="adj-reason"
              placeholder="Por ejemplo: «Saquen el ítem de la isla. Necesito un descuento del 10%»"
              rows={5}
              {...register('reason')}
            />
            {formState.errors.reason && (
              <p className="mt-1 text-xs text-red-600">{formState.errors.reason.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={reject.isPending}
            >
              {reject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar ajustes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const { register, handleSubmit, formState, setValue, watch, reset } =
    useForm<RejectQuotationFormValues>({
      resolver: zodResolver(rejectQuotationSchema),
      defaultValues: { reason_code: 'price', reason_extra: '' },
    });
  const reasonCode = watch('reason_code');

  const onSubmit = async (values: RejectQuotationFormValues) => {
    const reasonLabel =
      REJECTION_REASONS.find((r) => r.value === values.reason_code)?.label ?? values.reason_code;
    const composedReason = [reasonLabel, values.reason_extra?.trim()]
      .filter(Boolean)
      .join(' — ');
    await reject.mutateAsync({
      token,
      subtype: 'declined',
      reason: composedReason,
    });
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar propuesta</DialogTitle>
          <DialogDescription>
            Elegí el motivo principal. Si querés, podés agregar un comentario.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Motivo</Label>
            <Select
              value={reasonCode}
              onValueChange={(v) =>
                setValue('reason_code', v as RejectQuotationFormValues['reason_code'], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('reason_code')} />
          </div>
          <div>
            <Label htmlFor="reject-extra">Comentario adicional (opcional)</Label>
            <Textarea id="reject-extra" rows={3} {...register('reason_extra')} />
            {formState.errors.reason_extra && (
              <p className="mt-1 text-xs text-red-600">
                {formState.errors.reason_extra.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={reject.isPending}
            >
              {reject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Rechazar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
