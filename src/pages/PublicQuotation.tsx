import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import {
  usePublicQuotation,
  isRedirectResponse,
  isErrorResponse,
  isQuotationData,
} from '@/hooks/quotations/usePublicQuotation';
import { useFeatureFlag } from '@/hooks/settings/useFeatureFlag';
import { useSetting } from '@/hooks/settings/useSystemSettings';
import { PremiumLoader } from '@/components/shared/PremiumLoader';
import { PublicLayout } from '@/components/quotations/public/PublicLayout';
import { QuotationPublicView } from '@/components/quotations/public/QuotationPublicView';
import { QuotationActionButtons } from '@/components/quotations/public/QuotationActionButtons';
import { QuotationVersionsDiff } from '@/components/quotations/public/QuotationVersionsDiff';
import { QuotationExpiredView } from '@/components/quotations/public/QuotationExpiredView';
import { QuotationRedirectView } from '@/components/quotations/public/QuotationRedirectView';
import { QuotationRejectedView } from '@/components/quotations/public/QuotationRejectedView';
import { BankDetailsCard, type BankDetails } from '@/components/quotations/public/BankDetailsCard';
import { PaymentProofUploader } from '@/components/quotations/public/PaymentProofUploader';
import NotFoundPage from '@/pages/NotFound';

export default function PublicQuotation() {
  const { token } = useParams<{ token: string }>();
  const slice3 = useFeatureFlag('slice_3_enabled');
  const { data: bankDetails, isLoading: bankDetailsLoading } = useSetting<BankDetails>(
    'bank_block'
  );
  const { data: suggestedMinPct } = useSetting<number>('suggested_min_advance_pct');

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
        <div className="bg-card border border-border/40 rounded-sm p-16 flex flex-col items-center gap-4 shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
            Cargando tu propuesta...
          </span>
        </div>
      </PublicLayout>
    );
  }

  if (isError) {
    return (
      <PublicLayout>
        <ErrorCard
          message={error instanceof Error ? error.message : 'No pudimos cargar la propuesta.'}
        />
      </PublicLayout>
    );
  }

  if (isErrorResponse(data)) {
    return (
      <PublicLayout>
        <ErrorCard message="No encontramos esta propuesta. Verificá el link." />
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

  if (data.is_expired) {
    return (
      <PublicLayout>
        <QuotationExpiredView token={token} />
      </PublicLayout>
    );
  }

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

      {data.status === 'sent' && <QuotationActionButtons token={token} />}

      {data.status === 'client_approved' &&
        (slice3 ? (
          <div className="space-y-6">
            {bankDetailsLoading ? (
              <div className="h-32 flex items-center justify-center">
                <PremiumLoader size="md" text="Cargando datos de pago" />
              </div>
            ) : (
              <>
                <BankDetailsCard details={bankDetails ?? {}} isLoading={false} />
                <PaymentProofUploader
                  token={token}
                  quotationId={data.id}
                  quotationTotal={data.total_amount ?? 0}
                  suggestedMinAdvancePct={
                    typeof suggestedMinPct === 'number' ? suggestedMinPct : 30
                  }
                />
              </>
            )}
          </div>
        ) : (
          <PendingPaymentNotice />
        ))}

      {data.status === 'pending_payment_verification' && <UnderReviewNotice />}

      {data.status === 'approved' && <ApprovedNotice />}
    </PublicLayout>
  );
}

function StatusCard({
  tone,
  icon,
  eyebrow,
  title,
  body,
}: {
  tone: 'primary' | 'blue' | 'success';
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
}) {
  const accent =
    tone === 'primary'
      ? 'via-primary/80'
      : tone === 'blue'
      ? 'via-blue-400/80'
      : 'via-emerald-400/80';

  const iconBg =
    tone === 'primary'
      ? 'bg-primary/10 border-primary/30 text-primary'
      : tone === 'blue'
      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className={`h-1 w-full bg-gradient-to-r from-transparent ${accent} to-transparent`} />
      <div className="px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-start gap-5">
        <div
          className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="space-y-2 min-w-0">
          <span className={`block text-[10px] font-black uppercase tracking-[0.35em] ${
            tone === 'primary'
              ? 'text-primary/80'
              : tone === 'blue'
              ? 'text-blue-400/80'
              : 'text-emerald-400/80'
          }`}>
            {eyebrow}
          </span>
          <h3 className="font-heading text-xl font-black tracking-tight text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

function PendingPaymentNotice() {
  return (
    <StatusCard
      tone="primary"
      icon={<CheckCircle2 className="w-6 h-6" />}
      eyebrow="Propuesta aceptada"
      title="¡Recibimos tu confirmación!"
      body="Te enviamos un WhatsApp con los datos bancarios para el abono inicial. Cuando estés listo vas a poder subir el comprobante acá mismo."
    />
  );
}

function UnderReviewNotice() {
  return (
    <StatusCard
      tone="blue"
      icon={<Clock className="w-6 h-6" />}
      eyebrow="Pago en revisión"
      title="Estamos verificando tu comprobante"
      body="Recibimos tu pago y nuestro equipo lo está revisando. Apenas lo confirmemos te contactamos para arrancar con el diseño."
    />
  );
}

function ApprovedNotice() {
  return (
    <StatusCard
      tone="success"
      icon={<Sparkles className="w-6 h-6" />}
      eyebrow="Proyecto activo"
      title="¡Tu cocina arrancó!"
      body="Pago confirmado. En las próximas horas un diseñador toma tu proyecto y empezamos con el primer borrador."
    />
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-card border border-red-500/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-red-600/20 via-red-500 to-red-600/20" />
      <div className="px-6 sm:px-10 py-10 flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div className="space-y-2 max-w-md">
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-red-400/80">
            No pudimos abrirla
          </span>
          <h2 className="font-heading text-xl font-black tracking-tight text-foreground">
            Algo salió mal
          </h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
