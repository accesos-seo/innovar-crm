import * as React from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Info,
  Truck,
  Percent,
  FileText,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  MesonItem,
  MesonTipo,
  MesonMaterial,
  BarraLateralAltura,
  MesonesInput,
  BASE_PRICES,
  BARRA_LATERAL_HEIGHTS,
  MESONES_DEFAULTS,
  LAVAPLATOS_COST,
  ISLA_LATERALES_ML,
  ISLA_REGRUESO_ML,
} from './logic';
import { useMesonesCalculator } from '@/hooks/use-mesones-calculator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 1;
function newId() { return `m${Date.now()}-${_idCounter++}`; }

function defaultItem(): MesonItem {
  return {
    id: newId(),
    tipo: 'meson',
    material: 'granito',
    metrosLineales: 1.5,
    fondo: 60,
    incluyeSalpicaderoAlto: false,
    incluyeLaterales: false,
    incluyeRegrueso: false,
    alturaLateral: 0,
  };
}

const TIPO_LABELS: Record<MesonTipo, string> = {
  meson: 'Mesón Estándar',
  isla:  'Isla',
  barra: 'Barra',
};

const MATERIAL_LABELS: Record<MesonMaterial, string> = {
  granito:     'Granito',
  cuarzo:      'Cuarzo',
  sinterizado: 'Sinterizado',
};

function fmt(n: number) {
  return n.toLocaleString('es-CO');
}

// ─── Subcomponente: fila de un mesón ────────────────────────────────────────

interface MesonRowProps {
  item: MesonItem;
  calc: { subtotalMeson: number; subtotalLavaplatos: number; subtotalLaterales: number; subtotalRegrueso: number; subtotalSalpicaderoAlto: number; subtotal: number; multiplicador: number };
  onChange: (field: keyof MesonItem, value: any) => void;
  onRemove: () => void;
  index: number;
}

