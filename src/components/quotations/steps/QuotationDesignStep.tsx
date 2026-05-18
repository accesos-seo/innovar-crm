import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from '@/components/ui/status-badge';
import { KitchenModule } from '@/features/kitchen/KitchenModule';
import { ClosetCotizador as ClosetModule } from '@/features/closets/ClosetCotizador';
import { DoorsModule } from '@/features/doors/DoorsModule';
import { TVCenterModule } from '@/features/tv_center/TVCenterModule';
import { HardwareModule } from '@/features/hardware/HardwareModule';
import { SpecialFinishesModule } from '@/features/special_finishes/SpecialFinishesModule';
import { urgencyMap } from '@/pages/leads/LeadsColumns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, ChevronDown, PlusCircle, Truck,
  Info, User, Phone, MapPin, Zap, Box, Trash2
} from 'lucide-react';
import type { QuotationItemData, QuotationClient } from '@/hooks/quotations/useQuotationBuilder';

const CATEGORIES_CONFIG = [
  { id: 'cocina', label: 'Cocina' },
  { id: 'closet', label: 'Closet' },
  { id: 'puerta', label: 'Puerta' },
  { id: 'tv_center', label: 'Centro TV' },
  { id: 'mesones', label: 'Mesones' },
  { id: 'herrajes', label: 'Herrajes' },
  { id: 'especiales', label: 'Especiales' },
  { id: 'otro', label: 'Otro' },
];

const PlaceholderModule = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-primary/20 bg-primary/5 group">
    <Box className="w-16 h-16 text-primary/20 mb-6 group-hover:scale-110 transition-transform duration-500" />
    <h3 className="text-lg font-black text-muted-foreground tracking-widest uppercase">{title}</h3>
    <p className="text-[10px] text-primary font-bold mt-2 uppercase tracking-[0.3em] px-4 py-2 border border-primary/10">Próximamente en v2.0</p>
  </div>
);

function CategoryEmptyState({ category, label, onAdd }: { category: string; label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-primary/20 bg-primary/5 rounded-lg space-y-4">
      <Box className="w-12 h-12 text-primary/20" />
      <h3 className="text-sm font-black text-muted-foreground uppercase">No hay {label.toLowerCase()} configurados</h3>
      <Button
        onClick={onAdd}
        className="h-10 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground"
      >
        AGREGAR {label.toUpperCase()}
      </Button>
    </div>
  );
}

