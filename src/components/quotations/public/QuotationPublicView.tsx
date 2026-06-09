import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, CalendarClock, ShieldCheck } from 'lucide-react';
import type { PublicQuotationData } from '@/hooks/quotations/usePublicQuotation';
import { ShareQuotationButton } from './ShareQuotationButton';

function formatCOP(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

interface Props {
  data: PublicQuotationData;
}

export function QuotationPublicView({ data }: Props) {
  const validUntilFmt = data.valid_until
    ? format(new Date(data.valid_until), "d 'de' MMMM yyyy", { locale: es })
    : null;

  const versionLabel = (data.version_number ?? 1) > 1 ? `V${data.version_number}` : null;

  const discountAmount =
    data.discount_type === 'percent'
      ? Number(data.subtotal ?? 0) * (Number(data.discount_value ?? 0) / 100)
      : Number(data.discount_value ?? 0);

  return (
    <article className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      {/* Top accent — gradient menta editorial */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-primary/80 to-primary/20 shrink-0" />

      {/* Header */}
      <header className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 border-b border-border/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.35em] text-primary/80">
              Propuesta
            </span>
            {versionLabel && (
              <span className="px-2.5 py-0.5 border border-primary/40 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.25em]">
                {versionLabel}
              </span>
            )}
          </div>
          <ShareQuotationButton shortCode={data.short_code ?? null} />
        </div>

        <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          {data.quotation_number ?? 'En preparación'}
        </h1>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-background/40 border border-border/30 p-4">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/70 mb-1.5">
              Para
            </div>
            <p className="text-sm font-bold text-foreground truncate">
              {data.client?.name ?? '—'}
            </p>
          </div>
          {validUntilFmt && (
            <div className="bg-background/40 border border-border/30 p-4">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/70 mb-1.5">
                <CalendarClock className="w-3 h-3 text-primary/70" />
                Vigencia
              </div>
              <p className="text-sm font-bold text-foreground">{validUntilFmt}</p>
            </div>
          )}
        </div>
      </header>

      {/* Items */}
      <section className="px-6 sm:px-10 py-8">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/70 mb-5">
          Detalle del proyecto
        </h2>

        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin ítems detallados.</p>
        ) : (
          <ul className="space-y-5">
            {data.items.map((item) => {
              const subtotal = Number(item.unit_price) * Number(item.quantity);
              return (
                <li
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] gap-3 pb-5 border-b border-border/15 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground leading-snug">
                      {item.description}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground tabular-nums">
                      {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'} ·{' '}
                      {formatCOP(item.unit_price)} c/u
                      {item.product_category && (
                        <span className="ml-2 inline-flex px-1.5 py-0.5 border border-border/30 text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                          {item.product_category}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-base font-bold text-foreground tabular-nums whitespace-nowrap">
                    {formatCOP(subtotal)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Totals */}
      <section className="px-6 sm:px-10 py-8 bg-background/40 border-t border-border/20">
        <dl className="space-y-3 text-sm">
          <Row label="Subtotal" value={`${formatCOP(data.subtotal)} COP`} />
          {discountAmount > 0 && (
            <Row
              label={
                data.discount_type === 'percent'
                  ? `Descuento ${data.discount_value}%`
                  : 'Descuento'
              }
              value={`− ${formatCOP(discountAmount)} COP`}
              tone="discount"
            />
          )}
          {Number(data.transport_cost ?? 0) > 0 && (
            <Row label="Transporte" value={`${formatCOP(data.transport_cost)} COP`} />
          )}
        </dl>

        {/* Total destacadísimo */}
        <div className="mt-6 pt-6 border-t border-primary/30">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
              Total
            </span>
            <span className="text-3xl sm:text-4xl font-heading font-black tabular-nums text-foreground">
              {formatCOP(data.total_amount)}
              <span className="ml-1 text-base font-bold text-muted-foreground/60">COP</span>
            </span>
          </div>
        </div>

        {data.notes && (
          <p className="mt-7 text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-4 italic">
            {data.notes}
          </p>
        )}
      </section>

      {/* Footer interno: tracking + sello vigencia */}
      <footer className="px-6 sm:px-10 py-5 bg-muted/10 border-t border-border/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
          <ShieldCheck className="w-3 h-3 text-primary/60" />
          <span>Documento único · cliente {data.client?.name?.split(' ')[0] ?? ''}</span>
        </div>
        {data.view_count > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
            <Eye className="w-3 h-3 text-primary/60" />
            <span>
              Visto {data.view_count} {data.view_count === 1 ? 'vez' : 'veces'}
            </span>
          </div>
        )}
      </footer>
    </article>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'discount';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
        {label}
      </dt>
      <dd
        className={`tabular-nums font-bold ${
          tone === 'discount' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
