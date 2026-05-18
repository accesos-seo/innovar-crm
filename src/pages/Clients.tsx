import * as React from "react";
import {
  Users,
  User,
  Plus,
  MapPin,
  MessageSquare,
  History,
  UserCheck,
  TrendingUp,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Client } from "@/types/database";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailModal, InlineEditField, InlineEditPhoneField } from "@/components/shared/DetailModal";
import { formatSentenceCase, formatDate, formatDateTime } from "@/lib/format-utils";
import { notify } from "@/components/ui/PremiumToast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MetricData } from "@/components/shared/MetricsGrid";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useClients } from "@/hooks/useClients";
import { ResourceListPage, ResourceQueryResult } from "@/components/shared/ResourceListPage";

const clientColumns: ColumnDef<Client>[] = [
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
    header: formatSentenceCase("Cliente"),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={row.original.name} />
        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {row.original.name}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: formatSentenceCase("Email"),
    cell: ({ row }) => <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={row.original.email}>{row.original.email}</span>,
  },
  {
    accessorKey: "whatsapp_phone",
    header: formatSentenceCase("WhatsApp"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 group/phone cursor-pointer w-fit">
        <div className="p-1.5 bg-[#25D366]/10 rounded-full group-hover/phone:bg-[#25D366]/20 transition-colors">
          <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
        </div>
        <span className="text-sm text-muted-foreground font-medium group-hover/phone:text-primary transition-colors">
          {row.original.whatsapp_phone}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "address",
    header: formatSentenceCase("Dirección"),
    cell: ({ row }) => <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={row.original.address}>{row.original.address}</span>,
  },
];

function useClientsQuery(
  search: string,
  pagination: { pageIndex: number; pageSize: number }
): ResourceQueryResult<Client> {
  const { clients: data, isLoading, totalCount } = useClients(search, pagination);
  return { data, isLoading, totalCount };
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [activeFilters, setActiveFilters] = React.useState<string[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);

  const { clients: allClients, deleteClients } = useClients("");

  const metrics = React.useMemo<MetricData[]>(() => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newThisWeek = allClients.filter((c) => new Date(c.created_at) >= oneWeekAgo).length;
    const withPhone = allClients.filter((c) => c.whatsapp_phone).length;
    const withPhonePercent = allClients.length > 0
      ? Math.round((withPhone / allClients.length) * 100)
      : 0;
    const totalCount = allClients.length;
    return [
      { title: formatSentenceCase("Total clientes"), value: totalCount, description: formatSentenceCase("En la base de datos"), icon: Users, trend: "neutral", color: "blue" },
      { title: formatSentenceCase("Nuevos esta semana"), value: newThisWeek, description: formatSentenceCase("Últimos 7 días"), icon: Zap, trend: newThisWeek > 0 ? "up" : "neutral", color: "green" },
      { title: formatSentenceCase("Con WhatsApp"), value: withPhone, description: formatSentenceCase("Contacto disponible"), icon: UserCheck, trend: "neutral", color: "purple" },
      { title: formatSentenceCase("Cobertura contacto"), value: `${withPhonePercent}%`, description: formatSentenceCase("Clientes con teléfono"), icon: TrendingUp, trend: withPhonePercent > 70 ? "up" : "neutral", color: "yellow" },
    ];
  }, [allClients]);

  const handleSaveField = async (field: keyof Client, value: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    notify.success("Campo actualizado", `Cliente: ${field} actualizado.`);
  };

  const toggleFilter = (city: string) => {
    setActiveFilters(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  return (
    <ResourceListPage<Client>
      title="GESTIÓN DE CLIENTES"
      subtitle="Directorio centralizado de clientes y solicitudes de asesoría."
      icon={Users}
      onBack={() => navigate("/")}
      createLabel="Nuevo cliente"
      onCreateClick={() => navigate("/clients/new")}
      useQueryHook={useClientsQuery}
      columns={clientColumns}
      searchPlaceholder="Buscar clientes por nombre, email o teléfono..."
      metrics={metrics}
      metricsCount={4}
      filterTitle="Filtros de clientes"
      filterDescription="Segmenta tu base de clientes por ubicación o actividad."
      filterContent={
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="w-4 h-4" />
            <label className="text-xs font-bold uppercase tracking-widest">{formatSentenceCase("Ubicación")}</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["Bogotá", "Medellín", "Cali", "Barranquilla"].map((city) => (
              <Button
                key={city}
                variant={activeFilters.includes(city) ? "default" : "outline"}
                onClick={() => toggleFilter(city)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest h-10 rounded-none transition-all",
                  activeFilters.includes(city)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/30 text-muted-foreground hover:border-primary/50"
                )}
              >
                {city}
              </Button>
            ))}
          </div>
        </div>
      }
      isFiltered={activeFilters.length > 0}
      onClearFilters={() => setActiveFilters([])}
      onRowClick={setSelectedClient}
      onConfirmDelete={async (rows) => deleteClients(rows.map(c => c.id))}
      deleteTitle="¿Eliminar clientes?"
      deleteDescription={(count) => `¿Estás seguro de que deseas eliminar ${count} cliente(s)? Esta acción no se puede deshacer y afectará a sus proyectos asociados.`}
      emptyTitle="No hay información actual"
      emptyDescription="No se encontraron clientes que coincidan con los filtros actuales. Comienza creando un nuevo cliente."
    >
      <DetailModal
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
        title={selectedClient?.name || ""}
        icon={User}
        subtitle={formatSentenceCase(`Cliente ID: ${selectedClient?.id}`)}
        status={{
          label: formatSentenceCase("Activo"),
          variant: "default",
          className: "bg-primary/10 text-primary border-primary/20"
        }}
        editHref={selectedClient ? `/clients/${selectedClient.id}/edit` : undefined}
        onNavigate={navigate}
        footer={
          <Button variant="outline" className="gap-2 border-border/50 text-xs font-medium uppercase tracking-widest text-primary">
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            {formatSentenceCase("Enviar WhatsApp")}
          </Button>
        }
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pb-8">
            <InlineEditField
              label={formatSentenceCase("Nombre completo")}
              value={selectedClient?.name || ""}
              onSave={(v) => handleSaveField("name", v)}
            />
            <InlineEditField
              label={formatSentenceCase("Correo electrónico")}
              value={selectedClient?.email || ""}
              type="email"
              onSave={(v) => handleSaveField("email", v)}
            />
          </div>
          <div className="h-[1px] w-full bg-border/10" />
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 py-8">
            <InlineEditPhoneField
              label={formatSentenceCase("WhatsApp / teléfono")}
              value={selectedClient?.whatsapp_phone || ""}
              onSave={(v) => handleSaveField("whatsapp_phone", v)}
            />
            <InlineEditField
              label={formatSentenceCase("Dirección de obra")}
              value={selectedClient?.address || ""}
              onSave={(v) => handleSaveField("address", v)}
            />
          </div>
          <div className="h-[1px] w-full bg-border/10" />
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pt-8">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{formatSentenceCase("Fecha de registro")}</p>
              <div className="flex items-center gap-2 min-h-[32px]">
                <History className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{formatDate(selectedClient?.created_at)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{formatSentenceCase("Última actividad")}</p>
              <div className="flex items-center gap-2 min-h-[32px]">
                <History className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{formatDateTime(selectedClient?.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </DetailModal>
    </ResourceListPage>
  );
}
