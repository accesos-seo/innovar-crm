import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  newToken: string;
}

const AUTO_REDIRECT_SECONDS = 4;

export function QuotationRedirectView({ newToken }: Props) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          navigate(`/cotizacion/${newToken}`, { replace: true });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [newToken, navigate]);

  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-primary/80 to-primary/20" />

      <div className="px-6 sm:px-12 py-12 sm:py-16 flex flex-col items-center text-center space-y-7">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <RefreshCw className="w-7 h-7 text-primary animate-spin-slow" />
        </div>

        <div className="space-y-3 max-w-md">
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-primary/80">
            Versión actualizada
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Hay una propuesta más reciente
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu asesor preparó una nueva versión basada en tu feedback. Te llevamos a la
            vigente en <strong className="text-primary">{secondsLeft}s</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/cotizacion/${newToken}`, { replace: true })}
          className={cn(
            'h-14 px-8 relative overflow-hidden group/btn transition-all duration-500',
            'bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em]',
            'hover:bg-primary/90 rounded-sm shadow-lg shadow-primary/20 active:scale-[0.98]',
          )}
        >
          <div className="relative z-10 flex items-center justify-center gap-2">
            Ir a la versión vigente
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>
    </div>
  );
}
