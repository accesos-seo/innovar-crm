import * as React from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter,
  SheetTrigger
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

interface FilterSheetProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onApply: () => void;
  onClear?: () => void;
  trigger?: React.ReactNode;
}

export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary select-none border-l-2 border-primary pl-2">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

export function FilterOption({ 
  label, 
  value, 
  selected, 
  onClick 
}: { 
  label: string; 
  value: string; 
  selected: boolean; 
  onClick: () => void;
  key?: React.Key;
}) {
  return (
    <Button
      variant={selected ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-none text-[10px] font-bold uppercase tracking-widest transition-all relative group overflow-hidden",
        selected 
          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
          : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-primary bg-background"
      )}
    >
      <span className="relative z-10">{label}</span>
      {!selected && (
        <span className="absolute top-0 left-0 w-full h-[2px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
      )}
    </Button>
  );
}

export function FilterSheet({
  title,
  description,
  children,
  onApply,
  onClear,
  trigger
}: FilterSheetProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={(props) => {
          // Filter out asChild to prevent it from reaching the DOM
          const { asChild, ...rest } = props as any;
          if (trigger) {
            return React.cloneElement(trigger as React.ReactElement, rest);
          }
          return (
            <Button
              {...rest}
              variant="outline"
              className="gap-2 border-border/50 font-bold uppercase text-xs tracking-widest h-10 rounded-none"
            >
              <Filter className="w-4 h-4" />
              {formatSentenceCase("Filtros")}
            </Button>
          );
        }}
      />
      <SheetContent className="bg-card border-l-border/10 sm:max-w-md flex flex-col p-0 gap-0">
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
        
        <SheetHeader className="px-8 pt-8 pb-6 border-b border-border/10">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 rounded-sm">
              <Filter className="w-4 h-4 text-primary" />
            </div>
            <SheetTitle className="text-xl font-black uppercase tracking-tighter">
              {title}
            </SheetTitle>
          </div>
          {description && (
            <SheetDescription className="text-sm text-muted-foreground font-medium">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
          <div className="space-y-8">
            {children}
          </div>
        </div>

        <SheetFooter className="px-8 py-6 bg-muted/20 border-t border-border/10 gap-3 sm:flex-col">
          <PrimaryButton 
            onClick={onApply}
            label="Aplicar filtros"
            icon={Zap}
            className="w-full h-14"
          />
          {onClear && (
            <Button 
              variant="ghost" 
              onClick={onClear}
              className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              {formatSentenceCase("Limpiar selección")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
