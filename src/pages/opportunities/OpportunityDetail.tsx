import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Zap, User, UserCheck, TrendingUp, History } from "lucide-react";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { useOpportunity } from "@/hooks/useOpportunity";
import { OpportunityStatusBadge } from "@/components/opportunities/OpportunityStatusBadge";
import { OpportunityTimeline } from "@/components/opportunities/OpportunityTimeline";
import { OpportunityActions } from "@/components/opportunities/OpportunityActions";
import { ReassignDialog } from "@/components/opportunities/ReassignDialog";
import {
  opportunityPriorityConfig,
  opportunityStatusConfig,
  type OpportunityPriority,
  type OpportunityStatus,
} from "@/schemas/opportunity";
import { useNavigate } from "react-router-dom";

interface OpportunityDetailProps {
  opportunityId: string | null;
  onClose: () => void;
}

export function OpportunityDetail({
  opportunityId,
  onClose,
}: OpportunityDetailProps) {
  const navigate = useNavigate();
  const { data: opp, isLoading } = useOpportunity(opportunityId);
  const [reassignOpen, setReassignOpen] = React.useState(false);

  const open = !!opportunityId;

  if (!open) return null;

  const status = (opp?.status || "new") as OpportunityStatus;
  const priority = (opp?.priority || "SHORT") as OpportunityPriority;
  const statusCfg = opportunityStatusConfig[status];
  const priorityCfg = opportunityPriorityConfig[priority];

  return (
    <>
      <DetailModal
        open={open}
        onOpenChange={(o: boolean) => !o && onClose()}
        title={opp?.client?.name || formatSentenceCase("Cargando...")}
        icon={Zap}
        subtitle={formatSentenceCase(
          `CRM > OPORTUNIDADES > ${opp?.client?.name || ""}`,
        )}
        status={{
          label: formatSentenceCase(statusCfg?.label || "Nuevo"),
          variant: statusCfg?.variant || "warning",
        }}
        onNavigate={navigate}
      >
        {isLoading || !opp ? (
          <div className="text-xs text-muted-foreground italic p-8">
            {formatSentenceCase("Cargando información de la oportunidad...")}
          </div>
        ) : (
          <div className="flex flex-col space-y-12">
            {/* Acciones rápidas */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Acciones")}
                </h3>
              </div>
              <OpportunityActions
                opportunityId={opp.id}
                currentStatus={status}
                clientId={opp.client?.id || null}
                onReassign={() => setReassignOpen(true)}
              />
            </div>

            <div className="h-[1px] w-full bg-border/10" />

            {/* Datos del cliente */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Datos del cliente")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <Field
                  label={formatSentenceCase("WhatsApp")}
                  value={opp.client?.whatsapp_phone || "—"}
                />
                <Field
                  label={formatSentenceCase("Email")}
                  value={opp.client?.email || "—"}
                />
                <div className="col-span-2">
                  <Field
                    label={formatSentenceCase("Dirección de la visita")}
                    value={opp.address || opp.client?.address || "—"}
                  />
                </div>
              </div>
            </div>

            <div className="h-[1px] w-full bg-border/10" />

            {/* Información del proyecto */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Información del proyecto")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <Field
                  label={formatSentenceCase("Servicios")}
                  value={
                    Array.isArray(opp.services)
                      ? opp.services.join(", ")
                      : opp.services || "—"
                  }
                />
                <Field
                  label={formatSentenceCase("Ciudad / zona")}
                  value={opp.city || "—"}
                />
                <Field
                  label={formatSentenceCase("Prioridad")}
                  display={
                    <OpportunityStatusBadge
                      status={status}
                      animate={priority === "ASAP" ? "pulse" : "scale"}
                    />
                  }
                />
                <Field
                  label={formatSentenceCase("Urgencia")}
                  value={priorityCfg?.label || priority}
                />
                <Field
                  label={formatSentenceCase("Origen del lead")}
                  value={formatSentenceCase(opp.data_origin)}
                />
                <Field
                  label={formatSentenceCase("Última actividad")}
                  display={
                    <DateDisplay
                      date={opp.last_activity_at}
                      showTime
                      className="text-sm font-bold"
                    />
                  }
                />
              </div>
              {opp.notes && (
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {formatSentenceCase("Notas internas")}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {opp.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="h-[1px] w-full bg-border/10" />

            {/* Asignación */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <UserCheck className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Asignación comercial")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <Field
                  label={formatSentenceCase("Responsable actual")}
                  value={
                    opp.assigned_user?.full_name ||
                    opp.assigned_user?.email ||
                    formatSentenceCase("Sin asignar")
                  }
                />
                <Field
                  label={formatSentenceCase("Token público")}
                  value={opp.public_token}
                />
              </div>
            </div>

            <div className="h-[1px] w-full bg-border/10" />

            {/* Timeline de reasignaciones */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <History className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Historial de reasignaciones")}
                </h3>
              </div>
              <OpportunityTimeline history={opp.history || []} />
            </div>

            <div className="h-[1px] w-full bg-border/10" />

            {/* Metadatos */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-12 bg-muted/5 p-8 border border-border/10">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {formatSentenceCase("Creado")}
                </p>
                <DateDisplay
                  date={opp.created_at}
                  showTime
                  className="text-sm font-bold"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {formatSentenceCase("Actualizado")}
                </p>
                <DateDisplay
                  date={opp.updated_at}
                  showTime
                  className="text-sm font-bold"
                />
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      {opp && (
        <ReassignDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          opportunityId={opp.id}
          currentAssigneeId={opp.assigned_to}
        />
      )}
    </>
  );
}

function Field({
  label,
  value,
  display,
}: {
  label: string;
  value?: string;
  display?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      {display ?? (
        <p className="text-sm font-bold text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}
