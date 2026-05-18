import React, { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface WelcomeBannerProps {
  userName?: string;
  customInstruction?: string;
  className?: string;
}

/**
 * Hook para manejar la lógica de saludos basada en la franja horaria.
 * Sigue estrictamente las reglas: 5-12h, 12-19h, 19-5h.
 */
const useGreeting = () => {
  const timeData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { greeting: 'Buenos días', message: 'Hoy es un gran día para ir por más.' };
    } else if (hour >= 12 && hour < 19) {
      return { greeting: 'Buenas tardes', message: 'Mantén el ritmo, estás haciendo un gran trabajo.' };
    } else {
      return { greeting: 'Buenas noches', message: 'Excelente jornada, hora de revisar los logros.' };
    }
  }, []);

  return timeData;
};

/**
 * DynamicWelcomeHeader: Encabezado de bienvenida dinámico con estética 'Neon Dark'.
 * Implementado con React 19 y Tailwind CSS siguiendo el sistema de diseño global.
 */
export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ 
  userName = "Usuario", 
  customInstruction,
  className 
}) => {
  const { greeting, message } = useGreeting();
  
  // Formateo limpio del nombre (Capitalizado)
  const friendlyName = useMemo(() => {
    const name = userName.split('@')[0].split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }, [userName]);

  return (
    <div className={cn("mb-10 space-y-2 select-none animate-in fade-in slide-in-from-left duration-1000 ease-out", className)}>
      <h1 className="text-xl md:text-3xl text-foreground flex items-center gap-4">
        Hola <span className="inline-block animate-bounce-slow">👋</span> 
        <span className="text-primary drop-shadow-[0_0_15px_rgba(68,221,193,0.3)]">
          {friendlyName}
        </span>,
      </h1>
      
      <div className="space-y-1">
        <p className="text-sm md:text-base text-primary animate-in slide-in-from-left duration-700 delay-150 fill-mode-both">
          {greeting}. {message}
        </p>
        
        <p className="text-muted-foreground text-[10px] md:text-xs opacity-80 animate-in slide-in-from-left duration-1000 delay-300 fill-mode-both">
          {customInstruction || "Este es tu panel principal. Gestiona las operaciones y mantén el control."}
        </p>
      </div>

      <div className="h-0.5 w-1/2 bg-gradient-to-r from-primary via-primary/20 to-transparent mt-4 opacity-40 rounded-full" />
    </div>
  );
};
