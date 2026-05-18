import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuotation, useUpdateQuotation, useApproveQuotation } from "@/hooks/useQuotations";
import { useProjects } from "@/hooks/useProjects";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  FileText, 
  ChevronRight,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  DollarSign,
  Hash,
  Landmark
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QuotationStatus } from "@/types/database";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { formatDate, formatDateTime } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";

const statusMap: Record<QuotationStatus, { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "primary" }> = {
  draft: { label: "Borrador", variant: "info" },
  sent: { label: "Enviada", variant: "primary" },
  viewed: { label: "Vista por Cliente", variant: "purple" },
  negotiation: { label: "En Negociación", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "error" },
  expired: { label: "Vencida", variant: "error" },
  replaced: { label: "Reemplazada", variant: "info" },
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quotation, isLoading } = useQuotation(id || null);
  const { data: linkedProjects } = useProjects(quotation?.id ? { approved_quotation_id: quotation.id } : undefined);
  const upToDateProject = linkedProjects?.[0];
  
  const updateQuotation = useUpdateQuotation();
  const approveQuotation = useApproveQuotation();

  const [isApproveDialogOpen, setIsApproveDialogOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <PremiumLoader text="Cargando detalles de la cotización..." />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Cotización no encontrada</h2>
        <Button onClick={() => navigate("/quotations")} className="mt-4">Volver a Cotizaciones</Button>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: QuotationStatus) => {
    try {
      await updateQuotation.mutateAsync({ id: quotation.id, status: newStatus });
      toast.success(`Estado actualizado a ${statusMap[newStatus].label}`);
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar estado");
    }
  };

  const handleApprove = async () => {
    try {
      const result = await approveQuotation.mutateAsync({
        quotation_id: quotation.id,
        project_name: `Proyecto - ${(quotation as any).client?.name || 'Cliente'}`,
      });
      toast.success("Cotización aprobada y proyecto creado");
      setIsApproveDialogOpen(false);
      navigate(`/projects/${result.project.id}`);
    } catch (error: any) {
      toast.error(error.message || "Error al aprobar la cotización");
    }
  };

  const statusConfig = statusMap[quotation.status];

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 pb-32">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <button onClick={() => navigate("/quotations")} className="hover:text-primary transition-colors">Cotizaciones</button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground flex items-center gap-2">
          <Hash className="w-3 h-3 text-primary" />
          {quotation.id.split('-')[0].toUpperCase()}
        </span>
      </div>

      <CategoryHeader 
        title={`Cotización ${quotation.id.split('-')[0].toUpperCase()}`}
        subtitle={`Versión ${quotation.version_number} | Cliente: ${(quotation as any).client?.name || 'Desconocido'}`}
        icon={FileText}
        status={{
          label: statusConfig.label,
          variant: statusConfig.variant
        }}
      />

      {/* Acciones Rápidas */}
      <div className="flex flex-wrap gap-4 bg-card p-4 border border-border/10 rounded-sm">
        {quotation.status !== 'approved' && quotation.status !== 'rejected' && (
          <>
            <Button 
              variant="outline" 
              onClick={() => handleStatusChange('sent')}
              disabled={quotation.status === 'sent'}
              className="text-xs font-bold uppercase tracking-widest"
            >
              Marcar como Enviada
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleStatusChange('negotiation')}
              disabled={quotation.status === 'negotiation'}
              className="text-xs font-bold uppercase tracking-widest"
            >
              En Negociación
            </Button>
            <div className="flex-1" />
            <Button 
              variant="destructive" 
              onClick={() => handleStatusChange('rejected')}
              className="text-xs font-bold uppercase tracking-widest"
            >
              <XCircle className="w-4 h-4 mr-2" /> Rechazar
            </Button>
            <Button 
              onClick={() => setIsApproveDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Aprobar y Crear Proyecto
            </Button>
          </>
        )}
        {quotation.status === 'approved' && upToDateProject && (
          <Button 
            onClick={() => navigate(`/projects/${upToDateProject.id}`)}
            className="w-full sm:w-auto bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest"
          >
            Ver Proyecto Vinculado <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Detalle de Ítems */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20">
              <h3 className="text-sm font-bold uppercase tracking-widest">Líneas de Presupuesto</h3>
            </div>
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/10 border-b border-border/10">
                  <tr>
                    <th className="px-6 py-4">Descripción</th>
                    <th className="px-6 py-4 text-center">Cant.</th>
                    <th className="px-6 py-4 text-right">P. Unitario</th>
                    <th className="px-6 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(quotation as any).items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-border/5 hover:bg-muted/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{item.product_category}</p>
                      </td>
                      <td className="px-6 py-4 text-center">{item.quantity}</td>
                      <td className="px-6 py-4 text-right">${Number(item.unit_price).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold">${Number(item.calculated_total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-muted/10 border-t border-border/10 flex flex-col items-end space-y-2">
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${(quotation.subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-muted-foreground">Transporte:</span>
                <span className="font-medium">${(quotation.transport_cost || 0).toLocaleString()}</span>
              </div>
              {quotation.discount_value && quotation.discount_value > 0 && (
                <div className="flex justify-between w-full max-w-xs text-sm text-destructive">
                  <span>Descuento ({quotation.discount_type === 'percent' ? `${quotation.discount_value}%` : `$${quotation.discount_value}`}):</span>
                  <span>-${((quotation.discount_type === 'percent' ? (quotation.subtotal || 0) * (quotation.discount_value / 100) : quotation.discount_value) || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between w-full max-w-xs text-lg font-black pt-4 border-t border-border/10 items-center">
                <span>Total:</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span className="text-primary">${(quotation.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Condiciones y Metadatos */}
        <div className="space-y-8">
          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20">
              <h3 className="text-sm font-bold uppercase tracking-widest">Condiciones Comerciales</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vencimiento</p>
                <DateDisplay date={quotation.valid_until} className="text-sm font-bold" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            <div className="p-6 border-b border-border/10 bg-muted/20">
              <h3 className="text-sm font-bold uppercase tracking-widest">Auditoría</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground">Creado por:</span>
                <span className="text-foreground">{(quotation as any).created_by_user?.full_name || "Sistema"}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3 text-primary" /> Creación:</span>
                <DateDisplay date={quotation.created_at} showTime className="text-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isApproveDialogOpen}
        onClose={() => setIsApproveDialogOpen(false)}
        onConfirm={handleApprove}
        title="Aprobar Cotización"
        description={`¿Estás seguro de que deseas aprobar la cotización ${quotation.id.split('-')[0].toUpperCase()}? Esto creará automáticamente un nuevo proyecto en ejecución.`}
        confirmText="Aprobar y Crear Proyecto"
        cancelText="Cancelar"
      />
    </div>
  );
}
