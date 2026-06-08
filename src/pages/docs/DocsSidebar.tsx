import React from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { Wand2, LayoutGrid, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { automatizaciones, AutomatizacionCategoria, categoriaLabel } from '@/data/automatizacionesContent';
import { habilidadesData } from '@/data/docsData';

const BRAND_COLOR = '#44ddc1';
const ACTIVE_LINK = 'font-semibold bg-primary/10 text-primary';
const INACTIVE_LINK = 'text-muted-foreground hover:bg-accent/60 hover:text-foreground';
const VALID_CATS = new Set(Object.keys(categoriaLabel));

type SidebarSection = 'automatizaciones' | 'habilidades';

interface DocsSidebarProps {
  section?: SidebarSection;
  activeSlug?: string;
}

const AutoSidebar: React.FC<{ activeSlug?: string }> = ({ activeSlug }) => {
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get('cat');
  const validCat = (catParam && VALID_CATS.has(catParam) ? catParam : null) as AutomatizacionCategoria | null;

  const currentAut = activeSlug ? automatizaciones.find(a => a.slug === activeSlug) : null;
  const activeCat: AutomatizacionCategoria | null = currentAut?.categoria ?? validCat;
  const isDetail = !!activeSlug;
  const isAllActive = !isDetail && !activeCat;

  const categoryCounts = (Object.keys(categoriaLabel) as AutomatizacionCategoria[]).reduce(
    (acc, cat) => { acc[cat] = automatizaciones.filter(a => a.categoria === cat).length; return acc; },
    {} as Record<AutomatizacionCategoria, number>,
  );

  return (
    <nav className="py-5 px-3 flex flex-col gap-0.5 text-sm select-none">
      <Link
        to="/docs/automatizaciones"
        className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors', isAllActive ? ACTIVE_LINK : INACTIVE_LINK)}
      >
        <LayoutGrid size={13} className="shrink-0" />
        <span className="flex-1 text-[13px]">Todas</span>
        <span className="text-[11px] text-muted-foreground/50">{automatizaciones.length}</span>
      </Link>

      <div className="my-2 border-t border-border/15" />
      <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Categorías</p>

      {(Object.entries(categoriaLabel) as [AutomatizacionCategoria, string][]).map(([cat, label]) => {
        const isCatActive = activeCat === cat;
        const isExpanded = isDetail && isCatActive;
        const catItems = automatizaciones.filter(a => a.categoria === cat);
        return (
          <div key={cat}>
            <Link
              to={`/docs/automatizaciones?cat=${cat}`}
              className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors', isCatActive ? ACTIVE_LINK : INACTIVE_LINK)}
            >
              <span className="flex-1 text-[13px]">{label}</span>
              <span className="text-[11px] text-muted-foreground/50">{categoryCounts[cat]}</span>
            </Link>
            {isExpanded && catItems.length > 0 && (
              <div className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 border-l-2 border-primary/20 pl-3">
                {catItems.map(aut => {
                  const isCurrent = aut.slug === activeSlug;
                  return (
                    <Link
                      key={aut.slug}
                      to={`/docs/automatizaciones/${aut.slug}`}
                      className={cn(
                        'flex items-center gap-1.5 py-1.5 px-2 rounded-md transition-colors text-[12px]',
                        isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
                      )}
                    >
                      {isCurrent && <ChevronRight size={10} className="text-primary" />}
                      <span className="line-clamp-2 leading-tight">{aut.nombre}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
};

const HabilidadesSidebarNav: React.FC = () => (
  <nav className="py-5 px-3 flex flex-col gap-0.5 text-sm select-none">
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold mb-1" style={{ color: BRAND_COLOR }}>
      <Wand2 size={13} className="shrink-0" />
      <span className="text-[13px]">Todas las habilidades</span>
    </div>
    <div className="my-1 border-t border-border/15" />
    <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">Skills</p>
    {habilidadesData.map(item => (
      <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground/60 cursor-default">
        <span className="opacity-30">•</span>
        {item.title}
      </div>
    ))}
  </nav>
);

const DocsSidebar: React.FC<DocsSidebarProps> = ({ section = 'automatizaciones', activeSlug }) => {
  if (section === 'habilidades') return <HabilidadesSidebarNav />;
  return <AutoSidebar activeSlug={activeSlug} />;
};

export default DocsSidebar;
