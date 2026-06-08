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
    textColor: 'text-emerald-300',
  },
  current: {
    icon: <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />,
    textColor: 'text-violet-300',
  },
  pending: {
    icon: <Circle className="w-4 h-4 text-slate-500" />,
    textColor: 'text-slate-500',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 text-red-400" />,
    textColor: 'text-red-300',
  },
};

const agentStatusConfig: Record<AgentStatus, { label: string; className: string; dot: string }> = {
  activo:        { label: 'Activo',      className: 'text-emerald-400 bg-emerald-900/20 border border-emerald-700/40', dot: 'bg-emerald-400' },
  standby:       { label: 'Standby',     className: 'text-amber-400 bg-amber-900/20 border border-amber-700/40',       dot: 'bg-amber-400' },
  en_desarrollo: { label: 'En diseño',   className: 'text-blue-400 bg-blue-900/20 border border-blue-700/40',          dot: 'bg-blue-400' },
};

const opportunityStatusMap: Record<string, { label: string; color: string }> = {
  nuevo:              { label: 'Nuevo',             color: 'text-blue-400' },
  new:                { label: 'Nuevo',             color: 'text-blue-400' },
  en_contacto:        { label: 'En contacto',       color: 'text-violet-400' },
  contacted:          { label: 'En contacto',       color: 'text-violet-400' },
  visita_agendada:    { label: 'Visita agendada',   color: 'text-amber-400' },
  visit_scheduled:    { label: 'Visita agendada',   color: 'text-amber-400' },
  visita_realizada:   { label: 'Visita realizada',  color: 'text-amber-300' },
  visit_completed:    { label: 'Visita realizada',  color: 'text-amber-300' },
  cotizacion_enviada: { label: 'Cotización enviada',color: 'text-cyan-400' },
  quote_sent:         { label: 'Cotización enviada',color: 'text-cyan-400' },
  aprobada:           { label: 'Aprobada',          color: 'text-emerald-400' },
  approved:           { label: 'Aprobada',          color: 'text-emerald-400' },
  pago_pendiente:     { label: 'Pago pendiente',    color: 'text-amber-400' },
  payment_pending:    { label: 'Pago pendiente',    color: 'text-amber-400' },
  pago_verificado:    { label: 'Pago verificado',   color: 'text-emerald-400' },
  payment_verified:   { label: 'Pago verificado',   color: 'text-emerald-400' },
  proyecto_activo:    { label: 'Proyecto activo',   color: 'text-green-400' },
  project_active:     { label: 'Proyecto activo',   color: 'text-green-400' },
  dormido:            { label: 'Dormido',            color: 'text-slate-400' },
  sleeping:           { label: 'Dormido',            color: 'text-slate-400' },
  perdido:            { label: 'Perdido',            color: 'text-red-400' },
  lost:               { label: 'Perdido',            color: 'text-red-400' },
  convertido:         { label: 'Convertido',         color: 'text-green-400' },
  converted:          { label: 'Convertido',         color: 'text-green-400' },
};

