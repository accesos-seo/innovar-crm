import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LifeBuoy,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { format, isValid } from "date-fns";
import { es } from "date-fns/locale";
import type { SupportTicket, TicketStatus } from "@/types/tickets";
import { PRIORITY_LABELS, CATEGORY_LABELS } from "@/types/tickets";

function safeDate(dateStr: string, fmt: string): string {
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt, { locale: es }) : "—";
}

const STATUS_TABS: { value: TicketStatus; label: string }[] = [
  { value: "Abierto", label: "Abierto" },
  { value: "En Progreso", label: "En Progreso" },
  { value: "Cerrado", label: "Cerrado" },
];

const PRIORITY_COLORS: Record<string, string> = {
  baja: "text-slate-400 bg-slate-400/10",
  media: "text-amber-400 bg-amber-400/10",
  alta: "text-orange-400 bg-orange-400/10",
  urgente: "text-red-400 bg-red-400/10",
};

export default function SoportePage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";

  const [activeTab, setActiveTab] = React.useState<TicketStatus>("Abierto");
  const [search, setSearch] = React.useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support_tickets", isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, creator:profiles!created_by(full_name, avatar_url, role)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    staleTime: 30_000,
  });

  const counts = React.useMemo(
    () => ({
      Abierto: tickets.filter((t) => t.status === "Abierto").length,
      "En Progreso": tickets.filter((t) => t.status === "En Progreso").length,
      Cerrado: tickets.filter((t) => t.status === "Cerrado").length,
    }),
    [tickets]
  );

  const filtered = React.useMemo(() => {
    return tickets.filter((t) => {
      if (t.status !== activeTab) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticket_id.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [tickets, activeTab, search]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="SOPORTE"
        subtitle="Sistema de tickets para solicitudes, reportes y consultas."
        icon={LifeBuoy}
        onBack={() => navigate("/settings")}
        action={{
          label: "Nuevo Ticket",
          icon: Plus,
          onClick: () => navigate("/soporte/nuevo"),
        }}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={AlertCircle}
          label="Abiertos"
          value={counts["Abierto"]}
          color="primary"
        />
        <StatCard
          icon={Clock}
          label="En Progreso"
          value={counts["En Progreso"]}
          color="amber"
        />
        <StatCard
          icon={CheckCircle2}
          label="Cerrados"
          value={counts["Cerrado"]}
          color="emerald"
        />
      </div>

      {/* Search + Tabs + List */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por asunto, ID o descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-sm border-border/50"
          />
        </div>

        {/* Tab row */}
        <div className="flex gap-0 border-b border-border/10">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-black",
                  activeTab === tab.value
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Ticket list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            status={activeTab}
            isAdmin={isAdmin}
            onNew={() => navigate("/soporte/nuevo")}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                isAdmin={isAdmin}
                priorityColors={PRIORITY_COLORS}
                onClick={() => navigate(`/soporte/${ticket.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: "primary" | "amber" | "emerald";
}) {
  const colorMap = {
    primary: {
      icon: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    amber: {
      icon: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
    emerald: {
      icon: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
  };
  const c = colorMap[color];

  return (
    <div className="bg-card border border-border/10 rounded-lg p-5 flex items-center gap-4">
      <div className={cn("p-3 rounded-sm border", c.bg, c.border)}>
        <Icon className={cn("w-5 h-5", c.icon)} />
      </div>
      <div>
        <p className="text-2xl font-black text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}

function TicketRow({
  ticket,
  isAdmin,
  priorityColors,
  onClick,
}: {
  ticket: SupportTicket;
  isAdmin: boolean;
  priorityColors: Record<string, string>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-card border border-border/10 hover:border-primary/20 hover:bg-primary/[0.02] rounded-lg p-4 text-left transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-muted-foreground/50 font-mono">
              {ticket.ticket_id}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                priorityColors[ticket.priority]
              )}
            >
              {PRIORITY_LABELS[ticket.priority]}
            </span>
            {isAdmin && ticket.creator && (
              <span className="text-[10px] text-muted-foreground">
                {ticket.creator.full_name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {ticket.subject}
          </p>
          {ticket.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {ticket.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">
              {safeDate(ticket.created_at, "d MMM")}
            </p>
            <p className="text-[10px] text-muted-foreground/50">
              {CATEGORY_LABELS[ticket.category]}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}

function EmptyState({
  status,
  isAdmin,
  onNew,
}: {
  status: TicketStatus;
  isAdmin: boolean;
  onNew: () => void;
}) {
  const messages: Record<TicketStatus, string> = {
    Abierto: isAdmin
      ? "No hay tickets abiertos."
      : "No tienes tickets abiertos.",
    "En Progreso": "No hay tickets en progreso.",
    Cerrado: "No hay tickets cerrados aún.",
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="p-4 bg-primary/5 border border-primary/10 rounded-full">
        <LifeBuoy className="w-8 h-8 text-primary/50" />
      </div>
      <p className="text-sm text-muted-foreground">{messages[status]}</p>
      {status === "Abierto" && !isAdmin && (
        <Button variant="outline" size="sm" onClick={onNew} className="mt-2">
          <Plus className="w-4 h-4 mr-2" />
          Crear ticket
        </Button>
      )}
    </div>
  );
}
