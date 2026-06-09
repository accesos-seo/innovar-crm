import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bot, ChevronDown, ChevronRight, CheckCircle2, Circle, Loader2,
  Clock, Cpu, Sparkles, Zap, Info,
} from 'lucide-react';
import { CategoryHeader } from '@/components/shared/CategoryHeader';
import { AgentSpec, AgentPhaseStatus, getAgentById } from '@/data/agentesContent';
import { cn } from '@/lib/utils';

// ─── Phase flow SVG ───────────────────────────────────────────────────────────

const PHASE_COLORS = [
  { fill: '#44ddc1', stroke: '#44ddc1' },
  { fill: '#818cf8', stroke: '#818cf8' },
  { fill: '#60a5fa', stroke: '#60a5fa' },
  { fill: '#34d399', stroke: '#34d399' },
  { fill: '#fbbf24', stroke: '#fbbf24' },
  { fill: '#f472b6', stroke: '#f472b6' },
];

const PhaseFlowCanvas: React.FC<{ fases: AgentSpec['fases'] }> = ({ fases }) => {
  const n = fases.length;
  if (n === 0) return null;
  const W = 880;
  const spacing = W / (n + 1);
  const nodeY = 75;
  const r = 28;

  const nodes = fases.map((fase, i) => ({
    ...fase,
    x: spacing * (i + 1),
    y: nodeY,
    color: PHASE_COLORS[i % PHASE_COLORS.length],
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="mb-4">
        <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">
          Flujo de ejecución
        </p>
        <p className="text-[11px] text-muted-foreground/40 mt-0.5">{n} fases — secuencia automática</p>
      </div>

      <svg viewBox={`0 0 ${W} 160`} className="w-full h-auto" style={{ maxHeight: 120 }}>
        <defs>
          <marker id="ag-arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#44ddc1" fillOpacity="0.45" />
          </marker>
        </defs>

        {nodes.slice(0, -1).map((node, i) => (
          <line
            key={`line-${i}`}
            x1={node.x + r} y1={node.y}
            x2={nodes[i + 1].x - r} y2={nodes[i + 1].y}
            stroke="#44ddc1" strokeWidth="1.5" strokeOpacity="0.35"
            markerEnd="url(#ag-arr)"
          />
        ))}

        {nodes.map((node, i) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={r + 10} fill={node.color.fill} opacity="0.07" />
            <circle
              cx={node.x} cy={node.y} r={r}
              fill={node.color.fill} fillOpacity="0.14"
              stroke={node.color.stroke} strokeWidth="1.5" strokeOpacity="0.65"
            />
            <text
              x={node.x} y={node.y}
              textAnchor="middle" dominantBaseline="central"
              fill={node.color.fill} fontSize="14" fontWeight="700"
              fontFamily="'Plus Jakarta Sans', sans-serif"
            >
              {i + 1}
            </text>
            <text
              x={node.x} y={node.y + 50}
              textAnchor="middle"
              fill="#bbcac4" fillOpacity="0.8" fontSize="9.5"
              fontFamily="'Inter', sans-serif"
            >
              {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// ─── Phase Card (expandable) ───────────────────────────────────────────────────

const phaseStatusMap: Record<AgentPhaseStatus, { icon: React.ReactNode; color: string; label: string }> = {
  completed: {
    icon: <CheckCircle2 size={13} className="text-emerald-400" />,
    color: 'text-emerald-400',
    label: 'Completada',
  },
  current: {
    icon: <Loader2 size={13} className="text-primary animate-spin" />,
    color: 'text-primary',
    label: 'En curso',
  },
  pending: {
    icon: <Circle size={13} className="text-muted-foreground/40" />,
    color: 'text-muted-foreground/50',
    label: 'Pendiente',
  },
};

const PhaseCard: React.FC<{
  fase: AgentSpec['fases'][number];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ fase, index, isOpen, onToggle }) => {
  const cfg = phaseStatusMap[fase.status] ?? phaseStatusMap.pending;
  const color = PHASE_COLORS[index % PHASE_COLORS.length];

  return (
    <div
      className={cn(
        'bg-card border rounded-xl overflow-hidden transition-all duration-300',
        isOpen
          ? 'border-primary/40 shadow-[0_0_20px_rgba(68,221,193,0.10)]'
          : 'border-border hover:border-primary/30 hover:shadow-[0_0_12px_rgba(68,221,193,0.07)] cursor-pointer',
      )}
    >
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 cursor-pointer relative overflow-hidden"
      >
        {isOpen && <div className="absolute inset-0 bg-primary/[0.03] pointer-events-none" />}

        <div className="flex items-center gap-3 relative z-10">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl border text-sm font-bold leading-none transition-all duration-300"
            style={{
              backgroundColor: `${color.fill}1a`,
              borderColor: isOpen ? `${color.stroke}70` : `${color.stroke}30`,
              color: color.fill,
            }}
          >
            {fase.id}
          </div>
          <div>
            <p className={cn(
              'text-sm font-bold leading-tight transition-colors',
              isOpen ? 'text-foreground' : 'text-foreground/80',
            )}>
              {fase.label}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {cfg.icon}
              <span className={cn('text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
            </div>
          </div>
        </div>

        <div className={cn(
          'w-7 h-7 flex items-center justify-center rounded-full bg-muted border border-border text-muted-foreground transition-all duration-300 relative z-10',
          isOpen && 'rotate-180 border-primary/40 text-primary',
        )}>
          <ChevronDown size={13} />
        </div>
      </div>

      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-3 border-t border-border/50 bg-muted/10">
            <p className="text-xs text-foreground/70 leading-relaxed">{fase.detalle}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Info block ────────────────────────────────────────────────────────────────

const InfoBlock: React.FC<{ icon: React.ElementType; label: string; content: string }> = ({
  icon: Icon, label, content,
}) => (
  <div className="bg-card border border-border/30 rounded-xl p-5 flex flex-col gap-3 h-full">
    <div className="flex items-center gap-2">
      <Icon size={13} className="text-primary/60" />
      <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-sm text-foreground/80 leading-relaxed flex-1">{content}</p>
  </div>
);

// ─── Config stat card ─────────────────────────────────────────────────────────

const STAT_STYLES = [
  { value: 'text-primary',    glow: 'hover:shadow-[0_0_14px_rgba(68,221,193,0.09)]',  hover: 'hover:border-primary/30'   },
  { value: 'text-sky-400',   glow: 'hover:shadow-[0_0_14px_rgba(56,189,248,0.09)]',  hover: 'hover:border-sky-400/30'   },
  { value: 'text-indigo-400',glow: 'hover:shadow-[0_0_14px_rgba(129,140,248,0.09)]', hover: 'hover:border-indigo-400/30' },
  { value: 'text-amber-400', glow: 'hover:shadow-[0_0_14px_rgba(251,191,36,0.09)]',  hover: 'hover:border-amber-400/30' },
];

const ConfigCard: React.FC<{ item: AgentSpec['config'][number]; index: number }> = ({ item, index }) => {
  const s = STAT_STYLES[index % STAT_STYLES.length];
  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 flex flex-col gap-1 transition-all duration-300',
      s.glow, s.hover,
    )}>
      <p className="text-xs text-muted-foreground">{item.label}</p>
      <p className={cn('text-xl font-bold leading-tight mt-0.5', s.value)}>{item.value}</p>
      <p className="text-[10px] text-muted-foreground/50 leading-snug">{item.description}</p>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AgentDetailPage: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [openPhase, setOpenPhase] = useState<number | null>(null);

  const agent = agentId ? getAgentById(agentId) : undefined;

  if (!agent) {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Agente no encontrado.</p>
          <button onClick={() => navigate('/agentes')} className="text-sm text-primary hover:underline">
            Volver a Zona Agentes
          </button>
        </div>
      </div>
    );
  }

  const togglePhase = (id: number) => setOpenPhase((prev) => (prev === id ? null : id));

  const headerStatus = agent.status === 'activo'
    ? { label: 'Activo', variant: 'primary' as const }
    : { label: 'En diseño', variant: 'warning' as const };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── ZONA 1: Header ─────────────────────────────────────────────────── */}
        <CategoryHeader
          title={agent.nombre}
          subtitle={`Capa ${agent.layerNumber} · ${agent.layer}`}
          icon={Bot}
          onBack={() => navigate('/agentes')}
          status={headerStatus}
        />

        {/* ── ZONA 2: Config stat cards ──────────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">⚙️ Configuración del agente</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agent.config.map((item, i) => (
              <ConfigCard key={`config-${i}`} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* ── ZONA 3: Descripción funcional ──────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">📋 Descripción funcional</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoBlock icon={Zap}      label="¿Qué hace?"           content={agent.descripcion}       />
            <InfoBlock icon={Clock}    label="¿Cuándo se activa?"   content={agent.cuando_se_activa}  />
            <InfoBlock icon={Sparkles} label="¿Qué produce?"        content={agent.que_produce}       />
          </div>
          {agent.nota && (
            <div className="flex items-start gap-3 p-4 bg-amber-900/10 border border-amber-700/30 rounded-xl">
              <Info size={13} className="text-amber-400/80 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                <span className="font-bold text-amber-400/90 mr-1">Nota:</span>{agent.nota}
              </p>
            </div>
          )}
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* ── ZONA 4: Flujo SVG ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">🎯 Flujo de ejecución</p>
          <PhaseFlowCanvas fases={agent.fases} />
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* ── ZONA 5: Fases expandibles (2 por fila, se expanden a full) ─────── */}
        <div className="space-y-4">
          <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">📊 Fases detalladas</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agent.fases.map((fase, i) => (
              <div
                key={fase.id}
                className={cn('col-span-1', openPhase === fase.id && 'md:col-span-2')}
              >
                <PhaseCard
                  fase={fase}
                  index={i}
                  isOpen={openPhase === fase.id}
                  onToggle={() => togglePhase(fase.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── ZONA 6: Tecnología + módulos relacionados ──────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Cpu size={13} className="text-muted-foreground/40" />
            <span className="text-[11px] text-muted-foreground/40">{agent.tecnologia}</span>
          </div>

          {agent.modulos_relacionados.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {agent.modulos_relacionados.map((m) => (
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
          )}
        </div>

      </div>
    </div>
  );
};

export default AgentDetailPage;
