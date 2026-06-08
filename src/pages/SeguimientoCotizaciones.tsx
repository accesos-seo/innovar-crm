import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FileText, Clock, AlertTriangle, CheckCircle2, ChevronRight,
  Zap, Activity, Settings2, BarChart3, Send,
  Users, Calendar, Briefcase, TrendingUp,
} from 'lucide-react';
import { CategoryHeader } from '@/components/shared/CategoryHeader';
import { supabase } from '@/lib/supabaseClient';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TrackStage = 'recent' | 'd3' | 'd7';

interface TrackedQuotation {
  id: string;
  quotation_number: string | null;
  status: string;
  sent_at: string;
  total: number | null;
  alert_sent_at: string | null;
  daysElapsed: number;
  stage: TrackStage;
  clientName: string;
}

interface StatsState {
  loading: boolean;
  total: number;
  recentCount: number;
  d3Count: number;
  d7Count: number;
  resolvedThisWeek: number;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysElapsed(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function stageOf(days: number): TrackStage {
  if (days >= 7) return 'd7';
  if (days >= 3) return 'd3';
  return 'recent';
}

function formatCOP(amount: number | null): string {
  if (!amount) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  color: 'primary' | 'amber' | 'red' | 'green';
  loading?: boolean;
}> = ({ label, value, description, icon: Icon, color, loading }) => {
  const colorMap = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    amber: 'text-amber-400 bg-amber-900/20 border-amber-700/30',
    red: 'text-red-400 bg-red-900/20 border-red-700/30',
    green: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30',
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">{label}</p>
        <div className={cn('w-7 h-7 rounded-lg border flex items-center justify-center', colorMap[color])}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-10 bg-muted/40 rounded animate-pulse mb-1" />
      ) : (
        <p className={cn('text-2xl font-black mb-1', {
          'text-primary': color === 'primary',
          'text-amber-400': color === 'amber',
          'text-red-400': color === 'red',
          'text-emerald-400': color === 'green',
        })}>{value}</p>
      )}
      <p className="text-[10px] text-muted-foreground/40">{description}</p>
    </div>
  );
};

// ─── Pipeline phases config ───────────────────────────────────────────────────

const PIPELINE_PHASES = [
  {
    number: 1,
    label: 'Enviada',
    sublabel: 'Días 0–2',
    icon: Send,
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    numBg: 'bg-primary/20',
    getCount: (s: StatsState) => s.recentCount,
    description: 'Cotización enviada al cliente. El agente inicia el monitoreo.',
  },
  {
    number: 2,
    label: 'D+3 Recordatorio',
    sublabel: 'Día 3–6',
    icon: Clock,
    bg: 'bg-amber-900/20',
    border: 'border-amber-700/30',
    text: 'text-amber-400',
    numBg: 'bg-amber-900/40',
    getCount: (s: StatsState) => s.d3Count,
    description: 'WhatsApp automático recordando que la cotización sigue vigente.',
  },
  {
    number: 3,
    label: 'D+7 Urgente',
    sublabel: 'Día 7+',
    icon: AlertTriangle,
    bg: 'bg-red-900/20',
    border: 'border-red-700/30',
    text: 'text-red-400',
    numBg: 'bg-red-900/40',
    getCount: (s: StatsState) => s.d7Count,
    description: 'WhatsApp urgente + alerta directa al comercial para seguimiento.',
  },
  {
    number: 4,
    label: 'Resuelta',
    sublabel: 'Esta semana',
    icon: CheckCircle2,
    bg: 'bg-emerald-900/20',
    border: 'border-emerald-700/30',
    text: 'text-emerald-400',
    numBg: 'bg-emerald-900/40',
    getCount: (s: StatsState) => s.resolvedThisWeek,
    description: 'Cotización aprobada. El agente cierra el ciclo de seguimiento.',
  },
];

// ─── Stage Badge ─────────────────────────────────────────────────────────────

const StageBadge: React.FC<{ stage: TrackStage }> = ({ stage }) => {
  if (stage === 'd7') return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-900/30 border border-red-700/40 text-red-400">D+7 🚨</span>
  );
  if (stage === 'd3') return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/40 text-amber-400">D+3 ⏰</span>
  );
  return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary/70">Reciente</span>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────

