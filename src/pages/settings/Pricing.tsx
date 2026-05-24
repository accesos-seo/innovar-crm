import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import {
  CreditCard,
  Plus,
  Search,
  History,
  TrendingUp,
  DollarSign,
  Tag,
  FileText,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { FullscreenDetail } from "@/components/shared/FullscreenDetail";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { InlineEditField } from "@/components/shared/DetailModal";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { usePricing, PricingItem } from "@/hooks/usePricing";

const categoryMap: Record<PricingItem['category'], string> = {
  cocina: "Cocina",
  closet: "Closets",
  puerta: "Puerta",
  centro_tv: "Centro TV",
  meson: "Mesones",
  herraje: "Herrajes",
  otro: "Otros",
};

const categoryBadgeClass: Record<PricingItem['category'], string> = {
  cocina: "bg-primary/10 text-primary border border-primary/30",
  closet: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  puerta: "bg-violet-500/10 text-violet-400 border border-violet-500/30",
  centro_tv: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  meson: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  herraje: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
  otro: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};

const columns: ColumnDef<PricingItem>[] = [
  {
    accessorKey: "code",
    header: "Código",
    size: 160,
    cell: ({ row }) => (
      <span className="text-xs font-mono font-bold text-primary whitespace-nowrap">
        {row.original.code}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Concepto",
    cell: ({ row }) => (
      <span className="text-sm font-bold text-foreground">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoría",
    size: 140,
    cell: ({ row }) => {
      const cat = row.original.category;
      return (
        <span
          className={cn(
            "inline-block text-[9px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded-sm whitespace-nowrap",
            categoryBadgeClass[cat] ?? "bg-muted/30 text-muted-foreground border border-border/20"
          )}
        >
          {categoryMap[cat] ?? cat}
        </span>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground max-w-[280px] truncate block">
        {row.original.description || "—"}
      </span>
    ),
  },
  {
    accessorKey: "value",
    header: () => <div className="text-right w-full">Precio / Valor</div>,
    size: 140,
    cell: ({ row }) => (
      <div className="flex flex-col items-end text-right">
        <span className="text-sm font-mono font-bold text-foreground">
          ${row.original.value.toLocaleString("es-CO")}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
          POR {row.original.unit}
        </span>
      </div>
    ),
  },
];

export default function PricingSettingsPage() {
  const navigate = useNavigate();
  const { items: pricingItems, isLoading, updateItem } = usePricing();
  const [selectedItem, setSelectedItem] = React.useState<PricingItem | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(25);

  const filteredItems = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pricingItems;
    return pricingItems.filter(
      (p) =>
        p.code?.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term)
    );
  }, [pricingItems, searchTerm]);

  const paginatedItems = React.useMemo(
    () => filteredItems.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredItems, pageIndex, pageSize]
  );

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPageIndex(0);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const handleUpdate = async (field: keyof PricingItem, value: any) => {
    if (!selectedItem) return;
    const updateData: any = { id: selectedItem.id, [field]: value };
    if (field === 'value') {
      updateData.previousValue = selectedItem.value;
      updateData.lastUpdated = new Date().toISOString().split('T')[0];
    }
    try {
      await updateItem(updateData);
      setSelectedItem(prev => prev ? { ...prev, ...updateData } : null);
    } catch {
      // Error handled in hook
    }
  };

  const metrics: MetricData[] = [
    { title: "Ítems Tarifario", value: pricingItems.length, description: "Precios activos", icon: Tag, trend: "neutral", color: "blue" },
    { title: "Cocinas", value: pricingItems.filter(p => p.category === 'cocina').length, description: "Módulos base", icon: TrendingUp, trend: "up", color: "purple" },
    { title: "Valor Promedio", value: `$${Math.round(pricingItems.reduce((acc, curr) => acc + curr.value, 0) / (pricingItems.length || 1) / 1000)}k`, description: "Global catálogo", icon: DollarSign, trend: "neutral", color: "green" },
    { title: "Actualizados", value: pricingItems.filter(p => p.lastUpdated.includes('2026')).length, description: "Este año", icon: FileText, trend: "neutral", color: "yellow" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="TARIFARIO Y PRECIOS"
        subtitle="Configuración de costos base, mano de obra y valores de mercado."
        icon={CreditCard}
        onBack={() => navigate("/settings")}
        action={{
          label: "Nuevo Precio",
          icon: Plus,
          onClick: () => navigate("/settings/pricing/new")
        }}
      />

      {isLoading ? (
        <div className="h-[60vh] w-full flex items-center justify-center">
          <PremiumLoader size="lg" text="Calculando Tarifario Maestro" />
        </div>
      ) : (
        <>
          <MetricsGrid metrics={metrics} />

          <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o concepto..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
              />
            </div>

            <FilterSheet
              title="Filtros de Tarifario"
              description="Segmenta tus precios por categoría."
              onApply={() => toast.info("Filtros aplicados")}
              onClear={() => {}}
            >
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Por Categoría</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(categoryMap).map(([key, label]) => (
                      <Button key={key} variant="outline" className="text-[10px] font-bold uppercase h-10 rounded-none border-border/30 justify-start px-4">
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterSheet>
          </div>

          <DataTable
            columns={columns}
            data={paginatedItems}
            isLoading={isLoading}
            totalCount={filteredItems.length}
            pageCount={pageCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageSizeOptions={[25, 50, 100, 250]}
            onPageChange={setPageIndex}
            onPageSizeChange={handlePageSizeChange}
            onRowClick={setSelectedItem}
            emptyMessage={
              <EmptyState
                title="Sin precios registrados"
                description="No se encontraron ítems en el tarifario actual."
                icon={Tag}
                action={{
                  label: "Agregar precio",
                  icon: Plus,
                  onClick: () => navigate("/settings/pricing/new")
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
        subtitle={`CONFIGURACIÓN > TARIFARIO > ${selectedItem?.name}`}
        icon={CreditCard}
        status={{
          label: 'Vigente',
          variant: 'outline',
          className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        }}
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pb-8">
            <InlineEditField
              label="Nombre del Concepto"
              value={selectedItem?.name || ""}
              onSave={async (val) => handleUpdate('name', val)}
            />
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Categoría</p>
              <p className="text-lg font-black text-foreground">{selectedItem ? categoryMap[selectedItem.category] : ""}</p>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 py-8">
            <div className="col-span-2">
              <InlineEditField
                label="Descripción / Plantilla de Cotización"
                value={selectedItem?.description || ""}
                onSave={async (val) => handleUpdate('description', val)}
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pt-8">
            <div className="space-y-2">
              <InlineEditField
                label="Valor Unitario Actual ($)"
                value={selectedItem?.value.toString() || "0"}
                onSave={async (val) => handleUpdate('value', Number(val))}
              />
              <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">Unidad de Medida: {selectedItem?.unit}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Valor Anterior</p>
              <p className="text-xl font-mono font-bold text-muted-foreground/50 mt-1">${selectedItem?.previousValue?.toLocaleString() || "---"}</p>
            </div>
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-border/10">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-8">Historial de Ajustes</h4>
          <div className="space-y-4">
            {selectedItem?.previousValue && (
              <div className="flex items-center justify-between p-6 bg-muted/20 border border-border/5 rounded-sm group hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-6">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <History className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Actualización de Precio Base</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Sincronización de Sistema • {selectedItem.lastUpdated}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm font-mono text-muted-foreground/40 line-through">${selectedItem.previousValue.toLocaleString()}</span>
                  <ArrowRight className="w-4 h-4 text-primary/40" />
                  <span className="text-sm font-mono font-bold text-primary">${selectedItem.value.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </FullscreenDetail>
    </motion.div>
  );
}