interface QuotationDesignStepProps {
  selectedClient: QuotationClient | null;
  leadContext: any;
  isContextExpanded: boolean;
  setIsContextExpanded: (v: boolean) => void;
  activeTab: string;
  setActiveTab: (v: string) => void;
  items: QuotationItemData[];
  setItems: (items: QuotationItemData[]) => void;
  transportDisplay: string;
  setTransportDisplay: (v: string) => void;
  discountDisplay: string;
  setDiscountDisplay: (v: string) => void;
  transportCost: number;
  totals: { subtotalItems: number; subtotalWithTransport: number };
  handleItemDataChange: (id: string, total: number, config: any) => void;
  handleTransportCheckbox: (checked: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function QuotationDesignStep({
  selectedClient, leadContext,
  isContextExpanded, setIsContextExpanded,
  activeTab, setActiveTab,
  items, setItems,
  transportDisplay, setTransportDisplay,
  discountDisplay, setDiscountDisplay,
  transportCost, totals,
  handleItemDataChange, handleTransportCheckbox,
  onBack, onNext,
}: QuotationDesignStepProps) {
  const addItem = (category: string) => {
    const newId = `item-${Date.now()}`;
    setItems([...items, { id: newId, category, calculatedTotal: 0, configuration: {} }]);
  };

  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const ItemWrapper = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div className="relative group/item">
      {children}
      <Button
        variant="destructive"
        size="icon"
        className="absolute -top-4 -right-4 rounded-full shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity z-20"
        onClick={() => removeItem(id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-2 py-1 bg-primary/10 border border-primary/20">Cotizando para: {selectedClient?.name}</span>
          <h2 className="text-4xl lg:text-5xl font-black text-foreground tracking-tighter uppercase mt-4">Diseño Paramétrico</h2>
        </div>
        <Button
          variant="outline"
          onClick={onBack}
          className="h-12 px-6 text-xs font-bold uppercase tracking-widest border-primary/20 hover:border-primary/40 text-muted-foreground rounded-none bg-background/50 hover:bg-background transition-all shrink-0"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Cliente
        </Button>
      </div>

      {leadContext && (
        <div className="bg-[#1C1B1B] border border-primary/20 shadow-lg mb-8 relative">
          <div
            className="flex items-center justify-between cursor-pointer group p-4 border-l-4 border-l-primary hover:bg-primary/5 transition-colors"
            onClick={() => setIsContextExpanded(!isContextExpanded)}
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">Contexto de la Solicitud (Lead)</h3>
            </div>
            <ChevronDown className={cn("w-5 h-5 text-primary transition-transform duration-300", isContextExpanded ? "rotate-180" : "")} />
          </div>
          <AnimatePresence>
            {isContextExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 border-t border-primary/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-6">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2"><User className="w-3 h-3" /> Email</span>
                    <p className="text-sm font-medium text-foreground">{leadContext.email || "No especificado"}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2"><Phone className="w-3 h-3" /> WhatsApp/Teléfono</span>
                    <p className="text-sm font-medium text-foreground">{leadContext.whatsapp_phone || "No especificado"}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2"><MapPin className="w-3 h-3" /> Ubicación / Ciudad</span>
                    <p className="text-sm font-medium text-foreground">{leadContext.city || "No especificado"}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2"><Zap className="w-3 h-3 text-primary" /> Prioridad</span>
                    <div className="flex items-center h-8">
                      {(() => {
                        const urgency = leadContext.urgency;
                        if (!urgency) return <span className="text-sm font-medium text-muted-foreground italic">No especificado</span>;
                        const normalizedKey = urgency === 'ASAP' ? 'high' : urgency === 'SHORT' ? 'medium' : urgency === 'LON' ? 'low' : urgency;
                        const config = urgencyMap[normalizedKey] || { label: urgency, variant: "info" };
                        return (
                          <StatusBadge variant={config.variant as any} dot animate={normalizedKey === 'high' ? 'pulse' : 'scale'} className="py-1 shadow-none">
                            {normalizedKey === 'high' ? 'Alta / Lo antes posible' : normalizedKey === 'medium' ? 'Media / Mediano plazo' : normalizedKey === 'low' ? 'Baja / Solo averiguando' : config.label}
                          </StatusBadge>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2"><Box className="w-3 h-3" /> Servicios de interés</span>
                    <p className="text-sm font-medium text-foreground">
                      {(() => {
                        try {
                          const parsed = typeof leadContext.services === 'string' && leadContext.services.startsWith('[') ? JSON.parse(leadContext.services) : leadContext.services;
                          return Array.isArray(parsed) ? parsed.join(", ") : parsed || "No especificado";
                        } catch { return leadContext.services || "No especificado"; }
                      })()}
                    </p>
                  </div>
                  <div className="col-span-1 md:col-span-2 lg:col-span-5 bg-muted/10 p-4 border border-border/10">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Dirección para visita técnica</span>
                    <p className="text-sm font-medium text-foreground/90 whitespace-pre-wrap leading-relaxed">{leadContext.address || leadContext.observations || "No hay dirección de visita registrada."}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start relative">
          <div className="w-full space-y-10 order-1">
            <div className="lg:hidden mb-8 overflow-x-auto pb-4">
              <TabsList variant="line" className="h-auto p-0 flex flex-row gap-4 w-fit">
                {CATEGORIES_CONFIG.map(cat => (
                  <TabsTrigger key={cat.id} value={cat.id} className="data-active:bg-primary data-active:text-primary-foreground text-[10px] font-black uppercase tracking-widest h-12 px-6">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {items.length === 0 ? (
              <div className="p-20 border-2 border-dashed border-border/10 bg-muted/5 flex flex-col items-center justify-center text-center space-y-4">
                <Box className="w-16 h-16 text-muted-foreground/20" />
                <h3 className="text-xl font-black text-muted-foreground uppercase">El Cotizador está vacío</h3>
                <Button onClick={() => addItem('cocina')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest px-8">
                  Crear Primera Configuración
                </Button>
              </div>
            ) : (
              <>
                <TabsContent value="cocina" className="mt-0 focus-visible:outline-none space-y-12">
                  {items.filter(i => i.category === 'cocina' || i.category === 'cocina_integral').map(item => (
                    <ItemWrapper key={item.id} id={item.id}>
                      <KitchenModule onDataChange={(total, config) => handleItemDataChange(item.id, total, config)} />
                    </ItemWrapper>
                  ))}
                </TabsContent>
                <TabsContent value="closet" className="mt-0 focus-visible:outline-none space-y-12">
                  {items.filter(i => i.category === 'closet').map(item => (
                    <ItemWrapper key={item.id} id={item.id}>
                      <ClosetModule onDataChange={(total, config) => handleItemDataChange(item.id, total, config)} initialData={item.configuration} />
                    </ItemWrapper>
                  ))}
                </TabsContent>
                <TabsContent value="puerta" className="mt-0 focus-visible:outline-none space-y-12">
                  {items.filter(i => i.category === 'puerta' || i.category === 'puertas').length === 0
                    ? <CategoryEmptyState category="puerta" label="Puerta" onAdd={() => addItem('puerta')} />
                    : items.filter(i => i.category === 'puerta' || i.category === 'puertas').map(item => (
                      <ItemWrapper key={item.id} id={item.id}>
                        <DoorsModule onDataChange={(total, config) => handleItemDataChange(item.id, total, config)} initialData={item.configuration} />
                      </ItemWrapper>
                    ))}
                </TabsContent>
                <TabsContent value="tv_center" className="mt-0 focus-visible:outline-none space-y-12">
                  {items.filter(i => i.category === 'tv_center').length === 0
                    ? <CategoryEmptyState category="tv_center" label="Centro TV" onAdd={() => addItem('tv_center')} />
                    : items.filter(i => i.category === 'tv_center').map(item => (
                      <ItemWrapper key={item.id} id={item.id}>
                        <TVCenterModule onDataChange={(total, config) => handleItemDataChange(item.id, total, config)} initialData={item.configuration} />
                      </ItemWrapper>
                    ))}
                </TabsContent>
                <TabsContent value="mesones" className="mt-0">
                  <PlaceholderModule title="Mesones" />
                </TabsContent>
                <TabsContent value="herrajes" className="mt-0 focus-visible:outline-none space-y-12">
                  {items.filter(i => i.category === 'herrajes').length === 0
                    ? <CategoryEmptyState category="herrajes" label="Herrajes" onAdd={() => addItem('herrajes')} />
                    : items.filter(i => i.category === 'herrajes').map(item => (
                      <ItemWrapper key={item.id} id={item.id}>
                        <HardwareModule onDataChange={(total, config) => handleItemDataChange(item.id, total, config)} initialData={item.configuration} />
                      </ItemWrapper>
                    ))}
                </TabsContent>
                <TabsContent value="especiales" className="mt-0 focus-visible:outline-none space-y-12">
                  {items.filter(i => i.category === 'especiales').length === 0
                    ? <CategoryEmptyState category="especiales" label="Acabados especiales" onAdd={() => addItem('especiales')} />
                    : items.filter(i => i.category === 'especiales').map(item => (
                      <ItemWrapper key={item.id} id={item.id}>
                        <SpecialFinishesModule onDataChange={(total, config) => handleItemDataChange(item.id, total, config)} initialData={item.configuration} />
                      </ItemWrapper>
                    ))}
                </TabsContent>
                <TabsContent value="otro" className="mt-0">
                  <PlaceholderModule title="Otros" />
                </TabsContent>
              </>
            )}

            {/* Economic summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 bg-[#1C1B1B] p-8 border-t-4 border-t-primary shadow-2xl relative z-10">
              <div className="md:col-span-2 space-y-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center gap-3 text-primary">
                    <Truck className="w-5 h-5" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em]">Logística y Parámetros Globales</h3>
                  </div>
                  <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/10 w-fit">
                    <Checkbox
                      id="standard-transport"
                      checked={transportDisplay === "150000"}
                      onCheckedChange={(checked) => handleTransportCheckbox(!!checked)}
                      className="border-primary/30 data-[state=checked]:bg-primary"
                    />
                    <label htmlFor="standard-transport" className="text-[10px] font-bold text-primary uppercase tracking-widest cursor-pointer select-none">
                      Aplicar Tarifa Estándar ($150.000 COP)
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Costo de Transporte e Instalación</label>
                    <div className="relative">
                      <Input type="text" value={transportDisplay} onChange={(e) => setTransportDisplay(e.target.value)} className="bg-background/50 h-14 text-xl font-mono font-bold border-border/20 pl-8" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Descuento Estratégico (%)</label>
                    <div className="relative">
                      <Input type="text" value={discountDisplay} onChange={(e) => setDiscountDisplay(e.target.value)} className="bg-background/50 h-14 text-xl font-mono font-bold border-border/20 pr-12" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e3a35] p-6 lg:p-8 rounded-none border border-primary/20 shadow-inner flex flex-col justify-center items-end relative overflow-hidden group min-h-[180px] lg:min-h-[220px] w-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors" />
                <p className="text-[10px] font-black text-primary/70 uppercase tracking-[0.3em] mb-4 relative z-10 text-right">Total Proyectado Neto</p>
                <span className="text-xl lg:text-2xl xl:text-3xl font-black font-mono text-primary tracking-tighter text-right w-full block drop-shadow-[0_0_15px_rgba(68,221,193,0.3)] relative z-10">
                  ${totals.subtotalWithTransport.toLocaleString('es-CO')}
                </span>
                <Button
                  className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 h-16 text-[10px] font-black uppercase tracking-[0.2em] rounded-none shadow-lg shadow-primary/20 group/btn relative z-10"
                  onClick={() => {
                    if (totals.subtotalItems <= 0) { toast.error("Configure al menos un producto para continuar."); return; }
                    onNext();
                  }}
                >
                  Continuar a Revisión <ChevronRight className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col sticky top-24 z-30 w-[300px] shrink-0 order-2">
            <div className="bg-[#1C1B1B] border border-border/10 p-6 shadow-2xl flex flex-col gap-8 rounded-xl overflow-hidden">
              <div className="space-y-6">
                <div className="border-b border-primary/20 pb-4">
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] leading-none">Catálogo Técnico</h3>
                  </div>
                </div>
                <TabsList variant="line" className="flex flex-col gap-1 items-stretch h-auto bg-transparent p-0 w-full border-0 shadow-none">
                  {CATEGORIES_CONFIG.map(cat => (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="w-full text-left justify-start data-active:bg-primary/10 data-active:text-primary data-active:border-l-2 data-active:border-l-primary data-active:shadow-none text-[12px] font-black uppercase tracking-widest h-12 px-4 transition-all duration-200 border border-transparent hover:bg-white/5 rounded-none"
                    >
                      {cat.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="pt-6 border-t border-border/10">
                <Button
                  onClick={() => {
                    addItem(activeTab);
                    toast.success(`Nuevo espacio de ${activeTab.toUpperCase()} añadido.`);
                  }}
                  className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary border-dashed hover:text-primary-foreground h-16 text-[10px] font-black uppercase tracking-[0.3em] rounded-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
                >
                  NUEVO PRODUCTO
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </Tabs>
    </motion.div>
  );
}
