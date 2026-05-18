import * as React from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DoorsConfigSchema } from "@/schemas/quotation.schema";
import { z } from "zod";
import { useCalculatePrice } from "@/hooks/useCalculatePrice";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DoorOpen, 
  Layers, 
  Plus, 
  Trash2, 
  Sparkles,
  ChevronRight,
  Info,
  Box
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DoorsConfiguratorProps {
  onDataChange: (total: number, config: any) => void;
  defaultValues?: any;
}

const SECTION_E_ITEMS = [
  { code: "PUERTA_SUP_70", label: "Puerta Superior 70cm", sub: "Hasta 70cm ancho" },
  { code: "PUERTA_SUP_90", label: "Puerta Superior 90cm", sub: "70-90cm ancho" },
  { code: "PUERTA_SUP_100", label: "Puerta Superior 100cm+", sub: "Mayor a 100cm ancho" },
  { code: "PUERTA_INF", label: "Puerta Inferior", sub: "Estándar" },
  { code: "PUERTA_ALACENA", label: "Puerta Alacena", sub: "Alacena estándar" },
  { code: "TAPA_CAJON", label: "Tapa Cajón", sub: "Cajón estándar" },
  { code: "TAPA_PEQUENA", label: "Tapa Pequeña/Gola", sub: "Especiero o gola" },
];

const SECTION_F_ITEMS = [
  { code: "PINTADO_SUP", label: "Puerta Superior Pintada", sub: "Alto brillo" },
  { code: "PINTADO_INF", label: "Puerta Inferior Pintada", sub: "Alto brillo" },
  { code: "PINTADO_ALACENA", label: "Puerta Alacena Pintada", sub: "Alto brillo" },
  { code: "PINTADO_CAJON", label: "Tapa Cajón Pintada", sub: "Alto brillo" },
  { code: "PINTADO_ESPECIERO", label: "Tapa Especiero Pintada", sub: "Alto brillo" },
  { code: "PINTADO_GOLA", label: "Tapa Gola Pintada", sub: "Alto brillo" },
];

interface ItemCardProps {
  item: any;
  onAdd: () => void;
  accent?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onAdd, accent = false }) => {
  return (
    <button
      onClick={onAdd}
      className={cn(
        "group relative flex items-center justify-between p-4 bg-card/40 border border-border/10 rounded-sm text-left transition-all duration-300",
        "hover:border-primary/30 hover:bg-card/80 active:scale-[0.98]",
        accent && "hover:shadow-[0_0_15px_rgba(var(--primary),0.05)]"
      )}
    >
      <div className="flex-1 min-w-0">
        <h5 className="text-[11px] font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">
          {item.label}
        </h5>
        <p className="text-[10px] text-muted-foreground font-medium mt-0.5 italic">
          {item.sub}
        </p>
      </div>
      
      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 text-primary" />
        </div>
      </div>

      <div className="absolute top-0 right-0 p-1 opacity-20">
        <ChevronRight className="w-3 h-3" />
      </div>
    </button>
  );
}

export const DoorsConfigurator: React.FC<DoorsConfiguratorProps> = ({ onDataChange, defaultValues }) => {
  const form = useForm<z.infer<typeof DoorsConfigSchema>>({
    resolver: zodResolver(DoorsConfigSchema),
    defaultValues: defaultValues || {
      items: []
    },
    mode: "onChange"
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items" as const
  });

  const currentConfig = useWatch({ control: form.control });
  const { data: calculation } = useCalculatePrice('puertas', currentConfig);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });

  React.useEffect(() => {
    if (!calculation?.success) return;

    const total = calculation?.data?.calculated_total ?? 0;
    const configStr = JSON.stringify(currentConfig);

    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, currentConfig);
    }
  }, [calculation, currentConfig, onDataChange]);

  const addItem = (item: { code: string, label: string }) => {
    const existingIndex = fields.findIndex(f => (f as any).codigo === item.code);
    if (existingIndex >= 0) {
      const current = fields[existingIndex] as any;
      update(existingIndex, { ...current, cantidad: (current.cantidad || 0) + 1 });
    } else {
      append({ codigo: item.code, cantidad: 1, label: item.label });
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const current = fields[index] as any;
    const nextVal = Math.max(0, (current.cantidad || 0) + delta);
    if (nextVal === 0) {
      remove(index);
    } else {
      update(index, { ...current, cantidad: nextVal });
    }
  };

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      {/* 🟢 HEADER UNIFICADO */}
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DoorOpen className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Catálogo de Repuestos</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Puertas y Acabados de Reemplazo</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* CATALOGO (IZQUIERDA) */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-4">Selección de Partes</h4>
            <Tabs defaultValue="standard" className="w-full">
              <TabsList className="w-full bg-card/60 border border-border/10 p-1 h-14 rounded-sm mb-6">
                <TabsTrigger value="standard" className="flex-1 h-full gap-2 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-background">
                  <DoorOpen className="w-4 h-4" />
                  Estándar / Melamina
                </TabsTrigger>
                <TabsTrigger value="painted" className="flex-1 h-full gap-2 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-background">
                  <Sparkles className="w-4 h-4" />
                  Pintado Alto Brillo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="standard">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SECTION_E_ITEMS.map((item) => (
                    <ItemCard key={item.code} item={item} onAdd={() => addItem(item)} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="painted">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SECTION_F_ITEMS.map((item) => (
                    <ItemCard key={item.code} item={item} onAdd={() => addItem(item)} accent />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* RESUMEN (DERECHA - INTEGRADO) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-primary/20 pb-4">
               <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Carrito de Ingeniería</h4>
               <Badge variant="outline" className="text-primary font-mono border-primary/30">
                 {fields.reduce((acc, f) => acc + (f as any).cantidad, 0)} Unidades
               </Badge>
            </div>

            <ScrollArea className="h-[400px] border border-border/10 bg-black/20 p-4">
              {fields.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 space-y-4">
                  <Box className="w-12 h-12 text-muted-foreground/20" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Tu selección está vacía</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div 
                      key={field.id}
                      className="group flex items-center justify-between p-4 bg-card/40 border border-border/5 rounded-none hover:border-primary/20 transition-all"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-[11px] font-black uppercase tracking-tight truncate text-foreground">
                          {(field as any).label || (field as any).codigo}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-mono">CODE: {(field as any).codigo}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-background border border-border/10 rounded-sm p-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            type="button"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" 
                            onClick={() => updateQuantity(index, -1)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <span className="w-10 text-center text-sm font-black italic">{(field as any).cantidad}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            type="button"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary" 
                            onClick={() => updateQuantity(index, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tight leading-relaxed">
                Los precios de repuestos incluyen herrajes básicos. Acabados especiales como "Alto Brillo" requieren validación de color en producción.
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Subtotal Repuestos</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
             $ {(calculation?.data?.calculated_total ?? 0).toLocaleString('es-CO')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
