import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Bot, ChevronRight, Zap, TrendingUp, Package2, Heart, BarChart3 } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AgentStatus = 'activo' | 'en_desarrollo';

interface AgentDef {
  emoji: string;
  title: string;
  description: string;
  status: AgentStatus;
  metrics: string[];
  path?: string;
}

interface LayerDef {
  number: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  agents: AgentDef[];
}

// ─── Datos ───────────────────────────────────────────────────────────────────

const LAYERS: LayerDef[] = [
  {
    number: '01',
    title: 'Adquisición',
    subtitle: 'Captura y filtra oportunidades sin intervención humana',
    icon: TrendingUp,
    agents: [
      {
        emoji: '🏪',
        title: 'Motor Comercial',
        description: 'Pipeline completo de 9 fases automáticas desde el lead hasta la entrega. Orquesta 7 automatizaciones activas en producción.',
        status: 'activo',
        metrics: ['9 fases', '7 automats.', 'Pipeline vivo'],
        path: '/motor-comercial',
      },
      {
        emoji: '🤖',
        title: 'Calificador de Leads IA',
        description: 'Precalifica leads por WhatsApp usando IA. Detecta producto, presupuesto y urgencia antes de la primera llamada del comercial.',
        status: 'en_desarrollo',
        metrics: ['IA conversacional', 'Precalificación', 'WhatsApp'],
      },
      {
        emoji: '🎯',
        title: 'Detector de Abandono',
        description: 'Identifica leads sin actividad por +5 días y dispara automáticamente una secuencia de rescate al comercial responsable.',
        status: 'en_desarrollo',
        metrics: ['Inactividad 5d', 'Secuencia rescate', 'Alerta CRM'],
      },
    ],
  },
  {
    number: '02',
    title: 'Conversión',
    subtitle: 'Empuja oportunidades calificadas hasta el cierre',
    icon: Zap,
    agents: [
      {
        emoji: '📊',
        title: 'Seguimiento de Cotizaciones',
        description: 'Monitorea cotizaciones enviadas sin respuesta y dispara recordatorios D+3 y D+7 automáticamente por WhatsApp al cliente.',
        status: 'activo',
        metrics: ['D+3 / D+7', 'WhatsApp auto', 'Alerta comercial'],
        path: '/agentes/seguimiento-cotizaciones',
      },
      {
        emoji: '📅',
        title: 'Orquestador de Agenda',
        description: 'Agenda visitas técnicas automáticamente según disponibilidad, envía confirmación y recordatorio 24 h antes de la visita.',
        status: 'en_desarrollo',
        metrics: ['Auto-agendado', 'Confirmación WA', 'Recordatorio 24 h'],
      },
      {
        emoji: '💸',
        title: 'Vigía de Pagos',
        description: 'Monitorea pagos pendientes tras la aprobación y envía alertas escalonadas D+1, D+7 y D+14 al cliente y al comercial.',
        status: 'en_desarrollo',
        metrics: ['D+1/D+7/D+14', 'Cliente + comercial', 'Auto-escalado'],
      },
    ],
  },
  {
    number: '03',
    title: 'Entrega',
    subtitle: 'Mantiene al cliente informado durante producción sin esfuerzo manual',
    icon: Package2,
    agents: [
      {
        emoji: '📦',
        title: 'Notificador de Proyecto',
        description: 'Avisa automáticamente al cliente cuando su proyecto avanza de fase: diseño → materiales → fabricación → instalación.',
        status: 'en_desarrollo',
        metrics: ['Avance x fase', 'Notif. cliente', 'WhatsApp + foto'],
      },
      {
        emoji: '🔧',
        title: 'Coordinador de Producción',
        description: 'Al iniciar fabricación, notifica al taller con ficha técnica completa, medidas exactas y fecha comprometida de entrega.',
        status: 'en_desarrollo',
        metrics: ['Ficha técnica auto', 'Alerta taller', 'Fecha compromiso'],
      },
    ],
  },
  {
    number: '04',
    title: 'Retención',
    subtitle: 'Convierte clientes satisfechos en promotores activos',
    icon: Heart,
    agents: [
      {
        emoji: '⭐',
        title: 'Asistente de Postventa',
        description: 'Al entregar el proyecto, dispara encuesta de satisfacción, información de garantía y solicitud de referido personalizada.',
        status: 'en_desarrollo',
        metrics: ['Encuesta NPS', 'Info garantía', 'Solicitud referido'],
      },
      {
        emoji: '🔄',
        title: 'Reactivador de Clientes',
        description: 'A los 9 meses de un proyecto entregado, contacta al cliente para remodelación adicional o referido activo.',
        status: 'en_desarrollo',
        metrics: ['Ciclo 9 meses', 'Re-engagement', 'Referidos'],
      },
    ],
  },
  {
    number: '05',
    title: 'Inteligencia',
    subtitle: 'El sistema se analiza a sí mismo y reporta en tiempo real',
    icon: BarChart3,
    agents: [
      {
        emoji: '📈',
        title: 'Analista de Conversión',
        description: 'Reporte semanal automático vía WhatsApp: tasa Lead→Cotización→Aprobación, tiempo promedio por fase y cuellos de botella.',
        status: 'en_desarrollo',
        metrics: ['Reporte semanal', 'Conversión x fase', 'WhatsApp report'],
      },
      {
        emoji: '⚡',
        title: 'Monitor de Capacidad',
        description: 'Cruza proyectos activos vs. capacidad del taller y alerta con anticipación cuando hay riesgo de saturar producción.',
        status: 'en_desarrollo',
        metrics: ['Carga en tiempo real', 'Alerta saturación', 'Prevención retraso'],
      },
    ],
  },
];

