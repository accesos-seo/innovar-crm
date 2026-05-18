import * as React from "react";
import { LucideIcon, ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";

export interface StatusOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  count: number;
}

interface StatusSubnavProps {
  options: StatusOption[];
  activeValue: string;
  onSelect: (value: string) => void;
  className?: string;
  maxVisible?: number;
}

export function StatusSubnav({
  options,
  activeValue,
  onSelect,
  className,
  maxVisible = 4,
}: StatusSubnavProps) {
  // Separate "Todos" (all) from others
  const allOption = options.find((o) => o.value === "all");
  const otherOptions = options.filter((o) => o.value !== "all");

  // Sort others by count descending
  const sortedOthers = [...otherOptions].sort((a, b) => b.count - a.count);

  // Split into visible and hidden
  const visibleOthers = sortedOthers.slice(0, maxVisible - 1);
  const hiddenOptions = sortedOthers.slice(maxVisible - 1);

  const visibleOptions = allOption ? [allOption, ...visibleOthers] : visibleOthers;
  
  const isHiddenActive = hiddenOptions.some((o) => o.value === activeValue);
  const activeHiddenOption = hiddenOptions.find((o) => o.value === activeValue);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {visibleOptions.map((option) => {
          const isActive = activeValue === option.value;
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={cn(
                "group relative flex items-center gap-2 px-4 py-2.5 rounded-sm transition-all duration-200 border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-card/40 text-muted-foreground border-border/10 hover:border-border/40 hover:bg-card/60 hover:text-foreground"
              )}
            >
              {Icon && (
                <Icon 
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                  )} 
                />
              )}
              <span className="text-xs font-bold whitespace-nowrap">
                {formatSentenceCase(option.label)}
              </span>
              <span 
                className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-colors",
                  isActive 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}
              >
                {option.count}
              </span>

              {isActive && (
                <motion.div
                  layoutId="active-status-indicator"
                  className="absolute inset-0 border-2 border-primary rounded-sm -m-[1px] pointer-events-none"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}

        {hiddenOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(triggerProps) => (
                <button
                  {...triggerProps}
                  className={cn(
                    "group relative flex items-center gap-2 px-4 py-2.5 rounded-sm transition-all duration-200 border",
                    isHiddenActive
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                      : "bg-card/40 text-muted-foreground border-border/10 hover:border-border/40 hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  <MoreHorizontal className={cn("w-4 h-4", isHiddenActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                  <span className="text-xs font-bold whitespace-nowrap">
                    {isHiddenActive ? formatSentenceCase(activeHiddenOption?.label || "") : formatSentenceCase("Más")}
                  </span>
                  {!isHiddenActive && (
                    <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-transform group-data-[state=open]:rotate-180" />
                  )}
                  
                  {isHiddenActive && (
                    <motion.div
                      layoutId="active-status-indicator"
                      className="absolute inset-0 border-2 border-primary rounded-sm -m-[1px] pointer-events-none"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              )}
            />
            <DropdownMenuContent align="end" className="bg-card border-border/10 min-w-[200px]">
              {hiddenOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSelect(option.value)}
                  className={cn(
                    "flex justify-between items-center px-4 py-3 cursor-pointer transition-colors",
                    activeValue === option.value ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-xs font-bold">{formatSentenceCase(option.label)}</span>
                  <StatusBadge variant="primary" className="h-5 px-1.5 min-w-[20px]">
                    {option.count}
                  </StatusBadge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
