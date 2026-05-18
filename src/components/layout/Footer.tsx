import * as React from "react";
import { Heart, Database } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Link } from "react-router-dom";

export function Footer() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <footer className="w-full mt-auto pt-12 pb-8 px-8 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="bg-card/30 backdrop-blur-sm border border-border/10 rounded-sm p-12 flex flex-col items-center text-center space-y-8">
          {/* Logo & Brand */}
          <div className="flex flex-col items-center gap-4">
            <img 
              src="https://stjugsrkrweakvzmizpq.supabase.co/storage/v1/object/public/Logos%20Marcas/finallogo-fondo%20(1).png" 
              alt="Innovar Logo" 
              className="h-24 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase">INNOVAR</h2>
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-primary">
                Fabricación de Cocinas
              </p>
            </div>
          </div>

          {/* Message Section */}
          <div className="max-w-2xl space-y-4">
            <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
              Gracias por confiar en nuestro sistema
            </h3>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Potenciando la industria de la fabricación de cocinas con tecnología avanzada, 
              diseño de precisión y análisis inteligente para el año 2026.
            </p>
          </div>

          {/* Bottom Bar */}
          <div className="w-full pt-8 border-t border-border/10 flex flex-col items-center gap-6">
            <div className="flex flex-col md:flex-row items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              <span>© 2026 INNOVAR. Todos los derechos reservados.</span>
              <span className="hidden md:block text-border/30">|</span>
              <div className="flex items-center gap-2 group cursor-default">
                <span>Hecho con pasión</span>
                <Heart className="w-3 h-3 transition-all duration-300 group-hover:text-primary group-hover:scale-110 fill-transparent group-hover:fill-primary" />
                <span>por Innovar Team</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 pt-4 relative">
              <div className="bg-muted/50 text-muted-foreground font-mono text-[9px] px-3 py-1 rounded-full border border-border/10 tracking-tighter">
                Versión 2.0.26
              </div>

              <Link 
                to="/admin/dictionary" 
                className="opacity-10 hover:opacity-100 flex items-center gap-1 text-[8px] font-mono text-muted-foreground transition-opacity"
              >
                <Database className="w-2 h-2" />
                Diccionario
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
