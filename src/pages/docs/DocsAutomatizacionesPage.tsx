import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import DocsLayout, { DocsNavTab } from './DocsLayout';
import {
  automatizaciones, categoriaLabel, AutomatizacionCategoria,
  visibilidadConfig, AutomatizacionVisibilidad,
} from '@/data/automatizacionesContent';
import { ArrowRight, Search, Monitor, Cog, Workflow } from 'lucide-react';

const BRAND = '#44ddc1';

const NAV_TABS: DocsNavTab[] = [
  { key: '', label: 'Todas', href: '/docs/automatizaciones' },
  ...Object.entries(categoriaLabel).map(([key, label]) => ({
    key, label, href: `/docs/automatizaciones?cat=${key}`,
  })),
];
const VALID_CATS = new Set(Object.keys(categoriaLabel));

const VIS_ICONS: Record<AutomatizacionVisibilidad, React.FC<{ size?: number; className?: string }>> = {
  visible: Monitor,
  silente: Cog,
  n8n:     Workflow,
};

type VisFilter = 'todas' | AutomatizacionVisibilidad;

const DocsAutomatizacionesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery]   = useState('');
  const [vis, setVis]       = useState<VisFilter>('todas');

  const catParam = searchParams.get('cat');
  const activeCat = (catParam && VALID_CATS.has(catParam) ? catParam : null) as AutomatizacionCategoria | null;

  const counts = useMemo(() => ({
    visible: automatizaciones.filter(a => a.visibilidad === 'visible').length,
    silente: automatizaciones.filter(a => a.visibilidad === 'silente').length,
    n8n:     automatizaciones.filter(a => a.visibilidad === 'n8n').length,
  }), []);

  const list = useMemo(() => {
    let base = activeCat ? automatizaciones.filter(a => a.categoria === activeCat) : automatizaciones;
    if (vis !== 'todas') base = base.filter(a => a.visibilidad === vis);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      a.descripcion.toLowerCase().includes(q) ||
      categoriaLabel[a.categoria].toLowerCase().includes(q),
    );
  }, [activeCat, vis, query]);

  return (
    <DocsLayout
      activeSection="automatizaciones"
      navTabs={NAV_TABS}
      activeTabKey={catParam ?? ''}
    >
      <div className="p-6 lg:p-10">

        {/* ── Segmentación ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">
            Tipo de automatización
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Todas */}
            <button
              onClick={() => setVis('todas')}
              className={[
                'text-left rounded-xl border p-4 transition-all',
                vis === 'todas'
                  ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(68,221,193,0.1)]'
                  : 'border-border/20 bg-card hover:border-border/40',
              ].join(' ')}
            >
              <div className="text-[11px] text-muted-foreground/50 mb-1">Ver todo</div>
              <div className="text-[15px] font-bold text-foreground font-heading">
                Todas las Automatizaciones
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground/60">
                {automatizaciones.length} automatizaciones en total
              </div>
            </button>

            {/* Visibles */}
            {(['visible', 'silente', 'n8n'] as AutomatizacionVisibilidad[]).map(v => {
              const cfg = visibilidadConfig[v];
              const Icon = VIS_ICONS[v];
              const active = vis === v;
              return (
                <button
                  key={v}
                  onClick={() => setVis(v)}
                  className={[
                    'text-left rounded-xl border p-4 transition-all',
                    active
                      ? 'border-[var(--seg-color)]/50 shadow-[0_0_20px_rgba(0,0,0,0.15)]'
                      : 'border-border/20 bg-card hover:border-border/40',
                  ].join(' ')}
                  style={{
                    ['--seg-color' as string]: cfg.color,
                    backgroundColor: active ? `${cfg.color}08` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cfg.color}18` }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: cfg.color }}>
                      {counts[v]} automatizaciones
                    </span>
                  </div>
                  <div className="text-[15px] font-bold text-foreground font-heading leading-tight">
                    {cfg.label}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground/60 leading-snug">
                    {cfg.sublabel}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Header + buscador ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-extrabold text-foreground font-heading flex-1">
            {vis === 'todas'
              ? (activeCat ? categoriaLabel[activeCat] : 'Todas las Automatizaciones')
              : visibilidadConfig[vis].label}
            <span className="ml-2 text-[14px] font-normal text-muted-foreground/60">
              ({list.length})
            </span>
          </h1>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar automatización…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg bg-muted/60 border border-border/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* ── Lista ────────────────────────────────────────────────────────── */}
        {list.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground/50 text-[14px]">
            No hay automatizaciones que coincidan con "{query}"
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((aut, i) => {
              const cfg  = visibilidadConfig[aut.visibilidad] ?? visibilidadConfig['silente'];
              const Icon = VIS_ICONS[aut.visibilidad] ?? VIS_ICONS['silente'];
              const catLabel = categoriaLabel[aut.categoria] ?? aut.categoria;
              return (
                <Link
                  key={aut.slug}
                  to={`/docs/automatizaciones/${aut.slug}`}
                  className="bg-card rounded-xl border border-border/20 p-5 hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(68,221,193,0.08)] transition-all group flex items-start gap-4"
                >
                  {/* Número */}
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black tabular-nums mt-0.5"
                    style={{ backgroundColor: `${BRAND}15`, color: BRAND, border: `1px solid ${BRAND}30` }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-[15px] font-bold text-foreground font-heading">{aut.nombre}</h2>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/70">
                        {aut.status}
                      </span>
                      {/* Badge de visibilidad */}
                      <span
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
                      >
                        <Icon size={9} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground line-clamp-2">{aut.descripcion}</p>
                    <div className="mt-2 text-[11px]" style={{ color: `${BRAND}80` }}>
                      {catLabel}
                    </div>
                  </div>

                  <ArrowRight size={15} className="text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DocsLayout>
  );
};

export default DocsAutomatizacionesPage;
