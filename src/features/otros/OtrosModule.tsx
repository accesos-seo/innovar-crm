import * as React from 'react';
import { Package, Plus, Trash2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { Button } from '@/components/ui/button';
import { OtroLinea, calcularOtros } from './logic';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 1;
function newId() { return `o${Date.now()}-${_idCounter++}`; }

function defaultLinea(): OtroLinea {
  return { id: newId(), descripcion: '', cantidad: 1, precioUnitario: 0 };
}

function fmt(n: number) {
  return n.toLocaleString('es-CO');
}

// ─── Subcomponente: fila de un producto libre ────────────────────────────────

interface OtroRowProps {
  item: OtroLinea;
  subtotal: number;
  index: number;
  canRemove: boolean;
  onChange: (field: keyof OtroLinea, value: any) => void;
  onRemove: () => void;
}

function OtroRow({ item, subtotal, index, canRemove, onChange, onRemove }: OtroRowProps) {
  return (
    <div className="border border-border/20 bg-background/50 p-5 space-y-4">
      {/* Encabezado de la línea */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
          Ítem {index + 1}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-primary">$ {fmt(subtotal)}</span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar ítem"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_180px] gap-4">
        {/* Descripción */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Descripción del producto
          </label>
          <Input
            type="text"
            placeholder="Ej. Desmonte de cocina antigua, instalación especial…"
            value={item.descripcion}
            onChange={(e) => onChange('descripcion', e.target.value)}
            className="h-11 bg-background border-border/40 text-sm font-medium rounded-none"
          />
        </div>

        {/* Cantidad */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Cantidad
          </label>
          <Input
            type="number"
            min={0}
            step={1}
            value={item.cantidad}
            onChange={(e) => onChange('cantidad', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
            className="h-11 bg-background border-border/40 text-sm font-mono font-bold rounded-none"
          />
        </div>

        {/* Precio unitario */}
        <div className="space-y-2">
          <label className="text-[9px] font-black text-primary/70 uppercase tracking-widest">
            Precio unitario
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">$</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={item.precioUnitario}
              onChange={(e) => onChange('precioUnitario', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-11 bg-background border-border/40 text-sm font-mono font-bold pl-7 rounded-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface OtrosModuleProps {
  onDataChange?: (total: number, config: any) => void;
  initialData?: { lineas?: OtroLinea[] } | null;
}

export function OtrosModule({ onDataChange, initialData }: OtrosModuleProps) {
  const [lineas, setLineas] = React.useState<OtroLinea[]>(() =>
    initialData?.lineas && initialData.lineas.length > 0
      ? initialData.lineas.map((l) => ({ ...l }))
      : [defaultLinea()],
  );

  const results = calcularOtros(lineas);

  // Notifica al builder (mismo patrón anti-bucle que MesonesModule)
  const lastUpdateRef = React.useRef({ total: -1, configStr: '' });
  React.useEffect(() => {
    if (!onDataChange) return;
    const total = results.total;
    const config = { lineas };
    const configStr = JSON.stringify(config);
    if (total !== lastUpdateRef.current.total || configStr !== lastUpdateRef.current.configStr) {
      lastUpdateRef.current = { total, configStr };
      onDataChange(total, config);
    }
  }, [lineas]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (id: string, field: keyof OtroLinea, value: any) => {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };
  const addLinea = () => setLineas((prev) => [...prev, defaultLinea()]);
  const removeLinea = (id: string) =>
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  return (
    <Card className="w-full bg-card border-l-4 border-l-primary shadow-2xl overflow-hidden animate-in fade-in duration-500">
      {/* HEADER */}
      <CardHeader className="bg-primary/5 border-b border-border/10 pb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="text-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground uppercase italic">
                Otros
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">
                Trabajos y productos fuera de catálogo — precio manual
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border-0 text-xs font-bold">
            {lineas.length} {lineas.length === 1 ? 'ítem' : 'ítems'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {/* LISTA DE ÍTEMS */}
        <div className="space-y-3">
          {lineas.map((item, index) => {
            const calc = results.lineas.find((l) => l.id === item.id);
            return (
              <OtroRow
                key={item.id}
                item={item}
                subtotal={calc?.subtotal ?? 0}
                index={index}
                canRemove={lineas.length > 1}
                onChange={(field, value) => handleChange(item.id, field, value)}
                onRemove={() => removeLinea(item.id)}
              />
            );
          })}
        </div>

        {/* BOTÓN AGREGAR */}
        <Button
          type="button"
          variant="outline"
          onClick={addLinea}
          className="w-full h-10 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 rounded-none text-xs font-bold uppercase tracking-widest transition-all"
        >
          <Plus className="w-3 h-3 mr-2" />
          Agregar ítem
        </Button>

        <Separator className="bg-border/10" />

        {/* NOTA */}
        <div className="p-4 bg-primary/5 border border-primary/10 flex items-start gap-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tighter">
            Cada ítem se cotiza como Cantidad × Precio unitario. Útil para anexar trabajos que no
            encajan en los demás módulos. Las líneas vacías o sin precio se ignoran al guardar.
          </p>
        </div>
      </CardContent>

      {/* FOOTER — TOTAL */}
      <CardFooter className="bg-primary/5 border-t border-border/10 p-8 flex flex-col items-end gap-4">
        <div className="bg-primary-surface p-6 rounded-sm border-2 border-primary/30 min-w-[320px] flex flex-col items-end shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
          <p className="text-[11px] font-black text-primary/80 tracking-[0.2em] mb-2 uppercase relative z-10">
            Total Otros
          </p>
          <span className="text-5xl font-black font-mono text-primary tracking-tighter relative z-10">
            $ {fmt(results.total)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