function MesonRow({ item, calc, onChange, onRemove, index }: MesonRowProps) {
  const isAngosta = item.tipo === 'barra' && item.fondo >= 35 && item.fondo <= 45;
  const precioBase = BASE_PRICES[item.material][isAngosta ? 'barraAngosta' : 'standard'];

  const handleFondoBlur = () => {
    const min = item.tipo === 'barra' ? MESONES_DEFAULTS.minFondo : 55;
    const v = item.fondo;
    if (v < min) onChange('fondo', min);
    else if (v > MESONES_DEFAULTS.maxFondo) onChange('fondo', MESONES_DEFAULTS.maxFondo);
  };

  const handleMLBlur = () => {
    if (item.metrosLineales < MESONES_DEFAULTS.minML) onChange('metrosLineales', MESONES_DEFAULTS.minML);
    else if (item.metrosLineales > MESONES_DEFAULTS.maxML) onChange('metrosLineales', MESONES_DEFAULTS.maxML);
  };

  const handleTipoChange = (tipo: MesonTipo) => {
    // Resetear opciones incompatibles al cambiar tipo
    onChange('tipo', tipo);
    onChange('incluyeSalpicaderoAlto', false);
    onChange('incluyeLaterales', false);
    onChange('incluyeRegrueso', false);
    onChange('alturaLateral', 0);
    // Ajustar fondo mínimo
    if (tipo !== 'barra' && item.fondo < 55) onChange('fondo', 55);
  };

  return (
    <div className="border border-border/20 bg-background/50 p-5 space-y-4">
      {/* Encabezado del ítem */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
          Mesón {index + 1}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-primary">
            $ {fmt(calc.subtotal)}
          </span>
          {index > 0 && (
            <button
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar mesón"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Fila 1: Tipo · Material · ML · Fondo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Tipo */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">Tipo</label>
          <Select value={item.tipo} onValueChange={(v) => handleTipoChange(v as MesonTipo)}>
            <SelectTrigger className="h-11 bg-background border-border/40 text-xs font-bold rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_LABELS) as MesonTipo[]).map(t => (
                <SelectItem key={t} value={t} className="text-xs font-bold">{TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Material */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Material
            <span className="ml-1 font-normal opacity-60 normal-case">
              ${fmt(precioBase)}/ML
            </span>
          </label>
          <Select value={item.material} onValueChange={(v) => onChange('material', v as MesonMaterial)}>
            <SelectTrigger className="h-11 bg-background border-border/40 text-xs font-bold rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MATERIAL_LABELS) as MesonMaterial[]).map(m => (
                <SelectItem key={m} value={m} className="text-xs font-bold">
                  {MATERIAL_LABELS[m]}
                  <span className="ml-1 font-normal opacity-60 text-[10px]">
                    ${fmt(BASE_PRICES[m].standard)}/ML
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metros lineales */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Metraje (ML)
          </label>
          <div className="relative">
            <Input
              type="number"
              min={MESONES_DEFAULTS.minML}
              max={MESONES_DEFAULTS.maxML}
              step={0.1}
              value={item.metrosLineales}
              onChange={(e) => onChange('metrosLineales', parseFloat(e.target.value) || MESONES_DEFAULTS.minML)}
              onBlur={handleMLBlur}
              className="h-11 bg-background border-border/40 text-sm font-mono font-bold pr-10 rounded-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">ML</span>
          </div>
        </div>

        {/* Profundidad / Fondo */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Fondo (cm)
            {calc.multiplicador > 1 && (
              <Badge className="ml-1 text-[8px] py-0 bg-amber-500/20 text-amber-400 border-0">
                ×{calc.multiplicador}
              </Badge>
            )}
            {isAngosta && (
              <Badge className="ml-1 text-[8px] py-0 bg-primary/20 text-primary border-0">
                Angosta
              </Badge>
            )}
          </label>
          <Input
            type="number"
            min={item.tipo === 'barra' ? MESONES_DEFAULTS.minFondo : 55}
            max={MESONES_DEFAULTS.maxFondo}
            step={1}
            value={item.fondo}
            onChange={(e) => onChange('fondo', parseInt(e.target.value) || 55)}
            onBlur={handleFondoBlur}
            className="h-11 bg-background border-border/40 text-sm font-mono font-bold rounded-none"
          />
        </div>
      </div>

      {/* Fila 2: Opciones condicionales según tipo */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
        {/* MESÓN ESTÁNDAR: Lavaplatos (siempre) + Salpicadero alto (opcional) */}
        {item.tipo === 'meson' && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary/40" />
              <span className="text-[10px] text-muted-foreground font-medium">
                Lavaplatos incluido <span className="font-bold text-foreground">${fmt(LAVAPLATOS_COST)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`salp-${item.id}`}
                checked={item.incluyeSalpicaderoAlto ?? false}
                onCheckedChange={(v) => onChange('incluyeSalpicaderoAlto', v)}
              />
              <label htmlFor={`salp-${item.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide cursor-pointer">
                Salpicadero Alto
                {item.incluyeSalpicaderoAlto && calc.subtotalSalpicaderoAlto > 0 && (
                  <span className="ml-1 text-primary">+${fmt(calc.subtotalSalpicaderoAlto)}</span>
                )}
              </label>
            </div>
          </>
        )}

        {/* ISLA: Laterales + Regrueso */}
        {item.tipo === 'isla' && (
          <>
            <div className="flex items-center gap-2">
              <Switch
                id={`lat-${item.id}`}
                checked={item.incluyeLaterales ?? false}
                onCheckedChange={(v) => onChange('incluyeLaterales', v)}
              />
              <label htmlFor={`lat-${item.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide cursor-pointer">
                Laterales ({ISLA_LATERALES_ML}ml)
                {item.incluyeLaterales && calc.subtotalLaterales > 0 && (
                  <span className="ml-1 text-primary">+${fmt(calc.subtotalLaterales)}</span>
                )}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`reg-${item.id}`}
                checked={item.incluyeRegrueso ?? false}
                onCheckedChange={(v) => onChange('incluyeRegrueso', v)}
              />
              <label htmlFor={`reg-${item.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide cursor-pointer">
                Regrueso ({ISLA_REGRUESO_ML}ml)
                {item.incluyeRegrueso && calc.subtotalRegrueso > 0 && (
                  <span className="ml-1 text-primary">+${fmt(calc.subtotalRegrueso)}</span>
                )}
              </label>
            </div>
          </>
        )}

        {/* BARRA: Altura lateral + Salpicadero alto */}
        {item.tipo === 'barra' && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">
                Lateral
              </label>
              <Select
                value={String(item.alturaLateral ?? 0)}
                onValueChange={(v) => onChange('alturaLateral', parseInt(v) as BarraLateralAltura)}
              >
                <SelectTrigger className="h-8 w-32 bg-background border-border/40 text-xs font-bold rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BARRA_LATERAL_HEIGHTS.map(h => (
                    <SelectItem key={h} value={String(h)} className="text-xs font-bold">
                      {h === 0 ? 'Sin lateral' : `${h}cm`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(item.alturaLateral ?? 0) > 0 && calc.subtotalLaterales > 0 && (
                <span className="text-[10px] text-primary font-bold">+${fmt(calc.subtotalLaterales)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`salp-b-${item.id}`}
                checked={item.incluyeSalpicaderoAlto ?? false}
                onCheckedChange={(v) => onChange('incluyeSalpicaderoAlto', v)}
              />
              <label htmlFor={`salp-b-${item.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide cursor-pointer">
                Salpicadero Alto
                {item.incluyeSalpicaderoAlto && calc.subtotalSalpicaderoAlto > 0 && (
                  <span className="ml-1 text-primary">+${fmt(calc.subtotalSalpicaderoAlto)}</span>
                )}
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface MesonesModuleProps {
  onDataChange?: (total: number, config: any) => void;
}

export function MesonesModule({ onDataChange }: MesonesModuleProps) {
  const [mesones, setMesones] = React.useState<MesonItem[]>([defaultItem()]);
  const [includeTransport, setIncludeTransport] = React.useState(false);
  const [discountPercent, setDiscountPercent] = React.useState(0);
  const [notes, setNotes] = React.useState('');

  const input: MesonesInput = {
    mesones,
    transport: includeTransport ? MESONES_DEFAULTS.transport : 0,
    discountPercent,
    notes,
  };

  const results = useMesonesCalculator(input);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });
  React.useEffect(() => {
    if (!onDataChange) return;
    const total = results.total;
    const config = { ...input, ...results };
    const configStr = JSON.stringify(config);
    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, config);
    }
  }, [results, mesones, includeTransport, discountPercent, notes]);

  // Actualiza un campo de un ítem específico
  const handleItemChange = (id: string, field: keyof MesonItem, value: any) => {
    setMesones(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const addItem = () => setMesones(prev => [...prev, defaultItem()]);
  const removeItem = (id: string) => setMesones(prev => prev.filter(i => i.id !== id));

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      {/* HEADER */}
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">
                Mesones
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">
                Granito · Cuarzo · Sinterizado — Cotización por Metro Lineal
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border-0 text-xs font-bold">
            {mesones.length} {mesones.length === 1 ? 'superficie' : 'superficies'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {/* LISTA DE MESONES */}
        <div className="space-y-3">
          {mesones.map((item, index) => {
            const calc = results.items.find(c => c.id === item.id) ?? {
              subtotalMeson: 0, subtotalLavaplatos: 0, subtotalLaterales: 0,
              subtotalRegrueso: 0, subtotalSalpicaderoAlto: 0, subtotal: 0, multiplicador: 1,
            };
            return (
              <MesonRow
                key={item.id}
                item={item}
                calc={calc}
                index={index}
                onChange={(field, value) => handleItemChange(item.id, field, value)}
                onRemove={() => removeItem(item.id)}
              />
            );
          })}
        </div>

        {/* BOTÓN AGREGAR */}
        <Button
          variant="outline"
          onClick={addItem}
          className="w-full h-10 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 rounded-none text-xs font-bold uppercase tracking-widest transition-all"
        >
          <Plus className="w-3 h-3 mr-2" />
          Agregar superficie
        </Button>

        <Separator className="bg-border/10" />

        {/* PARÁMETROS ECONÓMICOS */}
        <div className="p-6 bg-muted/5 border border-border/5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transporte */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
              <Truck className="w-3 h-3" /> Transporte e Imprevistos
            </label>
            <div className="flex items-center gap-4">
              <Switch
                id="transport-toggle"
                checked={includeTransport}
                onCheckedChange={setIncludeTransport}
              />
              <label htmlFor="transport-toggle" className="text-sm font-mono font-bold text-muted-foreground cursor-pointer">
                {includeTransport
                  ? <span className="text-primary">+${fmt(MESONES_DEFAULTS.transport)}</span>
                  : <span className="opacity-50">${fmt(MESONES_DEFAULTS.transport)}</span>
                }
              </label>
            </div>
          </div>

          {/* Descuento */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
              <Percent className="w-3 h-3" /> Descuento Manual
            </label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                className="h-12 bg-background/50 border-border/20 pr-10 font-mono font-bold text-sm rounded-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-primary font-bold">%</span>
            </div>
          </div>
        </div>

        {/* OBSERVACIONES */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-4 h-4" /> Observaciones
          </label>
          <Textarea
            placeholder="Ej: Acabado pulido, bordes biselados, instalación en 2 etapas..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px] bg-background border-border/40 font-medium rounded-none resize-none focus:ring-primary"
          />
        </div>

        {/* NOTA TÉCNICA */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Multiplicadores de Profundidad
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              55–65cm → ×1.0 &nbsp;·&nbsp; 66–90cm → ×1.3 (+30%) &nbsp;·&nbsp; 91–120cm → ×2.0 &nbsp;·&nbsp;
              Barra 35–45cm → precio angosta sin recargo &nbsp;·&nbsp; Regrueso isla siempre a ×1.0
            </p>
          </div>
        </div>
      </CardContent>

      {/* FOOTER — RESUMEN */}
      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex flex-col items-end gap-4">
        {/* Desglose */}
        {(results.subtotalProductos > 0) && (
          <div className="w-full space-y-2 text-right">
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>Subtotal superficies</span>
              <span>${fmt(results.subtotalProductos)}</span>
            </div>
            {results.transport > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>Transporte</span>
                <span>+${fmt(results.transport)}</span>
              </div>
            )}
            {results.discountAmount > 0 && (
              <div className="flex justify-between text-xs text-amber-400 font-mono">
                <span>Descuento ({discountPercent}%)</span>
                <span>−${fmt(results.discountAmount)}</span>
              </div>
            )}
            <Separator className="bg-border/20 my-1" />
          </div>
        )}

        {/* Total */}
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">
            Total Mesones
          </p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
            $ {fmt(results.total)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
