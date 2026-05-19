import * as React from 'react';
import {
  DoorOpen,
  Plus,
  Trash2,
  Info,
  Truck,
  Percent,
  FileText,
  Sparkles,
  Eye,
  MapPin,
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
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DoorItem,
  DoorType,
  HardwareColor,
  DoorsInput,
  DOOR_PRICES,
  HARDWARE_COLORS,
  DOORS_DEFAULTS,
  getWidthRange,
} from './logic';
import { useDoorsCalculator } from '@/hooks/use-doors-calculator';
import { DoorsTemplate } from '@/components/pdf/templates/DoorsTemplate';
import { formatDate } from '@/lib/format-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 1;
function newId() { return `d${Date.now()}-${_idCounter++}`; }

function defaultDoor(): DoorItem {
  return {
    id: newId(),
    type: 'batiente',
    width: DOORS_DEFAULTS.defaultWidth,
    height: DOORS_DEFAULTS.defaultHeight,
    quantity: 1,
    hardwareColor: 'aluminio',
    hasLintel: true,
    location: '',
    notes: '',
  };
}

const TYPE_LABELS: Record<DoorType, string> = {
  batiente:  'Batiente',
  corrediza: 'Corrediza',
};

const fmt = (n: number) => n.toLocaleString('es-CO');

// ─── Subcomponente: fila por puerta ──────────────────────────────────────────

interface DoorRowProps {
  item: DoorItem;
  calc: { pricePerUnit: number; widthRange: string; lineTotal: number };
  onChange: (field: keyof DoorItem, value: any) => void;
  onRemove: () => void;
  index: number;
}

