import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Shield, 
  Mail, 
  Phone, 
  Clock,
  UserCheck,
  UserPlus,
  ShieldAlert,
  MoreVertical
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "use-debounce";
import { FullscreenDetail } from "@/components/shared/FullscreenDetail";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { InlineEditField } from "@/components/shared/DetailModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader, PremiumLoadingOverlay } from "@/components/shared/PremiumLoader";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatDate } from "@/lib/format-utils";
import { withTimeout } from "@/lib/timeout";

const userSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  role: z.enum(['user', 'admin', 'super_admin', 'comercial', 'disenador', 'jefe_taller', 'operario']),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin' | 'super_admin' | 'comercial' | 'disenador' | 'jefe_taller' | 'operario';
  loginMethod: 'apple' | 'google' | 'email';
  isTeamMember: boolean;
  lastSignedIn: string;
  status: 'active' | 'inactive';
}

const roleMap: Record<UserRecord['role'], { label: string; color: string }> = {
  super_admin: { label: formatSentenceCase("Super admin"), color: "bg-purple-500/10 text-purple-500" },
  admin: { label: formatSentenceCase("Admin"), color: "bg-blue-500/10 text-blue-500" },
  comercial: { label: formatSentenceCase("Comercial"), color: "bg-emerald-500/10 text-emerald-500" },
  disenador: { label: formatSentenceCase("Diseñador"), color: "bg-pink-500/10 text-pink-500" },
  jefe_taller: { label: formatSentenceCase("Jefe taller"), color: "bg-orange-500/10 text-orange-500" },
  operario: { label: formatSentenceCase("Operario"), color: "bg-slate-500/10 text-slate-500" },
  user: { label: formatSentenceCase("Usuario"), color: "bg-muted text-muted-foreground" },
};

const columns: ColumnDef<UserRecord>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        className="border-border/50"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        className="border-border/50"
      />
    ),
  },
  {
    accessorKey: "name",
    header: formatSentenceCase("Usuario"),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={row.original.name} />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">{row.original.name}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{row.original.email}</span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: formatSentenceCase("Rol"),
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none px-2 py-0.5", roleMap[row.original.role]?.color)}>
        {roleMap[row.original.role].label}
      </Badge>
    ),
  },
  {
    accessorKey: "lastSignedIn",
    header: formatSentenceCase("Último acceso"),
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.lastSignedIn}</span>,
  },
  {
    accessorKey: "status",
    header: formatSentenceCase("Estado"),
    cell: ({ row }) => (
      <Badge className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none", row.original.status === 'active' ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
        {row.original.status === 'active' ? formatSentenceCase('Activo') : formatSentenceCase('Inactivo')}
      </Badge>
    ),
  },
];

