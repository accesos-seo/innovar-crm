import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertTriangle } from 'lucide-react';
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
import { useUnlockQuotation } from '@/hooks/quotations/useUnlockQuotation';
import {
  unlockQuotationSchema,
  type UnlockQuotationFormValues,
} from '@/lib/schemas/quotation-public';

interface Props {
  open: boolean;
  onClose: () => void;
  quotationId: string;
}

export function UnlockQuotationModal({ open, onClose, quotationId }: Props) {
  const unlock = useUnlockQuotation();
  const { register, handleSubmit, formState, reset } = useForm<UnlockQuotationFormValues>({
    resolver: zodResolver(unlockQuotationSchema),
    defaultValues: { change_reason: '' },
  });

  const onSubmit = async (values: UnlockQuotationFormValues) => {
    await unlock.mutateAsync({
      quotationId,
      changeReason: values.change_reason,
    });
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desbloquear cotización</DialogTitle>
          <DialogDescription>
            Estás por habilitar la edición de una cotización que el cliente ya recibió.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2 text-amber-900 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <p>
            El cambio queda registrado en el log de auditoría con tu nombre y el motivo
            que escribas debajo.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="change_reason">¿Por qué desbloqueás?</Label>
            <Textarea
              id="change_reason"
              placeholder="Por ejemplo: «El cliente pidió cambiar un material por chat — armo V2 con la corrección»"
              rows={3}
              {...register('change_reason')}
            />
            {formState.errors.change_reason && (
              <p className="mt-1 text-xs text-red-600">
                {formState.errors.change_reason.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="default"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={unlock.isPending}
            >
              {unlock.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Desbloqueando...
                </>
              ) : (
                'Desbloquear'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
