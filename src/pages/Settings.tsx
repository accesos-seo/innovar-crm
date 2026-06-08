import * as React from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Users,
  History,
  Package,
  CreditCard,
  Calendar,
  Database,
  MessageSquare,
  Landmark,
  HandCoins,
  Settings2,
  Bell,
  Clock,
} from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { QuickAccessGrid, type QuickAccessItem } from "@/components/ui/QuickAccessGrid";
import { useNavigate } from "react-router-dom";

const allItems: QuickAccessItem[] = [
  {
    title: "Materiales e Insumos",
    description: "Herrajes, tableros y acabados.",
    icon: Package,
    path: "/settings/materials",
    category: "CATÁLOGOS",
    neonColor: "text-emerald-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]",
    neonBg: "bg-emerald-500/10",
  },
  {
    title: "Tarifario y Precios",
    description: "Costos de fabricación e instalación.",
    icon: CreditCard,
    path: "/settings/pricing",
    category: "CATÁLOGOS",
    neonColor: "text-cyan-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(34,211,238,0.15)]",
    neonBg: "bg-cyan-500/10",
  },
  {
    title: "Días Festivos",
    description: "Calendario laboral y excepciones.",
    icon: Calendar,
    path: "/settings/holidays",
    category: "CATÁLOGOS",
    neonColor: "text-amber-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(251,191,36,0.15)]",
    neonBg: "bg-amber-500/10",
  },
  {
    title: "Datos Bancarios",
    description: "Cuenta de cobro mostrada al cliente.",
    icon: Landmark,
    path: "/settings/bancarios",
    category: "FINANZAS",
    neonColor: "text-yellow-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(250,204,21,0.15)]",
    neonBg: "bg-yellow-500/10",
  },
  {
    title: "Configuración de Pagos",
    description: "Flujo de pago público, ventana y anticipo sugerido.",
    icon: Settings2,
    path: "/settings/pagos",
    category: "FINANZAS",
    neonColor: "text-orange-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(251,146,60,0.15)]",
    neonBg: "bg-orange-500/10",
  },
  {
    title: "Usuarios y Roles",
    description: "Gestión de personal y niveles de acceso.",
    icon: Users,
    path: "/settings/users",
    category: "SEGURIDAD",
    neonColor: "text-blue-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]",
    neonBg: "bg-blue-500/10",
  },
  {
    title: "Auditoría de Sistema",
    description: "Registro detallado de acciones y cambios.",
    icon: History,
    path: "/settings/audit",
    category: "SEGURIDAD",
    neonColor: "text-violet-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]",
    neonBg: "bg-violet-500/10",
  },
  {
    title: "Notificaciones WhatsApp",
    description: "Cola de envíos y trazabilidad de Meta.",
    icon: MessageSquare,
    path: "/settings/whatsapp",
    category: "SEGURIDAD",
    neonColor: "text-primary",
    neonShadow: "hover:shadow-[0_0_40px_rgba(0,255,200,0.15)]",
    neonBg: "bg-primary/10",
  },
  {
    title: "Notificaciones",
    description: "Centro de actividad: citas, pagos y cambios en proyectos.",
    icon: Bell,
    path: "/notifications",
    category: "ACTIVIDAD",
    neonColor: "text-primary",
    neonShadow: "hover:shadow-[0_0_40px_rgba(68,221,193,0.15)]",
    neonBg: "bg-primary/10",
  },
  {
    title: "Horas Laborales",
    description: "Registro mensual de jornadas y progreso del período.",
    icon: Clock,
    path: "/horas",
    category: "ACTIVIDAD",
    neonColor: "text-indigo-400",
    neonShadow: "hover:shadow-[0_0_40px_rgba(99,102,241,0.15)]",
    neonBg: "bg-indigo-500/10",
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto w-full space-y-12 pb-20">
      <CategoryHeader
        title="HUB DE CONFIGURACIÓN"
        subtitle="Centro de control administrativo para la gestión integral de INNOVAR."
        icon={SettingsIcon}
        onBack={() => navigate("/")}
      />

      <QuickAccessGrid items={allItems} columns={3} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="pt-12 border-t border-border/5"
      >
        <div className="bg-card p-8 rounded-lg border border-border/10 flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-primary/20 transition-all duration-500 shadow-2xl">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="text-sm font-bold text-primary uppercase tracking-[0.2em]">Capa de Seguridad Crítica</h4>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Las modificaciones en este panel impactan la integridad del sistema. Cada acción es registrada en los logs de auditoría para su posterior revisión.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Estado Sincronizado</p>
              <div className="flex items-center justify-end gap-2 text-[10px] text-emerald-400 font-bold uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Backup Activo
              </div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center transition-transform duration-500 group-hover:rotate-12">
              <Database className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