function getStatusDisplay(status: string) {
  return opportunityStatusMap[status] ?? { label: status, color: 'text-slate-400' };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return `hace ${Math.round(diffH * 60)}m`;
  if (diffH < 24) return `hace ${Math.round(diffH)}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD}d`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// ─── PhaseTimeline ─────────────────────────────────────────────────────────────

const PhaseTimeline: React.FC<{ fases: MotorAgente['fases'] }> = ({ fases }) => (
  <div className="relative space-y-3">
    <div className="absolute left-[7px] top-4 bottom-4 w-px bg-slate-700/70" />
    {fases.map((fase) => {
      const cfg = phaseStatusConfig[fase.status] ?? phaseStatusConfig.pending;
      return (
        <div key={fase.id} className="relative flex items-start gap-3">
          <div className="z-10 shrink-0 mt-0.5">{cfg.icon}</div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-semibold leading-tight', cfg.textColor)}>{fase.label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{fase.detalle}</p>
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
        'bg-[#212136] border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg',
        isOpen
          ? 'border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)]'
          : 'border-[#34344E] hover:border-slate-600',
      )}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-5 cursor-pointer relative overflow-hidden"
      >
        {isOpen && <div className="absolute inset-0 bg-violet-500/5 pointer-events-none" />}

        <div className="flex items-center gap-4 relative z-10">
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl border transition-all duration-300 text-2xl leading-none',
              isOpen
                ? 'bg-violet-500 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                : 'bg-[#1A1A2E] border-[#34344E]',
            )}
          >
            {agente.emoji}
          </div>
          <div>
            <h4 className={cn('text-base font-bold leading-tight transition-colors', isOpen ? 'text-white' : 'text-slate-200')}>
              {agente.nombre}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{agente.fases.length} fases</p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <span className={cn('hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold', statusCfg.className)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </span>
          <div className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full bg-[#1A1A2E] border border-[#34344E] text-slate-500 transition-transform duration-300',
            isOpen && 'rotate-180 bg-slate-800 text-white border-slate-600',
          )}>
            <ChevronDown size={15} />
          </div>
        </div>
      </div>

      {/* Panel expandido */}
      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-5 pb-6 pt-2 border-t border-[#34344E]/50 bg-[#1A1A2E]/50">

            <div className="mt-4 mb-6 p-4 rounded-lg border border-violet-500/10 bg-violet-950/10">
              <p className="text-sm text-slate-300 leading-relaxed">
                <span className="font-bold uppercase tracking-wider text-[10px] mr-2 border px-1.5 py-0.5 rounded text-violet-400 border-violet-500/20 bg-violet-500/10">
                  {statusCfg.label}
                </span>
                {agente.descripcion}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#212136]/80 border border-[#34344E] rounded-lg p-4">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-3">Fases</span>
                <PhaseTimeline fases={agente.fases} />
              </div>
              <div className="space-y-4">
                <div className="bg-[#212136]/80 border border-[#34344E] rounded-lg p-4">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Se activa cuando</span>
                  <p className="text-xs text-slate-300 leading-snug">{agente.cuando_se_activa}</p>
                </div>
                <div className="bg-[#212136]/80 border border-[#34344E] rounded-lg p-4">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Produce</span>
                  <p className="text-xs text-slate-300 leading-snug">{agente.que_produce}</p>
                </div>
              </div>
              <div className="bg-[#212136]/80 border border-[#34344E] rounded-lg p-4">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Tecnología</span>
                <p className="text-xs text-violet-400 leading-snug">{agente.tecnologia}</p>
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
        <span className="font-bold text-slate-400">{s.step}.</span>
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

type Stats = {
  loading: boolean;
  activos: number;
  cotizaciones: number;
  proyectos: number;
};

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

    async function fetchStats() {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [oppsRes, quotRes, projRes] = await Promise.all([
        supabase!
          .from('opportunities')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '(dormido,perdido,convertido,lost,sleeping,converted)'),
        supabase!
          .from('quotations')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase!
          .from('projects')
          .select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        loading: false,
        activos: oppsRes.count ?? 0,
        cotizaciones: quotRes.count ?? 0,
        proyectos: projRes.count ?? 0,
      });
    }

    async function fetchActividad() {
      const { data } = await supabase!
        .from('opportunities')
        .select('id, status, created_at, clients(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);
      setActividad((data as ActivityRow[]) ?? []);
    }

    fetchStats();
    fetchActividad();
  }, []);

  const activos = motorComercialAgentes.filter((a) => a.status === 'activo').length;

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── ZONA 1: Header ─────────────────────────────────────────────────── */}
        <CategoryHeader
          title="Motor Comercial"
          subtitle="Pipeline de ventas Innovar: 9 fases automáticas desde el lead hasta la producción"
          icon={Zap}
          onBack={() => navigate('/')}
          status={{ label: `${activos} automatizaciones activas`, variant: 'purple' }}
        />

        {/* ── ZONA 2: Stat Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <Card className="bg-[#212136] border-[#34344E] hover:border-slate-600 transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Leads activos</p>
                {stats.loading
                  ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mt-1" />
                  : <h3 className="text-2xl font-bold text-white mt-0.5">{stats.activos}</h3>}
              </div>
              <Users className="w-8 h-8 text-slate-600" />
            </CardContent>
          </Card>

          <Card className="bg-[#212136] border-[#34344E] hover:border-emerald-500/40 transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Cotizaciones (30d)</p>
                {stats.loading
                  ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mt-1" />
                  : <h3 className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.cotizaciones}</h3>}
              </div>
              <FileText className="w-8 h-8 text-emerald-600/40" />
            </CardContent>
          </Card>

          <Card className="bg-[#212136] border-[#34344E] hover:border-violet-500/40 transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Proyectos totales</p>
                {stats.loading
                  ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mt-1" />
                  : <h3 className="text-2xl font-bold text-violet-400 mt-0.5">{stats.proyectos}</h3>}
              </div>
              <FolderOpen className="w-8 h-8 text-violet-600/40" />
            </CardContent>
          </Card>

          <Card className="bg-[#212136] border-[#34344E] hover:border-blue-500/40 transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Agentes activos</p>
                <h3 className="text-2xl font-bold text-slate-300 mt-0.5">{activos}</h3>
              </div>
              <Zap className="w-8 h-8 text-blue-600/40" />
            </CardContent>
          </Card>

        </div>

        {/* ── ZONA 3: Stepper ────────────────────────────────────────────────── */}
        <ModuleStepBar />

        {/* ── Divider ────────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

        {/* ── ZONA 5: Leyenda de estados ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
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

        {/* ── ZONA 6: Agent Cards ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Automatizaciones del motor
          </h2>
          {motorComercialAgentes.map((agente) => (
            <AgentCard
              key={agente.id}
              agente={agente}
              isOpen={openCard === agente.id}
              onToggle={() => toggleCard(agente.id)}
            />
          ))}
        </div>

        {/* ── ZONA 7: Actividad reciente ──────────────────────────────────────── */}
        <div className="bg-[#1A1A2E] border border-[#34344E] rounded-xl overflow-hidden">
          <div
            onClick={() => setActividadOpen((v) => !v)}
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-violet-400" />
              <span className="text-sm font-semibold text-slate-200">Actividad reciente</span>
              {actividad.length > 0 && (
                <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50">
                  {actividad.length} oportunidades
                </span>
              )}
            </div>
            <ChevronDown
              size={15}
              className={cn('text-slate-500 transition-transform duration-300', actividadOpen && 'rotate-180')}
            />
          </div>

          <div className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            actividadOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}>
            <div className="overflow-hidden">
              <div className="border-t border-slate-800/60 px-5 py-4">
                {actividad.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-4">Sin actividad registrada.</p>
                ) : (
                  <div className="space-y-0">
                    {actividad.map((item, idx) => {
                      const { label, color } = getStatusDisplay(item.status);
                      const clientName = item.clients?.full_name ?? '—';
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-3 py-2.5 px-1',
                            idx < actividad.length - 1 && 'border-b border-slate-800/60',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 truncate">{clientName}</p>
                          </div>
                          <span className={cn('shrink-0 text-[10px] font-semibold', color)}>
                            {label}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-600 min-w-[52px] text-right">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
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
