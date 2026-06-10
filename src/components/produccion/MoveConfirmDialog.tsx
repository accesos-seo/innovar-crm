import * as React from 'react';
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
import { Loader2, AlertTriangle, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Recibe la nota opcional escrita por el usuario. */
  onConfirm: (note: string) => void;
  isLoading: boolean;
  projectName: string;
  toPhaseLabel: string;
  /** true si entrar a la fase destino dispara WhatsApp al cliente. */
  triggersWhatsApp: boolean;
}

/**
 * Confirmación obligatoria antes de mover una tarjeta del Kanban de planta:
 * varios triggers de prod sobre projects.status encolan WhatsApp al cliente.
 * Variante de ConfirmationDialog con campo de nota (va a project_status_history).
 */
export function MoveConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  projectName,
  toPhaseLabel,
  triggersWhatsApp,
}: MoveConfirmDialogProps) {
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (isOpen) setNote('');
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="bg-card border-border/10 sm:max-w-[440px] p-0 overflow-hidden gap-0">
        <div className={cn('h-1 w-full shrink-0', triggersWhatsApp ? 'bg-amber-500' : 'bg-primary')} />

        <div className="p-8 space-y-6">
          <DialogHeader className="space-y-4">
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mx-auto',
                triggersWhatsApp ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'
              )}
            >
              {triggersWhatsApp ? <MessageCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div className="space-y-2 text-center">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                Cambiar fase
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground">
                {triggersWhatsApp
                  ? `Esto actualizará «${projectName}» a «${toPhaseLabel}» y enviará una notificación de WhatsApp al cliente. ¿Continuar?`
                  : `Esto actualizará «${projectName}» a «${toPhaseLabel}». ¿Continuar?`}
              </DialogDescription>
            </div>
          </DialogHeader>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota opcional (queda en el historial de fases)"
            rows={2}
            maxLength={500}
            className="rounded-none border-border/50 text-sm resize-none"
          />

          <DialogFooter className="flex flex-col sm:flex-col gap-2 sm:space-x-0">
            <Button
              onClick={() => onConfirm(note)}
              disabled={isLoading}
              className={cn(
                'w-full h-12 font-bold uppercase text-xs tracking-widest rounded-none transition-colors duration-200',
                triggersWhatsApp
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Confirmar movimiento'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="w-full h-12 font-bold uppercase text-xs tracking-widest rounded-none text-muted-foreground hover:text-foreground hover:bg-muted/40"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
