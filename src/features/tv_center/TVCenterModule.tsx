/**
 * REGLA 3: Capa de Interfaz de Usuario (UI)
 * Módulo: Cotizador de Centro de TV
 * Fuente de verdad: 2-CENTRO_DE_TV.docx
 */

import * as React from 'react';
import {
  Tv,
  Sparkles,
  Info,
  Lightbulb,
  Layers,
  Truck,
  Eye,
  Monitor,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TVCenterTemplate } from '@/components/pdf/templates/TVCenterTemplate';
import { useTVCenterCalculator } from '@/hooks/use-tv-center-calculator';
import { TVCenterInput, TV_CENTER_PRICES } from './logic';
import { formatDate } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

interface TVCenterModuleProps {
  onDataChange: (total: number, config: any) => void;
  initialData?: any;
}

// Anchos disponibles según la documentación (1.20m a 2.40m, pasos de 0.20)
const WIDTH_OPTIONS = [1.20, 1.40, 1.60, 1.80, 2.00, 2.20, 2.40] as const;

// Opciones de repisas (0–5)
const SHELF_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

// Opciones de espacios para equipos (0–4)
const EQUIPMENT_OPTIONS = [0, 1, 2, 3, 4] as const;

export const TVCenterModule: React.FC<TVCenterModuleProps> = ({ onDataChange, initialData }) => {
  const [formData, setFormData] = React.useState<TVCenterInput>({
    width:            initialData?.width            ?? 1.60,
    hasHighGloss:     initialData?.hasHighGloss     ?? false,
    hasLedLights:     initialData?.hasLedLights     ?? false,
    floatingShelves:  initialData?.floatingShelves  ?? 2,
    equipmentSpaces:  initialData?.equipmentSpaces  ?? 0,
    includeTransport: initialData?.includeTransport ?? false,
    manualDiscount:   initialData?.manualDiscount   ?? 0,
  });

  const results = useTVCenterCalculator(formData);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });

  React.useEffect(() => {
    const total     = results.total;
    const configStr = JSON.stringify(formData);
    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, formData);
    }
  }, [results, formData, onDataChange]);

  const set = <K extends keyof TVCenterInput>(field: K, value: TVCenterInput[K]) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Tv className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Centro de TV</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">
                Motor de precios INNOVAR — {formData.width.toFixed(2)}m
              </CardDescription>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all">
                <Eye className="w-4 h-4 mr-2" /> Ver Ficha Técnica
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[850px] p-0 border-none bg-transparent shadow-2xl">
              <div className="scale-75 origin-top overflow-auto max-h-[90vh]">
                <TVCenterTemplate
                  data={{
                    client_name:   'Previsualización Técnica',
                    total_amount:  results.total,
                    configuration: { ...formData, ...results },
                    date:          formatDate(new Date()),
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-10">

        {/* ── SECCIÓN 1: Ancho ── */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
            <Monitor className="w-3 h-3" /> Ancho del centro de TV
          </p>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {WIDTH_OPTIONS.map(w => {
              const diff = Math.round((w - TV_CENTER_PRICES.BASE_WIDTH) * 100);
              const incs = Math.round(diff / 20);
              const delta = incs * TV_CENTER_PRICES.INCREMENT_PER_20CM;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => set('width', w)}
                  className={cn(
                    'flex flex-col items-center p-3 border text-center transition-all',
                    formData.width === w
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border/30 hover:border-primary/50 text-muted-foreground'
                  )}
                >
                  <span className="text-sm font-black">{w.toFixed(2)}m</span>
                  <span className={cn(
                    'text-[9px] font-bold mt-0.5',
                    formData.width === w ? 'text-primary-foreground/80' : 'text-muted-foreground/60'
                  )}>
                    {delta === 0 ? 'Estándar' : delta > 0 ? `+$${(delta / 1000).toFixed(0)}k` : `-$${(Math.abs(delta) / 1000).toFixed(0)}k`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SECCIÓN 2: Opcionales (checkboxes) ── */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Opcionales
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 hover:bg-primary/10 transition-colors">
              <Checkbox
                id="hasHighGloss"
                checked={formData.hasHighGloss}
                onCheckedChange={v => set('hasHighGloss', v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="hasHighGloss" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">Alto Brillo</Label>
                <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">+$350,000</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 hover:bg-primary/10 transition-colors">
              <Checkbox
                id="hasLedLights"
                checked={formData.hasLedLights}
                onCheckedChange={v => set('hasLedLights', v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="hasLedLights" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> Iluminación LED
                </Label>
                <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">+$250,000</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-primary/5 p-4 border border-primary/20 h-16 hover:bg-primary/10 transition-colors">
              <Checkbox
                id="includeTransport"
                checked={formData.includeTransport}
                onCheckedChange={v => set('includeTransport', v as boolean)}
                className="border-primary data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="includeTransport" className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer flex items-center gap-1">
                  <Truck className="w-3 h-3" /> Transporte
                </Label>
                <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">+$150,000</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 3: Repisas y Espacios ── */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
            <Layers className="w-3 h-3" /> Repisas y espacios para equipos
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Repisas flotantes <span className="text-primary/60">(2 incluidas en base)</span>
              </label>
              <Select
                value={String(formData.floatingShelves)}
                onValueChange={v => set('floatingShelves', Number(v))}
              >
                <SelectTrigger className="w-full h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHELF_OPTIONS.map(n => {
                    const shelfLabel = n === 0 ? '0 repisas (−$200,000)'
                      : n === 1 ? '1 repisa (−$100,000)'
                      : n === 2 ? '2 repisas (incluidas)'
                      : `${n} repisas (+$${((n - 2) * 100_000).toLocaleString('es-CO')})`;
                    return (
                      <SelectItem key={n} value={String(n)} label={shelfLabel} className="h-12 font-medium">
                        {shelfLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Espacios para equipos <span className="text-primary/60">(+$150,000 c/u)</span>
              </label>
              <Select
                value={String(formData.equipmentSpaces)}
                onValueChange={v => set('equipmentSpaces', Number(v))}
              >
                <SelectTrigger className="w-full h-14 bg-background border-border/40 text-sm font-bold rounded-none focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_OPTIONS.map(n => {
                    const equipLabel = n === 0 ? 'Sin espacios' : `${n} espacio${n > 1 ? 's' : ''} (+$${(n * 150_000).toLocaleString('es-CO')})`;
                    return (
                      <SelectItem key={n} value={String(n)} label={equipLabel} className="h-12 font-medium">
                        {equipLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── INFO BOX ── */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4 rounded-sm">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Especificaciones de ingeniería
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              {results.specs.includes} {results.specs.material}. {results.specs.base}. {results.specs.finish}. {results.specs.ledDetails}. {results.specs.shelvesDetails}. {results.specs.equipDetails}.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Subtotal Centro de TV</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10 drop-shadow-[0_0_12px_rgba(68,221,193,0.3)]">
            $ {results.total.toLocaleString('es-CO')}
          </span>
          {formData.manualDiscount > 0 && (
            <p className="text-[9px] text-muted-foreground/60 mt-1 relative z-10 uppercase tracking-widest">
              Descuento {formData.manualDiscount}% aplicado
            </p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
