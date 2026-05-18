import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAccessItem {
  id?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  category: string;
  neonColor: string;
  neonShadow: string;
  neonBg: string;
}

interface QuickAccessGridProps {
  items: QuickAccessItem[];
  title?: string;
  subtitle?: string;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export function QuickAccessGrid({ 
  items, 
  title, 
  subtitle,
  className,
  columns = 3
}: QuickAccessGridProps) {
  const navigate = useNavigate();

  const gridColsClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("space-y-6", className)}>
      {(title || subtitle) && (
        <div className="flex flex-col gap-1">
          {title && (
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
                {title}
              </h2>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium pl-4">
              {subtitle}
            </p>
          )}
        </div>
      )}
      
      <div className={cn("grid gap-4", gridColsClasses[columns])}>
        {items.map((item, index) => (
          <motion.div
            key={item.id || index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            onClick={() => navigate(item.path)}
            className={cn(
              "group relative p-5 bg-card border border-white/5 rounded-md cursor-pointer",
              "transition-all duration-300 ease-out",
              "hover:-translate-y-2 hover:bg-[#22232d]",
              "flex flex-col justify-between min-h-[140px]",
              "hover:border-primary/20",
              item.neonShadow
            )}
          >
            <div className="flex items-center gap-4">
              {/* Neon Box Container */}
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110",
                item.neonBg,
                item.neonColor,
                "border border-white/5 group-hover:border-current/20"
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

            {/* Bottom Navigation Indicator with Arrow */}
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