function DoorRow({ item, calc, onChange, onRemove, index }: DoorRowProps) {
  const handleWidthBlur = () => {
    if (item.width < DOORS_DEFAULTS.minWidth) onChange('width', DOORS_DEFAULTS.minWidth);
    else if (item.width > DOORS_DEFAULTS.maxWidth) onChange('width', DOORS_DEFAULTS.maxWidth);
  };
  const handleHeightBlur = () => {
    if (item.height < DOORS_DEFAULTS.minHeight) onChange('height', DOORS_DEFAULTS.minHeight);
    else if (item.height > DOORS_DEFAULTS.maxHeight) onChange('height', DOORS_DEFAULTS.maxHeight);
  };
  const handleQtyBlur = () => {
    if (item.quantity < DOORS_DEFAULTS.minQuantity) onChange('quantity', DOORS_DEFAULTS.minQuantity);
    else if (item.quantity > DOORS_DEFAULTS.maxQuantity) onChange('quantity', DOORS_DEFAULTS.maxQuantity);
  };

  return (
    <div className="border border-border/20 bg-background/50 p-5 space-y-4">
      {/* Header del ítem */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            Puerta {index + 1}
          </span>
          <Badge className="text-[9px] py-0 bg-primary/10 text-primary border-0">
            Rango {calc.widthRange}cm · ${fmt(calc.pricePerUnit)}/ud
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-bold text-primary">
            $ {fmt(calc.lineTotal)}
          </span>
          {index > 0 && (
            <button
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar puerta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Fila 1: Tipo · Ancho · Alto · Cantidad */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Tipo */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">Tipo</label>
          <Select value={item.type} onValueChange={(v) => onChange('type', v as DoorType)}>
            <SelectTrigger className="h-11 bg-background border-border/40 text-xs font-bold rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as DoorType[]).map(t => (
                <SelectItem key={t} value={t} className="text-xs font-bold">
                  {TYPE_LABELS[t]}
                  <span className="ml-1 font-normal opacity-60 text-[10px]">
                    ${fmt(DOOR_PRICES[t]['50-85'])}–${fmt(DOOR_PRICES[t]['85-110'])}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ancho */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Ancho (cm)
            <Badge className="ml-1 text-[8px] py-0 bg-primary/20 text-primary border-0">
              {getWidthRange(item.width)}
            </Badge>
          </label>
          <Input
            type="number"
            min={DOORS_DEFAULTS.minWidth}
            max={DOORS_DEFAULTS.maxWidth}
            step={1}
            value={item.width}
            onChange={(e) => onChange('width', parseInt(e.target.value) || DOORS_DEFAULTS.minWidth)}
            onBlur={handleWidthBlur}
            className="h-11 bg-background border-border/40 text-sm font-mono font-bold rounded-none"
          />
        </div>

        {/* Alto */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Alto (m)
          </label>
          <Input
            type="number"
            min={DOORS_DEFAULTS.minHeight}
            max={DOORS_DEFAULTS.maxHeight}
            step={0.05}
            value={item.height}
            onChange={(e) => onChange('height', parseFloat(e.target.value) || DOORS_DEFAULTS.minHeight)}
            onBlur={handleHeightBlur}
            className="h-11 bg-background border-border/40 text-sm font-mono font-bold rounded-none"
          />
        </div>

        {/* Cantidad */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">Cantidad</label>
          <Input
            type="number"
            min={DOORS_DEFAULTS.minQuantity}
            max={DOORS_DEFAULTS.maxQuantity}
            step={1}
            value={item.quantity}
            onChange={(e) => onChange('quantity', parseInt(e.target.value) || 1)}
            onBlur={handleQtyBlur}
            className="h-11 bg-background border-border/40 text-sm font-mono font-bold rounded-none"
          />
        </div>
      </div>

      {/* Fila 2: Color herrajes · Dintel · Ubicación */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4 items-end">
        {/* Color herrajes */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">Color Herrajes</label>
          <Select value={item.hardwareColor} onValueChange={(v) => onChange('hardwareColor', v as HardwareColor)}>
            <SelectTrigger className="h-11 bg-background border-border/40 text-xs font-bold rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HARDWARE_COLORS.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs font-bold">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dintel */}
        <div className="flex items-center gap-3 h-11 px-4 bg-primary/5 border border-primary/10">
          <Switch
            id={`lintel-${item.id}`}
            checked={item.hasLintel}
            onCheckedChange={(v) => onChange('hasLintel', v)}
          />
          <label htmlFor={`lintel-${item.id}`} className="text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer">
            Incluye Dintel
          </label>
        </div>

        {/* Ubicación */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Ubicación
          </label>
          <Input
            type="text"
            placeholder="Ej: Baño principal, Cocina, Closet..."
            value={item.location ?? ''}
            onChange={(e) => onChange('location', e.target.value)}
            className="h-11 bg-background border-border/40 text-xs font-medium rounded-none"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface DoorsModuleProps {
  onDataChange: (total: number, config: any) => void;
  initialData?: any;
}

export const DoorsModule: React.FC<DoorsModuleProps> = ({ onDataChange, initialData }) => {
  // Soporta initialData con la nueva forma (doors array) o vacía
  const initialDoors: DoorItem[] = React.useMemo(() => {
    if (initialData?.doors && Array.isArray(initialData.doors) && initialData.doors.length > 0) {
      return initialData.doors;
    }
    return [defaultDoor()];
  }, []);

  const [doors, setDoors] = React.useState<DoorItem[]>(initialDoors);
  const [includeTransport, setIncludeTransport] = React.useState<boolean>(initialData?.includeTransport ?? false);
  const [discountPercent, setDiscountPercent] = React.useState<number>(initialData?.discountPercent ?? 0);
  const [notes, setNotes] = React.useState<string>(initialData?.notes ?? '');

  const input: DoorsInput = {
    doors,
    transport: includeTransport ? DOORS_DEFAULTS.transport : 0,
    discountPercent,
    notes,
  };

  const results = useDoorsCalculator(input);

  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });
  React.useEffect(() => {
    const total = results.total;
    const config = { ...input, ...results, includeTransport };
    const configStr = JSON.stringify(config);
    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, config);
    }
  }, [results, doors, includeTransport, discountPercent, notes]);

  const handleDoorChange = (id: string, field: keyof DoorItem, value: any) => {
    setDoors(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addDoor = () => setDoors(prev => [...prev, defaultDoor()]);
  const removeDoor = (id: string) => setDoors(prev => prev.filter(d => d.id !== id));

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      {/* HEADER */}
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DoorOpen className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">
                Puertas Independientes
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">
                Batiente · Corrediza — Cotización por Unidad
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-primary/10 text-primary border-0 text-xs font-bold">
              {results.totalUnits} {results.totalUnits === 1 ? 'unidad' : 'unidades'}
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all">
                  <Eye className="w-3 h-3 mr-2" /> Ficha Técnica
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[850px] p-0 border-none bg-transparent shadow-2xl">
                <div className="scale-75 origin-top-center overflow-auto max-h-[90vh]">
                  <DoorsTemplate
                    data={{
                      client_name: "Previsualización Técnica",
                      total_amount: results.total,
                      configuration: { ...input, ...results, includeTransport },
                      date: formatDate(new Date()),
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {/* LISTA DE PUERTAS */}
        <div className="space-y-3">
          {doors.map((item, index) => {
            const calc = results.items.find(c => c.id === item.id) ?? {
              pricePerUnit: 0, widthRange: '50-85', lineTotal: 0,
            };
            return (
              <DoorRow
                key={item.id}
                item={item}
                calc={calc}
                index={index}
                onChange={(field, value) => handleDoorChange(item.id, field, value)}
                onRemove={() => removeDoor(item.id)}
              />
            );
          })}
        </div>

        {/* BOTÓN AGREGAR */}
        <Button
          variant="outline"
          onClick={addDoor}
          className="w-full h-10 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 rounded-none text-xs font-bold uppercase tracking-widest transition-all"
        >
          <Plus className="w-3 h-3 mr-2" />
          Agregar puerta
        </Button>

        <Separator className="bg-border/10" />

        {/* PARÁMETROS ECONÓMICOS */}
        <div className="p-6 bg-muted/5 border border-border/5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
              <Truck className="w-3 h-3" /> Transporte e Imprevistos
            </label>
            <div className="flex items-center gap-4">
              <Switch
                id="transport-toggle-doors"
                checked={includeTransport}
                onCheckedChange={setIncludeTransport}
              />
              <label htmlFor="transport-toggle-doors" className="text-sm font-mono font-bold text-muted-foreground cursor-pointer">
                {includeTransport
                  ? <span className="text-primary">+${fmt(DOORS_DEFAULTS.transport)}</span>
                  : <span className="opacity-50">${fmt(DOORS_DEFAULTS.transport)}</span>
                }
              </label>
            </div>
          </div>

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
            <FileText className="w-4 h-4" /> Observaciones generales
          </label>
          <Textarea
            placeholder="Ej: Acabado natural, sin pintura. Instalación coordinada con obra..."
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
              <Sparkles className="w-3 h-3" /> Tabla de precios oficial
            </p>
            <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
              Batiente 50–85cm: ${fmt(DOOR_PRICES.batiente['50-85'])} · 85–110cm: ${fmt(DOOR_PRICES.batiente['85-110'])} &nbsp;·&nbsp;
              Corrediza 50–85cm: ${fmt(DOOR_PRICES.corrediza['50-85'])} · 85–110cm: ${fmt(DOOR_PRICES.corrediza['85-110'])} &nbsp;·&nbsp;
              Color herrajes y dintel sin recargo &nbsp;·&nbsp; Marco, bisagras/rieles y chapa estándar incluidos
            </p>
          </div>
        </div>
      </CardContent>

      {/* FOOTER */}
      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex flex-col items-end gap-4">
        {results.subtotalProductos > 0 && (
          <div className="w-full space-y-2 text-right">
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>Subtotal puertas ({results.totalUnits} ud)</span>
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

        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">Total Puertas</p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
            $ {fmt(results.total)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};
