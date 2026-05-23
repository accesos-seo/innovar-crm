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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-7 sm:p-9 text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
        <XCircle className="w-7 h-7 text-gray-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Propuesta cerrada</h2>
      <p className="text-sm text-gray-600 max-w-md mx-auto">
        Esta cotización quedó marcada como rechazada
        {rejectedDate ? <> el <strong>{rejectedDate}</strong></> : null}. Si querés que te
        preparemos una nueva propuesta, escribinos por WhatsApp.
      </p>
    </div>
  );
}
