import * as React from 'react';
import { useIsFetching } from '@tanstack/react-query';

/**
 * Muestra un banner de "Conectando con Innovar..." durante el cold start de Supabase.
 * Aparece después de 2 segundos de carga activa y desaparece automáticamente.
 */
export function ConnectionBanner() {
  const isFetching = useIsFetching();
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (isFetching > 0) {
      // Solo muestra el banner si la carga dura más de 2 segundos
      timerRef.current = setTimeout(() => setVisible(true), 2000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isFetching]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 bg-card border border-primary/20 shadow-2xl px-5 py-3 rounded-full">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
        </span>
        <p className="text-sm font-semibold text-foreground tracking-tight">
          Conectando con Innovar
          <span className="text-muted-foreground font-normal"> — espera un momento...</span>
        </p>
      </div>
    </div>
  );
}
