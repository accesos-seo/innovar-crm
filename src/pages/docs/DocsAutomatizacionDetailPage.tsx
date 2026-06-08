import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DocsLayout, { DocsNavTab } from './DocsLayout';
import {
  automatizaciones, categoriaLabel,
  AutomatizacionStatus, AutomatizacionCanal, FlowNode,
} from '@/data/automatizacionesContent';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Lightbulb,
  Clock, User, ChevronDown,
} from 'lucide-react';

const BRAND_COLOR = '#44ddc1';

const NAV_TABS: DocsNavTab[] = [
  { key: '', label: 'Todas', href: '/docs/automatizaciones' },
  ...Object.entries(categoriaLabel).map(([key, label]) => ({
    key, label, href: `/docs/automatizaciones?cat=${key}`,
  })),
];

// ─── Configs ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AutomatizacionStatus, { label: string; chip: string; dot: string; sub: string }> = {
  activa:        { label: 'Activa',        dot: 'bg-emerald-400', sub: 'Funcionando en producción',  chip: 'text-emerald-400 bg-emerald-900/20 border border-emerald-700/40' },
  pausada:       { label: 'Pausada',       dot: 'bg-amber-400',   sub: 'En espera de activación',    chip: 'text-amber-400 bg-amber-900/20 border border-amber-700/40' },
  en_desarrollo: { label: 'En desarrollo', dot: 'bg-sky-400',     sub: 'En construcción',            chip: 'text-sky-400 bg-sky-900/20 border border-sky-700/40' },
  deprecada:     { label: 'Deprecada',     dot: 'bg-red-400',     sub: 'Fuera de uso',               chip: 'text-red-400 bg-red-900/20 border border-red-700/40' },
};

const TIPO_CONFIG: Record<string, { label: string; cls: string }> = {
  trigger:  { label: 'Disparador', cls: 'bg-violet-900/30 border border-violet-600/50 text-violet-300' },
  api:      { label: 'API',        cls: 'bg-orange-900/30 border border-orange-600/50 text-orange-300' },
  ia:       { label: 'IA',         cls: 'bg-purple-900/30 border border-purple-600/50 text-purple-300' },
  proceso:  { label: 'Proceso',    cls: 'bg-slate-800 border border-slate-600 text-slate-300' },
  decision: { label: 'Decisión',   cls: 'bg-yellow-900/30 border border-yellow-600/50 text-yellow-300' },
  output:   { label: 'Resultado',  cls: 'bg-emerald-900/20 border border-emerald-700/40 text-emerald-300' },
};

