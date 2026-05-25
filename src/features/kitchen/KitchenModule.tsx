/**
 * KitchenModule.tsx
 * Módulo de cocina del QuotationBuilder.
 * Usa el backend como motor de cálculo (useCalculatePrice).
 * Alineado con KitchenConfigSchema v2 — cotizadores/MOTOR_COCINAS.md
 */
import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KitchenConfigSchema } from '@/schemas/quotation.schema';
import { useCalculatePrice } from '@/hooks/useCalculatePrice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Ruler, Box, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KitchenModuleProps {
  onDataChange: (total: number, config: any) => void;
}

const TIPO_COCINA_LABELS: Record<string, string> = {
  COMPLETA_STANDARD: 'Completa standard',
  COMPLETA_PREMIUM:  'Completa premium',
  COMPLETA_DELUXE:   'Completa deluxe',
  SOLO_SUPERIOR:     'Solo superiores',
  SOLO_INFERIOR:     'Solo inferiores',
  FRENTE_POLLO:      'Frente PLL',
};

const FORMA_LABELS: Record<string, string> = {
  L:        'Forma en L',
  U:        'Forma en U',
  LINEAL:   'Lineal',
  PARALELA: 'Paralela',
  ISLA:     'Con isla',
};

const MESON_LABELS: Record<string, string> = {
  SINTERIZADO: 'Sinterizado — $1.200.000/ml',
  CUARZO:      'Cuarzo — $850.000/ml',
  GRANITO:     'Granito — $700.000/ml',
  NINGUNO:     'Sin mesón',
};

// Precio propio de cada módulo (cobrado al cliente) + metros que descuenta del metraje base
const MODULOS_ESPECIALES = [
  { codigo: 'NICHO_NEVECON',      label: 'Nicho Nevecón',      descuento: '−1.0ml',  precio: '$1.200.000' },
  { codigo: 'NICHO_NEVERA',       label: 'Nicho Nevera',       descuento: '−0.75ml', precio: '$1.100.000' },
  { codigo: 'ALACENA_ENTREPAÑOS', label: 'Alacena Entrepaños', descuento: '−0.5ml',  precio: '$1.250.000' },
  { codigo: 'ALACENA_HERRAJE',    label: 'Alacena Herraje',    descuento: '−0.5ml',  precio: '$900.000' },
  { codigo: 'TORRE_HORNOS',       label: 'Torre de Hornos',    descuento: '−0.7ml',  precio: '$1.350.000' },
] as const;