// ─── AgentHubCard ─────────────────────────────────────────────────────────────

interface AgentHubCardProps extends AgentDef {
  onOpen?: () => void;
}

const AgentHubCard: React.FC<AgentHubCardProps> = ({
  emoji, title, description, status, metrics, onOpen,
}) => {
  const isActive = status === 'activo';

  return (
    <div
      onClick={isActive && onOpen ? onOpen : undefined}
      className={cn(
        'group relative bg-card border rounded-xl p-5 transition-all duration-300',
        isActive
          ? 'border-border hover:border-primary/50 hover:shadow-[0_0_28px_rgba(68,221,193,0.1)] cursor-pointer'
          : 'border-border/30 opacity-50 cursor-default',
      )}
    >
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
      )}

      {/* Header */}
      <div className="relative flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-xl">
          {emoji}
        </div>
        <span className={cn(
          'text-[10px] font-black px-2.5 py-1 rounded-full border tracking-wide',
          isActive
            ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40'
            : 'text-muted-foreground/50 bg-muted/30 border-border/30',
        )}>
          {isActive ? '● ACTIVO' : 'EN DISEÑO'}
        </span>
      </div>

      {/* Título y descripción */}
      <div className="relative mb-3">
        <h3 className="font-bold text-sm text-foreground mb-1.5 leading-snug">{title}</h3>
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{description}</p>
      </div>

      {/* Métricas */}
      <div className="relative flex flex-wrap gap-1.5 mb-4">
        {metrics.map((m, i) => (
          <span
            key={i}
            className="text-[10px] font-semibold text-muted-foreground/40 bg-muted/40 px-2 py-0.5 rounded border border-border/40"
          >
            {m}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div className="relative">
        {isActive ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary group-hover:gap-3 transition-all duration-200">
            Ver agente
            <ChevronRight size={13} />
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/25 font-black uppercase tracking-widest">
            Próximamente
          </p>
        )}
      </div>
    </div>
  );
};

// ─── LayerSection ─────────────────────────────────────────────────────────────

interface LayerSectionProps extends LayerDef {
  onNavigate: (path: string) => void;
}

const LayerSection: React.FC<LayerSectionProps> = ({
  number, title, subtitle, icon: Icon, agents, onNavigate,
}) => {
  const activeCount = agents.filter(a => a.status === 'activo').length;

  return (
    <div className="mb-10">
      {/* Layer header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] font-black text-primary/60 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded tracking-[0.15em]">
            CAPA {number}
          </span>
          <Icon className="w-3.5 h-3.5 text-muted-foreground/40" />
          <h2 className="text-sm font-black text-foreground tracking-tight">{title}</h2>
        </div>
        {activeCount > 0 && (
          <span className="text-[9px] font-bold text-emerald-400/70 shrink-0">
            {activeCount} activo{activeCount > 1 ? 's' : ''}
          </span>
        )}
        <div className="flex-1 h-px bg-border/20" />
      </div>
      <p className="text-[11px] text-muted-foreground/40 mb-4 leading-relaxed">{subtitle}</p>

      {/* Cards */}
      <div className={cn(
        'grid gap-3',
        agents.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2',
      )}>
        {agents.map((agent, i) => (
          <AgentHubCard
            key={i}
            {...agent}
            onOpen={agent.path ? () => onNavigate(agent.path!) : undefined}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────

const Agentes: React.FC = () => {
  const navigate = useNavigate();

  const totalActive = LAYERS.flatMap(l => l.agents).filter(a => a.status === 'activo').length;
  const totalDesign = LAYERS.flatMap(l => l.agents).filter(a => a.status === 'en_desarrollo').length;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Zona Agentes</h1>
              <p className="text-[11px] text-muted-foreground/50">
                <span className="text-emerald-400/80 font-bold">{totalActive} activos</span>
                {' · '}
                <span className="text-sky-400/60">{totalDesign} en diseño</span>
                {' · '}
                <span>5 capas de inteligencia</span>
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground/50 max-w-xl leading-relaxed">
            Sistema agéntico compilado con automatizaciones, IA y enjambres coordinados.
            Cada agente opera de forma autónoma sobre una capa específica del negocio.
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-primary/30 via-border/40 to-transparent mb-10" />

        {/* Capas */}
        {LAYERS.map((layer) => (
          <LayerSection
            key={layer.number}
            {...layer}
            onNavigate={(path) => navigate(path, { state: { from: '/agentes' } })}
          />
        ))}

        {/* Footer note */}
        <div className="mt-4 flex items-start gap-3 p-4 bg-muted/20 border border-border/30 rounded-xl">
          <Zap size={13} className="text-primary/60 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Los agentes en diseño están documentados y planificados. Cada uno se activa como una capa independiente
            sin interrumpir las automatizaciones existentes.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Agentes;
