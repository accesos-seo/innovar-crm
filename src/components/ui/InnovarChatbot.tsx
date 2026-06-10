import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, X, Send, Zap, Sparkles,
  Maximize2, Minimize2,
  CalendarDays, DollarSign, FolderOpen, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';

interface Message {
  id: string;
  type: 'bot' | 'user';
  text: string;
  timestamp: string;
}

interface BotResponse {
  ok: boolean;
  reply?: string;
  error?: string;
}

const QuickAction = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 p-3',
      'bg-zinc-900/50 border border-zinc-800',
      'hover:border-[var(--primary)]/50 hover:bg-zinc-800',
      'transition-all duration-300 group text-left rounded-sm',
    )}
  >
    <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-sm text-zinc-500 group-hover:text-[var(--primary)] transition-colors">
      <Icon className="w-4 h-4" />
    </div>
    <span className="text-xs font-bold text-zinc-300 group-hover:text-white tracking-wider">
      {label}
    </span>
  </button>
);

export const InnovarChatbot: React.FC = () => {
  const { profile } = useAuthStore();

  const [isOpen, setIsOpen]           = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputValue, setInputValue]   = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const firstName = React.useMemo(() => {
    const name = profile?.full_name?.trim();
    if (!name) return '';
    return name.split(' ')[0] ?? '';
  }, [profile?.full_name]);

  const welcomeText = `${firstName ? `¡Hola, ${firstName}!` : '¡Hola!'} Soy NOVA, tu asistente ejecutivo de Cocinas Innovar. Puedo consultarte finanzas del mes, proyectos activos, tareas vencidas, pipeline comercial y tu agenda. ¿En qué te ayudo?`;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      text: welcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Actualiza bienvenida cuando carga el perfil
  useEffect(() => {
    setMessages(prev => {
      if (!prev.length || prev[0]?.type !== 'bot') return prev;
      if (prev[0].text === welcomeText) return prev;
      return [{ ...prev[0], text: welcomeText }, ...prev.slice(1)];
    });
  }, [welcomeText]);

  // Scroll al fondo en cada mensaje nuevo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string = inputValue) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sesión expirada. Recargá la página.');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-innovar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message: text }),
        },
      );

      const payload = (await res.json().catch(() => null)) as BotResponse | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `HTTP ${res.status}`);
      }

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: payload.reply ?? '(respuesta vacía)',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(msg);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          text: `⚠️ ${msg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Solo visible para admin y super_admin
  if (profile && profile.role !== 'super_admin' && profile.role !== 'admin') return null;

  return (
    <>
      {/* ── FAB ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-6 z-50 group animate-in zoom-in duration-300"
          aria-label="Abrir asistente NOVA"
        >
          <div className="absolute inset-0 bg-[var(--primary)]/20 rounded-full blur-xl animate-pulse group-hover:bg-[var(--primary)]/30 transition-all" />
          <div className="relative w-14 h-14 bg-zinc-950 border border-[var(--primary)]/50 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(68,221,193,0.08)_50%)] bg-[size:100%_4px] pointer-events-none" />
            <Bot className="w-6 h-6 text-[var(--primary)] drop-shadow-[0_0_5px_rgba(68,221,193,0.8)]" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-emerald-500 rounded-full border border-zinc-900 animate-pulse" />
          </div>
        </button>
      )}

      {/* ── Ventana de chat ── */}
      {isOpen && (
        <div
          className={cn(
            'fixed bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl z-50',
            'flex flex-col overflow-hidden font-sans',
            'animate-in slide-in-from-bottom-10 fade-in duration-300',
            'inset-0 sm:inset-auto',
            isMaximized
              ? 'sm:top-[5vh] sm:left-[5vw] sm:right-[5vw] sm:bottom-[5vh] sm:w-auto sm:h-auto sm:rounded-xl'
              : 'sm:bottom-6 sm:right-6 sm:w-[640px] sm:max-w-[92vw] sm:h-[min(80vh,820px)] sm:rounded-lg',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 bg-zinc-950 border border-zinc-800 rounded-sm flex items-center justify-center relative">
                <Bot className="w-5 h-5 text-[var(--primary)]" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-800">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10B981]" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black italic text-white tracking-wide">NOVA</h3>
                <p className="text-[10px] text-[var(--primary)] font-mono tracking-wider flex items-center gap-1">
                  <Sparkles className="w-2 h-2" /> Cocinas Innovar · Panel Director
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={() => setIsMaximized(p => !p)}
                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-sm transition-colors hidden sm:inline-flex"
                aria-label="Maximizar"
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-sm transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950/50 pointer-events-none" />

            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col max-w-[85%] relative z-10',
                  'animate-in fade-in slide-in-from-bottom-2 duration-300',
                  msg.type === 'user' ? 'ml-auto items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'px-4 py-3 text-sm leading-relaxed border rounded-sm whitespace-pre-wrap break-words',
                    msg.type === 'user'
                      ? 'bg-zinc-800 text-white border-zinc-700 rounded-tr-none'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 rounded-tl-none border-l-2 border-l-[var(--primary)]',
                  )}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-zinc-600 font-mono mt-1 px-1">
                  {msg.type === 'bot' ? 'NOVA' : 'DIRECTOR'} • {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Indicador de escritura */}
            {isTyping && (
              <div className="flex items-center gap-1 ml-2 animate-in fade-in duration-300">
                <span className="w-1.5 h-1.5 bg-[var(--primary)]/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-[var(--primary)]/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-[var(--primary)]/50 rounded-full animate-bounce" />
              </div>
            )}

            {/* Accesos rápidos */}
            {!isTyping && messages.at(-1)?.type === 'bot' && (
              <div className="grid grid-cols-1 gap-2 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 relative z-10">
                <p className="text-[10px] text-zinc-500 font-black tracking-[0.2em] mb-1 flex items-center gap-2">
                  <Zap className="w-3 h-3 text-[var(--primary)]" /> Accesos Rápidos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <QuickAction
                    icon={CalendarDays}
                    label="Resumen Hoy"
                    onClick={() => handleSendMessage('dame el resumen del día de hoy')}
                  />
                  <QuickAction
                    icon={DollarSign}
                    label="Finanzas del Mes"
                    onClick={() => handleSendMessage('resumen financiero del mes actual')}
                  />
                  <QuickAction
                    icon={FolderOpen}
                    label="Proyectos Activos"
                    onClick={() => handleSendMessage('estado de todos los proyectos en curso')}
                  />
                  <QuickAction
                    icon={AlertTriangle}
                    label="Pendientes Críticos"
                    onClick={() => handleSendMessage('tareas vencidas y pagos sin verificar')}
                  />
                </div>
              </div>
            )}

            <div className="h-2" />
          </div>

          {/* Footer / Input */}
          <div className="p-4 bg-zinc-950 border-t border-zinc-800 relative z-20">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta aquí..."
                className="w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-sm py-3 pl-4 pr-12 focus:outline-none focus:border-[var(--primary)]/50 focus:bg-zinc-900/80 transition-all font-mono placeholder:text-zinc-600"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isTyping}
                className="absolute right-2 top-2 p-1.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-black rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[8px] text-zinc-600 mt-2 text-center font-mono tracking-wider">
              Powered by Innovar Intelligence v1.0 · DeepSeek via OpenRouter
            </p>
          </div>
        </div>
      )}
    </>
  );
};
