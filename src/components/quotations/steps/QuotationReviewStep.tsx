import * as React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Calculator, ArrowLeft, FileText, Save, Search, Box, Truck, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { QuotationItemData } from '@/hooks/quotations/useQuotationBuilder';

const CATEGORY_LABELS: Record<string, string> = {
  cocina: 'Cocina Integral',
  cocina_integral: 'Cocina Integral',
  puerta: 'Carpintería de Puertas',
  puertas: 'Carpintería de Puertas',
  tv_center: 'Centro de TV Multimedia',
  herrajes: 'Kit de Herrajes & Accesorios',
  especiales: 'Acabados Especiales High-End',
  closet: 'Closet / Vestier',
};

interface Totals {
  subtotalItems: number;
  discountAmount: number;
  subtotalWithTransport: number;
  taxes: number;
  grandTotal: number;
}

interface QuotationReviewStepProps {
  items: QuotationItemData[];
  transportCost: number;
  discountPercent: number;
  setDiscountPercent: (v: number) => void;
  totals: Totals;
  isSaving: boolean;
  handleSaveQuotation: () => void;
  handlePrintPDF: () => void;
  onBack: () => void;
}

export function QuotationReviewStep({
  items, transportCost, discountPercent, setDiscountPercent,
  totals, isSaving, handleSaveQuotation, handlePrintPDF, onBack,
}: QuotationReviewStepProps) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className="space-y-12"
    >
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto border-2 border-primary/20 mb-6">
          <Calculator className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-5xl font-black text-foreground tracking-tighter uppercase underline decoration-primary/30 underline-offset-10">Revisión de Auditoría</h2>
        <p className="text-muted-foreground text-sm font-medium">Verifica los valores finales y la correcta parametrización de los impuestos antes de generar el documento oficial.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-16">
        {/* Left: items + logistics */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
              <Box className="w-4 h-4" /> Resumen de Productos
            </h4>
            <div className="space-y-3">
              {items.filter(i => i.calculatedTotal > 0).map((item, idx) => (
                <div key={idx} className="p-6 bg-card border border-border/10 flex justify-between items-center group hover:border-primary/30 transition-all duration-500">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-sm bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Box className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest text-foreground group-hover:text-primary transition-colors">
                        {CATEGORY_LABELS[item.category] ?? 'Producto Personalizado'}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">Configuración personalizada bajo demanda</p>
                    </div>
                  </div>
                  <span className="text-lg font-mono font-bold text-foreground">
                    $ {item.calculatedTotal.toLocaleString('es-CO')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 bg-muted/20 border border-border/5 space-y-6">
            <div className="flex items-center gap-3 text-muted-foreground mb-4">
              <Truck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest italic">Cargos Logísticos y Descuentos</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center px-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Transporte e Instalación</span>
                <span className="text-sm font-mono font-bold">$ {transportCost.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Descuento Global ({discountPercent}%)</span>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-20 text-right h-8 bg-background/50 text-xs font-bold"
                  />
                  <span className="text-sm font-mono font-bold text-primary">- $ {totals.discountAmount.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: totals card + actions */}
        <div className="space-y-8">
          <Card className="bg-[#1C1B1B] border-none shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden rounded-sm border-t-8 border-t-primary">
            <div className="p-10 space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-muted-foreground/60 hover:text-foreground transition-colors">
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Subtotal Base</span>
                  <span className="text-xl font-mono font-bold">$ {totals.subtotalWithTransport.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-500/60 hover:text-emerald-500 transition-colors">
                  <span className="text-xs font-black uppercase tracking-[0.2em]">IVA Consolidado (19%)</span>
                  <span className="text-xl font-mono font-bold">$ {totals.taxes.toLocaleString('es-CO')}</span>
                </div>
              </div>

              <Separator className="bg-border/5" />

              <div className="space-y-3 text-right">
                <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em]">Total Inversión</p>
                <h2 className="text-6xl font-black font-mono text-primary tracking-tighter drop-shadow-[0_0_20px_rgba(68,221,193,0.4)]">
                  ${totals.grandTotal.toLocaleString('es-CO')}
                </h2>
                <p className="text-[10px] text-muted-foreground font-medium italic mt-2">Valores finales sujetos a validación en sitio por ingeniería.</p>
              </div>

              <div className="flex flex-col gap-4 pt-6">
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={onBack}
                    className="flex-1 h-14 border-border/50 text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-muted/10 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Ajustar Diseño
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-14 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-primary/10 transition-colors"
                    onClick={() => toast.info("Borrador guardado localmente.")}
                  >
                    <FileText className="w-4 h-4 mr-2" /> Guardar Borrador
                  </Button>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-16 border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/5 group/pdf"
                    onClick={handlePrintPDF}
                  >
                    <Search className="w-5 h-5 group-hover/pdf:scale-110 transition-transform" /> Ver PDF (Vista Previa)
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={handleSaveQuotation}
                    className="flex-[1.5] bg-primary text-primary-foreground hover:bg-primary/90 h-16 text-xs font-black uppercase tracking-[0.1em] rounded-none shadow-2xl relative overflow-hidden group/save"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-3" />}
                    {isSaving ? "Finalizando..." : "Confirmar y Finalizar Cotización"}
                    <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/save:translate-x-[100%] transition-transform duration-1000" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
