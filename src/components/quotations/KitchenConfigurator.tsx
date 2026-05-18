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
import { Loader2, ChefHat, Ruler, Box, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KitchenConfiguratorProps {
  onDataChange: (total: number, config: any) => void;
}

// Módulos disponibles con sus descuentos reales (según MOTOR_COCINAS.md)
const MODULOS_ESPECIALES = [
  { codigo: 'NICHO_NEVECON',      label: 'Nicho Nevecón',        descuento: '−1.0ml' },
  { codigo: 'NICHO_NEVERA',       label: 'Nicho Nevera',         descuento: '−0.75ml' },
  { codigo: 'ALACENA_ENTREPAÑOS', label: 'Alacena Entrepaños',   descuento: '−0.5ml' },
  { codigo: 'ALACENA_HERRAJE',    label: 'Alacena con Herraje',  descuento: '−0.5ml' },
  { codigo: 'TORRE_HORNOS',       label: 'Torre de Hornos',      descuento: '−0.7ml' },
] as const;

export const KitchenConfigurator: React.FC<KitchenConfiguratorProps> = ({ onDataChange }) => {

  const form = useForm({
    resolver: zodResolver(KitchenConfigSchema),
    defaultValues: {
      tipoCocina:        'COMPLETA_STANDARD' as const,
      forma:             'L' as const,
      metrajeTotal:      0,
      modulosEspeciales: [] as { codigo: typeof MODULOS_ESPECIALES[number]['codigo']; cantidad: number }[],
      meson: {
        tipo:          'CUARZO' as const,
        profundidadCm: 60,
      },
      costoTransporte: false,
    }
  });

  const currentConfig = useWatch({ control: form.control });

  // Llama al backend — el engine es el que calcula
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

  // ── Helpers de toggle para módulos ──────────────────────
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

  // ── Indicador de recargo de profundidad ──────────────────
  const profundidad   = currentConfig.meson?.profundidadCm ?? 60;
  const recargoLabel  = profundidad > 90 ? 'Recargo ×2 (Doble)' : profundidad > 60 ? 'Recargo +30%' : null;

  const subtotalDisplay = calculation?.data?.calculated_total;

  return (
    <Card className="w-full bg-[#1C1B1B] border-l-4 border-l-primary shadow-2xl overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" aria-hidden="true" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ChefHat className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                Configuración de Cocina
              </CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground/80 tracking-normal mt-0.5">
                Motor de cálculo INNOVAR — Precios desde servidor
              </CardDescription>
            </div>
          </div>

          {/* Subtotal calculado por el backend */}
          <div className="bg-[#1e3a35] p-5 rounded-sm border-2 border-primary/30 min-w-[280px] flex flex-col items-end shadow-[0_0_30px_rgba(68,221,193,0.15)]">
            <p className="text-[11px] font-bold text-primary/80 tracking-wider mb-2">Presupuesto proyectado</p>
            <div className="flex items-center gap-4">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xl font-bold text-primary/40 tracking-widest animate-pulse">Calculando...</span>
                </div>
              ) : (
                <span className="text-5xl font-black font-mono text-primary tracking-tighter drop-shadow-[0_0_12px_rgba(68,221,193,0.5)]">
                  $ {subtotalDisplay !== undefined ? subtotalDisplay.toLocaleString('es-CO') : '0'}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-8 space-y-8">
        <Form {...form}>
          <form className="space-y-8">

            {/* ── SECCIÓN 1: Tipo y Medidas ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4 px-2">
                <Ruler className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground/90">Tipo de cocina y dimensiones</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 rounded-sm bg-muted/10 border border-border/5">

                {/* Tipo de Cocina (Standard / Premium / Deluxe / etc.) */}
                <FormField control={form.control} name="tipoCocina" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-muted-foreground/80 mb-3 block">Tipo de cocina</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border/40 h-16 focus:ring-primary text-base font-semibold px-4 shadow-inner">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1C1B1B] border-border/20">
                        <SelectItem value="COMPLETA_STANDARD" className="h-12 px-4 font-medium text-sm">Cocina Completa Standard</SelectItem>
                        <SelectItem value="COMPLETA_PREMIUM"  className="h-12 px-4 font-medium text-sm">Cocina Completa Premium</SelectItem>
                        <SelectItem value="COMPLETA_DELUXE"   className="h-12 px-4 font-medium text-sm">Cocina Completa Deluxe</SelectItem>
                        <SelectItem value="SOLO_SUPERIOR"     className="h-12 px-4 font-medium text-sm">Solo Muebles Superiores</SelectItem>
                        <SelectItem value="SOLO_INFERIOR"     className="h-12 px-4 font-medium text-sm">Solo Muebles Inferiores</SelectItem>
                        <SelectItem value="FRENTE_POLLO"      className="h-12 px-4 font-medium text-sm">Frente PLL (Pollo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Forma / Layout */}
                <FormField control={form.control} name="forma" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-muted-foreground/80 mb-3 block">Forma del layout</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-border/40 h-16 focus:ring-primary text-base font-semibold px-4 shadow-inner">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1C1B1B] border-border/20">
                        <SelectItem value="L"        className="h-12 px-4 font-medium text-sm">Forma en L</SelectItem>
                        <SelectItem value="U"        className="h-12 px-4 font-medium text-sm">Forma en U</SelectItem>
                        <SelectItem value="LINEAL"   className="h-12 px-4 font-medium text-sm">Lineal recta</SelectItem>
                        <SelectItem value="PARALELA" className="h-12 px-4 font-medium text-sm">Paralela</SelectItem>
                        <SelectItem value="ISLA"     className="h-12 px-4 font-medium text-sm">Con Isla</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Metraje Total */}
                <FormField control={form.control} name="metrajeTotal" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-muted-foreground/80 mb-3 block">Metraje lineal total (ML)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="bg-background border-border/40 h-16 pr-16 text-xl font-mono font-bold"
                          value={field.value || ''}
                          onChange={e => {
                            const val = e.target.value.replace(',', '.');
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              field.onChange(val === '' ? 0 : parseFloat(val) || 0);
                            }
                          }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary p-2 bg-primary/10 rounded-sm">M.L</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* ── SECCIÓN 2: Mesón ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4 px-2">
                <Box className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground/90">Mesón / Countertop</h4>
              </div>

              <div className="p-8 rounded-sm bg-muted/20 border border-border/10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                  {/* Material del Mesón */}
                  <FormField control={form.control} name="meson.tipo" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-muted-foreground/80 mb-3 block">Material de superficie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-border/40 h-16 focus:ring-primary text-base font-semibold px-4 shadow-inner">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-[#1C1B1B] border-border/20">
                          <SelectItem value="SINTERIZADO" className="h-12 px-4 font-medium text-sm">Sinterizado — $1.200.000/ml</SelectItem>
                          <SelectItem value="CUARZO"      className="h-12 px-4 font-medium text-sm">Cuarzo / Quarzone — $850.000/ml</SelectItem>
                          <SelectItem value="GRANITO"     className="h-12 px-4 font-medium text-sm">Granito — $700.000/ml</SelectItem>
                          <SelectItem value="NINGUNO"     className="h-12 px-4 font-medium text-sm">Sin mesón</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {/* Profundidad */}
                  <FormField control={form.control} name="meson.profundidadCm" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-muted-foreground/80 mb-3 block">
                        Profundidad (cm)
                        <span className="ml-2 text-muted-foreground/50 font-normal">≤60 sin recargo · 61-90 +30% · 91-120 ×2</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="bg-background border-border/40 h-16 pr-16 text-xl font-mono font-bold"
                            value={field.value || ''}
                            onChange={e => field.onChange(parseInt(e.target.value.replace(/\D/g, '')) || 60)}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary p-2 bg-primary/10 rounded-sm">CM</span>
                        </div>
                      </FormControl>
                      {recargoLabel && (
                        <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/50 text-amber-500 bg-amber-500/10 font-bold px-3 py-1">
                          ⚠ {recargoLabel}
                        </Badge>
                      )}
                    </FormItem>
                  )} />
                </div>
              </div>
            </div>

            {/* ── SECCIÓN 3: Módulos Especiales ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4 px-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground/90">Módulos especiales (descuentan metraje — sin cobro adicional)</h4>
              </div>

              <div className="p-8 rounded-sm bg-muted/10 border border-border/5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MODULOS_ESPECIALES.map(opt => (
                    <div
                      key={opt.codigo}
                      onClick={() => toggleModulo(opt.codigo)}
                      className={cn(
                        "flex flex-col gap-1 p-4 rounded-md border cursor-pointer transition-all",
                        moduloActivo(opt.codigo)
                          ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(68,221,193,0.1)]"
                          : "bg-background/40 border-border/10 hover:border-primary/30"
                      )}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className={cn(
                        "text-[10px] font-mono",
                        moduloActivo(opt.codigo) ? "text-primary" : "text-muted-foreground/40"
                      )}>{opt.descuento}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Nota del motor ── */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-sm flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-primary font-medium leading-relaxed tracking-wider">
                Motor de precios activo (servidor): metraje resultante, recargos de profundidad y reglas de negocio se aplican automáticamente según las reglas oficiales INNOVAR.
              </p>
            </div>

          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
