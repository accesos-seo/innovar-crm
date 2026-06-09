import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Loader2,
  Circle,
  AlertCircle,
  ChevronDown,
  Zap,
  Users,
  FileText,
  FolderOpen,
  Activity,
  Calendar,
  UserCircle,
} from 'lucide-react';
import { CategoryHeader } from '@/components/shared/CategoryHeader';
import { supabase } from '@/lib/supabaseClient';
import {
  motorComercialAgentes,
  motorComercialSteps,
  MotorAgente,
  PhaseStatus,
  AgentStatus,
} from '@/data/motorComercialContent';

// ─── helpers ──────────────────────────────────────────────────────────────────

const phaseStatusConfig: Record<PhaseStatus, { icon: React.ReactNode; textColor: string }> = {
  completed: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    textColor: 'text-emerald-400',
  },
  current: {
    icon: <Circle className="w-4 h-4 text-primary" />,
    textColor: 'text-primary',
  },
  pending: {
    icon: <Circle className="w-4 h-4 text-muted-foreground/40" />,
    textColor: 'text-muted-foreground/60',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 text-red-400" />,
    textColor: 'text-red-400',
  },
};

const agentStatusConfig: Record<AgentStatus, { label: string; className: string; dot: string }> = {
  activo:        { label: 'Activo',     className: 'text-emerald-400 bg-emerald-900/20 border border-emerald-700/40', dot: 'bg-emerald-400' },
  standby:       { label: 'Standby',    className: 'text-amber-400  bg-amber-900/20  border border-amber-700/40',    dot: 'bg-amber-400' },
  en_desarrollo: { label: 'En diseño',  className: 'text-sky-400    bg-sky-900/20    border border-sky-700/40',       dot: 'bg-sky-400' },
};

const opportunityStatusMap: Record<string, { label: string; color: string }> = {
  nuevo:              { label: 'Nuevo',             color: 'text-primary' },
  new:                { label: 'Nuevo',             color: 'text-primary' },
  en_contacto:        { label: 'En contacto',       color: 'text-sky-400' },
  contacted:          { label: 'En contacto',       color: 'text-sky-400' },
  visita_agendada:    { label: 'Visita agendada',   color: 'text-amber-400' },
  visit_scheduled:    { label: 'Visita agendada',   color: 'text-amber-400' },
  visita_realizada:   { label: 'Visita realizada',  color: 'text-amber-300' },
  visit_completed:    { label: 'Visita realizada',  color: 'text-amber-300' },
  cotizacion_enviada: { label: 'Cotización enviada',color: 'text-primary' },
  quote_sent:         { label: 'Cotización enviada',color: 'text-primary' },
  aprobada:           { label: 'Aprobada',          color: 'text-emerald-400' },
  approved:           { label: 'Aprobada',          color: 'text-emerald-400' },
  pago_pendiente:     { label: 'Pago pendiente',    color: 'text-amber-400' },
  payment_pending:    { label: 'Pago pendiente',    color: 'text-amber-400' },
  pago_verificado:    { label: 'Pago verificado',   color: 'text-emerald-400' },
  payment_verified:   { label: 'Pago verificado',   color: 'text-emerald-400' },
  proyecto_activo:    { label: 'Proyecto activo',   color: 'text-green-400' },
  project_active:     { label: 'Proyecto activo',   color: 'text-green-400' },
  dormido:            { label: 'Dormido',            color: 'text-muted-foreground' },
  sleeping:           { label: 'Dormido',            color: 'text-muted-foreground' },
  perdido:            { label: 'Perdido',            color: 'text-red-400' },
  lost:               { label: 'Perdido',            color: 'text-red-400' },
  convertido:         { label: 'Convertido',         color: 'text-emerald-400' },
  converted:          { label: 'Convertido',         color: 'text-emerald-400' },
};

