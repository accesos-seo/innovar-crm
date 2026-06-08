import * as React from "react";
import {
  LayoutDashboard,
  PencilRuler,
  Users,
  CreditCard,
  Plus,
  Calendar,
  ChevronRight,
  ChevronDown,
  Briefcase,
  UserCircle,
  FileText,
  Clock,
  CalendarClock,
  CheckSquare,
  Bell,
  Wallet,
  Receipt,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/uiStore";
import { formatSentenceCase } from "@/lib/format-utils";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

interface SubItem {
  label: string;
  path: string;
  icon?: any;
}

interface NavItem {
  icon: any;
  label: string;
  path?: string;
  children?: SubItem[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: PencilRuler, label: "Proyectos", path: "/projects" },
  { 
    icon: Users, 
    label: "Clientes & Ventas", 
    children: [
      { label: "Clientes", path: "/clients", icon: UserCircle },
      { label: "Solicitudes/Leads", path: "/solicitudes/leads", icon: Briefcase },
      { label: "Cotizaciones", path: "/quotes", icon: FileText },
    ]
  },
  { 
    icon: Calendar, 
    label: "Agenda & Tareas", 
    children: [
      { label: "Citas", path: "/agenda", icon: Clock },
      { label: "Reuniones", path: "/reuniones", icon: CalendarClock },
      { label: "Tareas", path: "/tasks", icon: CheckSquare },
    ]
  },
  { 
    icon: CreditCard, 
    label: "Finanzas", 
    children: [
      { label: "Pagos", path: "/finanzas/pagos", icon: Wallet },
      { label: "Gastos", path: "/finanzas/gastos", icon: Receipt },
      { label: "Cierres contables", path: "/finanzas/cierres", icon: BarChart3 },
    ]
  },
];

const NavItemComponent: React.FC<{ item: NavItem; isActive: boolean; isChildActive: boolean; isCollapsed: boolean }> = ({ item, isActive, isChildActive, isCollapsed }) => {
  const [isOpen, setIsOpen] = React.useState(isChildActive);
  const location = useLocation();

  // Update open state if a child becomes active externally
  React.useEffect(() => {
    if (isChildActive) setIsOpen(true);
  }, [isChildActive]);

  if (item.children) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => !isCollapsed && setIsOpen(!isOpen)}
          className={cn(
            "w-full group flex items-center px-4 py-3 rounded-md transition-all duration-200",
            isCollapsed ? "justify-center" : "justify-between",
            isChildActive 
              ? "text-primary bg-primary/5 font-bold" 
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon className={cn("w-5 h-5 transition-colors", isChildActive ? "text-primary" : "group-hover:text-primary")} aria-hidden="true" />
            {!isCollapsed && <span className="text-sm tracking-tight">{item.label}</span>}
          </div>
          {!isCollapsed && (
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 opacity-40" />
            </motion.div>
          )}
        </button>
        
        <AnimatePresence initial={false}>
          {isOpen && !isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="ml-9 mt-1 space-y-1 border-l border-border/10 pl-2">
                {item.children.map((child) => {
                  const isChildPathActive = location.pathname === child.path;
                  return (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-xs transition-all duration-200",
                        isChildPathActive
                          ? "text-primary font-bold bg-primary/5"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                      )}
                    >
                      {child.icon && <child.icon className="w-3.5 h-3.5" />}
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      to={item.path!}
      className={cn(
        "group flex items-center px-4 py-3 rounded-md transition-all duration-200",
        isCollapsed ? "justify-center" : "justify-between",
        isActive 
          ? "text-primary bg-primary/5 font-bold" 
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-3">
        <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} aria-hidden="true" />
        {!isCollapsed && <span className="text-sm tracking-tight">{item.label}</span>}
      </div>
      {!isCollapsed && isActive && <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_var(--color-primary)]" />}
      {!isCollapsed && !isActive && <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
    </Link>
  );
}

export const Sidebar = React.memo(function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();

  const handleBrandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-full border-r border-border/10 bg-background z-40 flex flex-col font-heading tracking-tight transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className={cn("p-6 flex flex-col gap-1 border-b border-border/5 relative", isSidebarCollapsed ? "items-center" : "p-8")}>
        <a 
          href="/" 
          onClick={handleBrandClick}
          className={cn(
            "text-2xl font-black tracking-tighter text-foreground hover:text-primary transition-colors flex items-center gap-2",
            isSidebarCollapsed && "justify-center"
          )}
        >
          <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-black text-xl shrink-0">I</div>
          {!isSidebarCollapsed && <span>INNOVAR</span>}
        </a>
        {!isSidebarCollapsed && (
          <span className="text-[10px] font-bold text-muted-foreground/60">{formatSentenceCase("Sistemas de cocinas")}</span>
        )}
        
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            "absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-border/10 shadow-sm z-50 hover:bg-accent",
            "flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-300"
          )}
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
      </div>

      {/* Primary Action Section */}
      <div className="p-4">
        <PrimaryButton 
          onClick={() => navigate("/projects/new")}
          label={isSidebarCollapsed ? "" : "Nuevo proyecto"}
          icon={Plus}
          className={cn(
            "w-full h-12 rounded-md",
            isSidebarCollapsed ? "px-0 justify-center" : "px-4"
          )}
        />
      </div>
      
      {/* Navigation Section */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4 custom-scrollbar">
        {!isSidebarCollapsed && (
          <div className="px-4 mb-4">
            <span className="text-[10px] font-black text-muted-foreground/40">{formatSentenceCase("Operaciones")}</span>
          </div>
        )}
        {navItems.map((item) => {
          const isActive = item.path ? location.pathname === item.path : false;
          const isChildActive = item.children?.some(child => location.pathname === child.path) || false;

          return (
            <NavItemComponent
              key={item.label}
              item={item}
              isActive={isActive}
              isChildActive={isChildActive}
              isCollapsed={isSidebarCollapsed}
            />
          );
        })}

        {/* ── Agentes section ── */}
        <div className="pt-4 pb-1">
          <div className="w-full h-px bg-gradient-to-r from-primary/30 via-border/40 to-transparent mb-3" />
          {!isSidebarCollapsed && (
            <div className="px-4 mb-2">
              <span className="text-[10px] font-black text-primary/50 tracking-widest uppercase">Agentes</span>
            </div>
          )}
        </div>
        <Link
          to="/agentes"
          className={cn(
            "group flex items-center px-4 py-3 rounded-md transition-all duration-200",
            isSidebarCollapsed ? "justify-center" : "justify-between",
            location.pathname.startsWith("/agentes") || location.pathname.startsWith("/motor-comercial")
              ? "text-primary bg-primary/5 font-bold"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <Bot className={cn(
              "w-5 h-5 transition-colors",
              location.pathname.startsWith("/agentes") || location.pathname.startsWith("/motor-comercial")
                ? "text-primary"
                : "group-hover:text-primary"
            )} />
            {!isSidebarCollapsed && <span className="text-sm tracking-tight">Agentes</span>}
          </div>
          {!isSidebarCollapsed && (location.pathname.startsWith("/agentes") || location.pathname.startsWith("/motor-comercial")) && (
            <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_var(--color-primary)]" />
          )}
          {!isSidebarCollapsed && !(location.pathname.startsWith("/agentes") || location.pathname.startsWith("/motor-comercial")) && (
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
          )}
        </Link>
      </nav>

      {/* Footer Sidebar - Removed User Info as requested */}
      <div className="p-4 border-t border-border/5 bg-muted/5 flex justify-center">
        <span className="text-[8px] font-bold text-muted-foreground/30">
          {isSidebarCollapsed ? "INV" : "Innovar v1.0"}
        </span>
      </div>
    </aside>
  );
});
