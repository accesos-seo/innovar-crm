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
    bgClass: 'bg-primary/10',
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
    bgClass: 'bg-[#8b5cf6]/10',
    count: habilidadesData.length,
    countLabel: 'habilidades',
  },
];

const DocsHomePage: React.FC = () => (
  <DocsLayout>
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-foreground font-heading">Documentación</h1>
        <p className="text-muted-foreground mt-2 text-[14px]">
          Base de conocimiento — automatizaciones y habilidades en un solo lugar.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {SECTIONS.map((sec) => (
          <Link
            key={sec.key}
            to={sec.href}
            className="bg-card rounded-xl border border-border/20 p-6 hover:border-border/50 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all group flex items-start gap-5"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${sec.bgClass}`}>
              <sec.Icon size={22} style={{ color: sec.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h2 className="text-[17px] font-bold text-foreground font-heading">{sec.title}</h2>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${sec.color}18`, color: sec.color }}
                >
                  {sec.count} {sec.countLabel}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground">{sec.description}</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </div>
  </DocsLayout>
);

export default DocsHomePage;
