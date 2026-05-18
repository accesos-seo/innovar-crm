import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PremiumLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
}

export function PremiumLoader({ className, size = "md", text }: PremiumLoaderProps) {
  const sizeMap = {
    sm: "w-12 h-12",
    md: "w-24 h-24",
    lg: "w-40 h-40",
    xl: "w-64 h-64",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-8", className)}>
      <div className={cn("relative", sizeMap[size])}>
        {/* Anillo Exterior - Rotación Lenta */}
        <div className="absolute inset-0 border-[1px] border-primary/20 rounded-full animate-[spin_8s_linear_infinite]" />

        {/* Anillo de Partículas Orbitantes */}
        <div className="absolute inset-0 animate-[spin_12s_linear_infinite_reverse]">
          {[0, 90, 180, 270].map((angle) => (
            <div
              key={angle}
              className="absolute w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_var(--color-primary)]"
              style={{
                top: "50%",
                left: "50%",
                transform: `rotate(${angle}deg) translate(${size === "lg" ? "75px" : size === "xl" ? "120px" : "45px"})`,
              }}
            />
          ))}
        </div>

        {/* Hexágono Central - Morphing & Glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1/2 h-1/2 bg-gradient-to-br from-primary to-primary-dark shadow-[0_0_30px_rgba(68,221,193,0.4)] rounded-[20%] animate-pulse" />
        </div>

        {/* Brillo de Fondo Difuso */}
        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
      </div>

      {text && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse">
            {text}
          </span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 bg-primary/40 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PremiumLoadingOverlay({ text = "Procesando Inteligencia..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-xl">
      <PremiumLoader size="lg" text={text} />
    </div>
  );
}