export const KitchenModule: React.FC<KitchenModuleProps> = ({ onDataChange }) => {
  const [metrajeDisplay, setMetrajeDisplay] = React.useState('');
  const [profDisplay, setProfDisplay] = React.useState('60');

  const form = useForm({
    resolver: zodResolver(KitchenConfigSchema),
    defaultValues: {
      tipoCocina:        'COMPLETA_STANDARD' as const,
      forma:             'LINEAL' as const,
      metrajeTotal:      0,
      modulosEspeciales: [] as { codigo: typeof MODULOS_ESPECIALES[number]['codigo']; cantidad: number }[],
      meson: {
        tipo:          'NINGUNO' as const,
        profundidadCm: 60,
      },
      costoTransporte: false,
    }
  });

  const currentConfig = useWatch({ control: form.control });

  // Solo calcular cuando el metraje sea válido (≥ 0.5 ml)
  const canCalculate = (currentConfig?.metrajeTotal ?? 0) >= 0.5;
  const { data: calculation, isLoading } = useCalculatePrice('cocina', currentConfig, canCalculate);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });
  React.useEffect(() => {
    if (!calculation?.success) return;
    const total     = calculation?.data?.calculated_total ?? 0;
    const configStr = JSON.stringify(currentConfig);
    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, currentConfig);
    }
  }, [calculation, currentConfig, onDataChange]);

  const toggleModulo = (codigo: typeof MODULOS_ESPECIALES[number]['codigo']) => {
    const current = form.getValues('modulosEspeciales') ?? [];
    const existe  = current.some(m => m.codigo === codigo);
    form.setValue(
      'modulosEspeciales',
      existe ? current.filter(m => m.codigo !== codigo) : [...current, { codigo, cantidad: 1 }]
    );
  };
  const moduloActivo = (codigo: string) =>
    (currentConfig.modulosEspeciales ?? []).some(m => m.codigo === codigo);

  const profundidad  = currentConfig.meson?.profundidadCm ?? 60;
  const recargoLabel = profundidad > 90 ? 'Recargo ×2' : profundidad > 60 ? 'Recargo +30%' : null;
  const subtotal     = calculation?.data?.calculated_total ?? 0;

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-border/10 py-4 px-6 relative overflow-hidden">
        <div className="flex flex-row justify-between items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ChefHat className="text-primary h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight text-foreground uppercase italic">Cocina Integral</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Motor Backend INNOVAR</CardDescription>
            </div>
          </div>

          {/* Subtotal compacto */}
          <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-sm shrink-0">
            <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest hidden sm:block">Subtotal</span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : canCalculate ? (
              <span className="text-lg font-black font-mono text-primary tracking-tighter">
                $ {subtotal.toLocaleString('es-CO')}
              </span>
            ) : (
              <span className="text-sm font-bold text-muted-foreground/40 italic">Ingresa metraje</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-8">
        <Form {...form}>
          <form className="space-y-8">

            {/* Parámetros principales — bloque unificado */}
            <div className="bg-muted/5 p-6 border border-border/10 space-y-6">

              {/* Fila 1: Tipo · Layout · Metraje */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <FormField control={form.control} name="tipoCocina" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest">Tipo de Cocina *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                          <SelectValue>
                            {(val: string | null) => val
                              ? TIPO_COCINA_LABELS[val] ?? val
                              : <span className="text-muted-foreground/40 font-normal text-sm">Selecciona tipo...</span>
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-sm border-border/20 shadow-xl">
                        <SelectItem value="COMPLETA_STANDARD" className="font-medium">Completa Standard</SelectItem>
                        <SelectItem value="COMPLETA_PREMIUM" className="font-medium">Completa Premium</SelectItem>
                        <SelectItem value="COMPLETA_DELUXE" className="font-medium">Completa Deluxe</SelectItem>
                        <SelectItem value="SOLO_SUPERIOR" className="font-medium">Solo Superiores</SelectItem>
                        <SelectItem value="SOLO_INFERIOR" className="font-medium">Solo Inferiores</SelectItem>
                        <SelectItem value="FRENTE_POLLO" className="font-medium">Frente PLL</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="forma" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest">Layout / Forma *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                          <SelectValue>
                            {(val: string | null) => val
                              ? FORMA_LABELS[val] ?? val
                              : <span className="text-muted-foreground/40 font-normal text-sm">Selecciona layout...</span>
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-sm border-border/20 shadow-xl">
                        <SelectItem value="L" className="font-medium">Forma en L</SelectItem>
                        <SelectItem value="U" className="font-medium">Forma en U</SelectItem>
                        <SelectItem value="LINEAL" className="font-medium">Lineal</SelectItem>
                        <SelectItem value="PARALELA" className="font-medium">Paralela</SelectItem>
                        <SelectItem value="ISLA" className="font-medium">Con Isla</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="metrajeTotal" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest">Metraje Total (ML) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Ej. 3.50"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold pr-16 transition-all"
                          value={metrajeDisplay}
                          onChange={e => {
                            const raw = e.target.value.replace(',', '.');
                            if (/^(\d*\.?\d*)$/.test(raw)) {
                              setMetrajeDisplay(raw);
                              field.onChange(parseFloat(raw) || 0);
                            }
                          }}
                          onBlur={() => {
                            const num = parseFloat(metrajeDisplay) || 0;
                            setMetrajeDisplay(num > 0 ? String(num) : '');
                            field.onChange(num);
                          }}
                        />
                        <span className="absolute right-0 top-0 bottom-0 flex items-center px-3 text-[10px] font-bold text-primary bg-primary/10 border-l border-border/50">ML</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Fila 2: Material Mesón (2/3) · Profundidad (1/3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <FormField control={form.control} name="meson.tipo" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">Material Mesón</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                            <SelectValue>
                              {(val: string | null) => val
                                ? MESON_LABELS[val] ?? val
                                : <span className="text-muted-foreground/40 font-normal text-sm">Selecciona material...</span>
                              }
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-sm border-border/20 shadow-xl">
                          <SelectItem value="SINTERIZADO" className="font-medium">Sinterizado — $1.200.000/ml</SelectItem>
                          <SelectItem value="CUARZO" className="font-medium">Cuarzo — $850.000/ml</SelectItem>
                          <SelectItem value="GRANITO" className="font-medium">Granito — $700.000/ml</SelectItem>
                          <SelectItem value="NINGUNO" className="font-medium">Sin mesón</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="meson.profundidadCm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest">Profundidad (cm)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej. 60"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold pr-16 transition-all"
                          value={profDisplay}
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setProfDisplay(raw);
                            field.onChange(parseInt(raw) || 0);
                          }}
                          onBlur={() => {
                            const num = parseInt(profDisplay) || 60;
                            setProfDisplay(String(num));
                            field.onChange(num);
                          }}
                        />
                        <span className="absolute right-0 top-0 bottom-0 flex items-center px-3 text-[10px] font-bold text-primary bg-primary/10 border-l border-border/50">CM</span>
                      </div>
                    </FormControl>
                    {recargoLabel && (
                      <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/50 text-amber-500 bg-amber-500/10 font-bold">
                        ⚠ {recargoLabel}
                      </Badge>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Módulos Especiales */}
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Módulos Especiales — Con precio propio</h4>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Cada módulo cobra su precio y descuenta los metros que ocupa del metraje base.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MODULOS_ESPECIALES.map(opt => (
                  <div
                    key={opt.codigo}
                    onClick={() => toggleModulo(opt.codigo)}
                    className={cn(
                      "p-4 border rounded-sm cursor-pointer transition-all flex flex-col gap-1",
                      moduloActivo(opt.codigo)
                        ? "bg-primary/20 border-primary"
                        : "bg-muted/5 border-border/10 hover:border-primary/40"
                    )}
                  >
                    <p className="text-xs font-bold uppercase">{opt.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-[10px] font-mono", moduloActivo(opt.codigo) ? "text-amber-400" : "text-muted-foreground/40")}>
                        {opt.descuento}
                      </span>
                      <span className="text-muted-foreground/20 text-[10px]">·</span>
                      <span className={cn("text-[10px] font-bold", moduloActivo(opt.codigo) ? "text-primary" : "text-muted-foreground/40")}>
                        {opt.precio}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </form>
        </Form>
      </CardContent>

    </Card>
  );
};
