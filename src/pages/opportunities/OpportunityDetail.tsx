import * as React from "react";
import {
  DetailModal,
  InlineEditField,
  InlineEditPhoneField,
  InlineEditSelectField,
  InlineEditMultiSelectField,
} from "@/components/shared/DetailModal";
import { Zap, User, UserCheck, TrendingUp, History } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { useOpportunity } from "@/hooks/useOpportunity";
import { useUpdateOpportunity } from "@/hooks/useOpportunities";
import { useUpdateClient } from "@/hooks/useClients";
import { OpportunityTimeline } from "@/components/opportunities/OpportunityTimeline";
import { OpportunityActions } from "@/components/opportunities/OpportunityActions";
import { ReassignDialog } from "@/components/opportunities/ReassignDialog";
import {
  OPPORTUNITY_PRIORITIES,
  opportunityDataOriginLabels,
  opportunityPriorityConfig,
  opportunityStatusConfig,
  type OpportunityDataOrigin,
  type OpportunityPriority,
  type OpportunityStatus,
} from "@/schemas/opportunity";
import {
  VISIT_SERVICE_LABELS,
  VISIT_SERVICE_KEYS,
  type VisitServiceKey,
} from "@/lib/schemas/visit-measurements";
import { useNavigate } from "react-router-dom";

interface OpportunityDetailProps {
  opportunityId: string | null;
  onClose: () => void;
}

const SERVICE_LABEL_LIST: string[] = VISIT_SERVICE_KEYS.map(
  (k) => VISIT_SERVICE_LABELS[k],
);
const SERVICE_LABEL_TO_KEY: Record<string, VisitServiceKey> = Object.fromEntries(
  VISIT_SERVICE_KEYS.map((k) => [VISIT_SERVICE_LABELS[k], k]),
) as Record<string, VisitServiceKey>;

const PRIORITY_OPTIONS = OPPORTUNITY_PRIORITIES.map((p) => ({
  value: p,
  label: opportunityPriorityConfig[p].label,
}));

// Ciudades canónicas — mismo set que usa el formulario de creación de leads
// (ver LeadCreate.tsx). "Otra ciudad" se maneja con allowCustom.
const CITY_OPTIONS = [
  { value: "Pereira", label: "Pereira" },
  { value: "La Virginia", label: "La Virginia" },
  { value: "Dosquebradas", label: "Dosquebradas" },
  { value: "Cuba", label: "Cuba" },
  { value: "Santa Rosa", label: "Santa Rosa" },
];

