import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { 
  Plus, 
  Search, 
  Database, 
  Zap, 
  HardDrive, 
  Repeat,
  Info,
  History,
  Clock,
  ArrowLeft,
  Filter,
  Trash2,
  Edit2
} from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase } from "@/lib/format-utils";
import { useDebounce } from "use-debounce";
import { notify } from "@/components/ui/PremiumToast";
import { useSystemDictionary } from "@/hooks/useSystemDictionary";
import { SystemDictionaryEntry } from "@/types/database";
import { columns, categoryMap, statusMap } from "./dictionary/DictionaryColumns";
import { DictionaryForm } from "./dictionary/DictionaryForm";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { cn } from "@/lib/utils";

export default function DictionaryPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Restricted access: only admin or super_admin
  React.useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      notify.error("Acceso Denegado", "No tienes permisos para acceder a esta sección.");
      navigate("/");
    }
  }, [user, navigate]);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [filters, setFilters] = React.useState({
    category: "all",
    status: "all"
  });

  const { entries, isLoading, upsertEntry, deleteEntry } = useSystemDictionary({
    search: debouncedSearch,
    category: filters.category,
    status: filters.status
  });

  const [selectedEntry, setSelectedEntry] = React.useState<SystemDictionaryEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<SystemDictionaryEntry | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // Pagination states
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  const paginatedEntries = entries.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const pageCount = Math.ceil(entries.length / pageSize);

  const metrics: MetricData[] = React.useMemo(() => [
    { 
      title: formatSentenceCase("Total Registros"), 
      value: entries.length, 
      description: formatSentenceCase("Documentación del sistema"), 
      icon: Database, 
      trend: "neutral", 
      color: "blue" 
    },
    { 
      title: formatSentenceCase("Edge Functions"), 
      value: entries.filter(e => e.category === 'EDGE_FUNCTION').length, 
      description: formatSentenceCase("Procesos activos"), 
      icon: Zap, 
      trend: "neutral", 
      color: "purple" 
    },
    { 
      title: formatSentenceCase("Buckets / Storage"), 
      value: entries.filter(e => e.category === 'BUCKET').length, 
      description: formatSentenceCase("Depósitos de datos"), 
      icon: HardDrive, 
      trend: "neutral", 
      color: "yellow" 
    },
    { 
      title: formatSentenceCase("Activos"), 
      value: entries.filter(e => e.status === 'active').length, 
      description: formatSentenceCase("En producción"), 
      icon: Repeat, 
      trend: "up", 
      color: "green" 
    },
  ], [entries]);

  const handleCreate = async (values: any) => {
    try {
      await upsertEntry(values);
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (values: any) => {
    try {
      await upsertEntry({ ...values, id: editingEntry?.id });
      setIsFormOpen(false);
      setEditingEntry(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (editingEntry?.id) {
      await deleteEntry(editingEntry.id);
      setIsDeleteDialogOpen(false);
      setEditingEntry(null);
      setIsFormOpen(false);
    }
  };

  const isFiltered = filters.category !== "all" || filters.status !== "all";

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <CategoryHeader 
        title={formatSentenceCase("DICCIONARIO DEL SISTEMA")}
        subtitle={formatSentenceCase("Registro documental de Buckets, Edge Functions, Triggers y Jobs.")}
        icon={Database}
        onBack={() => navigate("/")}
        action={{
          label: formatSentenceCase("Nuevo Registro"),
          icon: Plus,
          onClick: () => {
            setEditingEntry(null);
            setIsFormOpen(true);
          }
        }}
      />

      {isLoading ? (
        <MetricGridSkeleton />
      ) : (
        <MetricsGrid metrics={metrics} />
      )}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:border-l-primary hover:border-l-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={formatSentenceCase("Buscar por nombre o descripción...")} 
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <FilterSheet
          title={formatSentenceCase("Filtros del Diccionario")}
          description={formatSentenceCase("Segmenta por categoría de recurso o estado actual.")}
          onApply={() => notify.info(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La visualización se ha actualizado."))}
          onClear={() => setFilters({ category: "all", status: "all" })}
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Categoría")}</label>
              <div className="flex flex-col gap-2">
                {["all", "BUCKET", "EDGE_FUNCTION", "DB_TRIGGER", "CRON_JOB"].map((cat) => (
                  <Button 
                    key={cat} 
                    variant={filters.category === cat ? "default" : "outline"}
                    onClick={() => setFilters(prev => ({ ...prev, category: cat }))}
                    className={cn(
                      "justify-start h-10 rounded-none text-xs font-bold",
                      filters.category === cat ? "border-primary" : "text-muted-foreground"
                    )}
                  >
                    {cat === 'all' ? "Ver Todas" : formatSentenceCase(cat.replace("_", " "))}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Estado")}</label>
              <div className="flex gap-2">
                {["all", "active", "inactive"].map((st) => (
                  <Button 
                    key={st} 
                    variant={filters.status === st ? "default" : "outline"}
                    onClick={() => setFilters(prev => ({ ...prev, status: st }))}
                    className={cn(
                      "flex-1 h-10 rounded-none text-xs font-bold",
                      filters.status === st ? "border-primary" : "text-muted-foreground"
                    )}
                  >
                    {st === 'all' ? "Cualquiera" : formatSentenceCase(st)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </FilterSheet>

        {(searchTerm || isFiltered) && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setSearchTerm("");
              setFilters({ category: "all", status: "all" });
            }}
            className="text-xs font-bold text-primary"
          >
            {formatSentenceCase("Limpiar")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={paginatedEntries}
        isLoading={isLoading}
        totalCount={entries.length}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={(row) => setSelectedEntry(row)}
        emptyMessage={
          <EmptyState 
            title="No se encontraron registros"
            description="No hay registros en el diccionario que coincidan con la búsqueda. Crea uno nuevo para comenzar la documentación."
            icon={Database}
            action={{
              label: "Nuevo Registro",
              icon: Plus,
              onClick: () => {
                setEditingEntry(null);
                setIsFormOpen(true);
              }
            }}
          />
        }
      />

      {/* Sheet para Detalle (Drawer) */}
      <Sheet open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <SheetContent className="sm:max-w-xl border-l border-border/10">
          <SheetHeader className="space-y-4 pr-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-sm">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <SheetTitle className="text-xl font-black tracking-tight">{selectedEntry?.name}</SheetTitle>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge variant={selectedEntry ? categoryMap[selectedEntry.category]?.variant : "info"}>
                {selectedEntry ? categoryMap[selectedEntry.category]?.label : ""}
              </StatusBadge>
              <StatusBadge variant={selectedEntry?.status === 'active' ? "success" : "error"} dot>
                {selectedEntry?.status === 'active' ? "Activo" : "Inactivo"}
              </StatusBadge>
            </div>
            <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
              {formatSentenceCase("Información técnica y descriptiva del recurso del sistema.")}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-12 space-y-12">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-l-2 border-primary pl-3">
                {formatSentenceCase("Descripción")}
              </h4>
              <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-4 rounded-sm border border-border/10 font-medium">
                {selectedEntry?.description}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary border-l-2 border-primary pl-3">
                {formatSentenceCase("Evento Detonador")}
              </h4>
              <div className="flex items-center gap-3 bg-muted/20 p-4 border border-border/5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-bold">{selectedEntry?.trigger_event || "Llamada manual / No especificado"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border/10">
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">{formatSentenceCase("Creado")}</p>
                <DateDisplay date={selectedEntry?.created_at} showTime className="text-xs font-bold" />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">{formatSentenceCase("Actualizado")}</p>
                <DateDisplay date={selectedEntry?.updated_at} showTime className="text-xs font-bold" />
              </div>
            </div>
          </div>

          <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-card border-t border-border/10 flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1 rounded-none font-bold border-destructive/20 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setEditingEntry(selectedEntry);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {formatSentenceCase("Eliminar")}
            </Button>
            <Button 
              className="flex-1 rounded-none font-bold bg-primary hover:bg-primary/90"
              onClick={() => {
                setEditingEntry(selectedEntry);
                setIsFormOpen(true);
                setSelectedEntry(null);
              }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              {formatSentenceCase("Editar Registro")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Modal para Nuevo/Editar */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/50 p-0 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30"></div>
          <div className="p-8">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-sm">
                  {editingEntry ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                </div>
                {editingEntry ? formatSentenceCase("Editar Registro") : formatSentenceCase("Nuevo Registro de Diccionario")}
              </DialogTitle>
            </DialogHeader>

            <DictionaryForm 
              initialData={editingEntry}
              onSubmit={editingEntry ? handleUpdate : handleCreate}
              isLoading={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={formatSentenceCase("¿Eliminar registro?")}
        description={formatSentenceCase("Esta acción eliminará la documentación del recurso seleccionado de forma permanente.")}
        confirmText={formatSentenceCase("Eliminar")}
        cancelText={formatSentenceCase("Cancelar")}
        variant="destructive"
      />
    </div>
  );
}
