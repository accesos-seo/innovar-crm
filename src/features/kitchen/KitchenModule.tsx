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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Ruler, Box, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KitchenModuleProps {
  onDataChange: (total: number, config: any) => void;
}

const MODULOS_ESPECIALES = [
  { codigo: 'NICHO_NEVECON',      label: 'Nicho Nevecón',       descuento: '−1.0ml' },
  { codigo: 'NICHO_NEVERA',       label: 'Nicho Nevera',        descuento: '−0.75ml' },
  { codigo: 'ALACENA_ENTREPAÑOS', label: 'Alacena Entrepaños',  descuento: '−0.5ml' },
  { codigo: 'ALACENA_HERRAJE',    label: 'Alacena Herraje',     descuento: '−0.5ml' },
  { codigo: 'TORRE_HORNOS',       label: 'Torre de Hornos',     descuento: '−0.7ml' },
] as const;

export const KitchenModule: React.FC<KitchenModuleProps> = ({ onDataChange }) => {
  const [metrajeDisplay, setMetrajeDisplay] = React.useState('');
  const [profDisplay, setProfDisplay] = React.useState('60');

  const form = useForm({
    resolver: zodResolver(KitchenConfigSchema),
    defaultValues: {
      tipoCocina:        undefined as any,
      forma:             undefined as any,
      metrajeTotal:      0,
      modulosEspeciales: [] as { codigo: typeof MODULOS_ESPECIALES[number]['codigo']; cantidad: number }[],
      meson: {
        tipo:          undefined as any,
        profundidadCm: 60,
      },
      costoTransporte: false,
    }
  });

  const currentConfig = useWatch({ control: form.control });

  // Motor backend — reemplaza el cálculo local
  const { data: calculation, isLoading } = useCalculatePrice('cocina', currentConfig);

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
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ChefHat className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">Cocina Integral</CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">Motor Backend INNOVAR</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-8">
        <Form {...form}>
          <form className="space-y-8">

            {/* Tipo + Layout + Metraje */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/5 p-6 border border-border/5">

              <FormField control={form.control} name="tipoCocina" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tipo de Cocina</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full bg-background border-border/40 h-14">
                        <SelectValue placeholder="Selecciona tipo de cocina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="COMPLETA_STANDARD" label="Completa Standard">Completa Standard</SelectItem>
                      <SelectItem value="COMPLETA_PREMIUM" label="Completa Premium">Completa Premium</SelectItem>
                      <SelectItem value="COMPLETA_DELUXE" label="Completa Deluxe">Completa Deluxe</SelectItem>
                      <SelectItem value="SOLO_SUPERIOR" label="Solo Superiores">Solo Superiores</SelectItem>
                      <SelectItem value="SOLO_INFERIOR" label="Solo Inferiores">Solo Inferiores</SelectItem>
                      <SelectItem value="FRENTE_POLLO" label="Frente PLL">Frente PLL</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="forma" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Layout / Forma</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full bg-background border-border/40 h-14">
                        <SelectValue placeholder="Selecciona layout / forma" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="L" label="Forma en L">Forma en L</SelectItem>
                      <SelectItem value="U" label="Forma en U">Forma en U</SelectItem>
                      <SelectItem value="LINEAL" label="Lineal">Lineal</SelectItem>
                      <SelectItem value="PARALELA" label="Paralela">Paralela</SelectItem>
                      <SelectItem value="ISLA" label="Con Isla">Con Isla</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="metrajeTotal" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Metraje Total (ML)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-14 bg-background border-border/40 text-xl font-mono font-bold"
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
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary px-2 py-1 bg-primary/10">ML</span>
                    </div>
                  </FormControl>
                </FormItem>
              )} />
            </div>

            {/* Mesón */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="meson.tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Material Mesón</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full bg-background/50 h-12">
                        <SelectValue placeholder="Selecciona material del mesón" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SINTERIZADO" label="Sinterizado">Sinterizado — $1.200.000/ml</SelectItem>
                      <SelectItem value="CUARZO" label="Cuarzo">Cuarzo — $850.000/ml</SelectItem>
                      <SelectItem value="GRANITO" label="Granito">Granito — $700.000/ml</SelectItem>
                      <SelectItem value="NINGUNO" label="Sin mesón">Sin mesón</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="meson.profundidadCm" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Profundidad (cm)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="h-12 bg-background/50 font-mono font-bold pr-14"
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
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary">CM</span>
                    </div>
                  </FormControl>
                  {recargoLabel && (
                    <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/50 text-amber-500 bg-amber-500/10 font-bold">
                      ⚠ {recargoLabel}
                    </Badge>
                  )}
                </FormItem>
              )} />
            </div>

            {/* Módulos Especiales */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Módulos Especiales — Sin cobro adicional</h4>
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
                    <p className={cn("text-[10px] font-mono", moduloActivo(opt.codigo) ? "text-primary" : "text-muted-foreground/40")}>
                      {opt.descuento}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </form>
        </Form>
      </CardContent>

      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex justify-end">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl">
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase">Subtotal Cocina</p>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xl font-bold text-primary/40 animate-pulse">Calculando...</span>
            </div>
          ) : (
            <span className="text-5xl font-black font-mono text-primary tracking-tighter">
              $ {subtotal.toLocaleString('es-CO')}
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