export function OpportunityDetail({
  opportunityId,
  onClose,
}: OpportunityDetailProps) {
  const navigate = useNavigate();
  const { data: opp, isLoading } = useOpportunity(opportunityId);
  const updateOpportunity = useUpdateOpportunity();
  const updateClient = useUpdateClient();
  const [reassignOpen, setReassignOpen] = React.useState(false);

  const open = !!opportunityId;

  if (!open) return null;

  const status = (opp?.status || "new") as OpportunityStatus;
  const statusCfg = opportunityStatusConfig[status];

  const servicesAsLabels: string[] = Array.isArray(opp?.services)
    ? (opp.services as string[]).map(
        (k) => VISIT_SERVICE_LABELS[k as VisitServiceKey] ?? k,
      )
    : [];

  const originLabel = opp?.data_origin
    ? opportunityDataOriginLabels[opp.data_origin as OpportunityDataOrigin] ??
      opp.data_origin
    : "";

  const clientId = opp?.client?.id ?? null;
  const oppId = opp?.id ?? null;

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

            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {/* Datos del cliente */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Datos del cliente")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <InlineEditPhoneField
                  label="WhatsApp"
                  value={opp.client?.whatsapp_phone ?? ""}
                  editable={!!clientId}
                  onSave={async (newValue) => {
                    if (!clientId) return;
                    await updateClient.mutateAsync({
                      id: clientId,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      updates: { whatsapp_phone: newValue || null } as any,
                    });
                  }}
                />
                <InlineEditField
                  label="Email"
                  type="email"
                  value={opp.client?.email ?? ""}
                  editable={!!clientId}
                  emptyLabel="Sin email registrado"
                  onSave={async (newValue) => {
                    if (!clientId) return;
                    await updateClient.mutateAsync({
                      id: clientId,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      updates: { email: newValue || null } as any,
                    });
                  }}
                />
                <div className="col-span-2">
                  <InlineEditField
                    label="Dirección de la visita"
                    value={opp.address ?? opp.client?.address ?? ""}
                    editable={!!oppId}
                    emptyLabel="Dirección no registrada"
                    onSave={async (newValue) => {
                      if (!oppId) return;
                      await updateOpportunity.mutateAsync({
                        id: oppId,
                        updates: { address: newValue || null },
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {/* Información del proyecto */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Información del proyecto")}
                </h3>
              </div>
              <div className="space-y-8">
                <InlineEditMultiSelectField
                  label="Servicios"
                  value={servicesAsLabels}
                  options={SERVICE_LABEL_LIST}
                  variant="cards"
                  editable={!!oppId}
                  emptyLabel="Sin servicios definidos"
                  onSave={async (csv) => {
                    if (!oppId) return;
                    const labels = csv
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const keys = labels.map(
                      (l) => SERVICE_LABEL_TO_KEY[l] ?? l,
                    );
                    await updateOpportunity.mutateAsync({
                      id: oppId,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      updates: { services: keys as any },
                    });
                  }}
                />

                <InlineEditSelectField
                  label="Ciudad / zona"
                  value={opp.city ?? ""}
                  options={CITY_OPTIONS}
                  variant="cards"
                  allowCustom={{
                    customLabel: "Otra ciudad",
                    placeholder: "Especifica la ciudad...",
                  }}
                  editable={!!oppId}
                  emptyLabel="Sin ciudad registrada"
                  onSave={async (newValue) => {
                    if (!oppId) return;
                    await updateOpportunity.mutateAsync({
                      id: oppId,
                      updates: { city: newValue || null },
                    });
                  }}
                />

                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                  <InlineEditSelectField
                    label="Urgencia"
                    value={opp.priority ?? "SHORT"}
                    options={PRIORITY_OPTIONS}
                    variant="cards"
                    editable={!!oppId}
                    emptyLabel="Sin definir"
                    displayValue={
                      <StatusBadge
                        variant={
                          opportunityPriorityConfig[
                            (opp.priority ?? "SHORT") as OpportunityPriority
                          ].variant
                        }
                        dot
                        animate={opp.priority === "ASAP" ? "pulse" : "scale"}
                      >
                        {
                          opportunityPriorityConfig[
                            (opp.priority ?? "SHORT") as OpportunityPriority
                          ].label
                        }
                      </StatusBadge>
                    }
                    onSave={async (newValue) => {
                      if (!oppId) return;
                      await updateOpportunity.mutateAsync({
                        id: oppId,
                        updates: {
                          priority: newValue as OpportunityPriority,
                        },
                      });
                    }}
                  />
                  <ReadonlyField
                    label="Origen del lead"
                    value={originLabel}
                    emptyLabel="Origen no registrado"
                  />
                </div>

                <ReadonlyField
                  label="Última actividad"
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

            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {/* Asignación */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <UserCheck className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">
                  {formatSentenceCase("Asignación comercial")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <ReadonlyField
                  label="Responsable actual"
                  value={
                    opp.assigned_user?.full_name ||
                    opp.assigned_user?.email ||
                    ""
                  }
                  emptyLabel="Sin asignar"
                />
                <ReadonlyField
                  label="Token público"
                  value={opp.public_token ?? ""}
                  emptyLabel="Sin token"
                />
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

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

            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

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

function ReadonlyField({
  label,
  value,
  display,
  emptyLabel,
}: {
  label: string;
  value?: string | null;
  display?: React.ReactNode;
  emptyLabel?: string;
}) {
  const hasValue =
    value !== null && value !== undefined && String(value).trim() !== "";
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {formatSentenceCase(label)}
      </p>
      {display ??
        (hasValue ? (
          <p className="text-sm font-bold text-foreground">{value}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground/60">
            {emptyLabel ?? "—"}
          </p>
        ))}
    </div>
  );
}