const SeguimientoCotizaciones: React.FC = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsState>({
    loading: true,
    total: 0,
    recentCount: 0,
    d3Count: 0,
    d7Count: 0,
    resolvedThisWeek: 0,
  });
  const [tracked, setTracked] = useState<TrackedQuotation[]>([]);
  const [tableLoading, setTableLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setStats({ loading: false, total: 0, recentCount: 0, d3Count: 0, d7Count: 0, resolvedThisWeek: 0 });
      setTableLoading(false);
      return;
    }

    const load = async () => {
      // Cotizaciones activas en seguimiento
      const { data: raw } = await supabase
        .from('quotations')
        .select('id, quotation_number, status, sent_at, total, alert_sent_at, clients(name)')
        .in('status', ['sent', 'viewed', 'negotiation'])
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: true })
        .limit(50)
        .catch(() => ({ data: null }));

      // Cotizaciones aprobadas en los últimos 7 días
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: resolved } = await supabase
        .from('quotations')
        .select('id')
        .eq('status', 'approved')
        .gte('updated_at', weekAgo)
        .catch(() => ({ data: null }));

      const items: TrackedQuotation[] = (raw ?? []).map((q: any) => {
        const days = daysElapsed(q.sent_at);
        return {
          id: q.id,
          quotation_number: q.quotation_number,
          status: q.status,
          sent_at: q.sent_at,
          total: q.total,
          alert_sent_at: q.alert_sent_at,
          daysElapsed: days,
          stage: stageOf(days),
          clientName: q.clients?.name ?? 'Cliente',
        };
      });

      setTracked(items);
      setStats({
        loading: false,
        total: items.length,
        recentCount: items.filter(i => i.stage === 'recent').length,
        d3Count: items.filter(i => i.stage === 'd3').length,
        d7Count: items.filter(i => i.stage === 'd7').length,
        resolvedThisWeek: resolved?.length ?? 0,
      });
      setTableLoading(false);
    };

    load().catch(() => {
      setStats({ loading: false, total: 0, recentCount: 0, d3Count: 0, d7Count: 0, resolvedThisWeek: 0 });
      setTableLoading(false);
    });
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── ZONA 1: Header ───────────────────────────────────────────────── */}
        <CategoryHeader
          title="Seguimiento de Cotizaciones"
          subtitle="Agente autónomo de seguimiento — D+3 y D+7 por WhatsApp"
          icon={FileText}
          onBack={() => navigate('/agentes')}
          status={{ label: 'Activo', variant: 'primary' }}
        />

        {/* ── ZONA 1.5: Módulos relacionados ──────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Cotizaciones', path: '/quotations', icon: FileText },
            { label: 'Clientes',     path: '/clients',    icon: Users },
            { label: 'Leads',        path: '/leads',      icon: Briefcase },
            { label: 'Agenda',       path: '/agenda',     icon: Calendar },
          ].map(({ label, path, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground/60 bg-card border border-border/50 px-3 py-2 rounded-lg hover:border-primary/40 hover:text-primary/80 transition-all duration-200"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── ZONA 2: Stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="En seguimiento"
            value={stats.total}
            description="Cotizaciones activas sin respuesta"
            icon={FileText}
            color="primary"
            loading={stats.loading}
          />
          <StatCard
            label="Zona D+3"
            value={stats.d3Count}
            description="3–6 días sin respuesta"
            icon={Clock}
            color="amber"
            loading={stats.loading}
          />
          <StatCard
            label="Zona D+7"
            value={stats.d7Count}
            description="7+ días — urgente"
            icon={AlertTriangle}
            color="red"
            loading={stats.loading}
          />
          <StatCard
            label="Resueltas (7d)"
            value={stats.resolvedThisWeek}
            description="Aprobadas esta semana"
            icon={CheckCircle2}
            color="green"
            loading={stats.loading}
          />
        </div>

        {/* ── ZONA 3: Pipeline prominente ──────────────────────────────────── */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          {/* Header del pipeline */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-primary/60" />
              <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">Pipeline de seguimiento</h3>
            </div>
            {!stats.loading && (
              <span className="text-[10px] font-bold text-muted-foreground/30">{stats.total} activas</span>
            )}
          </div>

          {/* Fases en grid */}
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PIPELINE_PHASES.map((phase, i) => {
                const Icon = phase.icon;
                const count = phase.getCount(stats);
                return (
                  <div
                    key={i}
                    className={cn(
                      'relative rounded-xl border p-4 flex flex-col gap-3 transition-all duration-200',
                      phase.bg, phase.border,
                    )}
                  >
                    {/* Número + ícono */}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'text-[10px] font-black px-2 py-0.5 rounded-full',
                        phase.numBg, phase.text,
                      )}>
                        {phase.number}
                      </span>
                      <Icon className={cn('w-4 h-4', phase.text)} />
                    </div>
                    {/* Contador */}
                    {stats.loading ? (
                      <div className="h-8 w-10 bg-muted/30 rounded animate-pulse" />
                    ) : (
                      <p className={cn('text-3xl font-black leading-none', phase.text)}>{count}</p>
                    )}
                    {/* Label */}
                    <div>
                      <p className={cn('text-xs font-black leading-snug', phase.text)}>{phase.label}</p>
                      <p className="text-[10px] text-muted-foreground/35 mt-0.5">{phase.sublabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Etiquetas de fase (stepper row) */}
            <div className="mt-4 flex items-center gap-1 overflow-x-auto">
              {PIPELINE_PHASES.map((phase, i) => {
                const isLast = i === PIPELINE_PHASES.length - 1;
                return (
                  <React.Fragment key={i}>
                    <div className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black whitespace-nowrap',
                      phase.bg, phase.border, phase.text,
                    )}>
                      <span className="opacity-60">{phase.number}.</span>
                      {phase.label}
                    </div>
                    {!isLast && (
                      <svg className="w-4 h-4 text-border/40 shrink-0" fill="none" viewBox="0 0 16 16">
                        <path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Descripción de fases */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/20 border-t border-border/20">
            {PIPELINE_PHASES.map((phase, i) => (
              <div key={i} className="px-4 py-3">
                <p className={cn('text-[9px] font-black uppercase tracking-widest mb-1', phase.text)}>
                  Fase {phase.number}
                </p>
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{phase.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── ZONA 4: Tabla de seguimiento ─────────────────────────────────── */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-primary/60" />
              <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">Cotizaciones en seguimiento</h3>
            </div>
            {!tableLoading && tracked.length > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground/40">{tracked.length} activas</span>
            )}
          </div>

          {tableLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted/20 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : tracked.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/30" />
              <p className="text-sm font-bold text-muted-foreground/40">Sin cotizaciones pendientes</p>
              <p className="text-xs text-muted-foreground/30">Todas las cotizaciones han recibido respuesta</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/10">
                <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-wider">Cliente</span>
                <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-wider text-right">Monto</span>
                <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-wider text-center">Días</span>
                <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-wider text-center">Etapa</span>
                <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-wider text-center">Últ. alerta</span>
              </div>
              {/* Rows */}
              {tracked.map((q) => (
                <div
                  key={q.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 hover:bg-muted/10 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{q.clientName}</p>
                    <p className="text-[10px] text-muted-foreground/40">{q.quotation_number ?? 'Sin número'}</p>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground/60 text-right self-center">
                    {formatCOP(q.total)}
                  </p>
                  <div className="self-center text-center">
                    <span className={cn(
                      'text-xs font-black',
                      q.stage === 'd7' ? 'text-red-400' : q.stage === 'd3' ? 'text-amber-400' : 'text-primary/70',
                    )}>
                      {q.daysElapsed}d
                    </span>
                  </div>
                  <div className="self-center">
                    <StageBadge stage={q.stage} />
                  </div>
                  <div className="self-center text-center">
                    {q.alert_sent_at ? (
                      <span className="text-[10px] text-emerald-400/60 font-semibold">
                        {daysElapsed(q.alert_sent_at)}d atrás
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/25">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ZONA 5: Configuración del agente ─────────────────────────────── */}
        <div className="bg-card border border-border/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-3.5 h-3.5 text-primary/60" />
            <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">Configuración del agente</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ejecución', value: 'Diario 9:00 AM', sub: 'Colombia (COT)' },
              { label: 'Trigger D+3', value: 'WhatsApp', sub: 'Recordatorio cliente' },
              { label: 'Trigger D+7', value: 'WA + Alerta', sub: 'Cliente + comercial' },
              { label: 'Registro', value: 'alert_sent_at', sub: 'Trazabilidad en CRM' },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-muted/20 rounded-lg border border-border/30">
                <p className="text-[9px] font-black text-muted-foreground/35 uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-xs font-black text-foreground/80">{item.value}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-900/10 border border-emerald-700/20 rounded-lg">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_#4ade80]" />
            <p className="text-[11px] text-emerald-400/70 font-semibold">
              Agente activo · Monitorea cotizaciones automáticamente cada día
            </p>
          </div>
        </div>

        {/* ── ZONA 6: Nota ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 bg-muted/20 border border-border/30 rounded-xl">
          <Zap size={13} className="text-primary/50 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
              El agente opera de forma autónoma. Cada mensaje enviado queda registrado en la cotización
              para trazabilidad completa. Los recordatorios se envían por WhatsApp usando los templates
              aprobados por Meta.
            </p>
            <button
              onClick={() => navigate('/quotations')}
              className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary/60 hover:text-primary transition-colors"
            >
              Ver todas las cotizaciones <ChevronRight size={11} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SeguimientoCotizaciones;
