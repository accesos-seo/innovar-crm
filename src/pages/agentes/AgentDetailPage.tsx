import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Cpu, Clock, Sparkles, Settings2, CheckCircle2, Circle, Loader2, ChevronRight, Layers, Zap, Info } from 'lucide-react';
import { CategoryHeader } from '@/components/shared/CategoryHeader';
import { MetricsGrid, MetricData } from '@/components/shared/MetricsGrid';
import { AgentSpec, getAgentById } from '@/data/agentesContent';
import { cn } from '@/lib/utils';

// ─── Phase Timeline ───────────────────────────────────────────────────────────

const PhaseTimeline: React.FC<{ fases: AgentSpec['fases'] }> = ({ fases }) => (
  <div className="space-y-0">
    {fases.map((fase, idx) => {
      const isLast = idx === fases.length - 1;
      const isPending = fase.status === 'pending';
      const isCompleted = fase.status === 'completed';
      const isCurrent = fase.status === 'current';

      return (
        <div key={fase.id} className="flex gap-4">
          {/* Line column */}
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10',
              isCompleted ? 'border-primary bg-primary/20'
                : isCurrent ? 'border-blue-500/60 bg-blue-500/10'
                : 'border-border/40 bg-muted/30',
            )}>
              {isCompleted
                ? <CheckCircle2 className="w-4 h-4 text-primary" />
                : isCurrent
                  ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  : <Circle className="w-4 h-4 text-muted-foreground/40" />}
            </div>
            {!isLast && (
              <div className="w-px flex-1 bg-border/20 my-1" />
            )}
          </div>

          {/* Content column */}
          <div className={cn('pb-6', isLast && 'pb-0')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black text-muted-foreground/40 tracking-wider">
                FASE {fase.id}
              </span>
              {isPending && (
                <span className="text-[9px] font-bold text-amber-400/60 bg-amber-900/20 border border-amber-700/30 px-1.5 py-0.5 rounded-full">
                  PENDIENTE
                </span>
              )}
              {isCurrent && (
                <span className="text-[9px] font-bold text-blue-400/70 bg-blue-900/20 border border-blue-700/30 px-1.5 py-0.5 rounded-full">
                  EN CURSO
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-foreground mb-1">{fase.label}</h4>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{fase.detalle}</p>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Related Modules ──────────────────────────────────────────────────────────

const RelatedModules: React.FC<{ modulos: AgentSpec['modulos_relacionados'] }> = ({ modulos }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-2">
      {modulos.map((m) => (
        <button
          key={m.path}
          onClick={() => navigate(m.path)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-primary/70 bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
        >
          {m.label}
          <ChevronRight size={11} />
        </button>
      ))}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AgentDetailPage: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const agent = agentId ? getAgentById(agentId) : undefined;

  if (!agent) {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Agente no encontrado.</p>
          <button
            onClick={() => navigate('/agentes')}
            className="text-sm text-primary hover:underline"
          >
            Volver a Zona Agentes
          </button>
        </div>
      </div>
    );
  }

  const tecnologiaPrimaria = agent.tecnologia ? agent.tecnologia.split('+')[0].trim() : '—';
  const triggerResumen = agent.cuando_se_activa
    ? agent.cuando_se_activa.split(' ').slice(0, 4).join(' ') + '…'
    : '—';

  const metrics: MetricData[] = [
    {
      title: 'Tecnología',
      value: tecnologiaPrimaria,
      description: agent.tecnologia ?? '',
      icon: Cpu,
      color: 'primary',
    },
    {
      title: 'Trigger',
      value: triggerResumen,
      description: agent.cuando_se_activa ?? '',
      icon: Clock,
      color: 'yellow',
    },
    {
      title: 'Fases',
      value: agent.fases.length,
      description: `${agent.fases.filter(f => f.status === 'completed').length} completadas / ${agent.fases.length} totales`,
      icon: Layers,
      color: 'blue',
    },
    {
      title: 'Estado',
      value: 'En diseño',
      description: 'Planificado · Pendiente de construcción',
      icon: Settings2,
      color: 'red',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <CategoryHeader
          title={agent.nombre}
          subtitle={`Capa ${agent.layerNumber} · ${agent.layer}`}
          icon={Bot}
          onBack={() => navigate('/agentes')}
          status={{ label: 'En diseño', variant: 'warning' }}
        />

        {/* Metrics */}
        <MetricsGrid metrics={metrics} />

        {/* "EN DISEÑO" banner */}
        <div className="flex items-start gap-3 p-4 bg-amber-900/10 border border-amber-700/30 rounded-xl mb-8">
          <Info size={14} className="text-amber-400/80 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-400/90 mb-1">Agente en diseño</p>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Este agente está documentado y planificado. Su construcción e implementación se activan
              en una fase independiente sin interrumpir las automatizaciones existentes.
              {agent.nota && <span> {agent.nota}</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Description + Modules */}
          <div className="lg:col-span-1 space-y-6">

            {/* Descripción */}
            <div className="bg-card border border-border/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} className="text-primary/60" />
                <h3 className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">¿Qué hace?</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{agent.descripcion}</p>
            </div>

            {/* Trigger */}
            <div className="bg-card border border-border/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={13} className="text-primary/60" />
                <h3 className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">¿Cuándo se activa?</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{agent.cuando_se_activa}</p>
            </div>

            {/* Output */}
            <div className="bg-card border border-border/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} className="text-primary/60" />
                <h3 className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">¿Qué produce?</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{agent.que_produce}</p>
            </div>

            {/* Related modules */}
            {agent.modulos_relacionados.length > 0 && (
              <div className="bg-card border border-border/30 rounded-xl p-5">
                <h3 className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider mb-3">Módulos relacionados</h3>
                <RelatedModules modulos={agent.modulos_relacionados} />
              </div>
            )}
          </div>

          {/* Right: Phase timeline */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border/30 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Layers size={14} className="text-primary/60" />
                <h3 className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">
                  Fases de ejecución
                </h3>
                <span className="text-[9px] font-bold text-muted-foreground/30 bg-muted/30 border border-border/30 px-2 py-0.5 rounded-full ml-auto">
                  {agent.fases.length} fases
                </span>
              </div>
              <PhaseTimeline fases={agent.fases} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AgentDetailPage;
