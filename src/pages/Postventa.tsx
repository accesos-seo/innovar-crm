// Módulo Postventa y Garantías (PRD-postventa-garantias.md, migración 055).
// Tres pestañas — Garantías / Reclamos / Encuestas — sobre tablas existentes
// de prod + métricas de v_postventa_metrics.
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Star,
  Wrench,
  MessageSquareHeart,
  Plus,
  Copy,
  Send,
  ThumbsUp,
  CalendarClock,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { StatusSubnav, StatusOption } from "@/components/shared/StatusSubnav";
import { DataTable } from "@/components/shared/DataTable";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "@/components/ui/PremiumToast";
import { formatDate, formatSentenceCase } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import {
  useWarranties,
  useWarrantyClaims,
  useSurveys,
  usePostventaMetrics,
  useCreateClaim,
  useUpdateClaim,
  useVoidWarranty,
  useSendSurveyNow,
  useClaimPhotoUrls,
  useAssignableProfiles,
  type Warranty,
  type WarrantyClaim,
  type SatisfactionSurvey,
  type ClaimSeverity,
  type ClaimStatus,
} from "@/hooks/usePostventa";

// ── Labels y estilos por estado ──────────────────────────────────────────────

const WARRANTY_LABELS: Record<string, { label: string; className: string }> = {
  active:  { label: "Activa",      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  expired: { label: "Vencida",     className: "bg-red-500/10 text-red-400 border-red-500/30" },
  claimed: { label: "Con reclamo", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  voided:  { label: "Anulada",     className: "bg-muted text-muted-foreground border-border/40" },
};

const SEVERITY_LABELS: Record<string, { label: string; className: string }> = {
  low:      { label: "Baja",    className: "bg-muted text-muted-foreground border-border/40" },
  medium:   { label: "Media",   className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  high:     { label: "Alta",    className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  critical: { label: "Crítica", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const CLAIM_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open:        { label: "Abierto",    className: "bg-red-500/10 text-red-400 border-red-500/30" },
  in_progress: { label: "En proceso", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  resolved:    { label: "Resuelto",   className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  rejected:    { label: "Rechazado",  className: "bg-muted text-muted-foreground border-border/40" },
};

const SURVEY_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pendiente",  className: "bg-muted text-muted-foreground border-border/40" },
  sent:      { label: "Enviada",    className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  responded: { label: "Respondida", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  expired:   { label: "Expirada",   className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

function StatusPill({ map, value }: { map: Record<string, { label: string; className: string }>; value: string }) {
  const meta = map[value] ?? { label: value, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("rounded-full text-[10px] font-bold", meta.className)}>
      {meta.label}
    </Badge>
  );
}

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i <= value ? "text-amber-400 fill-amber-400" : "text-border"
          )}
        />
      ))}
    </span>
  );
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function daysOpen(claim: WarrantyClaim): number {
  const end = claim.resolved_at ? new Date(claim.resolved_at).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(claim.reported_at).getTime()) / 86400000));
}

