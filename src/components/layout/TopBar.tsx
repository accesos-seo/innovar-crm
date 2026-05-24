import * as React from "react";
import { Search, Bell, Settings, User, LogOut, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { formatSentenceCase } from "@/lib/format-utils";
import { notify } from "@/components/ui/PremiumToast";
import { useAuthStore } from "@/store/authStore";

import { NotificationBell } from "./NotificationBell";

export const TopBar = React.memo(function TopBar() {
  const navigate = useNavigate();
  const { profile, user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      notify.info("Cerrando sesión...");
      await logout();
      notify.success("Sesión cerrada correctamente");
      navigate("/login");
    } catch (error) {
      notify.error("Error al cerrar sesión");
    }
  };

  const getFriendlyName = (input: string | null | undefined) => {
    if (!input) return "";
    const name = input.includes('@') ? input.split('@')[0] : input;
    return name.split(/[\s._-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  const displayName = getFriendlyName(profile?.full_name || user?.email);
  const userRole = profile?.role || "Consultor";

  return (
    <header className="fixed top-0 right-0 left-64 h-16 flex justify-between items-center px-8 z-30 bg-background/80 backdrop-blur-md shadow-[0_20px_40px_rgba(0,0,0,0.4)] font-heading font-medium">
      <div className="flex items-center gap-8">
        <img 
          src="https://stjugsrkrweakvzmizpq.supabase.co/storage/v1/object/public/Logos%20Marcas/finallogo-fondo%20(1).png" 
          alt="Innovar Logo" 
          className="h-16 w-auto object-contain"
          referrerPolicy="no-referrer"
        />
        <div className="bg-muted px-4 py-1.5 flex items-center gap-3 border-l-2 border-primary">
          <Search className="text-primary w-4 h-4" aria-hidden="true" />
          <Input 
            className="bg-transparent border-none focus-visible:ring-0 text-sm w-64 text-foreground placeholder:text-muted-foreground/40 h-auto p-0" 
            placeholder="Buscar planos, órdenes, clientes..." 
            aria-label="Buscar"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex gap-4">
          <NotificationBell />
          <button 
            onClick={() => navigate("/settings")}
            className="text-muted-foreground hover:text-primary transition-colors duration-200" 
            aria-label="Configuración"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        
        <div className="h-8 w-[1px] bg-border/20 mx-2" aria-hidden="true"></div>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 cursor-pointer group outline-none bg-transparent border-none p-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{displayName}</p>
              <p className="text-[10px] font-medium text-primary">{formatSentenceCase(userRole)}</p>
            </div>
            <UserAvatar 
              name={displayName} 
              image={profile?.avatar_url ?? undefined}
              className="h-10 w-10 rounded-sm border border-border/30 group-hover:border-primary transition-all duration-300"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border/50 p-2 rounded-none shadow-2xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-3">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground opacity-0 h-0 overflow-hidden">Oculto</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-border/10" />
            <DropdownMenuItem 
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 px-2 py-3 cursor-pointer focus:bg-primary/10 focus:text-primary rounded-none transition-colors"
            >
              <User className="w-4 h-4" />
              <span className="text-xs font-bold">{formatSentenceCase("Mi perfil")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 px-2 py-3 cursor-pointer focus:bg-primary/10 focus:text-primary rounded-none transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs font-bold">{formatSentenceCase("Configuración")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/10" />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="flex items-center gap-2 px-2 py-3 cursor-pointer bg-destructive/90 text-destructive-foreground hover:bg-destructive focus:bg-destructive focus:text-destructive-foreground rounded-none transition-all shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold">{formatSentenceCase("Cerrar sesión")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
