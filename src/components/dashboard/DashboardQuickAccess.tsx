import * as React from "react";
import { 
  Contact, 
  Target, 
  FileText, 
  Calendar, 
  CheckSquare, 
  Bell, 
  CreditCard, 
  TrendingDown, 
  Calculator,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface QuickAccessItem {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  category: string;
  neonColor: string;
  neonShadow: string;
}

const modules: QuickAccessItem[] = [
  // Clientes & Ventas
  { 
    title: "Clientes",
    description: "Gestión centralizada de contactos y obras.", 
    icon: Contact, 
    path: "/clients",
    category: "Clientes & Ventas",
    neonColor: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(6,182,212,0.2)] hover:border-cyan-500/40"
  },
  { 
    title: "Solicitudes/Leads", 
    description: "Seguimiento de nuevos prospectos y oportunidades.", 
    icon: Target, 
    path: "/solicitudes/leads",
    category: "Clientes & Ventas",
    neonColor: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(245,158,11,0.2)] hover:border-amber-500/40"
  },
  { 
    title: "Cotizaciones", 
    description: "Generación y control de presupuestos comerciales.", 
    icon: FileText, 
    path: "/quotations",
    category: "Clientes & Ventas",
    neonColor: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(217,70,239,0.2)] hover:border-fuchsia-500/40"
  },
  // Agenda & Tareas
  { 
    title: "Citas", 
    description: "Programación de visitas técnicas y reuniones.", 
    icon: Calendar, 
    path: "/agenda",
    category: "Agenda & Tareas",
    neonColor: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] hover:border-blue-500/40"
  },
  { 
    title: "Tareas", 
    description: "Gestión de pendientes y flujo de trabajo diario.", 
    icon: CheckSquare, 
    path: "/tasks",
    category: "Agenda & Tareas",
    neonColor: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(139,92,246,0.2)] hover:border-violet-500/40"
  },
  { 
    title: "Recordatorios", 
    description: "Alertas automáticas de seguimiento y entregas.", 
    icon: Bell, 
    path: "/tasks",
    category: "Agenda & Tareas",
    neonColor: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(16,185,129,0.2)] hover:border-emerald-500/40"
  },
  // Finanzas
  { 
    title: "Pagos", 
    description: "Registro de ingresos y abonos de clientes.", 
    icon: CreditCard, 
    path: "/finanzas/pagos",
    category: "Finanzas",
    neonColor: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(14,165,233,0.2)] hover:border-sky-500/40"
  },
  { 
    title: "Gastos", 
    description: "Control de egresos operativos y materiales.", 
    icon: TrendingDown, 
    path: "/finanzas/gastos",
    category: "Finanzas",
    neonColor: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(249,115,22,0.2)] hover:border-orange-500/40"
  },
  { 
    title: "Cierres Contables", 
    description: "Resumen de balance y estados financieros.", 
    icon: Calculator, 
    path: "/finanzas/cierres",
    category: "Finanzas",
    neonColor: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    neonShadow: "hover:shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:border-indigo-500/40"
  },
];

export function DashboardQuickAccess() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 bg-primary rounded-full" />
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
          Módulos de Acceso Rápido
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => navigate(item.path)}
            className={cn(
              "group relative p-5 bg-card border border-white/5 rounded-md cursor-pointer",
              "transition-all duration-300 ease-out",
              "hover:-translate-y-2 hover:bg-[#22232d]",
              "flex flex-col justify-between min-h-[140px]",
              item.neonShadow
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110",
                item.neonColor
              )}>
                <item.icon className="w-6 h-6" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white tracking-tight mb-0.5 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Bottom Navigation Indicator */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                {item.category}
              </span>
              <div className="flex items-center gap-2 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-primary opacity-0 group-hover:opacity-100 transition-all duration-300">
                  Acceder
                </span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
