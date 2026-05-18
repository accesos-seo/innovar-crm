/**
 * REGLA 3: Capa de Interfaz de Usuario (UI)
 * Módulo: Cotizador de Centro de TV
 */

import * as React from 'react';
import { 
  Tv, 
  Sparkles,
  Info,
  Lightbulb,
  Layers,
  Truck,
  Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { TVCenterTemplate } from '@/components/pdf/templates/TVCenterTemplate';
import { useTVCenterCalculator } from '@/hooks/use-tv-center-calculator';
import { TVCenterInput } from './logic';
import { formatDate } from '@/lib/format-utils';

interface TVCenterModuleProps {
  onDataChange: (total: number, config: any) => void;
  initialData?: any;
}

export const TVCenterModule: React.FC<TVCenterModuleProps> = ({ onDataChange, initialData }) => {
  const [formData, setFormData] = React.useState<TVCenterInput>({
    includeBase: initialData?.includeBase ?? true,
    highGloss: initialData?.highGloss ?? false,
    ledMetros: initialData?.ledMetros ?? 0,
    shelvesQuantity: initialData?.shelvesQuantity ?? 0,
    includeTransport: initialData?.includeTransport ?? false,
    manualDiscount: initialData?.manualDiscount ?? 0
  });

  const [displayData, setDisplayData] = React.useState({
    ledMetros: String(formData.ledMetros),
    shelvesQuantity: String(formData.shelvesQuantity),
    manualDiscount: String(formData.manualDiscount)
  });

  // Sincronizar displayData con formData (Patrón Empty-able de AGENTS.md)
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      ledMetros: Number(displayData.ledMetros) || 0,
      shelvesQuantity: Number(displayData.shelvesQuantity) || 0,
      manualDiscount: Number(displayData.manualDiscount) || 0
    }));
  }, [displayData]);

  const results = useTVCenterCalculator(formData);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });

  React.useEffect(() => {
    const total = results.total;
    const configStr = JSON.stringify(formData);

    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, formData);
    }
  }, [results, formData, onDataChange]);

  const handleCheckboxChange = (field: keyof TVCenterInput, checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked }));
  };

  return (
    <Card className="w-full bg-[#1C1B1B] border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Tv className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Centro de TV</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Diseño Paramétrico & Multimedia</CardDescription>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all">
                <Eye className="w-4 h-4 mr-2" /> Ver Ficha Técnica
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[850px] p-0 border-none bg-transparent shadow-2xl">
              <div className="scale-75 origin-top-center overflow-auto max-h-[90vh]">
                 <TVCenterTemplate 
                  data={{
                    client_name: "Previsualización Técnica",
                    total_amount: results.total,
                    configuration: { ...formData, ...results },
                    date: formatDate(new Date())
                  }} 
                 />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* OPCIONES PRINCIPALES (CHECKBOXES) */}
          <div className="space-y-4 col-span-1 md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 transition-colors hover:bg-primary/10">
              <Checkbox 
                id="includeBase" 
                checked={formData.includeBase}
                onCheckedChange={(v) => handleCheckboxChange('includeBase', v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="includeBase" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Mueble Base</Label>
                <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">Suma $2,800,000</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 transition-colors hover:bg-primary/10">
              <Checkbox 
                id="highGloss" 
                checked={formData.highGloss}
                onCheckedChange={(v) => handleCheckboxChange('highGloss', v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="highGloss" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Acabado Alto Brillo</Label>
                <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">Suma $500,000</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 transition-colors hover:bg-primary/10">
              <Checkbox 
                id="includeTransport" 
                checked={formData.includeTransport}
                onCheckedChange={(v) => handleCheckboxChange('includeTransport', v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="includeTransport" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Logística & Transporte</Label>
                <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">Suma $150,000</span>
              </div>
            </div>
          </div>

          {/* INPUTS NUMÉRICOS */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <Lightbulb className="w-3 h-3" /> Metros de LED
            </label>
            <Input 
              type="text"
              value={displayData.ledMetros}
              onChange={(e) => setDisplayData(prev => ({ ...prev, ledMetros: e.target.value }))}
              placeholder="0"
              className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary w-full px-4 font-mono transition-all focus:border-primary"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers className="w-3 h-3" /> Repisas Adicionales
            </label>
            <Input 
              type="text"
              value={displayData.shelvesQuantity}
              onChange={(e) => setDisplayData(prev => ({ ...prev, shelvesQuantity: e.target.value }))}
              placeholder="0"
              className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary w-full px-4 font-mono transition-all focus:border-primary"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Descuento (%)</label>
            <div className="relative">
              <Input 
                type="text"
                value={displayData.manualDiscount}
                onChange={(e) => setDisplayData(prev => ({ ...prev, manualDiscount: e.target.value }))}
                placeholder="0"
                className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary w-full px-4 font-mono pr-12 transition-all focus:border-primary"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">%</span>
            </div>
          </div>
        </div>

        {/* INFO BOX */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4 rounded-sm">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Especificaciones de Ingeniería
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              {results.specs.includes} Fabricado en {results.specs.material}. 
              Configuración: {results.specs.base}, {results.specs.finish}, {results.specs.ledDetails}.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-[#1e3a35] p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Subtotal Centro de TV</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
             $ {results.total.toLocaleString('es-CO')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};
