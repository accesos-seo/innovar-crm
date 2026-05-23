import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import {
  usePublicQuotation,
  isRedirectResponse,
  isErrorResponse,
  isQuotationData,
} from '@/hooks/quotations/usePublicQuotation';
import { PublicLayout } from '@/components/quotations/public/PublicLayout';
import { QuotationPublicView } from '@/components/quotations/public/QuotationPublicView';
import { QuotationActionButtons } from '@/components/quotations/public/QuotationActionButtons';
import { QuotationVersionsDiff } from '@/components/quotations/public/QuotationVersionsDiff';
import { QuotationExpiredView } from '@/components/quotations/public/QuotationExpiredView';
import { QuotationRedirectView } from '@/components/quotations/public/QuotationRedirectView';
import { QuotationRejectedView } from '@/components/quotations/public/QuotationRejectedView';
import NotFoundPage from '@/pages/NotFound';

export default function PublicQuotation() {
  const { token } = useParams<{ token: string }>();

  // Feature flag — si está OFF, la ruta no existe.
  if (!FEATURES.phase4QuotationPublicEnabled) {
    return <NotFoundPage />;
  }

  if (!token) {
    return (
      <PublicLayout>
        <ErrorCard message="Falta el código de la cotización en el link." />
      </PublicLayout>
    );
  }

  const { data, isLoading, isError, error } = usePublicQuotation(token);

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-widest">
            Cargando cotización...
          </span>
        </div>
      </PublicLayout>
    );
  }

  if (isError) {
    return (
      <PublicLayout>
        <ErrorCard
          message={error instanceof Error ? error.message : 'No pudimos cargar la cotización.'}
        />
      </PublicLayout>
    );
  }

  if (isErrorResponse(data)) {
    return (
      <PublicLayout>
        <ErrorCard message="No encontramos esta cotización. Verificá el link." />
      </PublicLayout>
    );
  }

  if (isRedirectResponse(data)) {
    return (
      <PublicLayout>
        <QuotationRedirectView newToken={data.redirect_to_token} />
      </PublicLayout>
    );
  }

  if (!isQuotationData(data)) {
    return (
      <PublicLayout>
        <ErrorCard message="La respuesta del servidor no tiene el formato esperado." />
      </PublicLayout>
    );
  }

  // Cotización vencida (por valid_until pasado o status='expired')
  if (data.is_expired) {
    return (
      <PublicLayout>
        <QuotationExpiredView token={token} />
      </PublicLayout>
    );
  }

  // Rechazada → vista cerrada (read-only)
  if (data.status === 'rejected') {
    return (
      <PublicLayout>
        <QuotationRejectedView data={data} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <QuotationPublicView data={data} />

      {(data.version_number ?? 1) > 1 && (
        <QuotationVersionsDiff currentQuotationId={data.id} />
      )}

      {data.status === 'sent' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 sm:p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-700">
            ¿Qué te parece?
          </h2>
          <QuotationActionButtons token={token} />
        </div>
      )}

      {/* Slice 3 agregará aquí QuotationPaymentSection cuando status ∈ {client_approved, pending_payment_verification} */}
      {data.status === 'client_approved' && (
        <PendingPaymentNotice />
      )}

      {data.status === 'pending_payment_verification' && (
        <UnderReviewNotice />
      )}

      {/* Slice 5 agregará QuotationApprovedView con botón de PDF */}
      {data.status === 'approved' && <ApprovedNotice />}
    </PublicLayout>
  );
}

function PendingPaymentNotice() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-emerald-900">
      <h3 className="text-sm font-bold mb-1">¡Aceptaste la propuesta!</h3>
      <p className="text-sm">
        Te enviamos un WhatsApp con los datos bancarios para hacer el abono inicial.
        Cuando estés listo, vas a poder subir el comprobante acá mismo.
      </p>
    </div>
  );
}

function UnderReviewNotice() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-blue-900">
      <h3 className="text-sm font-bold mb-1">Comprobante en revisión</h3>
      <p className="text-sm">
        Recibimos tu pago. Nuestro equipo lo está verificando — apenas confirmemos te
        contactamos para arrancar con el diseño.
      </p>
    </div>
  );
}

function ApprovedNotice() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-emerald-900">
      <h3 className="text-sm font-bold mb-1">¡Tu proyecto arrancó!</h3>
      <p className="text-sm">
        Pago confirmado. En las próximas horas un diseñador toma tu proyecto y empezamos
        con el primer borrador.
      </p>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-lg border border-red-200 shadow-sm p-7 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">No pudimos abrir la cotización</h2>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
