import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Bot, ChevronRight, Zap } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AgentStatus = 'activo' | 'en_desarrollo';

interface AgentHubCardProps {
  emoji: string;
  title: string;
  description: string;
  status: AgentStatus;
  metrics: string[];
  onOpen?: () => void;
}

// ─── AgentHubCard ─────────────────────────────────────────────────────────────

const AgentHubCard: React.FC<AgentHubCardProps> = ({
  emoji,
  title,
  description,
  status,
  metrics,
  onOpen,
}) => {
  const isActive = status === 'activo';

  return (
    <div
      onClick={isActive && onOpen ? onOpen : undefined}
      className={cn(
        'group relative bg-card border rounded-xl p-6 transition-all duration-300',
        isActive
          ? 'border-border hover:border-primary/40 hover:shadow-[0_0_24px_rgba(68,221,193,0.09)] cursor-pointer'
          : 'border-border/40 opacity-60 cursor-default',
      )}
    >
      {/* Fondo sutil activo */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
      )}

      {/* Header: emoji + badge */}
      <div className="relative flex items-start justify-between mb-5">
        <div className="w-14 h-14 rounded-xl bg-muted border border-border flex items-center justify-center text-2xl">
          {emoji}
        </div>
        <span
          className={cn(
            'text-[10px] font-bold px-2.5 py-1 rounded-full border',
            isActive
              ? 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40'
              : 'text-sky-400 bg-sky-900/20 border-sky-700/40',
          )}
        >
          {isActive ? 'Activo' : 'En diseño'}
        </span>
      </div>

      {/* Título y descripción */}
      <div className="relative mb-4">
        <h3 className="font-bold text-base text-foreground mb-1.5">{title}</h3>
        <p className="text-xs text-muted-foreground/70 leading-relaxed">{description}</p>
      </div>

      {/* Métricas */}
      <div className="relative flex flex-wrap gap-2 mb-5">
        {metrics.map((m, i) => (
          <span
            key={i}
            className="text-[10px] font-semibold text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-md border border-border/50"
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
            <ChevronRight size={14} />
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/30 font-semibold uppercase tracking-wider">
            Próximamente
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Página ───────────────────────────────────────────────────────────────────

const Agentes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-5xl mx-auto">

        {/* Header del área */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Zona Agentes</h1>
              <p className="text-xs text-muted-foreground/60">Automatizaciones activas del CRM</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground/60 max-w-lg leading-relaxed">
            Área exclusiva de agentes autónomos. Cada agente gestiona un conjunto de operaciones
            sin intervención humana — desde la captura del lead hasta el cierre del proyecto.
          </p>
        </div>

        {/* Divider decorativo */}
        <div className="w-full h-px bg-gradient-to-r from-primary/20 via-border to-transparent mb-8" />

        {/* Grid de agentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <AgentHubCard
            emoji="🏪"
            title="Motor Comercial"
            description="Pipeline completo de ventas: desde la captura del lead hasta la entrega del proyecto. 9 fases automáticas coordinadas por 7 automatizaciones en producción."
            status="activo"
            metrics={['9 fases', '7 automatizaciones', '2 en diseño']}
            onOpen={() => navigate('/motor-comercial', { state: { from: '/agentes' } })}
          />

          <AgentHubCard
            emoji="📊"
            title="Seguimiento de Cotizaciones"
            description="Monitorea cotizaciones enviadas sin respuesta y dispara recordatorios D+3 y D+7 automáticamente por WhatsApp."
            status="en_desarrollo"
            metrics={['D+3 / D+7', 'WhatsApp automático', 'Alerta al comercial']}
          />

          <AgentHubCard
            emoji="🤖"
            title="Calificador de Leads IA"
            description="Precalifica leads por WhatsApp usando inteligencia artificial. Detecta producto, presupuesto y urgencia sin que el comercial tenga que hacer la llamada inicial."
            status="en_desarrollo"
            metrics={['IA conversacional', 'Precalificación', 'WhatsApp']}
          />

        </div>

        {/* Nota informativa */}
        <div className="mt-8 flex items-start gap-3 p-4 bg-muted/30 border border-border/50 rounded-xl">
          <Zap size={14} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            Los agentes en diseño están documentados y planificados. Se activarán en las
            próximas fases del sistema.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Agentes;
