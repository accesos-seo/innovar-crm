import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProject, useUpdateProject, useUpload3DFile } from "@/hooks/useProjects";
import { getProjectFileUrl, ALLOWED_FILE_EXTENSIONS } from "@/hooks/produccion/useProductionBoard";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Briefcase, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FileUp, 
  Download,
  ChevronRight,
  History,
  Layout,
  MessageSquare,
  User,
  DollarSign,
  ArrowRight,
  Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { ClientPortalCard } from "@/components/projects/ClientPortalCard";
import { LevantamientoTecnico } from "@/components/projects/LevantamientoTecnico";
import { FEATURES } from "@/lib/features";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProjectStatus } from "@/types/database";
import { formatDate, formatDateTime } from "@/lib/format-utils";

const statusTimeline: ProjectStatus[] = [
  'contacto',
  'medicion_tomada',
  'cotizacion_enviada',
  'cotizacion_aprobada',
  'en_diseno',
  'modelado_listo',
  'renders_listos',
  'aprobacion_cliente',
  'en_produccion',
  'instalacion_programada',
  'instalando',
  'entregado'
];

const statusLabels: Record<ProjectStatus, string> = {
  contacto: "Contacto",
  medicion_tomada: "Medición",
  cotizacion_enviada: "Cotización",
  cotizacion_aprobada: "Aprobado",
  en_diseno: "Diseño",
  modelado_listo: "Modelado",
  renders_listos: "Renders",
  aprobacion_cliente: "Aprob. Cliente",
  en_produccion: "Producción",
  instalacion_programada: "Instalación",
  instalando: "Instalando",
  entregado: "Entregado",
  garantia: "Garantía"
};

