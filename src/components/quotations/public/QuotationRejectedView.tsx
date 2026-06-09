import { XCircle } from 'lucide-react';
import type { PublicQuotationData } from '@/hooks/quotations/usePublicQuotation';

interface Props {
  data: PublicQuotationData;
}

export function QuotationRejectedView({ data }: Props) {
  const rejectedDate = data.client_rejected_at
    ? new Date(data.client_rejected_at).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-muted/30 via-muted-foreground/40 to-muted/30" />

      <div className="px-6 sm:px-12 py-12 sm:py-16 flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-muted/20 border border-border/40 flex items-center justify-center">
          <XCircle className="w-7 h-7 text-muted-foreground/70" />
        </div>

        <div className="space-y-3 max-w-md">
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground/70">
            Propuesta cerrada
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Recibimos tu respuesta
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta propuesta quedó cerrada
            {rejectedDate ? (
              <>
                {' '}
                el <strong className="text-foreground">{rejectedDate}</strong>
              </>
            ) : null}
            . Si querés que te preparemos algo distinto, escribinos por WhatsApp y armamos
            una nueva propuesta a tu medida.
          </p>
        </div>
      </div>
    </div>
  );
}
