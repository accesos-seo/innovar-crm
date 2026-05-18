import { Toaster as SonnerToaster, toast } from "sonner";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// 1. Componente Toaster Configurado
export function PremiumToaster() {
  return (
    <SonnerToaster
      position="top-right"
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-full md:w-[380px] relative group",
          title: "text-sm font-black uppercase tracking-tight italic",
          description: "text-xs font-medium opacity-80 leading-relaxed",
        },
      }}
    />
  );
}

// 2. Utilidad de Notificación Estilizada
export const notify = {
  success: (title: string, description?: string) => {
    toast.custom((t) => (
      <div className="w-full bg-emerald-950/40 border-emerald-500/30 text-emerald-400 p-5 rounded-2xl border backdrop-blur-xl shadow-[0_0_20px_rgba(16,185,129,0.1)] flex gap-4 relative group">
        <button
          onClick={() => toast.dismiss(t)}
          className="absolute -top-2 -left-2 p-1 rounded-full bg-emerald-950 border border-emerald-500/30 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="p-2 bg-emerald-500/10 rounded-lg h-fit">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black uppercase tracking-tight italic">¡{title}!</h3>
          {description && <p className="text-xs font-medium opacity-80">{description}</p>}
        </div>
      </div>
    ));
  },
  error: (title: string, description?: string) => {
    toast.custom((t) => (
      <div className="w-full bg-rose-950/40 border-rose-500/30 text-rose-400 p-5 rounded-2xl border backdrop-blur-xl shadow-[0_0_20px_rgba(244,63,94,0.1)] flex gap-4 relative group">
        <button
          onClick={() => toast.dismiss(t)}
          className="absolute -top-2 -left-2 p-1 rounded-full bg-rose-950 border border-rose-500/30 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="p-2 bg-rose-500/10 rounded-lg h-fit">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black uppercase tracking-tight italic">Error: {title}</h3>
          {description && <p className="text-xs font-medium opacity-80">{description}</p>}
        </div>
      </div>
    ));
  },
  warning: (title: string, description?: string) => {
    toast.custom((t) => (
      <div className="w-full bg-amber-950/40 border-amber-500/30 text-amber-400 p-5 rounded-2xl border backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.1)] flex gap-4 relative group">
        <button
          onClick={() => toast.dismiss(t)}
          className="absolute -top-2 -left-2 p-1 rounded-full bg-amber-950 border border-amber-500/30 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="p-2 bg-amber-500/10 rounded-lg h-fit">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black uppercase tracking-tight italic">Atención: {title}</h3>
          {description && <p className="text-xs font-medium opacity-80">{description}</p>}
        </div>
      </div>
    ));
  },
  info: (title: string, description?: string) => {
    toast.custom((t) => (
      <div className="w-full bg-blue-950/40 border-blue-500/30 text-blue-400 p-5 rounded-2xl border backdrop-blur-xl shadow-[0_0_20px_rgba(59,130,246,0.1)] flex gap-4 relative group">
        <button
          onClick={() => toast.dismiss(t)}
          className="absolute -top-2 -left-2 p-1 rounded-full bg-blue-950 border border-blue-500/30 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="p-2 bg-blue-500/10 rounded-lg h-fit">
          <Info className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black uppercase tracking-tight italic">Info: {title}</h3>
          {description && <p className="text-xs font-medium opacity-80">{description}</p>}
        </div>
      </div>
    ));
  }
};
