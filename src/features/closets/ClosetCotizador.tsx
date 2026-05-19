
import * as React from 'react';
import { 
  Box, 
  Ruler, 
  Layers, 
  Truck, 
  Percent, 
  FileText, 
  Info,
  ChevronRight,
  Calculator,
  Sparkles
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import {
  ClosetInput,
  ClosetType,
  DoorType,
  CLOSET_DEFAULTS,
  CLOSET_DEPTHS,
} from './logic';
import { useClosetCalculator } from '@/hooks/use-closet-calculator';

interface ClosetCotizadorProps {
  onDataChange?: (total: number, config: any) => void;
  initialData?: Partial<ClosetInput>;
}

/**
 * REGLA 3: Capa de Interfaz de Usuario (UI)
 * Módulo: Cotizador de Closets a medida
 */
export function ClosetCotizador({ onDataChange, initialData }: ClosetCotizadorProps) {
  // Estado local para permitir strings vacíos en inputs numéricos y mejorar UX
  const [displayData, setDisplayData] = React.useState({
    width: String(initialData?.width || CLOSET_DEFAULTS.minWidth),
    height: String(initialData?.height || CLOSET_DEFAULTS.minHeight),
    transport: String(initialData?.transport || CLOSET_DEFAULTS.transport),
    discountPercent: String(initialData?.discountPercent || 0),
  });

  const [formData, setFormData] = React.useState<ClosetInput>({
    type: undefined as any,
    width: CLOSET_DEFAULTS.minWidth,
    height: CLOSET_DEFAULTS.minHeight,
    doorType: undefined as any,
    observations: '',
    transport: CLOSET_DEFAULTS.transport,
    discountPercent: 0,
    ...initialData
  });

  const results = useClosetCalculator(formData);

  // Sincronizar displayData con formData para los cálculos
  React.useEffect(() => {
    setFormData(prev => ({
      ...prev,
      width: Number(displayData.width) || 0,
      height: Number(displayData.height) || 0,
      transport: Number(displayData.transport) || 0,
      discountPercent: Number(displayData.discountPercent) || 0,
    }));
  }, [displayData]);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });
  React.useEffect(() => {
    if (!onDataChange) return;
    const total = results.total;
    const config = { ...formData, ...results };
    const configStr = JSON.stringify(config);
    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, config);
    }
  }, [results.total, formData]);

  const handleDisplayChange = (field: keyof typeof displayData, value: string) => {
    setDisplayData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleChange = (field: keyof ClosetInput, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      {/* 🟢 HEADER UNIFICADO (Idéntico a Cocina) */}
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Closets a Medida</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Ingeniería Paramétrica de Almacenamiento</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-10">
        {/* 🛠️ FORMULARIO TÉCNICO EN ANCHO COMPLETO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* TIPO DE CLOSET */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              Categoría de closet
            </label>
            <Select 
              value={formData.type} 
              onValueChange={(v) => { if (v !== null) handleChange('type', v as ClosetType); }}
            >
              <SelectTrigger className="h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary min-w-[240px] w-full px-4">
                <SelectValue placeholder="Selecciona categoría de closet" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/10 min-w-[240px] w-[max-content]">
                <SelectItem value="estandar" label="Estándar" className="font-bold py-3 text-sm capitalize">Estándar <span className="lowercase font-normal opacity-60">($750.000/m² · 0.60m prof.)</span></SelectItem>
                <SelectItem value="especial" label="Especial" className="font-bold py-3 text-sm capitalize">Especial <span className="lowercase font-normal opacity-60">($650.000/m² · 0.45m prof.)</span></SelectItem>
                <SelectItem value="empotrado" label="Empotrado" className="font-bold py-3 text-sm capitalize">Empotrado <span className="lowercase font-normal opacity-60">($900.000/m² · 0.60m prof.)</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* TIPO DE PUERTAS */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
              Sistema de apertura
            </label>
            <Select 
              value={formData.doorType} 
              onValueChange={(v) => { if (v !== null) handleChange('doorType', v as DoorType); }}
            >
              <SelectTrigger className="h-14 bg-background border-border/40 text-sm font-bold rounded-none min-w-[240px] w-full px-4">
                <SelectValue placeholder="Selecciona sistema de apertura" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border/10 min-w-[240px] w-[max-content]">
                <SelectItem value="batiente" label="Batientes" className="font-bold py-3 text-sm capitalize">Batientes <span className="lowercase font-medium opacity-60 ml-2">(Tradicional)</span></SelectItem>
                <SelectItem value="corrediza" label="Corredizas" className="font-bold py-3 text-sm capitalize">Corredizas <span className="lowercase font-medium opacity-60 ml-2">(Espacios reducidos)</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              Ancho (Metros) <Ruler className="w-3 h-3" />
            </label>
            <div className="relative">
              <Input 
                type="text" 
                value={displayData.width}
                onChange={(e) => handleDisplayChange('width', e.target.value)}
                onBlur={() => {
                  const v = Number(displayData.width);
                  if (displayData.width === '' || isNaN(v) || v < CLOSET_DEFAULTS.minWidth) {
                    handleDisplayChange('width', String(CLOSET_DEFAULTS.minWidth));
                  } else if (v > CLOSET_DEFAULTS.maxWidth) {
                    handleDisplayChange('width', String(CLOSET_DEFAULTS.maxWidth));
                  }
                }}
                className="h-16 bg-background border-border/40 text-2xl font-mono font-bold pl-12 rounded-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">W</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              Alto (Metros) <Ruler className="w-3 h-3" />
            </label>
            <div className="relative">
              <Input 
                type="text" 
                value={displayData.height}
                onChange={(e) => handleDisplayChange('height', e.target.value)}
                onBlur={() => {
                  const v = Number(displayData.height);
                  if (displayData.height === '' || isNaN(v) || v < CLOSET_DEFAULTS.minHeight) {
                    handleDisplayChange('height', String(CLOSET_DEFAULTS.minHeight));
                  } else if (v > CLOSET_DEFAULTS.maxHeight) {
                    handleDisplayChange('height', String(CLOSET_DEFAULTS.maxHeight));
                  }
                }}
                className="h-16 bg-background border-border/40 text-2xl font-mono font-bold pl-12 rounded-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">H</span>
            </div>
          </div>
        </div>

        {/* OBSERVACIONES */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-4 h-4" /> Requerimientos específicos
          </label>
          <Textarea 
            placeholder="Ej: Incluir iluminación LED en maletero, herrajes de cierre lento, etc..."
            value={formData.observations}
            onChange={(e) => handleChange('observations', e.target.value)}
            className="min-h-[100px] bg-background border-border/40 font-medium rounded-none resize-none focus:ring-primary"
          />
        </div>

        {/* PARÁMETROS ECONÓMICOS DEL MÓDULO */}
        <div className="p-8 bg-muted/5 border border-border/5 grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-3">
             <label className="text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
               <Truck className="w-3 h-3" /> Transporte e Instalación Local
             </label>
             <div className="relative">
               <Input 
                 type="text" 
                 value={displayData.transport}
                 onChange={(e) => handleDisplayChange('transport', e.target.value)}
                 className="h-12 bg-background/50 border-border/20 pl-8 font-mono font-bold text-sm rounded-none"
               />
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
             </div>
           </div>
           <div className="space-y-3">
             <label className="text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
               <Percent className="w-3 h-3" /> Descuento Manual por Módulo
             </label>
             <div className="relative">
               <Input 
                 type="text" 
                 value={displayData.discountPercent}
                 onChange={(e) => handleDisplayChange('discountPercent', e.target.value)}
                 className="h-12 bg-background/50 border-border/20 pr-10 font-mono font-bold text-sm rounded-none"
               />
               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">%</span>
             </div>
           </div>
        </div>

        {/* PIE DE NOTAS TÉCNICAS */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Configuración Estándar Validada
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              Incluye Maletero, divisor, doble colgadero, entrepaños, doble cajonero, zapatero y puertas.{formData.type === 'empotrado' && ' Espaldar y laterales completos.'} Profundidad: <span className="text-foreground font-bold">{CLOSET_DEPTHS[formData.type]}m</span>. Área: <span className="text-foreground font-bold">{results.area.toFixed(2)}m²</span>
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Subtotal Closet</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
             $ {results.total.toLocaleString('es-CO')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
