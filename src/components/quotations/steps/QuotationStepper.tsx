import * as React from 'react';
import { motion } from 'framer-motion';
import { User, Box, Save, Check, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  { id: 1, title: "Cliente", icon: User },
  { id: 2, title: "Diseño", icon: Box },
  { id: 3, title: "Revisión", icon: Save },
];

interface QuotationStepperProps {
  currentStep: number;
}

export function QuotationStepper({ currentStep }: QuotationStepperProps) {
  return (
    <div className="flex justify-between items-center relative py-4 lg:px-12">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border/10 -translate-y-1/2 -z-10 overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: `${(currentStep - 1) / (STEPS.length - 1) * 100}%` }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
      </div>
      {STEPS.map((step) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        return (
          <div key={step.id} className="flex flex-col items-center gap-3 bg-background px-6 relative z-10 transition-all duration-500">
            <div className={cn(
              "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500",
              isActive ? "border-primary bg-primary text-primary-foreground shadow-[0_0_20px_var(--color-primary)]/30 scale-110" :
              isCompleted ? "border-primary bg-primary/20 text-primary" : "border-border/30 bg-muted/20 text-muted-foreground"
            )}>
              {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
            </div>
            <p className={cn("text-[10px] font-black uppercase tracking-widest", isActive ? "text-primary" : "text-muted-foreground/60")}>
              {step.title}
            </p>
          </div>
        );
      })}
    </div>
  );
}
