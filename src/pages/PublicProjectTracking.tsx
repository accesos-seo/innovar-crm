import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  Check,
  Hammer,
  RefreshCw,
  X,
} from 'lucide-react';
import { FEATURES } from '@/lib/features';
import {
  usePublicProjectTracking,
  TrackingNotFoundError,
  type TrackingPhoto,
} from '@/hooks/usePublicProjectTracking';
import { PremiumLoader } from '@/components/shared/PremiumLoader';
import { PublicLayout } from '@/components/quotations/public/PublicLayout';
import NotFoundPage from '@/pages/NotFound';

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const WORK_TYPE_LABELS: Record<string, string> = {
  cocina: 'Cocina',
  closet: 'Closet',
  puertas: 'Puertas',
  centro_tv: 'Centro de TV',
  otro: 'Proyecto',
};

const STAGE_LABELS: Record<string, string> = {
  diseno: 'Diseño',
  produccion: 'Producción',
  final: 'Final',
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PublicProjectTracking() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    usePublicProjectTracking(token);

  if (!FEATURES.clientPortalEnabled) {
    return <NotFoundPage />;
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="bg-card border border-border/40 rounded-sm p-16 flex flex-col items-center gap-4">
          <PremiumLoader size="md" text="Cargando tu proyecto" />
        </div>
      </PublicLayout>
    );
  }

  const notFound =
    !token || (isError && error instanceof TrackingNotFoundError);

  if (notFound) {
    return (
      <PublicLayout>
        <FriendlyNotFound />
      </PublicLayout>
    );
  }

  if (isError || !data) {
    return (
      <PublicLayout>
        <div className="bg-card border border-border/40 rounded-sm px-6 py-12 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-muted-foreground max-w-sm">
            No pudimos cargar tu proyecto. Revisa tu conexión e intenta de nuevo.
          </p>
          <button
            onClick={() => refetch()}
            className="h-14 px-8 inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-sm rounded-sm hover:opacity-90 transition-opacity"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Reintentar
          </button>
        </div>
      </PublicLayout>
    );
  }

  const doneCount = data.timeline.filter((p) => p.state === 'done').length;
  const currentPhase = data.timeline.find((p) => p.state === 'current');
  const progressPct = Math.round(
    ((doneCount + (currentPhase ? 0.5 : 0)) / data.timeline.length) * 100,
  );
  const workLabel = WORK_TYPE_LABELS[data.project.work_type] ?? 'Proyecto';
  const installDate = formatDate(data.installation.scheduled_at);
  const estimatedDate = formatDate(data.installation.estimated_date);

  return (
    <PublicLayout>
      {/* 1 — Hero: fase actual + avance */}
      <section className="bg-card border border-border/40 rounded-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
        <div className="px-6 sm:px-10 py-8 space-y-5">
          <div className="space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-primary/80">
              Hola {data.project.client_first_name} · Tu {workLabel.toLowerCase()}
            </span>
            <h1 className="font-heading text-2xl font-black tracking-tight text-foreground">
              {data.project.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {currentPhase
                ? <>Fase actual: <span className="text-foreground font-semibold">{currentPhase.label}</span></>
                : doneCount === data.timeline.length
                  ? 'Tu proyecto fue entregado. ¡Gracias por confiar en Innovar!'
                  : 'Tu proyecto está en preparación.'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              <span>Avance</span>
              <span className="text-primary">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2 — Timeline vertical */}
      <section className="bg-card border border-border/40 rounded-sm px-6 sm:px-10 py-8">
        <SectionTitle>Línea de tiempo</SectionTitle>
        <ol className="mt-6 space-y-0">
          {data.timeline.map((phase, i) => {
            const isLast = i === data.timeline.length - 1;
            const date = formatDate(phase.reached_at);
            return (
              <li key={phase.key} className="relative flex gap-4 pb-7 last:pb-0">
                {!isLast && (
                  <span
                    className={`absolute left-[15px] top-8 bottom-0 w-px ${
                      phase.state === 'done' ? 'bg-primary/50' : 'bg-border/40'
                    }`}
                  />
                )}
                <span
                  className={`relative z-10 mt-0.5 w-8 h-8 shrink-0 rounded-full border flex items-center justify-center ${
                    phase.state === 'done'
                      ? 'bg-primary/15 border-primary/50 text-primary'
                      : phase.state === 'current'
                        ? 'bg-primary text-primary-foreground border-primary animate-pulse'
                        : 'bg-background border-border/50 text-muted-foreground/40'
                  }`}
                >
                  {phase.state === 'done' ? (
                    <Check className="w-4 h-4" />
                  ) : phase.state === 'current' ? (
                    <Hammer className="w-4 h-4" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </span>
                <div className="min-w-0 pt-1">
                  <p
                    className={`text-sm font-bold ${
                      phase.state === 'pending' ? 'text-muted-foreground/50' : 'text-foreground'
                    }`}
                  >
                    {phase.label}
                  </p>
                  {date && phase.state !== 'pending' && (
                    <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                  )}
                  {phase.state === 'current' && (
                    <p className="text-xs text-primary mt-0.5 font-semibold">En este momento</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 3 — Galería de fotos por etapa */}
      {data.photos.length > 0 && <PhotoGallery photos={data.photos} />}

      {/* 4 — Pagos */}
      {data.payments.total > 0 && (
        <section className="bg-card border border-border/40 rounded-sm px-6 sm:px-10 py-8 space-y-4">
          <SectionTitle icon={<Banknote className="w-4 h-4 text-primary/70" />}>
            Resumen de pagos
          </SectionTitle>
          <dl className="space-y-3 text-sm">
            <PaymentRow label="Valor total" value={COP.format(data.payments.total)} />
            <PaymentRow label="Abonado" value={COP.format(data.payments.advance_paid)} />
            <div className="border-t border-border/30 pt-3">
              {data.payments.is_fully_paid ? (
                <p className="flex items-center gap-2 text-primary font-bold">
                  <Check className="w-4 h-4" /> Proyecto pagado en su totalidad
                </p>
              ) : (
                <PaymentRow
                  label="Saldo pendiente"
                  value={COP.format(data.payments.balance_due)}
                  strong
                />
              )}
            </div>
          </dl>
        </section>
      )}

      {/* 5 — Instalación */}
      {(installDate || estimatedDate) && (
        <section className="bg-card border border-border/40 rounded-sm px-6 sm:px-10 py-8 space-y-3">
          <SectionTitle icon={<CalendarDays className="w-4 h-4 text-primary/70" />}>
            Instalación
          </SectionTitle>
          <p className="text-sm text-muted-foreground">
            {installDate ? (
              <>
                Fecha agendada:{' '}
                <span className="text-foreground font-bold">{installDate}</span>
                {data.installation.duration_days
                  ? ` · ${data.installation.duration_days} día${data.installation.duration_days > 1 ? 's' : ''} estimado${data.installation.duration_days > 1 ? 's' : ''}`
                  : null}
              </>
            ) : (
              <>
                Fecha estimada:{' '}
                <span className="text-foreground font-bold">{estimatedDate}</span> (por confirmar)
              </>
            )}
          </p>
        </section>
      )}

      {/* 6 — FAB WhatsApp */}
      {data.contact.whatsapp_url && (
        <a
          href={data.contact.whatsapp_url}
          target="_blank"
          rel="noreferrer"
          aria-label={data.contact.label}
          className="fixed bottom-5 right-5 z-50 h-14 px-5 inline-flex items-center gap-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:scale-[1.03] transition-transform"
        >
          <WhatsAppGlyph />
          {data.contact.label}
        </a>
      )}
    </PublicLayout>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

function PaymentRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-black text-foreground text-base' : 'font-semibold text-foreground'}>
        {value}
      </dd>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: TrackingPhoto[] }) {
  const [lightbox, setLightbox] = useState<TrackingPhoto | null>(null);
  const stages = (['diseno', 'produccion', 'final'] as const).filter((s) =>
    photos.some((p) => p.stage === s),
  );

  return (
    <section className="bg-card border border-border/40 rounded-sm px-6 sm:px-10 py-8 space-y-6">
      <SectionTitle>Fotos del avance</SectionTitle>
      {stages.map((stage) => (
        <div key={stage} className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary/80">
            {STAGE_LABELS[stage]}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {photos
              .filter((p) => p.stage === stage)
              .map((photo, i) => (
                <button
                  key={`${stage}-${i}`}
                  onClick={() => setLightbox(photo)}
                  className="group relative aspect-square overflow-hidden rounded-sm border border-border/30 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `Foto de ${STAGE_LABELS[stage].toLowerCase()}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform"
                  />
                </button>
              ))}
          </div>
        </div>
      ))}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <figure className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? 'Foto del proyecto'}
              className="w-full max-h-[80vh] object-contain rounded-sm"
            />
            {lightbox.caption && (
              <figcaption className="mt-3 text-center text-sm text-white/80">
                {lightbox.caption}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </section>
  );
}

function FriendlyNotFound() {
  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="px-6 sm:px-10 py-12 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="font-heading text-xl font-black tracking-tight text-foreground">
            Este enlace no es válido o el proyecto ya no está disponible
          </h2>
          <p className="text-sm text-muted-foreground">
            Si crees que es un error, escríbenos y te ayudamos enseguida.
          </p>
        </div>
        <a
          href="https://wa.me/573136802025"
          target="_blank"
          rel="noreferrer"
          className="h-14 px-8 inline-flex items-center gap-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-sm hover:opacity-90 transition-opacity"
        >
          <WhatsAppGlyph />
          Escribir por WhatsApp
        </a>
      </div>
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}
