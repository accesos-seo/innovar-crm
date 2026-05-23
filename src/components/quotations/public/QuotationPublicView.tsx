import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, CalendarClock } from 'lucide-react';
import type { PublicQuotationData } from '@/hooks/quotations/usePublicQuotation';

function formatCOP(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
}

interface Props {
  data: PublicQuotationData;
}

export function QuotationPublicView({ data }: Props) {
  const validUntilFmt = data.valid_until
    ? format(new Date(data.valid_until), "d 'de' MMMM yyyy", { locale: es })
    : null;

  const versionLabel =
    (data.version_number ?? 1) > 1 ? `Versión ${data.version_number}` : null;

  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <header className="px-5 py-5 sm:px-7 sm:py-7 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Cotización
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-gray-900 break-words">
              {data.quotation_number ?? 'En preparación'}
            </h1>
            {versionLabel && (
              <span className="inline-flex mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-800">
                {versionLabel}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Para</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {data.client?.name ?? '—'}
            </p>
          </div>
        </div>

        {validUntilFmt && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
            <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Válida hasta el <strong className="text-gray-800">{validUntilFmt}</strong>
            </span>
          </div>
        )}
      </header>

      <section className="px-5 py-5 sm:px-7 sm:py-7 space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Detalle del proyecto
        </h2>

        {data.items.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Cotización sin ítems detallados.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.items.map((item) => {
              const subtotal = Number(item.unit_price) * Number(item.quantity);
              return (
                <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {item.description}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.quantity} × {formatCOP(item.unit_price)}
                      {item.product_category && (
                        <span className="ml-2 inline-flex px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] uppercase tracking-wider">
                          {item.product_category}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCOP(subtotal)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="px-5 py-5 sm:px-7 sm:py-7 border-t border-gray-200 bg-gray-50">
        <dl className="space-y-2 text-sm">
          <Row label="Subtotal" value={formatCOP(data.subtotal)} />
          {Number(data.discount_value ?? 0) > 0 && (
            <Row
              label={
                data.discount_type === 'percent'
                  ? `Descuento (${data.discount_value}%)`
                  : 'Descuento'
              }
              value={`− ${formatCOP(data.discount_value)}`}
              tone="discount"
            />
          )}
          {Number(data.transport_cost ?? 0) > 0 && (
            <Row label="Transporte" value={formatCOP(data.transport_cost)} />
          )}
          <Row
            label="Total"
            value={formatCOP(data.total_amount)}
            tone="total"
          />
        </dl>

        {data.notes && (
          <p className="mt-5 text-xs text-gray-600 leading-relaxed border-l-2 border-gray-300 pl-3">
            {data.notes}
          </p>
        )}

        {data.view_count > 0 && (
          <div className="mt-5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-400">
            <Eye className="w-3 h-3" />
            <span>
              Esta cotización fue vista {data.view_count}{' '}
              {data.view_count === 1 ? 'vez' : 'veces'}
            </span>
          </div>
        )}
      </section>
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
  tone?: 'total' | 'discount';
}) {
  if (tone === 'total') {
    return (
      <div className="flex items-baseline justify-between pt-2 border-t border-gray-300">
        <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-700">
          {label}
        </dt>
        <dd className="text-lg font-bold text-gray-900 tabular-nums">{value}</dd>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-gray-600">{label}</dt>
      <dd
        className={
          tone === 'discount'
            ? 'text-emerald-700 font-semibold tabular-nums'
            : 'text-gray-900 tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  );
}
