import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import DocsLayout, { DocsNavTab } from './DocsLayout';
import { automatizaciones, categoriaLabel, AutomatizacionCategoria } from '@/data/automatizacionesContent';
import { ArrowRight } from 'lucide-react';

const NAV_TABS: DocsNavTab[] = [
  { key: '', label: 'Todas', href: '/docs/automatizaciones' },
  ...Object.entries(categoriaLabel).map(([key, label]) => ({
    key, label, href: `/docs/automatizaciones?cat=${key}`,
  })),
];

const VALID_CATS = new Set(Object.keys(categoriaLabel));

const DocsAutomatizacionesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get('cat');
  const activeCat = (catParam && VALID_CATS.has(catParam) ? catParam : null) as AutomatizacionCategoria | null;
  const list = activeCat ? automatizaciones.filter(a => a.categoria === activeCat) : automatizaciones;

  return (
    <DocsLayout
      activeSection="automatizaciones"
      navTabs={NAV_TABS}
      activeTabKey={catParam ?? ''}
    >
      <div className="p-6 lg:p-10">
        <h1 className="text-2xl font-extrabold text-foreground font-heading mb-6">
          {activeCat ? categoriaLabel[activeCat] : 'Todas las Automatizaciones'}
          <span className="ml-2 text-[14px] font-normal text-muted-foreground/60">({list.length})</span>
        </h1>
        <div className="flex flex-col gap-3">
          {list.map((aut) => (
            <Link
              key={aut.slug}
              to={`/docs/automatizaciones/${aut.slug}`}
              className="bg-card rounded-xl border border-border/20 p-5 hover:border-border/50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all group flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-[15px] font-bold text-foreground font-heading">{aut.nombre}</h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/70">{aut.status}</span>
                </div>
                <p className="text-[13px] text-muted-foreground line-clamp-2">{aut.descripcion}</p>
                <div className="mt-2 text-[11px] text-muted-foreground/50">{categoriaLabel[aut.categoria]}</div>
              </div>
              <ArrowRight size={15} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </div>
    </DocsLayout>
  );
};

export default DocsAutomatizacionesPage;