const CANAL_CONFIG: Record<AutomatizacionCanal, { label: string; cls: string }> = {
  slack:    { label: 'Slack',         cls: 'bg-indigo-900/30 border border-indigo-600/50 text-indigo-300' },
  whatsapp: { label: 'WhatsApp',      cls: 'bg-green-900/20 border border-green-700/40 text-green-300' },
  email:    { label: 'Email',         cls: 'bg-blue-900/20 border border-blue-700/40 text-blue-300' },
  supabase: { label: 'Base de datos', cls: 'bg-emerald-900/20 border border-emerald-700/40 text-emerald-300' },
  interno:  { label: 'Interno (CRM)', cls: 'bg-slate-800 border border-slate-600 text-slate-300' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50 mb-3">{children}</h2>
);

const FlowChip: React.FC<{ node: FlowNode }> = ({ node }) => {
  const cfg = TIPO_CONFIG[node.tipo] ?? TIPO_CONFIG['proceso'];
  return (
    <div className={`rounded-lg px-3 py-2 min-w-[100px] max-w-[150px] text-center ${cfg.cls}`}>
      <div className="text-[9px] font-black uppercase tracking-wide opacity-60 mb-0.5">{cfg.label}</div>
      <div className="text-[12px] font-bold leading-snug">{node.label}</div>
      {node.sublabel && <div className="text-[10px] opacity-55 mt-0.5 leading-tight">{node.sublabel}</div>}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const DocsAutomatizacionDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [techOpen, setTechOpen] = useState(false);

  const aut = automatizaciones.find(a => a.slug === slug);
  const backHref  = aut?.categoria ? `/docs/automatizaciones?cat=${aut.categoria}` : '/docs/automatizaciones';
  const backLabel = aut?.categoria ? categoriaLabel[aut.categoria] : 'Automatizaciones';

  if (!aut) {
    return (
      <DocsLayout activeSection="automatizaciones">
        <div className="p-10 text-muted-foreground">Automatización no encontrada.</div>
      </DocsLayout>
    );
  }

  const statusCfg = STATUS_CONFIG[aut.status] ?? STATUS_CONFIG['activa'];
  const techItems = [
    { label: 'FUENTE DE DATOS',    value: aut.fuente_datos },
    { label: 'TIPO DE TRIGGER',    value: aut.tipo },
    { label: 'N8N WORKFLOW ID',    value: aut.n8n_workflow_id || '—' },
    { label: 'SUPABASE PROYECTO',  value: aut.supabase_proyecto },
    {
      label: 'ÚLTIMA REVISIÓN',
      value: aut.ultima_revision
        ? new Date(aut.ultima_revision).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—',
    },
  ];

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

        {/* ── Back nav ── */}
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a {backLabel}
        </Link>

        {/* ── Category + status ── */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">
            {categoriaLabel[aut.categoria]}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusCfg.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
            <span className="opacity-60 font-normal">· {statusCfg.sub}</span>
          </span>
        </div>

        {/* ── Title + description ── */}
        <h1 className="text-[28px] font-extrabold text-foreground font-heading leading-tight mb-2">{aut.nombre}</h1>
        <p className="text-[15px] text-muted-foreground mb-8 leading-relaxed">{aut.descripcion}</p>

        {/* ── Problema que resuelve ── */}
        {aut.problema_que_resuelve && (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-5 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={13} style={{ color: BRAND_COLOR }} />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: BRAND_COLOR }}>
                ¿QUÉ PROBLEMA RESUELVE?
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{aut.problema_que_resuelve}</p>
          </div>
        )}

        {/* ── Métricas ── */}
        {aut.metricas?.length > 0 && (
          <div className={`grid gap-3 mb-10 ${aut.metricas.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {aut.metricas.map((m, i) => (
              <div key={i} className="bg-card rounded-xl border border-border/20 p-4 text-center">
                <div className="text-2xl font-black font-heading" style={{ color: BRAND_COLOR }}>{m.valor}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{m.etiqueta}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Descripción completa ── */}
        {aut.descripcion_larga && (
          <section className="mb-10">
            <SectionHeader>DESCRIPCIÓN COMPLETA</SectionHeader>
            <div className="text-[14px] text-muted-foreground leading-relaxed whitespace-pre-line">
              {aut.descripcion_larga}
            </div>
          </section>
        )}

        {/* ── Flujo de ejecución ── */}
        {aut.flujo_visual?.length > 0 && (
          <section className="mb-10">
            <SectionHeader>FLUJO DE EJECUCIÓN</SectionHeader>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[...new Set(aut.flujo_visual.map(n => n.tipo))].map(tipo => (
                <span
                  key={tipo}
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full ${TIPO_CONFIG[tipo]?.cls ?? ''}`}
                >
                  {TIPO_CONFIG[tipo]?.label ?? tipo}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto pb-2 rounded-xl border border-border/20 bg-card p-4">
              <div className="flex items-center gap-1 min-w-max">
                {aut.flujo_visual.map((node, i) => (
                  <React.Fragment key={i}>
                    <FlowChip node={node} />
                    {i < aut.flujo_visual.length - 1 && (
                      <ArrowRight size={13} className="text-muted-foreground/30 mx-0.5 shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Beneficios clave ── */}
        {aut.beneficios?.length > 0 && (
          <section className="mb-10">
            <SectionHeader>BENEFICIOS CLAVE</SectionHeader>
            <ul className="flex flex-col gap-2.5">
              {aut.beneficios.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                  <CheckCircle2 size={14} style={{ color: BRAND_COLOR }} className="shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── En la práctica ── */}
        {aut.casos_de_uso?.length > 0 && (
          <section className="mb-10">
            <SectionHeader>EN LA PRÁCTICA</SectionHeader>
            <div className="flex flex-col gap-3">
              {aut.casos_de_uso.map((caso, i) => (
                <div key={i} className="flex items-start gap-3 bg-card rounded-xl border border-border/20 p-4">
                  <span className="w-6 h-6 rounded-full bg-muted text-[11px] font-black flex items-center justify-center shrink-0 text-muted-foreground/60">
                    {i + 1}
                  </span>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{caso}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Pasos técnicos ── */}
        {aut.pasos?.length > 0 && (
          <section className="mb-10">
            <SectionHeader>PASOS TÉCNICOS DEL PROCESO</SectionHeader>
            <div className="flex flex-col gap-2">
              {aut.pasos.map((paso, i) => (
                <div key={i} className="flex items-start gap-3 bg-card rounded-xl border border-border/20 p-3.5">
                  <span className="text-[11px] font-black text-muted-foreground/30 tabular-nums shrink-0 w-5">{i + 1}</span>
                  <p className="text-[13px] text-muted-foreground">{paso}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Cuándo + Responsable ── */}
        {(aut.frecuencia || aut.responsable) && (
          <div className="grid grid-cols-2 gap-3 mb-10">
            {aut.frecuencia && (
              <div className="bg-card rounded-xl border border-border/20 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
                  <Clock size={10} />¿CUÁNDO SE ACTIVA?
                </div>
                <p className="text-[13px] text-foreground font-semibold leading-snug">{aut.frecuencia}</p>
              </div>
            )}
            {aut.responsable && (
              <div className="bg-card rounded-xl border border-border/20 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
                  <User size={10} />RESPONSABLE
                </div>
                <p className="text-[13px] text-foreground font-semibold">{aut.responsable}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Canales de salida ── */}
        {aut.canal_salida?.length > 0 && (
          <section className="mb-10">
            <SectionHeader>¿A DÓNDE LLEGAN LOS RESULTADOS?</SectionHeader>
            <div className="flex flex-wrap gap-2">
              {aut.canal_salida.map((canal, i) => {
                const cfg = CANAL_CONFIG[canal];
                return cfg ? (
                  <span key={i} className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl border ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                ) : null;
              })}
            </div>
          </section>
        )}

        {/* ── Nota importante ── */}
        {aut.notas && (
          <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-5 mb-10">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-[0.12em] mb-2">NOTA IMPORTANTE</div>
            <p className="text-[13px] text-amber-300/80 leading-relaxed">{aut.notas}</p>
          </div>
        )}

        {/* ── Detalles técnicos (collapsible) ── */}
        <div className="mb-10 border border-border/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setTechOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
          >
            <span className="font-semibold">{techOpen ? '↑ Ocultar detalles técnicos' : '↓ Ver detalles técnicos'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${techOpen ? 'rotate-180' : ''}`} />
          </button>

          {techOpen && (
            <div className="border-t border-border/20 p-4 grid grid-cols-2 gap-x-6 gap-y-4">
              {techItems.map(item =>
                item.value ? (
                  <div key={item.label}>
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/40 mb-1">{item.label}</div>
                    <div className="text-[12px] font-mono text-muted-foreground">{item.value}</div>
                  </div>
                ) : null
              )}
              {aut.rutas_codigo && aut.rutas_codigo.length > 0 && (
                <div className="col-span-2">
                  <div className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/40 mb-1">RUTAS DE CÓDIGO</div>
                  <div className="flex flex-col gap-1">
                    {aut.rutas_codigo.map((ruta, i) => (
                      <code key={i} className="text-[11px] font-mono text-muted-foreground/70">{ruta}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Historial ── */}
        {aut.historial?.length > 0 && (
          <section>
            <SectionHeader>HISTORIAL DE CAMBIOS</SectionHeader>
            <div className="flex flex-col">
              {aut.historial.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 text-[13px] py-3 border-b border-border/10 last:border-0"
                >
                  <span className="text-muted-foreground/40 shrink-0 tabular-nums text-[12px] mt-0.5">
                    {h.fecha?.substring(0, 10)}
                  </span>
                  <span className="text-muted-foreground flex-1">{h.descripcion}</span>
                  <span className="text-muted-foreground/40 shrink-0 text-[12px]">{h.autor}</span>
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
