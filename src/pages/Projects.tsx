import * as React from "react";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { 
  Briefcase, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  FileText,
  Settings2,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Project, ProjectStatus } from "@/types/database";
import { formatDate } from "@/lib/format-utils";
import { formatSentenceCase } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "use-debounce";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { StatusSubnav, StatusOption } from "@/components/shared/StatusSubnav";
import { notify } from "@/components/ui/PremiumToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

import { statusMap, columns } from "./projects/ProjectsColumns";

import { useProjects, useUpdateProject, useArchiveProject } from "@/hooks/useProjects";

export default function ProjectsPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [projectsToDelete, setProjectsToDelete] = React.useState<Project[]>([]);

  const { data: allProjects = [], isLoading, isError, error } = useProjects({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  React.useEffect(() => {
    if (isError) {
      notify.error("Error de conexión", error?.message || "No se pudieron cargar los proyectos.");
    }
  }, [isError, error]);

  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();

  const filteredData = React.useMemo(() => {
    return allProjects.filter(p =>
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [allProjects, debouncedSearch]);

  const paginatedData = React.useMemo(
    () => filteredData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredData, pageIndex, pageSize]
  );

  React.useEffect(() => { setPageIndex(0); }, [debouncedSearch, statusFilter]);

  const metrics = React.useMemo<MetricData[]>(() => {
    return [
      { title: "Proyectos Activos", value: allProjects.length, description: "+2 este mes", icon: Briefcase, trend: "up", color: "blue" },
      { title: "En Producción", value: allProjects.filter(p => p.status === 'en_produccion').length, description: "3 con entrega próxima", icon: Clock, trend: "neutral", color: "yellow" },
      { title: "Completados", value: allProjects.filter(p => p.status === 'entregado').length, description: "Año 2024", icon: CheckCircle2, trend: "up", color: "green" },
      { title: "Valor en Pipeline", value: `$${allProjects.reduce((acc, p) => acc + (p.total_amount || 0), 0).toLocaleString()}`, description: "Proyectos abiertos", icon: TrendingUp, trend: "up", color: "purple" },
    ];
  }, [allProjects]);

  const statusOptions: StatusOption[] = React.useMemo(() => {
    const options: StatusOption[] = [
      { value: "all", label: "Todos", count: allProjects.length, icon: Briefcase },
    ];

    Object.entries(statusMap).forEach(([key, value]) => {
      options.push({
        value: key,
        label: value.label,
        count: allProjects.filter(p => p.status === key).length,
      });
    });

    return options;
  }, [allProjects]);

  const handleDelete = async () => {
    try {
      for (const project of projectsToDelete) {
        await archiveProject.mutateAsync(project.id);
      }
      toast.success(`${projectsToDelete.length} proyecto(s) archivado(s) correctamente.`);
      setProjectsToDelete([]);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Error al archivar proyectos");
    }
  };

  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader 
        title={formatSentenceCase("Gestión de proyectos")}
        subtitle={formatSentenceCase("Seguimiento integral de ensambles y logística de cocinas a medida.")}
        icon={Briefcase}
        onBack={() => navigate("/")}
        action={{
          label: formatSentenceCase("Nuevo proyecto"),
          icon: Plus,
          onClick: () => navigate("/projects/new")
        }}
      />

      {isLoading ? (
        <div className="h-[60vh] w-full flex items-center justify-center bg-card/20 rounded-sm border border-border/5">
          <PremiumLoader size="lg" text="Analizando Base de Datos de Proyectos" />
        </div>
      ) : (
        <>
          <MetricsGrid metrics={metrics} />

          <div className="flex gap-4 items-center bg-card/50 p-6 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar proyectos por nombre o cliente..." 
                className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Sheet>
              <SheetTrigger render={(props) => (
                <Button {...props} variant="outline" className="gap-2 border-border/50 font-bold text-xs h-10 rounded-none">
                  <Filter className="w-4 h-4" aria-hidden="true" />
                  {formatSentenceCase("Filtros avanzados")}
                </Button>
              )} />
              <SheetContent className="bg-card border-l-border/10 w-[90vw] sm:w-[450px] sm:max-w-none p-0 flex flex-col">
                <SheetHeader className="px-8 pt-8 pb-6 shrink-0">
                  <SheetTitle className="text-xl font-bold tracking-tight">{formatSentenceCase("Filtros de proyectos")}</SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground">
                    {formatSentenceCase("Refina la búsqueda por estado, fecha o tipo de trabajo.")}
                  </SheetDescription>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 scrollbar-thin">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Filtros rápidos")}</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/30 p-5 border border-border/50 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl hover:border-t-purple-500 hover:border-t-4 group">
                        <p className="text-[10px] font-bold text-muted-foreground group-hover:text-purple-500 transition-colors">{formatSentenceCase("Urgentes")}</p>
                        <p className="text-2xl font-bold text-foreground">05</p>
                      </div>
                      <div className="bg-muted/30 p-5 border border-border/50 cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl hover:border-t-blue-500 hover:border-t-4 group">
                        <p className="text-[10px] font-bold text-muted-foreground group-hover:text-blue-500 transition-colors">{formatSentenceCase("Próxima entrega")}</p>
                        <p className="text-2xl font-bold text-foreground">12</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Estado del proyecto")}</label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button 
                        variant={statusFilter === "all" ? "default" : "outline"}
                        onClick={() => setStatusFilter("all")}
                        className="justify-between text-[10px] font-bold h-12 rounded-none border-border/30 hover:bg-primary hover:text-primary-foreground transition-all duration-200 px-4"
                      >
                        <span>{formatSentenceCase("Todos")}</span>
                        <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">{allProjects.length}</Badge>
                      </Button>
                      {Object.entries(statusMap).map(([key, value]) => {
                        const count = allProjects.filter(p => p.status === key).length;
                        return (
                          <Button 
                            key={key} 
                            variant={statusFilter === key ? "default" : "outline"}
                            onClick={() => setStatusFilter(key)}
                            className="justify-between text-[10px] font-bold h-12 rounded-none border-border/30 hover:bg-primary hover:text-primary-foreground transition-all duration-200 px-4"
                          >
                            <span className="truncate mr-1">{formatSentenceCase(value.label)}</span>
                            <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] shrink-0">{count}</Badge>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <SheetFooter className="p-8 bg-muted/20 border-t border-border/10 shrink-0">
                  <PrimaryButton 
                    label="Aplicar Filtros"
                    className="w-full h-14"
                    onClick={() => {}} // Handle if needed
                  />
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {(searchTerm || statusFilter !== "all") && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
                className="text-xs font-bold uppercase tracking-widest text-primary"
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={paginatedData}
            isLoading={isLoading}
            totalCount={filteredData.length}
            pageCount={Math.max(1, Math.ceil(filteredData.length / pageSize))}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
            onRowClick={(project) => navigate(`/projects/${project.id}`)}
            onDeleteSelected={(rows) => {
              setProjectsToDelete(rows);
              setIsDeleteDialogOpen(true);
            }}
            emptyMessage={
              <EmptyState 
                title="No hay información actual"
                description="No se encontraron proyectos en la base de datos que coincidan con los filtros actuales. Comienza creando un nuevo proyecto."
                icon={Briefcase}
                action={{
                  label: "Crear nuevo proyecto",
                  icon: Plus,
                  onClick: () => navigate("/projects/new")
                }}
              />
            }
          />
        </>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="¿Eliminar Proyectos?"
        description={`¿Estás seguro de que deseas eliminar ${projectsToDelete.length} proyecto(s)? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
