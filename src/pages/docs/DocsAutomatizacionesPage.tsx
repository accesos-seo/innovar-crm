import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import DocsLayout, { DocsNavTab } from './DocsLayout';
import { automatizaciones, categoriaLabel, AutomatizacionCategoria } from '@/data/automatizacionesContent';
import { ArrowRight, Search } from 'lucide-react';

const BRAND = '#44ddc1';
const NAV_TABS: DocsNavTab[] = [
  { key: '', label: 'Todas', href: '/docs/automatizaciones' },
  ...Object.entries(categoriaLabel).map(([key, label]) => ({
    key, label, href: `/docs/automatizaciones?cat=${key}`,
  })),
];
const VALID_CATS = new Set(Object.keys(categoriaLabel));

const DocsAutomatizacionesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const catParam = searchParams.get('cat');
  const activeCat = (catParam && VALID_CATS.has(catParam) ? catParam : null) as AutomatizacionCategoria | null;

  const list = useMemo(() => {
    const byCat = activeCat ? automatizaciones.filter(a => a.categoria === activeCat) : automatizaciones;
    if (!query.trim()) return byCat;
    const q = query.toLowerCase();
    return byCat.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      a.descripcion.toLowerCase().includes(q) ||
      categoriaLabel[a.categoria].toLowerCase().includes(q),
    );
  }, [activeCat, query]);

  return (
    <DocsLayout
      activeSection="automatizaciones"
      navTabs={NAV_TABS}
      activeTabKey={catParam ?? ''}
    >
      <div className="p-6 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-extrabold text-foreground font-heading flex-1">
            {activeCat ? categoriaLabel[activeCat] : 'Todas las Automatizaciones'}
            <span className="ml-2 text-[14px] font-normal text-muted-foreground/60">({list.length})</span>
          </h1>

          {/* Search */}
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

        {/* List */}
        {list.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground/50 text-[14px]">
            No hay automatizaciones que coincidan con "{query}"
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((aut, i) => (
                <Link
                  key={aut.slug}
                  to={`/docs/automatizaciones/${aut.slug}`}
                  className="bg-card rounded-xl border border-border/20 p-5 hover:border-primary/30 hover:shadow-[0_4px_20px_rgba(68,221,193,0.08)] transition-all group flex items-start gap-4"
                >
                  {/* Número con color de marca */}
                  <div
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black tabular-nums mt-0.5"
                    style={{ backgroundColor: `${BRAND}15`, color: BRAND, border: `1px solid ${BRAND}30` }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-[15px] font-bold text-foreground font-heading">{aut.nombre}</h2>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/70">{aut.status}</span>
                    </div>
                    <p className="text-[13px] text-muted-foreground line-clamp-2">{aut.descripcion}</p>
                    <div className="mt-2 text-[11px]" style={{ color: `${BRAND}80` }}>{categoriaLabel[aut.categoria]}</div>
                  </div>

                  <ArrowRight size={15} className="text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0 mt-1" />
                </Link>
            ))}
          </div>
        )}
      </div>
    </DocsLayout>
  );
};

export default DocsAutomatizacionesPage;