function usePagination() {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  return { pageIndex, setPageIndex, pageSize, setPageSize };
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function PostventaPage() {
  const navigate = useNavigate();
  const { data: metrics } = usePostventaMetrics();

  const metricCards = React.useMemo<MetricData[]>(() => [
    {
      title: "Garantías activas",
      value: metrics?.warranties_active ?? 0,
      description: "Con cobertura vigente",
      icon: ShieldCheck,
      trend: "neutral",
      color: "green",
    },
    {
      title: "Vencen en 60 días",
      value: metrics?.warranties_expiring_60d ?? 0,
      description: "Oportunidad de mantenimiento",
      icon: CalendarClock,
      trend: "neutral",
      color: "yellow",
    },
    {
      title: "Reclamos abiertos",
      value: (metrics?.claims_open ?? 0) + (metrics?.claims_in_progress ?? 0),
      description: metrics?.claims_avg_resolution_days != null
        ? `Resolución media ${metrics.claims_avg_resolution_days} días`
        : "Sin resueltos en 90 días",
      icon: Wrench,
      trend: "neutral",
      color: "blue",
    },
    {
      title: "Satisfacción promedio",
      value: metrics?.rating_overall_avg != null ? `${metrics.rating_overall_avg} ★` : "—",
      description: `${metrics?.surveys_responded ?? 0} encuestas respondidas`,
      icon: Star,
      trend: "up",
      color: "purple",
    },
    {
      title: "Recomendarían",
      value: metrics?.would_recommend_pct != null ? `${metrics.would_recommend_pct}%` : "—",
      description: "De los que respondieron",
      icon: ThumbsUp,
      trend: "up",
      color: "green",
    },
  ], [metrics]);

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader
        title={formatSentenceCase("Postventa y garantías")}
        subtitle={formatSentenceCase("Garantías, reclamos y satisfacción del cliente después de la entrega.")}
        icon={ShieldCheck}
        onBack={() => navigate("/")}
      />

      <MetricsGrid metrics={metricCards} />

      <Tabs defaultValue="garantias" className="space-y-6">
        <TabsList className="rounded-none h-12 bg-card/50 border border-border/10 p-1">
          <TabsTrigger value="garantias" className="rounded-none h-10 px-6 text-xs font-bold">
            Garantías
          </TabsTrigger>
          <TabsTrigger value="reclamos" className="rounded-none h-10 px-6 text-xs font-bold">
            Reclamos
          </TabsTrigger>
          <TabsTrigger value="encuestas" className="rounded-none h-10 px-6 text-xs font-bold">
            Encuestas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="garantias"><WarrantiesTab /></TabsContent>
        <TabsContent value="reclamos"><ClaimsTab /></TabsContent>
        <TabsContent value="encuestas"><SurveysTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tab Garantías ────────────────────────────────────────────────────────────

function WarrantiesTab() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const { pageIndex, setPageIndex, pageSize, setPageSize } = usePagination();
  const { data: allRaw, isLoading } = useWarranties(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const all = allRaw ?? [];
  const [selected, setSelected] = React.useState<Warranty | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const voidWarranty = useVoidWarranty();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = ["admin", "super_admin"].includes(profile?.role ?? "");

  const { data: allForCounts } = useWarranties();
  const statusOptions: StatusOption[] = React.useMemo(() => {
    const base = allForCounts ?? [];
    return [
      { value: "all", label: "Todas", count: base.length, icon: ShieldCheck },
      ...Object.entries(WARRANTY_LABELS).map(([key, v]) => ({
        value: key,
        label: v.label,
        count: base.filter((w) => w.status === key).length,
      })),
    ];
  }, [allForCounts]);

  const columns = React.useMemo<ColumnDef<Warranty>[]>(() => [
    {
      header: "Proyecto",
      accessorKey: "project",
      cell: ({ row }) => (
        <span className="font-semibold text-foreground">{row.original.project?.name ?? "—"}</span>
      ),
    },
    {
      header: "Cliente",
      accessorKey: "client",
      cell: ({ row }) => <span>{row.original.client?.name ?? "—"}</span>,
    },
    {
      header: "Inicio",
      accessorKey: "starts_at",
      cell: ({ row }) => <span>{formatDate(row.original.starts_at)}</span>,
    },
    {
      header: "Vence",
      accessorKey: "expires_at",
      cell: ({ row }) => {
        const days = daysUntil(row.original.expires_at);
        const isActive = row.original.status === "active";
        return (
          <span
            className={cn(
              "font-medium",
              isActive && days < 0 && "text-red-400",
              isActive && days >= 0 && days <= 60 && "text-amber-500"
            )}
          >
            {formatDate(row.original.expires_at)}
            {isActive && days >= 0 && days <= 60 && (
              <span className="block text-[10px] text-amber-500/80">en {days} días</span>
            )}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => <StatusPill map={WARRANTY_LABELS} value={row.original.status} />,
    },
    {
      header: "Reclamos",
      accessorKey: "claims",
      cell: ({ row }) => <span className="font-bold">{row.original.claims?.length ?? 0}</span>,
    },
  ], []);

  const paginated = all.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className="space-y-6">
      <StatusSubnav options={statusOptions} activeValue={statusFilter} onSelect={(v) => { setStatusFilter(v); setPageIndex(0); }} />
      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        totalCount={all.length}
        pageCount={Math.max(1, Math.ceil(all.length / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={(w) => { setSelected(w); setVoidReason(""); }}
        emptyMessage="Sin garantías. Se crean automáticamente al entregar un proyecto."
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="bg-card border-l-border/10 w-[90vw] sm:w-[450px] sm:max-w-none p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="px-8 pt-8 pb-6 shrink-0">
                <SheetTitle className="text-xl font-bold tracking-tight">
                  {selected.project?.name ?? "Garantía"}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Garantía de {selected.warranty_months} meses · {selected.client?.name ?? "—"}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 scrollbar-thin">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoBlock label="Inicio" value={formatDate(selected.starts_at) ?? "—"} />
                  <InfoBlock label="Vence" value={formatDate(selected.expires_at) ?? "—"} />
                  <InfoBlock label="Estado" value={<StatusPill map={WARRANTY_LABELS} value={selected.status} />} />
                  <InfoBlock label="Reclamos" value={String(selected.claims?.length ?? 0)} />
                </div>
                {selected.notes && (
                  <InfoBlock label="Notas" value={selected.notes} />
                )}
                {isAdmin && selected.status !== "voided" && (
                  <div className="space-y-3 pt-4 border-t border-border/10">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Anular garantía (solo admin)
                    </label>
                    <Textarea
                      placeholder="Motivo de la anulación…"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className="rounded-none border-border/50 min-h-20"
                    />
                    <Button
                      variant="destructive"
                      className="h-12 rounded-none w-full font-bold text-xs"
                      disabled={!voidReason.trim() || voidWarranty.isPending}
                      onClick={async () => {
                        await voidWarranty.mutateAsync({ id: selected.id, reason: voidReason });
                        notify.success("Garantía anulada", "La garantía quedó anulada con su motivo.");
                        setSelected(null);
                      }}
                    >
                      Anular garantía
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

// ── Tab Reclamos ─────────────────────────────────────────────────────────────

function ClaimsTab() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const { pageIndex, setPageIndex, pageSize, setPageSize } = usePagination();
  const { data: allRaw, isLoading } = useWarrantyClaims(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const all = allRaw ?? [];
  const [selected, setSelected] = React.useState<WarrantyClaim | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: allForCounts } = useWarrantyClaims();
  const statusOptions: StatusOption[] = React.useMemo(() => {
    const base = allForCounts ?? [];
    return [
      { value: "all", label: "Todos", count: base.length, icon: Wrench },
      ...Object.entries(CLAIM_STATUS_LABELS).map(([key, v]) => ({
        value: key,
        label: v.label,
        count: base.filter((c) => c.status === key).length,
      })),
    ];
  }, [allForCounts]);

  const columns = React.useMemo<ColumnDef<WarrantyClaim>[]>(() => [
    {
      header: "Reclamo",
      accessorKey: "claim_number",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-foreground">{row.original.claim_number ?? "—"}</span>
      ),
    },
    {
      header: "Proyecto / Cliente",
      accessorKey: "warranty",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-foreground">{row.original.warranty?.project?.name ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.warranty?.client?.name ?? ""}</p>
        </div>
      ),
    },
    {
      header: "Severidad",
      accessorKey: "severity",
      cell: ({ row }) => <StatusPill map={SEVERITY_LABELS} value={row.original.severity} />,
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => <StatusPill map={CLAIM_STATUS_LABELS} value={row.original.status} />,
    },
    {
      header: "Asignado",
      accessorKey: "assignee",
      cell: ({ row }) => <span>{row.original.assignee?.full_name ?? "Sin asignar"}</span>,
    },
    {
      header: "Días abierto",
      accessorKey: "reported_at",
      cell: ({ row }) => {
        const days = daysOpen(row.original);
        const open = row.original.status === "open" || row.original.status === "in_progress";
        return (
          <span className={cn("font-bold", open && days > 5 && "text-amber-500")}>
            {days}
          </span>
        );
      },
    },
  ], []);

  const paginated = all.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <StatusSubnav options={statusOptions} activeValue={statusFilter} onSelect={(v) => { setStatusFilter(v); setPageIndex(0); }} className="flex-1" />
        <PrimaryButton
          label="Nuevo reclamo"
          icon={Plus}
          onClick={() => setCreateOpen(true)}
        />
      </div>
      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        totalCount={all.length}
        pageCount={Math.max(1, Math.ceil(all.length / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={setSelected}
        emptyMessage="Sin reclamos registrados. Eso es buena señal."
      />
      <ClaimCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <ClaimDetailSheet claim={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ClaimCreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: warranties } = useWarranties();
  const { data: profiles } = useAssignableProfiles();
  const createClaim = useCreateClaim();

  const [warrantyId, setWarrantyId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [severity, setSeverity] = React.useState<ClaimSeverity>("medium");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [photos, setPhotos] = React.useState<File[]>([]);

  // Garantías reclamables: activas o ya con reclamo previo
  const selectable = (warranties ?? []).filter((w) =>
    w.status === "active" || w.status === "claimed"
  );

  const reset = () => {
    setWarrantyId(""); setDescription(""); setSeverity("medium");
    setAssignedTo(""); setPhotos([]);
  };

  const submit = async () => {
    if (!warrantyId || !description.trim()) return;
    await createClaim.mutateAsync({
      warranty_id: warrantyId,
      description,
      severity,
      assigned_to: assignedTo || null,
      photos,
    });
    notify.success("Reclamo creado", "El reclamo quedó registrado y la garantía marcada con reclamo.");
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <SheetContent className="bg-card border-l-border/10 w-[90vw] sm:w-[450px] sm:max-w-none p-0 flex flex-col">
        <SheetHeader className="px-8 pt-8 pb-6 shrink-0">
          <SheetTitle className="text-xl font-bold tracking-tight">Nuevo reclamo de garantía</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Registra el reclamo con su severidad, responsable y fotos.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 scrollbar-thin">
          <Field label="Garantía (cliente / proyecto)">
            <Select value={warrantyId} onValueChange={(v) => setWarrantyId(v ?? "")}>
              <SelectTrigger className="h-12 rounded-none border-border/50">
                <SelectValue placeholder="Selecciona la garantía…" />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {(w.client?.name ?? "Cliente")} — {(w.project?.name ?? "Proyecto")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descripción del problema">
            <Textarea
              placeholder="¿Qué pasó? Bisagra suelta, puerta desalineada, humedad…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-none border-border/50 min-h-28"
            />
          </Field>
          <Field label="Severidad">
            <Select value={severity} onValueChange={(v) => setSeverity(v as ClaimSeverity)}>
              <SelectTrigger className="h-12 rounded-none border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_LABELS).map(([key, v]) => (
                  <SelectItem key={key} value={key}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Asignado a (opcional)">
            <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? "")}>
              <SelectTrigger className="h-12 rounded-none border-border/50">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {(profiles ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fotos (opcional)">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:h-10 file:px-4 file:rounded-none file:border file:border-border/50 file:bg-background file:text-xs file:font-bold file:text-foreground hover:file:bg-accent/40"
            />
            {photos.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{photos.length} foto(s) seleccionada(s)</p>
            )}
          </Field>
        </div>
        <SheetFooter className="p-8 bg-muted/20 border-t border-border/10 shrink-0">
          <PrimaryButton
            label={createClaim.isPending ? "Creando…" : "Crear reclamo"}
            className="w-full h-14"
            disabled={!warrantyId || !description.trim() || createClaim.isPending}
            onClick={submit}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ClaimDetailSheet({ claim, onClose }: { claim: WarrantyClaim | null; onClose: () => void }) {
  const updateClaim = useUpdateClaim();
  const { data: photoUrls } = useClaimPhotoUrls(claim);
  const [newStatus, setNewStatus] = React.useState<ClaimStatus | "">("");
  const [resolutionNotes, setResolutionNotes] = React.useState("");

  React.useEffect(() => {
    setNewStatus("");
    setResolutionNotes(claim?.resolution_notes ?? "");
  }, [claim?.id]);

  const targetStatus = (newStatus || claim?.status) as ClaimStatus | undefined;
  const needsNotes = targetStatus === "resolved" || targetStatus === "rejected";

  const save = async () => {
    if (!claim || !newStatus) return;
    await updateClaim.mutateAsync({
      id: claim.id,
      status: newStatus as ClaimStatus,
      resolution_notes: resolutionNotes || null,
    });
    notify.success("Reclamo actualizado", "El estado del reclamo quedó guardado.");
    onClose();
  };

  return (
    <Sheet open={!!claim} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-card border-l-border/10 w-[90vw] sm:w-[450px] sm:max-w-none p-0 flex flex-col">
        {claim && (
          <>
            <SheetHeader className="px-8 pt-8 pb-6 shrink-0">
              <SheetTitle className="text-xl font-bold tracking-tight font-mono">
                {claim.claim_number ?? "Reclamo"}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                {claim.warranty?.project?.name ?? "—"} · {claim.warranty?.client?.name ?? "—"}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 scrollbar-thin">
              <div className="grid grid-cols-2 gap-4">
                <InfoBlock label="Severidad" value={<StatusPill map={SEVERITY_LABELS} value={claim.severity} />} />
                <InfoBlock label="Estado actual" value={<StatusPill map={CLAIM_STATUS_LABELS} value={claim.status} />} />
                <InfoBlock label="Reportado" value={formatDate(claim.reported_at) ?? "—"} />
                <InfoBlock label="Días abierto" value={String(daysOpen(claim))} />
              </div>
              <InfoBlock label="Descripción" value={claim.description} />

              {(photoUrls?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fotos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {photoUrls!.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Foto ${i + 1}`} className="w-full h-28 object-cover border border-border/30" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(claim.status === "open" || claim.status === "in_progress") ? (
                <div className="space-y-4 pt-4 border-t border-border/10">
                  <Field label="Cambiar estado">
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ClaimStatus)}>
                      <SelectTrigger className="h-12 rounded-none border-border/50">
                        <SelectValue placeholder="Selecciona el nuevo estado…" />
                      </SelectTrigger>
                      <SelectContent>
                        {claim.status === "open" && <SelectItem value="in_progress">En proceso</SelectItem>}
                        <SelectItem value="resolved">Resuelto</SelectItem>
                        <SelectItem value="rejected">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={needsNotes ? "Notas de resolución (obligatorias)" : "Notas de resolución"}>
                    <Textarea
                      placeholder="Qué se hizo para resolver o por qué se rechaza…"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="rounded-none border-border/50 min-h-24"
                    />
                  </Field>
                </div>
              ) : (
                claim.resolution_notes && <InfoBlock label="Resolución" value={claim.resolution_notes} />
              )}
            </div>
            {(claim.status === "open" || claim.status === "in_progress") && (
              <SheetFooter className="p-8 bg-muted/20 border-t border-border/10 shrink-0">
                <PrimaryButton
                  label={updateClaim.isPending ? "Guardando…" : "Guardar cambios"}
                  className="w-full h-14"
                  disabled={!newStatus || (needsNotes && !resolutionNotes.trim()) || updateClaim.isPending}
                  onClick={save}
                />
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

// ── Tab Encuestas ────────────────────────────────────────────────────────────

function SurveysTab() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const { pageIndex, setPageIndex, pageSize, setPageSize } = usePagination();
  const { data: allRaw, isLoading } = useSurveys(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const all = allRaw ?? [];
  const [selected, setSelected] = React.useState<SatisfactionSurvey | null>(null);
  const sendNow = useSendSurveyNow();

  const { data: allForCounts } = useSurveys();
  const statusOptions: StatusOption[] = React.useMemo(() => {
    const base = allForCounts ?? [];
    return [
      { value: "all", label: "Todas", count: base.length, icon: MessageSquareHeart },
      ...Object.entries(SURVEY_STATUS_LABELS).map(([key, v]) => ({
        value: key,
        label: v.label,
        count: base.filter((s) => s.status === key).length,
      })),
    ];
  }, [allForCounts]);

  const copyLink = (s: SatisfactionSurvey) => {
    const url = `${window.location.origin}/encuesta/${s.public_token}`;
    navigator.clipboard.writeText(url);
    notify.success("Link copiado", "Comparte el link de la encuesta con el cliente.");
  };

  const handleSend = async (s: SatisfactionSurvey) => {
    const result = await sendNow.mutateAsync(s.id);
    if (result?.ok) {
      notify.success("Encuesta encolada", "El WhatsApp con la encuesta quedó en cola de envío.");
    } else if (result?.error === "dry_run") {
      notify.warning(
        "Modo seguro activo",
        "postventa_dry_run está en 'true': no se envían mensajes. Usa 'Copiar link' mientras tanto."
      );
    } else if (result?.error === "client_without_phone") {
      notify.error("Sin teléfono", "El cliente no tiene WhatsApp registrado.");
    } else if (result?.error) {
      notify.error("No se pudo enviar", `Motivo: ${result.error}`);
    }
  };

  const columns = React.useMemo<ColumnDef<SatisfactionSurvey>[]>(() => [
    {
      header: "Proyecto",
      accessorKey: "project",
      cell: ({ row }) => (
        <span className="font-semibold text-foreground">{row.original.project?.name ?? "—"}</span>
      ),
    },
    {
      header: "Cliente",
      accessorKey: "client",
      cell: ({ row }) => <span>{row.original.client?.name ?? "—"}</span>,
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => <StatusPill map={SURVEY_STATUS_LABELS} value={row.original.status} />,
    },
    {
      header: "Enviada",
      accessorKey: "sent_at",
      cell: ({ row }) => <span>{row.original.sent_at ? formatDate(row.original.sent_at) : "—"}</span>,
    },
    {
      header: "Respondida",
      accessorKey: "responded_at",
      cell: ({ row }) => <span>{row.original.responded_at ? formatDate(row.original.responded_at) : "—"}</span>,
    },
    {
      header: "Rating",
      accessorKey: "rating_overall",
      cell: ({ row }) => <Stars value={row.original.rating_overall} />,
    },
    {
      header: "Recomendaría",
      accessorKey: "would_recommend",
      cell: ({ row }) =>
        row.original.would_recommend == null
          ? <span className="text-muted-foreground text-xs">—</span>
          : row.original.would_recommend
            ? <span className="text-emerald-500 font-bold text-xs">Sí</span>
            : <span className="text-red-400 font-bold text-xs">No</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const s = row.original;
        const sendable = s.status === "pending" || s.status === "sent";
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 rounded-none"
              title="Copiar link público"
              onClick={() => copyLink(s)}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {sendable && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 rounded-none"
                title={s.status === "pending" ? "Enviar ahora por WhatsApp" : "Reenviar por WhatsApp"}
                disabled={sendNow.isPending}
                onClick={() => handleSend(s)}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ], [sendNow.isPending]);

  const paginated = all.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className="space-y-6">
      <StatusSubnav options={statusOptions} activeValue={statusFilter} onSelect={(v) => { setStatusFilter(v); setPageIndex(0); }} />
      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        totalCount={all.length}
        pageCount={Math.max(1, Math.ceil(all.length / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={(s) => s.status === "responded" && setSelected(s)}
        emptyMessage="Sin encuestas. Se crean automáticamente al entregar un proyecto."
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="bg-card border-l-border/10 w-[90vw] sm:w-[450px] sm:max-w-none p-0 flex flex-col">
          {selected && (
            <>
              <SheetHeader className="px-8 pt-8 pb-6 shrink-0">
                <SheetTitle className="text-xl font-bold tracking-tight">
                  Respuesta de {selected.client?.name ?? "cliente"}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {selected.project?.name ?? "—"} · respondida el {formatDate(selected.responded_at ?? "") ?? "—"}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-5 scrollbar-thin">
                <RatingRow label="Experiencia general" value={selected.rating_overall} />
                <RatingRow label="Calidad del producto" value={selected.rating_quality} />
                <RatingRow label="Puntualidad" value={selected.rating_punctuality} />
                <RatingRow label="Atención del equipo" value={selected.rating_service} />
                <div className="pt-4 border-t border-border/10 space-y-4">
                  <InfoBlock
                    label="¿Nos recomendaría?"
                    value={selected.would_recommend ? "Sí 👍" : "No"}
                  />
                  {selected.comments && <InfoBlock label="Comentarios" value={selected.comments} />}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RatingRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Stars value={value} />
    </div>
  );
}
