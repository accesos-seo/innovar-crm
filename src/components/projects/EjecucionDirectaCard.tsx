import React from "react";
import { Hammer, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-utils";
import {
  useRequestSkipDesign,
  useResolveSkipDesign,
  SKIP_DESIGN_CATEGORY_LABELS,
  type SkipDesignCategory,
} from "@/hooks/useSkipDesign";

interface SkipProject {
  id: string;
  name?: string | null;
  status?: string | null;
  total_amount?: number | null;
  skip_design_process?: boolean | null;
  skip_design_status?: string | null;
  direct_execution_category?: string | null;
  skip_design_justification?: string | null;
  skip_design_approved_at?: string | null;
}

const REQUESTER_ROLES = ["comercial", "admin", "super_admin", "gerente", "administradora"];
const ADMIN_ROLES = ["admin", "super_admin"];
const TERMINAL = ["en_produccion", "listo_instalacion", "entregado", "completado"];
const CATEGORIES = Object.keys(SKIP_DESIGN_CATEGORY_LABELS) as SkipDesignCategory[];

export function EjecucionDirectaCard({ project }: { project: SkipProject }) {
  const role = useAuthStore((s) => s.profile)?.role ?? "";
  const request = useRequestSkipDesign();
  const resolve = useResolveSkipDesign();

  const [formOpen, setFormOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SkipDesignCategory | "">("");
  const [justification, setJustification] = React.useState("");
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  const isAdmin = ADMIN_ROLES.includes(role);
  const canRequest = REQUESTER_ROLES.includes(role);
  const isSkipped = project.skip_design_process === true;
  const isPending = project.skip_design_status === "pending";
  const isRejected = project.skip_design_status === "rejected";
  const tooLate = TERMINAL.includes(project.status ?? "");

  // No mostrar la tarjeta si no hay nada que ver ni hacer para este rol.
  if (!isSkipped && !isPending && !isRejected && !(canRequest && !tooLate)) {
    return null;
  }

  const catLabel = project.direct_execution_category
    ? SKIP_DESIGN_CATEGORY_LABELS[project.direct_execution_category as SkipDesignCategory] ??
      project.direct_execution_category
    : null;

  const submitRequest = async () => {
    if (!category) {
      toast.error("Elegí una categoría de ejecución directa.");
      return;
    }
    try {
      const res = await request.mutateAsync({ projectId: project.id, category, justification });
      setFormOpen(false);
      setCategory("");
      setJustification("");
      if ((res as any)?.mode === "pending") {
        toast.success("Solicitud enviada: un administrador la revisará.");
      } else {
        toast.success("Proyecto marcado como ejecución directa (sin diseño).");
      }
    } catch {
      /* onError del hook ya muestra el aviso de error */
    }
  };

  const doResolve = async (approve: boolean) => {
    try {
      await resolve.mutateAsync({
        projectId: project.id,
        approve,
        reason: approve ? undefined : rejectReason,
      });
      setRejectOpen(false);
      setRejectReason("");
      toast.success(approve ? "Omisión de diseño aprobada." : "Solicitud rechazada.");
    } catch {
      /* onError del hook ya muestra el aviso de error */
    }
  };

  const inputCls =
    "flex h-12 w-full rounded-none border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
      <div className="p-6 border-b border-border/10 bg-muted/20 flex items-center gap-2">
        <Hammer className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest">Ejecución Directa</h3>
      </div>

      <div className="p-8 space-y-5">
        {/* Estado: ya es ejecución directa */}
        {isSkipped && (
          <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">Sin diseño — va directo a taller</p>
                {catLabel && (
                  <Badge variant="outline" className="uppercase text-[10px] font-bold">
                    {catLabel}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                No genera modelado, renders ni aprobación de diseño. El jefe de taller es la
                autoridad técnica de ejecución.
              </p>
              {project.skip_design_approved_at && (
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
                  Aprobado {formatDateTime(project.skip_design_approved_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Estado: pendiente de aprobación de admin */}
        {isPending && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-sm">
              <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  Omisión de diseño pendiente de aprobación
                </p>
                {catLabel && (
                  <p className="text-xs text-muted-foreground">
                    Categoría solicitada: <span className="font-bold">{catLabel}</span>
                  </p>
                )}
                {project.skip_design_justification && (
                  <p className="text-xs text-muted-foreground italic">
                    “{project.skip_design_justification}”
                  </p>
                )}
                {!isAdmin && (
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
                    Esperando que un administrador apruebe
                  </p>
                )}
              </div>
            </div>

            {isAdmin && !rejectOpen && (
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => doResolve(true)}
                  disabled={resolve.isPending}
                  className="h-11 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs tracking-widest"
                >
                  Aprobar omisión
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={resolve.isPending}
                  className="h-11 rounded-none font-bold uppercase text-xs tracking-widest"
                >
                  Rechazar
                </Button>
              </div>
            )}

            {isAdmin && rejectOpen && (
              <div className="space-y-3 p-4 border border-border/30 rounded-sm bg-muted/10">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Motivo del rechazo (opcional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Ej: este proyecto sí requiere diseño por…"
                  className={cn(inputCls, "h-auto")}
                />
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => doResolve(false)}
                    disabled={resolve.isPending}
                    className="h-10 rounded-none font-bold uppercase text-xs tracking-widest"
                  >
                    Confirmar rechazo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRejectOpen(false)}
                    className="h-10 rounded-none font-bold uppercase text-xs tracking-widest"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado: rechazada */}
        {isRejected && (
          <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-sm">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Solicitud de omisión rechazada — sigue el flujo de diseño
              </p>
              {project.skip_design_justification && (
                <p className="text-xs text-muted-foreground italic">
                  {project.skip_design_justification}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Acción: marcar como ejecución directa (proyecto normal o re-solicitar tras rechazo) */}
        {canRequest && !tooLate && !isSkipped && !isPending && (
          <div className="space-y-4">
            {!formOpen ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(true)}
                className="h-12 rounded-none font-bold uppercase text-xs tracking-widest"
              >
                <Hammer className="w-4 h-4 mr-2" />
                Marcar como ejecución directa (sin diseño)
              </Button>
            ) : (
              <div className="space-y-4 p-4 border border-border/30 rounded-sm bg-muted/10">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SkipDesignCategory)}
                    className={inputCls}
                  >
                    <option value="">Elegí una categoría…</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {SKIP_DESIGN_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Justificación (opcional)
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    rows={2}
                    placeholder="Detalle breve del trabajo a ejecutar…"
                    className={cn(inputCls, "h-auto")}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/70">
                  Sobre el umbral configurado, un administrador debe aprobar antes de aplicar.
                </p>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={submitRequest}
                    disabled={request.isPending}
                    className="h-11 rounded-none font-bold uppercase text-xs tracking-widest"
                  >
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setFormOpen(false)}
                    className="h-11 rounded-none font-bold uppercase text-xs tracking-widest"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
