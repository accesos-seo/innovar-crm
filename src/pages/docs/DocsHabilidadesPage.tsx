import React from 'react';
import DocsLayout from './DocsLayout';
import { habilidadesData } from '@/data/docsData';
import { Wand2, Clock } from 'lucide-react';

const BRAND_COLOR = '#44ddc1';
const HABILIDADES_COLOR = '#8b5cf6';

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

const HabilidadesSidebar: React.FC = () => (
  <nav className="py-5 px-3 flex flex-col gap-0.5 text-sm select-none">
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold mb-1" style={{ color: BRAND_COLOR }}>
      <Wand2 size={13} className="shrink-0" />
      <span className="text-[13px]">Todas las habilidades</span>
    </div>
    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
    <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Skills</p>
    {habilidadesData.map((item) => (
      <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-default">
        <span className="text-[11px] opacity-50">•</span>
        {item.title}
      </div>
    ))}
  </nav>
);

const DocsHabilidadesPage: React.FC = () => (
  <DocsLayout activeSection="habilidades" sidebarContent={<HabilidadesSidebar />}>
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: HABILIDADES_COLOR }}>
            <Wand2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Habilidades</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Skills del sistema de IA</p>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mt-4">
          Comandos y capacidades disponibles en el asistente de IA. Cada habilidad tiene un disparador específico y una función concreta.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {habilidadesData.map((item, i) => (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-[11px] font-black text-slate-300 dark:text-slate-700 tabular-nums shrink-0 mt-0.5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold leading-snug" style={{ color: BRAND_COLOR }}>
                  {item.title}
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
                {item.features && item.features.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5">
                    {item.features.map((f, fi) => (
                      <li key={fi} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
              <Clock size={11} />
              {fmtDate(item.last_updated_at) ? <span>Actualizado {fmtDate(item.last_updated_at)}</span> : <span>—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  </DocsLayout>
);

export default DocsHabilidadesPage;
