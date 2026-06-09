import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Image as ImageIcon,
  Layers,
  Tag,
  DollarSign,
  Grid,
  Layout,
  Palette,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { FullscreenDetail } from "@/components/shared/FullscreenDetail";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { InlineEditField } from "@/components/shared/DetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";

const materialSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  category: z.enum(['cocinas', 'closets', 'puertas', 'herrajes', 'accesorios', 'otros']),
  description: z.string().min(5, "La descripción debe ser más detallada"),
  price: z.number().min(0, "El precio no puede ser negativo"),
  unit: z.string().min(1, "La unidad es obligatoria"),
  photoUrl: z.string(),
  active: z.boolean(),
});

type MaterialFormData = z.infer<typeof materialSchema>;

import { useMaterials, HardwareItem } from "@/hooks/useMaterials";
import { useMaterialPriceHistory } from "@/hooks/useMaterialPriceHistory";
import { useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, History } from "lucide-react";

const categoryMap: Record<HardwareItem['category'], { label: string; color: string }> = {
  cocinas: { label: "Cocinas", color: "bg-emerald-500/10 text-emerald-500" },
  closets: { label: "Closets", color: "bg-blue-500/10 text-blue-500" },
  puertas: { label: "Puertas", color: "bg-orange-500/10 text-orange-500" },
  herrajes: { label: "Herrajes", color: "bg-purple-500/10 text-purple-500" },
  accesorios: { label: "Accesorios", color: "bg-pink-500/10 text-pink-500" },
  otros: { label: "Otros", color: "bg-slate-500/10 text-slate-500" },
};

