import * as React from "react";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import {
  Package,
  Plus,
  Search,
  History,
  AlertTriangle,
  Tag,
  Layers,
  Box,
  Filter,
  ShoppingCart,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  FilterSheet,
  FilterSection,
  FilterOption,
} from "@/components/shared/FilterSheet";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "use-debounce";
import { DetailModal, InlineEditField } from "@/components/shared/DetailModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { useMaterials, HardwareItem } from "@/hooks/useMaterials";

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: ColumnDef<HardwareItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todos"
        className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
          className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Item",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-muted flex items-center justify-center rounded-sm border border-border/30">
          <Package className="w-5 h-5 text-primary/60" />
        </div>
        <div className="flex flex-col">
          <span
            className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[200px]"
            title={row.original.name}
          >
            {row.original.name}
          </span>
          <span className="text-xs text-muted-foreground/70 truncate max-w-[200px]">
            {row.original.description || "—"}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Categoría",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs font-medium border-border/50 capitalize">
        {row.original.category}
      </Badge>
    ),
  },
  {
    accessorKey: "unit",
    header: "Unidad",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.unit || "—"}</span>
    ),
  },
  {
    accessorKey: "active",
    header: () => <div className="text-center">Estado</div>,
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-bold border",
            row.original.active
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted text-muted-foreground border-border/30"
          )}
        >
          {row.original.active ? "Activo" : "Inactivo"}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "price",
    header: () => <div className="text-right">Precio Unit.</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm font-bold text-foreground flex items-center justify-end gap-1.5">
        <DollarSign className="w-3 h-3 text-primary/60" />
        {row.original.price.toLocaleString("es-CO")}
      </div>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [selectedItem, setSelectedItem] = React.useState<HardwareItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [itemsToDelete, setItemsToDelete] = React.useState<HardwareItem[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [showInactive, setShowInactive] = React.useState(false);

  // ── Real data ──────────────────────────────────────────────────────────────
  const { items: allItems, isLoading, updateItem } = useMaterials();

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredItems = React.useMemo(() => {
    let result = allItems;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (!showInactive) {
      result = result.filter((item) => item.active);
    }

    return result;
  }, [allItems, debouncedSearch, selectedCategory, showInactive]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const paginatedItems = React.useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, pageIndex, pageSize]);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics: MetricData[] = React.useMemo(() => {
    const totalActive = allItems.filter((i) => i.active).length;
    const totalInactive = allItems.filter((i) => !i.active).length;
    const uniqueCategories = new Set(allItems.map((i) => i.category)).size;
    const avgPrice =
      allItems.length > 0
        ? Math.round(allItems.reduce((sum, i) => sum + i.price, 0) / allItems.length)
        : 0;

    return [
      {
        title: "Total Items",
        value: allItems.length,
        description: `${uniqueCategories} categorías`,
        icon: Package,
        trend: "neutral",
        color: "blue",
      },
      {
        title: "Activos",
        value: totalActive,
        description: "Disponibles para cotizar",
        icon: ShoppingCart,
        trend: "up",
        color: "green",
      },
      {
        title: "Inactivos",
        value: totalInactive,
        description: totalInactive > 0 ? "Requieren revisión" : "Sin pendientes",
        icon: AlertTriangle,
        trend: totalInactive > 0 ? "down" : "neutral",
        color: totalInactive > 0 ? "destructive" : "blue",
      },
      {
        title: "Precio Promedio",
        value: `$${avgPrice.toLocaleString("es-CO")}`,
        description: "Por ítem en catálogo",
        icon: DollarSign,
        trend: "neutral",
        color: "purple",
      },
    ];
  }, [allItems]);

  // ── Categories for filter ──────────────────────────────────────────────────
  const availableCategories = React.useMemo(
    () => Array.from(new Set(allItems.map((i) => i.category))).sort(),
    [allItems]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDelete = () => {
    toast.success(`${itemsToDelete.length} item(s) eliminado(s) correctamente.`);
    setItemsToDelete([]);
  };

  const handleSaveField = async (field: keyof HardwareItem, value: string) => {
    if (!selectedItem) return;
    try {
      const parsed: any =
        field === "price" || field === "sortOrder" ? Number(value) :
        field === "active" ? value === "true" :
        value;
      await updateItem({ id: selectedItem.id, [field]: parsed });
      setSelectedItem({ ...selectedItem, [field]: parsed });
      toast.success(`Campo actualizado correctamente`);
    } catch {
      toast.error("Error al actualizar el campo");
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader
        title="CATÁLOGO DE MATERIALES"
        subtitle="Inventario de herrajes, accesorios y componentes para ensambles."
        icon={Package}
        onBack={() => navigate("/")}
        action={{
          label: "Nuevo Item",
          icon: Plus,
          onClick: () => navigate("/inventory/new"),
        }}
      />

      {isLoading ? <MetricGridSkeleton /> : <MetricsGrid metrics={metrics} />}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, descripción o categoría..."
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <FilterSheet
          title="Filtros de Inventario"
          description="Filtra por categoría o estado del ítem."
          onApply={() => {}}
          trigger={
            <Button
              variant="outline"
              className="gap-2 border-border/50 font-bold uppercase text-xs tracking-widest h-10 rounded-none"
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              Filtros
            </Button>
          }
        >
          <FilterSection title="Categorías">
            <div className="grid grid-cols-1 gap-2">
              <FilterOption
                label="Todas"
                value=""
                selected={!selectedCategory}
                onClick={() => setSelectedCategory(null)}
              />
              {availableCategories.map((cat) => (
                <FilterOption
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  value={cat}
                  selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection title="Estado">
            <div className="grid grid-cols-1 gap-2">
              <FilterOption
                label="Solo activos"
                value="active"
                selected={!showInactive}
                onClick={() => setShowInactive(false)}
              />
              <FilterOption
                label="Todos (incluir inactivos)"
                value="all"
                selected={showInactive}
                onClick={() => setShowInactive(true)}
              />
            </div>
          </FilterSection>
        </FilterSheet>

        {(searchTerm || selectedCategory || showInactive) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory(null);
              setShowInactive(false);
            }}
            className="text-xs font-bold uppercase tracking-widest text-primary"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={paginatedItems}
        isLoading={isLoading}
        totalCount={filteredItems.length}
        pageCount={Math.ceil(filteredItems.length / pageSize)}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedItem}
        onDeleteSelected={(rows) => {
          setItemsToDelete(rows);
          setIsDeleteDialogOpen(true);
        }}
        emptyMessage={
          <EmptyState
            title="Sin items en catálogo"
            description="No se encontraron materiales que coincidan con la búsqueda."
            icon={Package}
            action={{
              label: "Agregar nuevo item",
              icon: Plus,
              onClick: () => navigate("/inventory/new"),
            }}
          />
        }
      />

      <DetailModal
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        title={selectedItem?.name || ""}
        icon={Package}
        subtitle={`Categoría: ${selectedItem?.category || "—"}`}
        status={
          selectedItem
            ? {
                label: selectedItem.active ? "Activo" : "Inactivo",
                variant: selectedItem.active ? "default" : "destructive",
                className: selectedItem.active
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-border/30",
              }
            : undefined
        }
        editHref={selectedItem ? `/inventory/${selectedItem.id}/edit` : undefined}
        onNavigate={navigate}
        footer={
          <Button
            variant="outline"
            className="gap-2 border-border/50 text-xs font-medium uppercase tracking-widest text-primary"
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            Ver Movimientos
          </Button>
        }
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pb-8">
            <InlineEditField
              label="Nombre del Producto"
              value={selectedItem?.name || ""}
              onSave={(v) => handleSaveField("name", v)}
            />
            <InlineEditField
              label="Descripción"
              value={selectedItem?.description || ""}
              onSave={(v) => handleSaveField("description", v)}
            />
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 py-8">
            <InlineEditField
              label="Categoría"
              value={selectedItem?.category || ""}
              onSave={(v) => handleSaveField("category", v)}
            />
            <InlineEditField
              label="Unidad de medida"
              value={selectedItem?.unit || ""}
              onSave={(v) => handleSaveField("unit", v)}
            />
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pt-8">
            <InlineEditField
              label="Precio Unitario"
              value={selectedItem?.price.toString() || "0"}
              type="number"
              onSave={(v) => handleSaveField("price", v)}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <div className="flex items-center gap-2 min-h-[32px]">
                <Box className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {selectedItem?.active ? "Activo en catálogo" : "Inactivo"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {selectedItem?.description && (
          <div className="space-y-4 pt-8">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-foreground border-b border-border/10 pb-2">
              Detalles
            </h4>
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-sm border border-border/10">
              <Tag className="w-5 h-5 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Descripción</p>
                <p className="text-sm font-bold text-foreground">{selectedItem.description}</p>
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="¿Eliminar Items?"
        description={`¿Estás seguro de que deseas eliminar ${itemsToDelete.length} item(s) del catálogo? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