function getStatusDisplay(status: string) {
  return opportunityStatusMap[status] ?? { label: status, color: 'text-muted-foreground' };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (diffH < 1) return `hace ${Math.round(diffH * 60)}m`;
  if (diffH < 24) return `hace ${Math.round(diffH)}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD}d`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ─── Pipeline Canvas ──────────────────────────────────────────────────────────

const MODULE_NAV = [
  { label: 'Leads',        icon: Users,      path: '/leads' },
  { label: 'Cotizaciones', icon: FileText,   path: '/quotations' },
  { label: 'Proyectos',    icon: FolderOpen, path: '/projects' },
  { label: 'Agenda',       icon: Calendar,   path: '/agenda' },
  { label: 'Clientes',     icon: UserCircle, path: '/clients' },
];

const PIPELINE_PHASES = [
  { step: 1,  label: 'Captura',    fill: '#44ddc1', stroke: '#44ddc1' },
  { step: 2,  label: 'Contacto',   fill: '#818cf8', stroke: '#818cf8' },
  { step: 3,  label: 'Visita',     fill: '#818cf8', stroke: '#818cf8' },
  { step: 4,  label: 'Medidas',    fill: '#34d399', stroke: '#34d399' },
  { step: 5,  label: 'Cotización', fill: '#60a5fa', stroke: '#60a5fa' },
  { step: 6,  label: 'Aprobación', fill: '#fbbf24', stroke: '#fbbf24' },
  { step: 7,  label: 'Pago',       fill: '#fbbf24', stroke: '#fbbf24' },
  { step: 8,  label: 'Proyecto',   fill: '#34d399', stroke: '#34d399' },
  { step: 9,  label: 'Entrega',    fill: '#4ade80', stroke: '#4ade80' },
  { step: 10, label: 'Cierre',     fill: '#44ddc1', stroke: '#44ddc1' },
];

const PipelineCanvas: React.FC = () => {
  // Row 1 (top, left→right): phases 1-5
  // Row 2 (bottom, right→left): phases 6-10 (symmetric 5+5)
  const r1 = PIPELINE_PHASES.slice(0, 5).map((p, i) => ({ ...p, x: 90 + i * 175, y: 80 }));
  const r2 = PIPELINE_PHASES.slice(5).map((p, i) => ({ ...p, x: 790 - i * 175, y: 190 }));
  const all = [...r1, ...r2];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4">
        <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">
          Pipeline del Motor Comercial
        </p>
        <p className="text-[11px] text-muted-foreground/40 mt-0.5">10 fases — del lead al cierre</p>
      </div>

      <svg viewBox="0 0 900 270" className="w-full h-auto" style={{ maxHeight: 200 }}>
        <defs>
          <marker id="mc-arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#44ddc1" fillOpacity="0.45" />
          </marker>
        </defs>

        {/* Row 1 horizontal lines (left → right) */}
        {r1.slice(0, -1).map((phase, i) => (
          <line
            key={`h1-${i}`}
            x1={phase.x + 30} y1={phase.y}
            x2={r1[i + 1].x - 30} y2={r1[i + 1].y}
            stroke="#44ddc1" strokeWidth="1.5" strokeOpacity="0.35"
            markerEnd="url(#mc-arr)"
          />
        ))}

        {/* Vertical connector: phase 5 down to phase 6 */}
        <line
          x1={790} y1={80 + 30}
          x2={790} y2={190 - 30}
          stroke="#44ddc1" strokeWidth="1.5" strokeOpacity="0.35"
          markerEnd="url(#mc-arr)"
        />

        {/* Row 2 horizontal lines (right → left: 6→7→8→9) */}
        {r2.slice(0, -1).map((phase, i) => (
          <line
            key={`h2-${i}`}
            x1={phase.x - 30} y1={phase.y}
            x2={r2[i + 1].x + 30} y2={r2[i + 1].y}
            stroke="#44ddc1" strokeWidth="1.5" strokeOpacity="0.35"
            markerEnd="url(#mc-arr)"
          />
        ))}

        {/* Phase nodes */}
        {all.map((phase) => (
          <g key={phase.step}>
            {/* Outer glow */}
            <circle cx={phase.x} cy={phase.y} r={38} fill={phase.fill} opacity="0.07" />
            {/* Main circle */}
            <circle
              cx={phase.x} cy={phase.y} r={28}
              fill={phase.fill} fillOpacity="0.14"
              stroke={phase.stroke} strokeWidth="1.5" strokeOpacity="0.65"
            />
            {/* Step number */}
            <text
              x={phase.x} y={phase.y}
              textAnchor="middle" dominantBaseline="central"
              fill={phase.fill} fontSize="15" fontWeight="700"
              fontFamily="'Plus Jakarta Sans', sans-serif"
            >
              {phase.step}
            </text>
            {/* Label: row 1 above (y-46), row 2 below (y+46) — no overlap */}
            <text
              x={phase.x} y={phase.y + (phase.y < 130 ? -46 : 46)}
              textAnchor="middle"
              fill="#bbcac4" fillOpacity="0.8" fontSize="10"
              fontFamily="'Inter', sans-serif"
            >
              {phase.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── PhaseTimeline ─────────────────────────────────────────────────────────────

const PhaseTimeline: React.FC<{ fases: MotorAgente['fases'] }> = ({ fases }) => (
  <div className="relative space-y-3">
    <div className="absolute left-[7px] top-4 bottom-4 w-px bg-border/50" />
    {fases.map((fase) => {
      const cfg = phaseStatusConfig[fase.status] ?? phaseStatusConfig.pending;
      return (
        <div key={fase.id} className="relative flex items-start gap-3">
          <div className="z-10 shrink-0 mt-0.5">{cfg.icon}</div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-semibold leading-tight', cfg.textColor)}>{fase.label}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug">{fase.detalle}</p>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── AgentCard ─────────────────────────────────────────────────────────────────

const AgentCard: React.FC<{
  agente: MotorAgente;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ agente, isOpen, onToggle }) => {
  const statusCfg = agentStatusConfig[agente.status] ?? agentStatusConfig.standby;

  return (
    <div
      className={cn(
        'bg-card border rounded-xl overflow-hidden transition-all duration-300',
        isOpen
          ? 'border-primary/40 shadow-[0_0_24px_rgba(68,221,193,0.12)]'
          : 'border-border hover:border-primary/30 hover:shadow-[0_0_16px_rgba(68,221,193,0.08)] cursor-pointer',
      )}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-5 cursor-pointer relative overflow-hidden"
      >
        {isOpen && <div className="absolute inset-0 bg-primary/[0.04] pointer-events-none" />}

        <div className="flex items-center gap-4 relative z-10">
          <div
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 text-lg leading-none',
              isOpen
                ? 'bg-primary border-primary/60 shadow-[0_0_14px_rgba(68,221,193,0.35)]'
                : 'bg-muted border-border',
            )}
          >
            {agente.emoji}
          </div>
          <div>
            <h4 className={cn(
              'text-base font-bold leading-tight transition-colors',
              isOpen ? 'text-foreground' : 'text-foreground/80',
            )}>
              {agente.nombre}
            </h4>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">{agente.fases.length} fases</p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <span className={cn('hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold', statusCfg.className)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </span>
          <div className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full bg-muted border border-border text-muted-foreground transition-all duration-300',
            isOpen && 'rotate-180 border-primary/40 text-primary',
          )}>
            <ChevronDown size={15} />
          </div>
        </div>
      </div>

      {/* Panel expandido */}
      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-5 pb-6 pt-2 border-t border-border/50 bg-muted/20">

            <div className="mt-4 mb-5 p-4 rounded-lg border border-primary/10 bg-primary/5">
              <p className="text-sm text-foreground/80 leading-relaxed">
                <span className="font-bold uppercase tracking-wider text-[10px] mr-2 border px-1.5 py-0.5 rounded text-primary border-primary/25 bg-primary/10">
                  {statusCfg.label}
                </span>
                {agente.descripcion}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider block mb-3">Fases</span>
                <PhaseTimeline fases={agente.fases} />
              </div>
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider block mb-2">Se activa cuando</span>
                  <p className="text-xs text-foreground/70 leading-snug">{agente.cuando_se_activa}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider block mb-2">Produce</span>
                  <p className="text-xs text-foreground/70 leading-snug">{agente.que_produce}</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider block mb-2">Tecnología</span>
                <p className="text-xs text-primary/80 leading-snug">{agente.tecnologia}</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ModuleStepBar ─────────────────────────────────────────────────────────────

const ModuleStepBar: React.FC = () => (
  <div className="flex flex-wrap gap-2">
    {motorComercialSteps.map((s) => (
      <div key={s.step} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium', s.bg)}>
        <span className="font-bold text-muted-foreground/60">{s.step}.</span>
        <span className={s.color}>{s.label}</span>
      </div>
    ))}
  </div>
);

// ─── Tipos para actividad ───────────────────────────────────────────────────────

type ActivityRow = {
  id: string;
  status: string;
  created_at: string;
  clients?: { full_name?: string } | null;
};

type Stats = { loading: boolean; activos: number; cotizaciones: number; proyectos: number };

// ─── Página principal ──────────────────────────────────────────────────────────

const MotorComercial: React.FC = () => {
  const navigate = useNavigate();
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [actividadOpen, setActividadOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({ loading: true, activos: 0, cotizaciones: 0, proyectos: 0 });
  const [actividad, setActividad] = useState<ActivityRow[]>([]);

  const toggleCard = (id: string) => setOpenCard((prev) => (prev === id ? null : id));

  useEffect(() => {
    if (!supabase) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    Promise.all([
      supabase
        .from('opportunities')
        .select('id', { count: 'exact', head: true })
        .not('status', 'in', '(dormido,perdido,convertido,lost,sleeping,converted)'),
      supabase
        .from('quotations')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true }),
    ])
      .then(([oppsRes, quotRes, projRes]) => {
        setStats({
          loading: false,
          activos: oppsRes.count ?? 0,
          cotizaciones: quotRes.count ?? 0,
          proyectos: projRes.count ?? 0,
        });
      })
      .catch(() => {
        setStats({ loading: false, activos: 0, cotizaciones: 0, proyectos: 0 });
      });

    supabase
      .from('opportunities')
      .select('id, status, created_at, clients(full_name)')
      .order('created_at', { ascending: false })
      .limit(10)
      .then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          setActividad(res.data as ActivityRow[]);
        }
      })
      .catch((err) => {
        console.error('Error fetching actividad:', err);
      });
  }, []);

  const agentesActivos = motorComercialAgentes.filter((a) => a.status === 'activo').length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── ZONA 1: Header ─────────────────────────────────────────────────── */}
        <CategoryHeader
          title="Motor Comercial"
          subtitle="Pipeline de ventas Innovar: 10 fases automáticas desde el lead hasta el cierre"
          icon={Zap}
          onBack={() => navigate('/agentes')}
          status={{ label: `${agentesActivos} automatizaciones activas`, variant: 'primary' }}
        />

        {/* ── ZONA 2: Stat Cards & Metrics ──────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">📊 Métricas en vivo</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <Card className="bg-card border-border hover:border-primary/30 hover:shadow-[0_0_14px_rgba(68,221,193,0.07)] transition-all duration-300">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads activos</p>
                {stats.loading
                  ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mt-1" />
                  : <h3 className="text-2xl font-bold text-foreground mt-0.5">{stats.activos}</h3>}
              </div>
              <Users className="w-8 h-8 text-muted-foreground/30" />
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-emerald-500/30 hover:shadow-[0_0_14px_rgba(52,211,153,0.07)] transition-all duration-300">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cotizaciones (30d)</p>
                {stats.loading
                  ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mt-1" />
                  : <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.cotizaciones}</h3>}
              </div>
              <FileText className="w-8 h-8 text-emerald-400/20" />
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-primary/30 hover:shadow-[0_0_14px_rgba(68,221,193,0.07)] transition-all duration-300">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Proyectos totales</p>
                {stats.loading
                  ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mt-1" />
                  : <h3 className="text-2xl font-bold text-primary mt-0.5">{stats.proyectos}</h3>}
              </div>
              <FolderOpen className="w-8 h-8 text-primary/20" />
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:border-sky-500/30 hover:shadow-[0_0_14px_rgba(56,189,248,0.07)] transition-all duration-300">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agentes activos</p>
                <h3 className="text-2xl font-bold text-foreground/80 mt-0.5">{agentesActivos}</h3>
              </div>
              <Zap className="w-8 h-8 text-sky-400/20" />
            </CardContent>
          </Card>

        </div>
        </div>

        {/* ── Divisor visual ────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* ── ZONA 3: Navegación & Stepper ──────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">🔗 Acceso rápido</p>
          <div className="flex items-center gap-2 flex-wrap">
          {MODULE_NAV.map((mod) => (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path, { state: { from: '/motor-comercial' } })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-muted-foreground text-xs hover:border-primary/40 hover:text-primary transition-colors"
            >
              <mod.icon size={12} />
              {mod.label}
            </button>
          ))}
        </div>
        </div>

        {/* ── ZONA 3: Stepper ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">📋 Pipeline de fases</p>
          <ModuleStepBar />
        </div>

        {/* ── Divisor visual ────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* ── ZONA 4: Pipeline Canvas & Legend ──────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">🎯 Flujo del motor comercial</p>
          <PipelineCanvas />

          {/* ── Legend ────────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground/60">
            {(Object.entries(phaseStatusConfig) as [PhaseStatus, typeof phaseStatusConfig[PhaseStatus]][]).map(
              ([key, cfg]) => (
                <span key={key} className="flex items-center gap-1.5">
                  {cfg.icon}
                  <span className={cfg.textColor}>
                    {key === 'completed' ? 'Completada' : key === 'current' ? 'En curso' : key === 'pending' ? 'Planificada' : 'Error'}
                  </span>
                </span>
              ),
            )}
          </div>
        </div>

        {/* ── Divisor visual ────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* ── ZONA 5: Agent Cards (2 por fila, expand a full-width) ─────────── */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-wider">
            Automatizaciones del motor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {motorComercialAgentes.map((agente) => (
              <div
                key={agente.id}
                className={cn('col-span-1', openCard === agente.id && 'md:col-span-2')}
              >
                <AgentCard
                  agente={agente}
                  isOpen={openCard === agente.id}
                  onToggle={() => toggleCard(agente.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── ZONA 7: Actividad reciente ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div
            onClick={() => setActividadOpen((v) => !v)}
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-accent/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-primary" />
              <span className="text-sm font-semibold text-foreground/80">Actividad reciente</span>
              {actividad.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60 bg-muted/60 px-2 py-0.5 rounded-full border border-border/50">
                  {actividad.length} oportunidades
                </span>
              )}
            </div>
            <ChevronDown
              size={15}
              className={cn('text-muted-foreground/40 transition-transform duration-300', actividadOpen && 'rotate-180')}
            />
          </div>

          <div className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            actividadOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}>
            <div className="overflow-hidden">
              <div className="border-t border-border/50 px-5 py-4">
                {actividad.length === 0 ? (
                  <p className="text-xs text-muted-foreground/40 text-center py-4">Sin actividad registrada.</p>
                ) : (
                  actividad.map((item, idx) => {
                    const { label, color } = getStatusDisplay(item.status);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 py-2.5 px-1',
                          idx < actividad.length - 1 && 'border-b border-border/30',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground/70 truncate">
                            {item.clients?.full_name ?? '—'}
                          </p>
                        </div>
                        <span className={cn('shrink-0 text-[10px] font-semibold', color)}>{label}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground/40 min-w-[52px] text-right">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MotorComercial;
