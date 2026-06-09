import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, Zap, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocsBreadcrumb {
  label: string;
  href?: string;
}

export interface DocsNavTab {
  label: string;
  key: string;
  href: string;
}

export type DocsSection = 'automatizaciones' | 'habilidades';

interface DocsLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: DocsBreadcrumb[];
  navTabs?: DocsNavTab[];
  activeTabKey?: string;
  sidebarContent?: React.ReactNode;
  rightSidebarContent?: React.ReactNode;
  activeSection?: DocsSection;
}

const BRAND_COLOR = '#44ddc1';

const TOP_SECTIONS = [
  { key: 'automatizaciones' as DocsSection, label: 'Automatizaciones', href: '/docs/automatizaciones', icon: <Zap size={13} /> },
  { key: 'habilidades' as DocsSection, label: 'Habilidades', href: '/docs/habilidades', icon: <Wand2 size={13} /> },
];

const DocsLayout: React.FC<DocsLayoutProps> = ({
  children, breadcrumbs, navTabs, activeTabKey,
  sidebarContent, rightSidebarContent, activeSection,
}) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hasNavTabs = Array.isArray(navTabs) && navTabs.length > 0;

  const isTabActive = (tab: DocsNavTab): boolean => {
    if (activeTabKey !== undefined) return tab.key === activeTabKey;
    if (tab.key === '') {
      const isAuto = location.pathname === '/docs/automatizaciones';
      return isAuto && !searchParams.get('cat');
    }
    return searchParams.get('cat') === tab.key;
  };

  const headerHeight = hasNavTabs ? 108 : 64;
  const sidebarStyle: React.CSSProperties = {
    top: `${headerHeight}px`,
    maxHeight: `calc(100vh - ${headerHeight}px)`,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header sticky */}
      <header className="sticky top-0 z-50 bg-card border-b border-border/20 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="max-w-[1400px] mx-auto px-6 h-[64px] flex items-center gap-6">
          <Link to="/docs" className="flex items-center gap-2.5 shrink-0 group">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND_COLOR }}>
              <span className="text-background font-black text-sm">I</span>
            </div>
            <div className="flex items-baseline gap-1 leading-none">
              <span className="text-[18px] font-extrabold tracking-tight text-foreground">Innovar</span>
              <span className="text-[18px] font-extrabold tracking-tight" style={{ color: BRAND_COLOR }}>Docs</span>
            </div>
          </Link>

          <div className="w-px h-5 bg-border/30 shrink-0" />

          <nav className="flex items-center gap-1">
            {TOP_SECTIONS.map((sec) => {
              const isActive = activeSection === sec.key;
              return (
                <Link
                  key={sec.key}
                  to={sec.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'text-background shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60',
                  )}
                  style={isActive ? { backgroundColor: BRAND_COLOR } : undefined}
                >
                  <span className={cn('opacity-70', isActive && 'opacity-100')}>{sec.icon}</span>
                  {sec.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground/60 min-w-0 max-w-xs">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight size={10} className="shrink-0" />}
                  {crumb.href ? (
                    <Link to={crumb.href} className="hover:text-muted-foreground transition-colors truncate">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium truncate">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {/* Fila 2: Tabs de categoría */}
        {hasNavTabs && (
          <div className="border-t border-border/10">
            <div className="max-w-[1400px] mx-auto px-6">
              <nav className="flex items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {navTabs!.map((tab) => (
                  <Link
                    key={tab.key}
                    to={tab.href}
                    className={cn(
                      'shrink-0 h-10 flex items-center px-4 text-[13px] font-medium border-b-2 transition-all duration-150 whitespace-nowrap',
                      isTabActive(tab)
                        ? 'font-semibold'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/40',
                    )}
                    style={isTabActive(tab) ? { color: BRAND_COLOR, borderBottomColor: BRAND_COLOR } : undefined}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="max-w-[1400px] mx-auto flex">
        {sidebarContent && (
          <aside
            className="w-56 shrink-0 hidden lg:block sticky self-start overflow-y-auto border-r border-border/10 bg-card"
            style={sidebarStyle}
          >
            {sidebarContent}
          </aside>
        )}
        <main className="flex-1 min-w-0">{children}</main>
        {rightSidebarContent && (
          <aside
            className="w-60 shrink-0 hidden xl:block sticky self-start overflow-y-auto border-l border-border/10 bg-card"
            style={sidebarStyle}
          >
            {rightSidebarContent}
          </aside>
        )}
      </div>
    </div>
  );
};

export default DocsLayout;
