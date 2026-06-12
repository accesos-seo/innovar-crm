/**
 * REGLA 3: Capa de Interfaz de Usuario (UI)
 * Módulo: Cotizador de Herrajes (Selección Múltiple)
 */

import * as React from 'react';
import { 
  Box, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Search, 
  Filter,
  Eye,
  Info,
  Sparkles
} from 'lucide-react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useHardwareCalculator } from '@/hooks/use-hardware-calculator';
import { HARDWARE_CATALOG, HardwareInput, HardwareItem, SelectedHardware, HARDWARE_LEGAL_NOTE } from './logic';
import { HardwareTemplate } from '@/components/pdf/templates/HardwareTemplate';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format-utils';

interface HardwareModuleProps {
  onDataChange: (total: number, config: any) => void;
  initialData?: any;
}

export const HardwareModule: React.FC<HardwareModuleProps> = ({ onDataChange, initialData }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('');
  const [currentItemId, setCurrentItemId] = React.useState<string>('');
  const [currentQuantity, setCurrentQuantity] = React.useState<string>('1');
  
  const [formData, setFormData] = React.useState<HardwareInput>({
    selectedItems: initialData?.selectedItems || [],
    manualDiscount: initialData?.manualDiscount || 0
  });

  const [displayData, setDisplayData] = React.useState({
    manualDiscount: String(formData.manualDiscount)
  });

  // Sync displayData with formData (Patrón Empty-able)
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      manualDiscount: Number(displayData.manualDiscount) || 0
    }));
  }, [displayData.manualDiscount]);

  const results = useHardwareCalculator(formData);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });

  React.useEffect(() => {
    const total = results.total;
    const configStr = JSON.stringify(formData);

    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, formData);
    }
  }, [results, formData, onDataChange]);

  const filteredCatalog = HARDWARE_CATALOG.filter(item =>
    !selectedCategory || item.category === selectedCategory
  );

  const handleAddItem = () => {
    if (!currentItemId) return;
    const qty = Number(currentQuantity) || 1;
    
    setFormData(prev => {
      const existingIndex = prev.selectedItems.findIndex(i => i.hardwareId === currentItemId);
      if (existingIndex > -1) {
        const newItems = [...prev.selectedItems];
        newItems[existingIndex].quantity += qty;
        return { ...prev, selectedItems: newItems };
      }
      return {
        ...prev,
        selectedItems: [...prev.selectedItems, { hardwareId: currentItemId, quantity: qty }]
      };
    });
    
    // Reset selection
    setCurrentItemId('');
    setCurrentQuantity('1');
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter(item => item.hardwareId !== id)
    }));
  };

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShoppingCart className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Herrajes & Accesorios</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Selección Dinámica de Calidad Premium</CardDescription>
            </div>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all">
                <Eye className="w-4 h-4 mr-2" /> Ver Ficha Técnica
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[850px] p-0 border-none bg-transparent shadow-2xl">
              <div className="scale-75 origin-top-center overflow-auto max-h-[90vh]">
                 <HardwareTemplate 
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
        {/* PANEL DE SELECCIÓN */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 bg-muted/5 p-6 border border-border/10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-primary uppercase tracking-widest">Filtrar Categoría</label>
            <Select
              value={selectedCategory}
              onValueChange={(v) => setSelectedCategory(v === 'todas' ? '' : v)}
            >
              <SelectTrigger className="w-full h-12 bg-background border-border/40 text-sm font-bold rounded-none">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/40">
                <SelectItem value="todas" label="Todas las categorías">Todas las categorías</SelectItem>
                <SelectItem value="cocinas" label="Cocinas">Cocinas</SelectItem>
                <SelectItem value="closets" label="Closets">Closets</SelectItem>
                <SelectItem value="puertas" label="Puertas">Puertas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-primary uppercase tracking-widest">Seleccionar Herraje</label>
            <Select value={currentItemId} onValueChange={setCurrentItemId}>
              <SelectTrigger className="w-full h-12 bg-background border-border/40 text-sm font-bold rounded-none">
                <SelectValue placeholder="Selecciona un producto..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/40 max-h-[300px]">
                {filteredCatalog.map(item => (
                  <SelectItem key={item.id} value={item.id} className="focus:bg-primary/10">
                    <div className="flex justify-between w-full gap-8">
                      <span>{item.name}</span>
                      <span className="text-primary font-mono">${item.price.toLocaleString('es-CO')}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-primary uppercase tracking-widest">Cant.</label>
              <Input
                type="number"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(e.target.value)}
                min="1"
                className="h-12 w-20 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary font-mono"
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={!currentItemId}
              className="h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-none px-6"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* TABLA DE ITEMS SELECCIONADOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
             <Filter className="w-4 h-4" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Configuración Actual</h3>
          </div>
          
          <div className="border border-border/10 rounded-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/10">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Herraje</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Categoría</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Cantidad</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Unitario</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Subtotal</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.detailedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic text-xs uppercase tracking-widest opacity-50">
                      No se han agregado herrajes a la lista
                    </TableCell>
                  </TableRow>
                ) : (
                  results.detailedItems.map((item) => (
                    <TableRow key={item.id} className="border-border/5 hover:bg-white/5 transition-colors group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground uppercase tracking-tight">{item.name}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{item.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 bg-primary/10 text-primary text-[8px] font-black uppercase rounded-full">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-xs">${item.price.toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">${item.subtotal.toLocaleString('es-CO')}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* EXTRAS Y DESCUENTOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end pt-4 border-t border-border/10">
           <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-3 h-3" /> Condición Comercial
                </p>
                <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
                  {HARDWARE_LEGAL_NOTE}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex flex-col gap-1">
                <span>Descuento Estratégico (%)</span>
                <span className="text-[8px] text-muted-foreground/60 font-bold italic">Rango permitido: 0 - 15%</span>
              </label>
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
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Total Herrajes</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
             $ {results.total.toLocaleString('es-CO')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};
