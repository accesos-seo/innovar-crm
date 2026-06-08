import React from 'react';
import { useParams, Link } from 'react-router-dom';
import DocsLayout, { DocsNavTab } from './DocsLayout';
import { automatizaciones, categoriaLabel } from '@/data/automatizacionesContent';
import { ArrowLeft } from 'lucide-react';

const NAV_TABS: DocsNavTab[] = [
  { key: '', label: 'Todas', href: '/docs/automatizaciones' },
  ...Object.entries(categoriaLabel).map(([key, label]) => ({
    key, label, href: `/docs/automatizaciones?cat=${key}`,
  })),
];

const DocsAutomatizacionDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const aut = automatizaciones.find(a => a.slug === slug);

  const backHref = aut?.categoria
    ? `/docs/automatizaciones?cat=${aut.categoria}`
    : '/docs/automatizaciones';
  const backLabel = aut?.categoria ? categoriaLabel[aut.categoria] : 'Automatizaciones';

  if (!aut) {
    return (
      <DocsLayout activeSection="automatizaciones">
        <div className="p-10 text-slate-500">Automatización no encontrada.</div>
      </DocsLayout>
    );
  }

  return (
    <DocsLayout
      activeSection="automatizaciones"
      breadcrumbs={[
        { label: 'Automatizaciones', href: '/docs/automatizaciones' },
        { label: aut.nombre },
      ]}
      navTabs={NAV_TABS}
      activeTabKey={aut.categoria}
    >
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <Link to={backHref} className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors">
          <ArrowLeft size={14} />
          Volver a {backLabel}
        </Link>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">{aut.nombre}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">{aut.descripcion}</p>

        {aut.descripcion_larga && (
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 mb-3">¿Cómo funciona?</h2>
            <div className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {aut.descripcion_larga}
            </div>
          </section>
        )}

        {aut.problema_que_resuelve && (
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 mb-3">Problema que resuelve</h2>
            <p className="text-[14px] text-slate-600 dark:text-slate-300">{aut.problema_que_resuelve}</p>
          </section>
        )}

        {aut.beneficios?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 mb-3">Beneficios</h2>
            <ul className="flex flex-col gap-2">
              {aut.beneficios?.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[14px] text-slate-600 dark:text-slate-300">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}

        {aut.metricas?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 mb-3">Métricas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {aut.metricas?.map((m, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{m.valor}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{m.etiqueta}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {aut.pasos?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 mb-3">Pasos del flujo</h2>
            <ol className="flex flex-col gap-2">
              {aut.pasos?.map((paso, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px] text-slate-600 dark:text-slate-300">
                  <span className="text-[11px] font-black text-slate-300 tabular-nums shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {paso}
                </li>
              ))}
            </ol>
          </section>
        )}

        {aut.historial?.length > 0 && (
          <section>
            <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 mb-3">Historial de cambios</h2>
            <div className="flex flex-col gap-2">
              {aut.historial?.map((h, i) => (
                <div key={i} className="flex items-start gap-3 text-[13px]">
                  <span className="text-slate-400 shrink-0">{h.fecha?.substring(0, 10) || '—'}</span>
                  <span className="text-slate-600 dark:text-slate-300">{h.descripcion}</span>
                  <span className="text-slate-400 ml-auto shrink-0">{h.autor}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </DocsLayout>
  );
};

export default DocsAutomatizacionDetailPage;