const statusVariants: Record<ProjectStatus, "success" | "info" | "warning" | "error" | "purple" | "primary"> = {
  contacto: "info",
  medicion_tomada: "info",
  cotizacion_enviada: "info",
  cotizacion_aprobada: "success",
  en_diseno: "warning",
  modelado_listo: "primary",
  renders_listos: "primary",
  aprobacion_cliente: "success",
  en_produccion: "warning",
  instalacion_programada: "purple",
  instalando: "purple",
  entregado: "success",
  garantia: "error"
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id || null);
  const updateProject = useUpdateProject();
  const upload3DFile = useUpload3DFile();

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <PremiumLoader text="Cargando detalles del proyecto..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Proyecto no encontrado</h2>
        <Button onClick={() => navigate("/projects")} className="mt-4">Volver a Proyectos</Button>
      </div>
    );
  }

  const currentStatusIndex = statusTimeline.indexOf(project.status);

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    try {
      await updateProject.mutateAsync({ id: project.id, status: newStatus });
      toast.success(`Estado actualizado a ${statusLabels[newStatus]}`);
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar estado");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      toast.error(`Extensión no permitida. Usa: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`);
      return;
    }

    const toastId = toast.loading("Subiendo archivo...");

    try {
      await upload3DFile.mutateAsync({
        projectId: project.id,
        file,
        fileName: file.name
      });
      toast.success("Archivo subido correctamente", { id: toastId });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      const isBucketError = error.message?.includes("bucket") || error.error === "Bucket not found";
      const message = isBucketError
        ? "El contenedor de archivos (Bucket) no está configurado en Supabase. Contacte a soporte."
        : error.message || "Error al subir archivo";
      toast.error(message, { id: toastId });
    }
  };

  const handleFileDownload = async (file: any) => {
    const url = await getProjectFileUrl(file);
    if (url) {
      window.open(url, "_blank", "noopener");
    } else {
      toast.error("No se pudo generar el enlace del archivo");
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 pb-20">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <button onClick={() => navigate("/projects")} className="hover:text-primary transition-colors">Proyectos</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">Detalle de Proyecto</span>
      </div>

      <CategoryHeader 
        title={project.name}
        subtitle={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-muted-foreground/60 transition-colors hover:text-primary cursor-default group">
              <Clock className="w-3.5 h-3.5 group-hover:animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Proyecto activo en sistema</span>
            </div>
          </div>
        }
        icon={Briefcase}
        status={{
          label: statusLabels[project.status],
          variant: statusVariants[project.status]
        }}
      />

      {/* Timeline de Estados */}
      <div className="bg-card p-8 border border-border/10 rounded-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-[1000px] relative">
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border/20 -translate-y-1/2 z-0" />
          <div 
            className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 z-0 transition-all duration-500" 
            style={{ width: `${(currentStatusIndex / (statusTimeline.length - 1)) * 100}%` }}
          />
          
          {statusTimeline.map((status, index) => {
            const isCompleted = index < currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            const isPending = index > currentStatusIndex;

            return (
              <div key={status} className="relative z-10 flex flex-col items-center gap-3">
                <button
                  onClick={() => handleStatusChange(status)}
                  disabled={isCompleted || isCurrent}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-background border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]",
                    isPending && "bg-background border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </button>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-tighter text-center max-w-[80px]",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {statusLabels[status]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Información General */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Layout className="w-4 h-4 text-primary" />
                Información del Proyecto
              </h3>
              <Button variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-widest h-8">
                Editar Datos
              </Button>
            </div>
            <div className="p-8 grid grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</p>
                  <p className="text-sm font-bold text-foreground">{(project as any).client?.name || "No asignado"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cotización Aprobada</p>
                  {project.approved_quotation_id ? (
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-sm font-bold text-primary"
                      onClick={() => navigate(`/quotations/${project.approved_quotation_id}`)}
                    >
                      Ver Cotización Vinculada <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin cotización</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo de Trabajo</p>
                  <Badge variant="outline" className="uppercase text-[10px] font-bold">{project.work_type}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Diseñador Asignado</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-bold text-foreground">{(project as any).designer?.full_name || "Pendiente"}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Monto Total</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <p className="text-lg font-black text-foreground">${(project.total_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anticipo</p>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-primary/60" />
                    <p className="text-sm font-bold text-primary">${(project.advance_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo Pendiente</p>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-destructive/60" />
                    <p className="text-sm font-bold text-destructive">${((project.total_amount || 0) - (project.advance_amount || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Levantamiento Técnico (medidas + fotos + notas de la visita) */}
          <LevantamientoTecnico projectId={project.id} />

          {/* Archivos 3D y Modelado */}
          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <FileUp className="w-4 h-4 text-primary" />
                Modelado 3D y Renders
              </h3>
              <div className="flex gap-2">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.skp,.dwg,.dxf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="default"
                  size="sm"
                  className="text-[10px] font-bold uppercase tracking-widest h-8"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Subir Nueva Versión
                </Button>
              </div>
            </div>
            <div className="p-8">
              {project.design_3d_files && project.design_3d_files.length > 0 ? (
                <div className="space-y-4">
                  {project.design_3d_files.map((file: any, idx: number) => (
                    <div key={file.path ?? file.url ?? idx} className="flex items-center justify-between p-4 bg-muted/30 border border-border/10 rounded-sm group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-sm flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{file.name ?? file.nombre}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                            Versión {file.version ?? idx + 1} • {formatDate(file.uploaded_at ?? file.subido_en)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFileDownload(file)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-border/10 rounded-sm bg-muted/5">
                  <p className="text-sm text-muted-foreground italic">No se han subido archivos de diseño aún.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Fechas y Logística */}
        <div className="space-y-8">
          {FEATURES.clientPortalEnabled && (
            <ClientPortalCard
              projectId={project.id}
              trackingToken={(project as any).tracking_token}
            />
          )}

          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Fechas Críticas
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-500/10 rounded-sm">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Límite de Diseño</p>
                  <DateDisplay date={project.design_deadline} className="text-sm font-bold text-foreground" />
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-orange-500/10 rounded-sm">
                  <Calendar className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Instalación Estimada</p>
                  <DateDisplay date={project.estimated_install_date} className="text-sm font-bold text-foreground" />
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-500/10 rounded-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fecha de Entrega</p>
                  <DateDisplay date={project.delivered_at} className="text-sm font-bold text-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Notas y Auditoría Rápida */}
          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Notas del Proyecto
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                {project.notes || "Sin notas adicionales para este proyecto."}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20">
              <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Auditoría
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground">Creado por:</span>
                <span className="text-foreground">{(project as any).created_by_user?.full_name || "Sistema"}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground">Fecha:</span>
                <DateDisplay date={project.created_at} showTime className="text-foreground" />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground">Origen:</span>
                <span className="text-foreground">{project.data_origin}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
