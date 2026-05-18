import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  status?: { label: string; color: string };
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function DetailView({
  isOpen,
  onClose,
  title,
  subtitle,
  status,
  children,
  actions,
}: DetailViewProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="bg-card border-l border-border/50 sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="p-8 pb-4 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <SheetTitle className="text-3xl font-black font-heading uppercase tracking-tighter text-foreground">
                {title}
              </SheetTitle>
              {subtitle && (
                <SheetDescription className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
                  {subtitle}
                </SheetDescription>
              )}
            </div>
            {status && (
              <Badge className={`${status?.color} border-none rounded-none px-3 py-1 text-[10px] font-bold uppercase tracking-tighter`}>
                {status.label}
              </Badge>
            )}
          </div>
          {actions && (
            <div className="flex gap-2 pt-2">
              {actions}
            </div>
          )}
        </SheetHeader>
        
        <Separator className="bg-border/10" />
        
        <ScrollArea className="flex-1 p-8">
          <div className="space-y-8">
            {children}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
