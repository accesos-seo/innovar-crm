/**
 * REGLA 3: Capa de Interfaz de Usuario (UI)
 * Módulo: Cotizador de Acabados Especiales
 */

import * as React from 'react';
import { 
  Sparkles, 
  Trash2, 
  Plus, 
  Info,
  Layers,
  Lightbulb,
  Truck,
  Eye,
  FileText
} from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useSpecialFinishesCalculator } from '@/hooks/use-special-finishes-calculator';
import { SpecialFinishesInput, SPECIAL_FINISH_LEGAL_NOTE } from './logic';
import { SpecialFinishesTemplate } from '@/components/pdf/templates/SpecialFinishesTemplate';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-utils';

interface SpecialFinishesModuleProps {
  onDataChange: (total: number, config: any) => void;
  initialData?: any;
}

export const SpecialFinishesModule: React.FC<SpecialFinishesModuleProps> = ({ onDataChange, initialData }) => {
  const [formData, setFormData] = React.useState<SpecialFinishesInput>({
    description: initialData?.description || '',
    doors: initialData?.doors || [],
    includeLed: initialData?.includeLed || false,
    ledMl: initialData?.ledMl || 0,
    includeTransport: initialData?.includeTransport || false,
    manualDiscount: initialData?.manualDiscount || 0
  });

  const [displayData, setDisplayData] = React.useState({
    ledMl: String(formData.ledMl),
    manualDiscount: String(formData.manualDiscount)
  });

  // Sync displayData (Patrón Empty-able)
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      ledMl: Number(displayData.ledMl) || 0,
      manualDiscount: Number(displayData.manualDiscount) || 0
    }));
  }, [displayData]);

  const results = useSpecialFinishesCalculator(formData);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });

  React.useEffect(() => {
    const total = results.total;
    const configStr = JSON.stringify(formData);

    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, formData);
    }
  }, [results, formData, onDataChange]);

  const addDoor = () => {
    setFormData(prev => ({
      ...prev,
      doors: [...prev.doors, { id: `door-${Date.now()}`, height: 0, width: 0 }]
    }));
  };

  const removeDoor = (id: string) => {
    setFormData(prev => ({
      ...prev,
      doors: prev.doors.filter(d => d.id !== id)
    }));
  };

  const updateDoor = (id: string, field: 'height' | 'width', value: string) => {
    setFormData(prev => ({
      ...prev,
      doors: prev.doors.map(d => d.id === id ? { ...d, [field]: Number(value) || 0 } : d)
    }));
  };

  return (
    <Card className="w-full bg-[#1C1B1B] border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Acabados Especiales</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Aluminio & Vidrio Ahumado High-End</CardDescription>
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
                 <SpecialFinishesTemplate 
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
        {/* DESCRIPCIÓN OBLIGATORIA */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-3 h-3" /> Detalles del Acabado (Obligatorio)
          </label>
          <Textarea 
            placeholder="Describe aquí las especificaciones del diseño..."
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="min-h-[100px] bg-background border-border/40 focus:border-primary text-sm font-medium resize-none rounded-none"
          />
        </div>

        {/* CONFIGURADOR DE PUERTAS */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/10 pb-4">
             <div className="flex items-center gap-3">
               <Layers className="text-primary w-4 h-4" />
               <h3 className="text-xs font-black uppercase tracking-[0.2em]">Dimensionamiento de Puertas</h3>
             </div>
             <Button 
              onClick={addDoor}
              variant="outline"
              size="sm"
              className="h-9 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 rounded-none"
             >
               <Plus className="w-4 h-4 mr-2" /> Agregar Puerta
             </Button>
          </div>

          <div className="space-y-4">
            {formData.doors.length === 0 ? (
               <div className="h-24 flex items-center justify-center border border-dashed border-border/20 bg-muted/5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">
                 No hay puertas definidas en este módulo
               </div>
            ) : (
              formData.doors.map((door, idx) => {
                const doorResults = results.detailedDoors.find(d => d.id === door.id);
                return (
                  <div key={door.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-muted/5 p-4 border border-border/5 group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                         {idx + 1}
                       </span>
                       <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Puerta Aluminio</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <div className="flex-1">
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Alto (m)"
                            value={door.height || ''}
                            onChange={(e) => updateDoor(door.id, 'height', e.target.value)}
                            className="bg-background h-10 border-border/40 font-mono text-center"
                          />
                       </div>
                       <span className="text-muted-foreground font-mono">×</span>
                       <div className="flex-1">
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Ancho (m)"
                            value={door.width || ''}
                            onChange={(e) => updateDoor(door.id, 'width', e.target.value)}
                            className="bg-background h-10 border-border/40 font-mono text-center"
                          />
                       </div>
                    </div>

                    <div className="text-center">
                       <span className="text-sm font-black font-mono text-primary">
                         {doorResults?.area.toFixed(2)} m²
                       </span>
                    </div>

                    <div className="flex justify-end gap-4 items-center">
                       <div className="text-right flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-500 font-mono italic">
                            ${doorResults?.cost.toLocaleString('es-CO')}
                          </span>
                       </div>
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeDoor(door.id)}
                        className="text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ILUMINACION LED & LOGISTICA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-6">
              <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 transition-colors hover:bg-primary/10">
                <Checkbox 
                  id="includeLed" 
                  checked={formData.includeLed}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, includeLed: v as boolean }))}
                  className="border-primary data-[state=checked]:bg-primary"
                />
                <div className="flex flex-col flex-1">
                  <Label htmlFor="includeLed" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Iluminación LED Integrada</Label>
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">Suma $180,000 / ml</span>
                </div>
                {formData.includeLed && (
                  <div className="w-24">
                    <Input 
                      type="text"
                      value={displayData.ledMl}
                      onChange={(e) => setDisplayData(prev => ({ ...prev, ledMl: e.target.value }))}
                      className="h-9 bg-background border-primary/20 text-center font-mono font-bold text-xs"
                      placeholder="ml"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 transition-colors hover:bg-primary/10">
                <Checkbox 
                  id="includeTransportSF" 
                  checked={formData.includeTransport}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, includeTransport: v as boolean }))}
                  className="border-primary data-[state=checked]:bg-primary"
                />
                <div className="flex flex-col">
                  <Label htmlFor="includeTransportSF" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Transporte & Logística de Cristalería</Label>
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">Suma $150,000 Fijo</span>
                </div>
              </div>
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Descuento Estratégico (%)</label>
              <div className="relative">
                <Input 
                  type="text"
                  value={displayData.manualDiscount}
                  onChange={(e) => setDisplayData(prev => ({ ...prev, manualDiscount: e.target.value }))}
                  placeholder="0"
                  className="h-14 bg-background border-border/40 text-xl font-bold rounded-none focus:ring-primary w-full px-4 font-mono pr-12 transition-all focus:border-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold text-xl">%</span>
              </div>
           </div>
        </div>

        {/* INFO BOX */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Lightbulb className="w-3 h-3" /> Especificación de Producto
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              {SPECIAL_FINISH_LEGAL_NOTE} Puertas configuradas: {formData.doors.length}. Área total: {results.totalM2.toFixed(2)} m². 
              Insumos detectados: Bisagras ({results.totalHingesCount} pares), LED ({formData.ledMl} ml).
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-[#1e3a35] p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Subtotal Acabados</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
             $ {results.total.toLocaleString('es-CO')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};
