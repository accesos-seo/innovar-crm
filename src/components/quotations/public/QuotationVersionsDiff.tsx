import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import {
  useQuotationVersions,
  type QuotationVersionItem,
} from '@/hooks/quotations/useQuotationVersions';

interface Props {
  currentQuotationId: string;
}

function formatCOP(value: number): string {
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

/**
 * Compara la versión actual con la anterior (basándose en `version_number`).
 * Heurística simple: matchea ítems por `description` exacto (case-insensitive,
 * trim). Cambios de precio se muestran como "antes → ahora".
 */
export function QuotationVersionsDiff({ currentQuotationId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuotationVersions(currentQuotationId);

  const diff = useMemo(() => {
    if (!data) return null;
    const sorted = [...data.versions].sort(
      (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0),
    );
    const current = sorted.find((v) => v.id === currentQuotationId);
    const previous = sorted.find(
      (v) => (v.version_number ?? 0) < (current?.version_number ?? 0),
    );
    if (!current || !previous) return null;

    const currentItems = data.itemsByVersion[current.id] ?? [];
    const previousItems = data.itemsByVersion[previous.id] ?? [];
    const norm = (s: string) => s.trim().toLowerCase();

    const previousByDesc = new Map<string, QuotationVersionItem>(
      previousItems.map((it) => [norm(it.description), it]),
    );
    const currentByDesc = new Map<string, QuotationVersionItem>(
      currentItems.map((it) => [norm(it.description), it]),
    );

    const added: QuotationVersionItem[] = [];
    const removed: QuotationVersionItem[] = [];
    const changed: Array<{
      description: string;
      before: number;
      after: number;
    }> = [];

    for (const it of currentItems) {
      const prev = previousByDesc.get(norm(it.description));
      if (!prev) {
        added.push(it);
      } else if (Number(prev.unit_price) !== Number(it.unit_price)) {
        changed.push({
          description: it.description,
          before: Number(prev.unit_price),
          after: Number(it.unit_price),
        });
      }
    }
    for (const it of previousItems) {
      if (!currentByDesc.has(norm(it.description))) removed.push(it);
    }

    return {
      previousVersionNumber: previous.version_number,
      currentVersionNumber: current.version_number,
      added,
      removed,
      changed,
    };
  }, [data, currentQuotationId]);

  if (isLoading || !diff) return null;
  const hasChanges =
    diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
  if (!hasChanges) return null;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-100/60 transition"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
            Cambios respecto a la versión {diff.previousVersionNumber}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            {diff.added.length} agregado{diff.added.length === 1 ? '' : 's'} ·{' '}
            {diff.removed.length} eliminado{diff.removed.length === 1 ? '' : 's'} ·{' '}
            {diff.changed.length} con precio modificado
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-amber-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-700" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-amber-200 px-4 py-3 space-y-3 bg-white">
          {diff.added.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">
                Agregados
              </p>
              <ul className="text-sm text-emerald-900 space-y-0.5">
                {diff.added.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span>+ {it.description}</span>
                    <span className="tabular-nums">{formatCOP(it.unit_price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">
                Eliminados
              </p>
              <ul className="text-sm text-red-900 line-through space-y-0.5">
                {diff.removed.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span>− {it.description}</span>
                    <span className="tabular-nums">{formatCOP(it.unit_price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.changed.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">
                Cambios de precio
              </p>
              <ul className="text-sm text-amber-900 space-y-0.5">
                {diff.changed.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span>{c.description}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <span className="text-gray-500 line-through">
                        {formatCOP(c.before)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-amber-700" />
                      <span className="font-semibold">{formatCOP(c.after)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
