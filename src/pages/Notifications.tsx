import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  Inbox,
  Mail,
  Calendar,
  Hammer,
  Settings as SettingsIcon,
  Check,
  Search,
  Settings2,
} from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { useUnreadCount } from "@/hooks/notifications/useUnreadCount";
import { useMarkAllAsRead } from "@/hooks/notifications/useMarkAllAsRead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CategoryId = "all" | "unread" | "booking" | "project" | "system";

interface Category {
  id: CategoryId;
  label: string;
  icon: typeof Bell;
  description: string;
}

const CATEGORIES: Category[] = [
  { id: "all",     label: "Bandeja",          icon: Inbox,         description: "Todas las notificaciones" },
  { id: "unread",  label: "Sin leer",         icon: Mail,          description: "Pendientes de revisar" },
  { id: "booking", label: "Citas y visitas",  icon: Calendar,      description: "Diseño y visitas técnicas" },
  { id: "project", label: "Proyectos",        icon: Hammer,        description: "Cambios de estado y avances" },
  { id: "system",  label: "Sistema",          icon: SettingsIcon,  description: "Pagos, ajustes y otros" },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [active, setActive] = React.useState<CategoryId>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Realtime subscription lives in NotificationBell (mounted in Layout).
  // Don't re-subscribe here — Supabase rejects a second postgres_changes
  // callback on the same channel name after .subscribe().
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAllAsRead = useMarkAllAsRead();

  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const activeCategory = CATEGORIES.find((c) => c.id === active)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="NOTIFICACIONES"
        subtitle="Centro de actividad: citas, pagos y cambios en tus proyectos."
        icon={Bell}
        onBack={() => navigate("/settings")}
        status={
          unreadCount > 0
            ? { label: `${unreadCount} sin leer`, variant: "primary" }
            : { label: "Al día", variant: "success" }
        }
        action={
          unreadCount > 0
            ? {
                label: "Marcar todas como leídas",
                icon: Check,
                onClick: () => markAllAsRead.mutate(),
              }
            : undefined
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8">
        {/* ── Sidebar de categorías ──────────────────────────────────────── */}
        <aside className="space-y-3">
          <div className="hidden md:flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Categorías
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => navigate("/settings/notifications")}
              title="Preferencias de notificaciones"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-1 md:mx-0 px-1 md:px-0">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = active === cat.id;
              const showCount = cat.id === "unread" && unreadCount > 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActive(cat.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm border transition-all shrink-0 md:w-full text-left",
                    isActive
                      ? "bg-primary/10 border-primary/30 text-primary shadow-sm shadow-primary/5"
                      : "bg-card/30 border-border/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground hover:border-border/30"
                  )}
                >
                  <Icon
                    className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "")}
                  />
                  <span className="font-medium whitespace-nowrap flex-1">
                    {cat.label}
                  </span>
                  {showCount && (
                    <span
                      className={cn(
                        "min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/20 text-primary"
                      )}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden md:block px-3 py-3 bg-card/20 border border-border/10 rounded-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {activeCategory.label}
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1 leading-relaxed">
              {activeCategory.description}
            </p>
          </div>
        </aside>

        {/* ── Lista principal ────────────────────────────────────────────── */}
        <main className="space-y-6 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar en notificaciones por título o contenido…"
              className="pl-9 bg-card/30 border-border/10 focus-visible:ring-primary rounded-sm h-10"
            />
          </div>

          <NotificationsList filterType={active} searchQuery={debouncedSearch} />
        </main>
      </div>
    </motion.div>
  );
}
