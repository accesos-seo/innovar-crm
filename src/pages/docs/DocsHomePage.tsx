import React from 'react';
import { Link } from 'react-router-dom';
import DocsLayout from './DocsLayout';
import { Zap, Wand2, ArrowRight } from 'lucide-react';
import { automatizaciones } from '@/data/automatizacionesContent';
import { habilidadesData } from '@/data/docsData';

const SECTIONS = [
  {
    key: 'automatizaciones',
    title: 'Automatizaciones',
    description: 'Flujos y procesos automatizados que potencian la operación.',
    href: '/docs/automatizaciones',
    Icon: Zap,
    color: '#44ddc1',
    bg: '#e0faf7',
    count: automatizaciones.length,
    countLabel: 'automatizaciones',
  },
  {
    key: 'habilidades',
    title: 'Habilidades',
    description: 'Skills y capacidades del sistema de IA — comandos disponibles.',
    href: '/docs/habilidades',
    Icon: Wand2,
    color: '#8b5cf6',
    bg: '#ede9fe',
    count: habilidadesData.length,
    countLabel: 'habilidades',
  },
];

const DocsHomePage: React.FC = () => (
  <DocsLayout>
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Documentación</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-[14px]">
          Base de conocimiento — automatizaciones y habilidades en un solo lugar.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {SECTIONS.map((sec) => (
          <Link
            key={sec.key}
            to={sec.href}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all group flex items-start gap-5"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: sec.bg }}>
              <sec.Icon size={22} style={{ color: sec.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">{sec.title}</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: sec.bg, color: sec.color }}>
                  {sec.count} {sec.countLabel}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">{sec.description}</p>
            </div>
            <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </div>
  </DocsLayout>
);

export default DocsHomePage;
