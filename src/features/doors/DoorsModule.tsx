import * as React from 'react';
import { 
  DoorOpen, 
  Calculator, 
  Sparkles,
  Info,
  Layers,
  Eye
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
import { DoorsTemplate } from '@/components/pdf/templates/DoorsTemplate';
import { useDoorsCalculator } from '@/hooks/use-doors-calculator';
import { DoorType } from './logic';
import { formatDate } from '@/lib/format-utils';

interface DoorsModuleProps {
  onDataChange: (total: number, config: any) => void;
  initialData?: any;
}

export const DoorsModule: React.FC<DoorsModuleProps> = ({ onDataChange, initialData }) => {
  const [formData, setFormData] = React.useState({
    type: (initialData?.type as DoorType) || 'CORREDIZA_SENCILLA',
    quantity: initialData?.quantity ?? 1,
    includeDintel: initialData?.includeDintel ?? false,
    manualDiscount: initialData?.manualDiscount ?? 0
  });

  const [displayData, setDisplayData] = React.useState({
    quantity: String(formData.quantity),
    manualDiscount: String(formData.manualDiscount)
  });

  // Sincronizar displayData con formData (Patrón Empty-able de AGENTS.md)
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      quantity: Number(displayData.quantity) || 0,
      manualDiscount: Number(displayData.manualDiscount) || 0
    }));
  }, [displayData]);

  const results = useDoorsCalculator(formData);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });

  React.useEffect(() => {
    const total = results.total;
    const configStr = JSON.stringify(formData);

    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, formData);
    }
  }, [results, formData, onDataChange]);

  const handleTypeChange = (type: DoorType) => {
    setFormData(prev => ({ ...prev, type }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, includeDintel: checked }));
  };

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DoorOpen className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Puertas Independientes</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Fabricación a Medida Estándar</CardDescription>
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
                 <DoorsTemplate 
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* TIPO DE PUERTA */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Tipo de Puerta</label>
            <Select value={formData.type} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary w-full px-4">
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/40 min-w-[240px]">
                <SelectItem value="CORREDIZA_SENCILLA" className="focus:bg-primary/20 focus:text-primary py-3">Corrediza Sencilla</SelectItem>
                <SelectItem value="CORREDIZA_DOBLE" className="focus:bg-primary/20 focus:text-primary py-3">Corrediza Doble</SelectItem>
                <SelectItem value="BATIENTE" className="focus:bg-primary/20 focus:text-primary py-3">Batiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CANTIDAD */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Cantidad</label>
            <Input 
              type="text"
              value={displayData.quantity}
              onChange={(e) => setDisplayData(prev => ({ ...prev, quantity: e.target.value }))}
              className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary w-full px-4 font-mono"
            />
          </div>

          {/* DESCUENTO */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Descuento (%)</label>
            <div className="relative">
              <Input 
                type="text"
                value={displayData.manualDiscount}
                onChange={(e) => setDisplayData(prev => ({ ...prev, manualDiscount: e.target.value }))}
                className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary w-full px-4 font-mono pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">%</span>
            </div>
          </div>

          {/* DINTEL */}
          <div className="flex items-end pb-4">
            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 w-full h-14">
              <Checkbox 
                id="dintel" 
                checked={formData.includeDintel}
                onCheckedChange={(v) => handleCheckboxChange(v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <Label htmlFor="dintel" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Incluye Dintel</Label>
            </div>
          </div>
        </div>

        {/* INFO BOX */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Especificaciones Estándar
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              {results.specs.includes} Altura máxima: {results.specs.altoMax}. {results.specs.dintel}.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Subtotal Puertas</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
             $ {results.total.toLocaleString('es-CO')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};
