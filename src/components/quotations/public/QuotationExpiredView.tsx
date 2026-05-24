import { Clock, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRequestReactivation } from '@/hooks/quotations/useRequestReactivation';

interface Props {
  token: string;
}

export function QuotationExpiredView({ token }: Props) {
  const req = useRequestReactivation();

  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-orange-500/20 via-orange-500 to-orange-500/20" />

      <div className="px-6 sm:px-12 py-12 sm:py-16 flex flex-col items-center text-center space-y-7">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
          <Clock className="w-8 h-8 text-orange-400" />
        </div>

        <div className="space-y-3 max-w-md">
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-orange-400/80">
            Cotización vencida
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Esta propuesta ya expiró
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los precios y materiales pueden haber cambiado. Pedinos una nueva propuesta
            actualizada y un asesor te contacta hoy mismo.
          </p>
        </div>

        {req.isSuccess ? (
          <div className="flex items-center gap-2 px-5 py-3 border border-primary/40 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            <span>Pedido enviado · te contactamos pronto</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => req.mutate({ token })}
            disabled={req.isPending}
            className={cn(
              'h-14 px-8 relative overflow-hidden group/btn transition-all duration-500',
              'bg-orange-500 text-black font-black text-xs uppercase tracking-[0.3em]',
              'hover:bg-orange-400 disabled:bg-muted disabled:text-muted-foreground',
              'rounded-sm shadow-lg shadow-orange-500/20 active:scale-[0.98]',
            )}
          >
            <div className="relative z-10 flex items-center justify-center gap-2">
              {req.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Solicitar nueva cotización
                </>
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
