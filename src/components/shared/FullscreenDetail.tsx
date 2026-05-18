import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LucideIcon, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";

interface FullscreenDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  status?: { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string };
  isLoading?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function FullscreenDetail({
  open,
  onOpenChange,
  title,
  subtitle,
  icon: Icon,
  status,
  isLoading,
  children,
  footer,
}: FullscreenDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-card border-border/50 overflow-hidden"
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
        {/* Header Section */}
        <div className="p-8 pt-7 bg-muted/20 border-b border-border/10 relative">
          <DialogHeader className="p-0 text-left">
            <div className="flex items-start justify-between gap-6 mr-8">
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className="p-3 bg-primary/10 rounded-sm">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold uppercase tracking-tight text-foreground flex items-center gap-2">
                    {title}
                  </DialogTitle>
                  {subtitle && (
                    <DialogDescription className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                      {subtitle}
                    </DialogDescription>
                  )}
                </div>
              </div>
              
              {status && (
                <Badge 
                  variant={status.variant} 
                  className={cn(
                    "rounded-none px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border-primary/20",
                    status.className
                  )}
                >
                  {status.label}
                </Badge>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10"
            >
              {children}
            </motion.div>
          )}
        </div>

        {/* Footer Section */}
        {footer && (
          <div className="p-8 border-t border-border/10 bg-muted/5 mt-0 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