export default function UsersSettingsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [isLoading, setIsLoading] = React.useState(true);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<UserRecord | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      if (!supabase) {
        setUsers([]);
        return;
      }
      
      const query = supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      const response = await withTimeout(query as any);
      const { data, error } = response as any;

      if (error) {
        console.warn("Network/Supabase Info:", error);
        toast.error("Error de conexión", { description: "No se pudo cargar la lista de usuarios." });
        setUsers([]);
        return;
      }
      
      const mappedUsers: UserRecord[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.full_name || "Sin nombre",
        email: p.email,
        phone: p.phone || "---",
        role: p.role || "user",
        loginMethod: 'email',
        isTeamMember: true,
        lastSignedIn: p.lastSignedIn ? formatDate(p.lastSignedIn) : "Nunca",
        status: p.status || 'active'
      }));

      setUsers(mappedUsers);
    } catch (error: any) {
      console.warn("Network/Supabase Info:", error);
      toast.error("Error inesperado", { description: "Tiempo de espera agotado al obtener usuarios." });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      // Simulación de creación de usuario
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Usuario a crear:", data);
      
      toast.success("Usuario creado correctamente", {
        description: `Se ha enviado una invitación a ${data.email}`
      });
      
      fetchUsers();
    } catch (error) {
      toast.error("Error al crear el usuario");
    }
  };

  const newThisMonth = React.useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return users.filter((u) => u.createdAt && new Date(u.createdAt) >= startOfMonth).length;
  }, [users]);

  const metrics: MetricData[] = [
    { title: formatSentenceCase("Total usuarios"), value: users.length, description: formatSentenceCase("Personal activo"), icon: Users, trend: "neutral", color: "blue" },
    { title: formatSentenceCase("Admins"), value: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length, description: formatSentenceCase("Acceso total"), icon: Shield, trend: "neutral", color: "purple" },
    { title: formatSentenceCase("Nuevos este mes"), value: newThisMonth, description: formatSentenceCase("Incorporaciones recientes"), icon: UserPlus, trend: newThisMonth > 0 ? "up" : "neutral", color: "green" },
    { title: formatSentenceCase("Alertas"), value: 0, description: formatSentenceCase("Sin incidencias"), icon: ShieldAlert, trend: "neutral", color: "yellow" },
  ];

  React.useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title={formatSentenceCase("USUARIOS Y ROLES")}
        subtitle={formatSentenceCase("Gestión de identidades, niveles de acceso y personal de INNOVAR.")}
        icon={Users}
        onBack={() => navigate("/settings")}
        action={{
          label: formatSentenceCase("Nuevo usuario"),
          icon: Plus,
          onClick: () => navigate("/settings/users/new")
        }}
      />

      {isLoading && <PremiumLoadingOverlay text={formatSentenceCase("Cargando directorio de usuarios")} />}

      <MetricsGrid metrics={metrics} />

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={formatSentenceCase("Buscar por nombre, email o rol...")} 
                className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <FilterSheet
              title={formatSentenceCase("Filtros de usuarios")}
              description={formatSentenceCase("Segmenta tus colaboradores por rol o estado.")}
              onApply={() => toast.info(formatSentenceCase("Filtros aplicados"))}
              onClear={() => {}}
            >
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Por rol")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(roleMap).map((r) => (
                      <Button key={r.label} variant="outline" className="text-[10px] font-bold uppercase h-10 rounded-none border-border/30">
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </FilterSheet>
          </div>

          <DataTable
            columns={columns}
            data={users.filter(u => u.name.toLowerCase().includes(debouncedSearch.toLowerCase()))}
            isLoading={isLoading}
            totalCount={users.length}
            pageCount={1}
            pageIndex={0}
            pageSize={10}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            onRowClick={setSelectedUser}
            emptyMessage={
              <EmptyState 
                title="Usuarios no encontrados"
                description="No se encontraron colaboradores que coincidan con la búsqueda."
                icon={Users}
                action={{
                  label: "Agregar usuario",
                  icon: UserPlus,
                  onClick: () => navigate("/settings/users/new")
                }}
              />
            }
          />

      <FullscreenDetail
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        title={selectedUser?.name || ""}
        subtitle={formatSentenceCase(`CONFIGURACIÓN > USUARIOS > ${selectedUser?.name}`)}
        icon={Users}
        status={{ 
          label: selectedUser?.status === 'active' ? formatSentenceCase('Activo') : formatSentenceCase('Inactivo'), 
          variant: selectedUser?.status === 'active' ? 'default' : 'destructive' 
        }}
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pb-8">
            <InlineEditField
              label={formatSentenceCase("Nombre completo")}
              value={selectedUser?.name || ""}
              onSave={async () => {}}
            />
            <InlineEditField
              label={formatSentenceCase("Correo electrónico")}
              value={selectedUser?.email || ""}
              onSave={async () => {}}
            />
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 py-8">
            <InlineEditField
              label={formatSentenceCase("Teléfono / contacto")}
              value={selectedUser?.phone || ""}
              onSave={async () => {}}
            />
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Rol asignado")}</p>
              <Badge variant="outline" className={cn("mt-1 text-xs font-bold uppercase tracking-widest px-3 py-1", selectedUser ? roleMap[selectedUser.role]?.color : "")}>
                {selectedUser ? roleMap[selectedUser.role].label : ""}
              </Badge>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pt-8">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Método de login")}</p>
              <p className="text-lg font-black text-foreground uppercase tracking-widest">{selectedUser?.loginMethod}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Último acceso")}</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">{formatDate(selectedUser?.lastSignedIn)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-20 pt-10 border-t border-border/10 flex gap-4">
          <Button variant="outline" className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 font-bold uppercase text-[10px] tracking-widest h-12 rounded-none">
            {formatSentenceCase("Desactivar usuario")}
          </Button>
          <Button variant="outline" className="flex-1 border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase text-[10px] tracking-widest h-12 rounded-none">
            {formatSentenceCase("Resetear contraseña")}
          </Button>
        </div>
      </FullscreenDetail>

    </motion.div>
  );
}