const columns: ColumnDef<HardwareItem>[] = [
  {
    accessorKey: "photoUrl",
    header: "Imagen",
    cell: ({ row }) => (
      <div className="h-10 w-10 bg-muted rounded-sm overflow-hidden border border-border/30">
        <img src={row.original.photoUrl || undefined} alt={row.original.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: "Material / Herraje",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-bold text-foreground">{row.original.name}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest truncate max-w-[200px]">{row.original.description}</span>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoría",
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none", categoryMap[row.original.category]?.color)}>
        {categoryMap[row.original.category].label}
      </Badge>
    ),
  },
  {
    accessorKey: "price",
    header: "Precio Base",
    cell: ({ row }) => (
      <div className="flex flex-col text-right">
        <span className="text-sm font-mono font-bold text-foreground">${row.original.price.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">por {row.original.unit}</span>
      </div>
    ),
  },
  {
    accessorKey: "active",
    header: "Estado",
    cell: ({ row }) => (
      <Badge className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none", row.original.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
        {row.original.active ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
];

export default function MaterialsSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items: materials, isLoading, isSaving, createItem, updateItem } = useMaterials();
  const [selectedItem, setSelectedItem] = React.useState<HardwareItem | null>(null);
  const [showPriceHistory, setShowPriceHistory] = React.useState(false);
  const { data: priceHistory = [], isLoading: historyLoading } = useMaterialPriceHistory(
    showPriceHistory ? selectedItem?.id ?? null : null
  );

  const metrics: MetricData[] = [
    { title: "Total Ítems", value: materials.length, description: "Catálogo activo", icon: Package, trend: "up", color: "blue" },
    { title: "Maderas", value: materials.filter(m => m.category === 'cocinas' || m.category === 'closets').length, description: "Tableros y RH", icon: Layers, trend: "neutral", color: "purple" },
    { title: "Herrajes", value: materials.filter(m => m.category === 'herrajes').length, description: "Blum, Hafele, etc.", icon: Grid, trend: "up", color: "green" },
    { title: "Accesorios", value: materials.filter(m => m.category === 'accesorios').length, description: "Canastilla y más", icon: Palette, trend: "neutral", color: "yellow" },
  ];

  const handleUpdate = async (field: keyof HardwareItem, value: any) => {
    if (!selectedItem) return;
    try {
      await updateItem({ id: selectedItem.id, [field]: value });
      setSelectedItem(prev => prev ? { ...prev, [field]: value } : null);
      if (field === 'price') {
        queryClient.invalidateQueries({ queryKey: ['material-price-history', selectedItem.id] });
      }
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title="CATÁLOGO DE MATERIALES"
        subtitle="Gestión de herrajes, tableros y acabados para la producción."
        icon={Package}
        onBack={() => navigate("/settings")}
        action={{
          label: "Nuevo Material",
          icon: Plus,
          onClick: () => navigate("/settings/materials/new")
        }}
      />

      {isLoading ? (
        <div className="h-[60vh] w-full flex items-center justify-center">
          <PremiumLoader size="lg" text="Cargando Catálogo de Materiales" />
        </div>
      ) : (
        <>
          <MetricsGrid metrics={metrics} />

          <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o descripción..." 
                className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
              />
            </div>
            <FilterSheet
              title="Filtros de Catálogo"
              description="Segmenta tus materiales por categoría o estado."
              onApply={() => toast.info("Filtros aplicados")}
              onClear={() => {}}
            >
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Por Categoría</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(categoryMap).map(([key, item]) => (
                      <Button key={key} variant="outline" className="text-[10px] font-bold uppercase h-10 rounded-none border-border/30">
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterSheet>
          </div>

          <DataTable
            columns={columns}
            data={materials}
            isLoading={isLoading}
            totalCount={materials.length}
            pageCount={1}
            pageIndex={0}
            pageSize={10}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            onRowClick={setSelectedItem}
            emptyMessage={
              <EmptyState 
                title="Sin materiales registrados"
                description="No se encontraron herrajes o acabados en el catálogo."
                icon={Package}
                action={{
                  label: "Agregar material",
                  icon: Plus,
                  onClick: () => navigate("/settings/materials/new")
                }}
              />
            }
          />
        </>
      )}

      <FullscreenDetail
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        title={selectedItem?.name || ""}
        subtitle={`CONFIGURACIÓN > MATERIALES > ${selectedItem?.name}`}
        icon={Package}
        status={{ 
          label: selectedItem?.active ? 'Activo' : 'Inactivo', 
          variant: selectedItem?.active ? 'default' : 'destructive' 
        }}
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pb-8">
            <div className="col-span-2 flex justify-center mb-4">
              <div className="h-48 w-48 bg-muted rounded-sm border border-border/10 overflow-hidden relative group">
                <img src={selectedItem?.photoUrl || undefined} alt={selectedItem?.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="outline" className="text-white border-white/40 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest">Cambiar Imagen</Button>
                </div>
              </div>
            </div>
            <InlineEditField
              label="Nombre del Material"
              value={selectedItem?.name || ""}
              onSave={async (val) => handleUpdate('name', val)}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Categoría</p>
              <Badge variant="outline" className={cn("mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1", selectedItem ? categoryMap[selectedItem.category]?.color : "")}>
                {selectedItem ? categoryMap[selectedItem.category].label : ""}
              </Badge>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 py-8">
            <div className="col-span-2 space-y-1">
              <InlineEditField
                label="Descripción Detallada"
                value={selectedItem?.description || ""}
                onSave={async (val) => handleUpdate('description', val)}
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pt-8">
            <InlineEditField
              label="Precio Base"
              value={selectedItem?.price.toString() || "0"}
              onSave={async (val) => handleUpdate('price', Number(val))}
            />
            <InlineEditField
              label="Unidad de Medida"
              value={selectedItem?.unit || ""}
              onSave={async (val) => handleUpdate('unit', val)}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Orden de Visualización</p>
              <p className="text-sm font-bold text-foreground mt-2">{selectedItem?.sortOrder}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Estado en Catálogo</p>
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle2 className={cn("w-4 h-4", selectedItem?.active ? "text-primary" : "text-destructive")} />
                <span className="text-sm font-bold text-foreground">{selectedItem?.active ? 'Disponible' : 'Deshabilitado'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border/10 flex gap-4">
          <Button variant="outline" className="flex-1 border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase text-[10px] tracking-widest h-12 gap-2">
            <Layout className="w-4 h-4" />
            Gestionar Opciones
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPriceHistory(true)}
            className="flex-1 border-border/50 text-muted-foreground hover:bg-accent/50 font-bold uppercase text-[10px] tracking-widest h-12 gap-2"
          >
            <History className="w-4 h-4" />
            Ver Historial Precios
          </Button>
        </div>

        {/* Price history panel */}
        {showPriceHistory && (
          <div className="mt-6 border border-border/20 rounded-sm bg-card/30">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/10">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Historial de Precios</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPriceHistory(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground h-7 px-2"
              >
                Cerrar
              </Button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : priceHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Tag className="w-8 h-8 opacity-30" />
                <p className="text-[11px] uppercase tracking-widest font-bold">Sin cambios registrados</p>
                <p className="text-xs opacity-60">Los cambios de precio se registran automáticamente al editar el campo.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {priceHistory.map((entry) => {
                  const delta = entry.new_price - entry.previous_price;
                  const pct = entry.previous_price > 0 ? ((delta / entry.previous_price) * 100).toFixed(1) : "—";
                  const isUp = delta > 0;
                  const isDown = delta < 0;
                  return (
                    <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(entry.changed_at).toLocaleDateString("es-CO", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono line-through opacity-50">
                          ${entry.previous_price.toLocaleString("es-CO")}
                        </span>
                        <span className="text-xs font-bold font-mono text-foreground">
                          ${entry.new_price.toLocaleString("es-CO")}
                        </span>
                        <span className={cn(
                          "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide",
                          isUp ? "text-emerald-500" : isDown ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {isUp ? "+" : ""}{pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </FullscreenDetail>
    </motion.div>
  );
}
