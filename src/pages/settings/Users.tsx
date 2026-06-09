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
import { formatSentenceCase, formatPersonName } from "@/lib/format-utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "use-debounce";
import { FullscreenDetail } from "@/components/shared/FullscreenDetail";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { InlineEditField, InlineEditPhoneField } from "@/components/shared/DetailModal";
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
import { formatDate, formatDateTime } from "@/lib/format-utils";

// Schema interno (no usado actualmente por el form de la página, pero
// queda alineado con el enum DB real por si se reactiva).
const userSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  role: z.enum(['admin', 'comercial', 'diseno', 'produccion', 'super_admin']),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type UserFormData = z.infer<typeof userSchema>;

// Roles exactos del enum DB `public.user_role` (verificado 2026-05-23):
// admin, comercial, diseno, produccion, super_admin. El map viejo tenía
// disenador/jefe_taller/operario/user que NO existen en la DB → cualquier
// usuario con rol real (ej. 'diseno') hacía crash en `roleMap[role].label`.
type DbUserRole = 'admin' | 'comercial' | 'diseno' | 'produccion' | 'super_admin';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: DbUserRole;
  loginMethod: 'apple' | 'google' | 'email';
  isTeamMember: boolean;
  /** ISO string desde auth.users.last_sign_in_at (RPC list_users_with_auth). null si nunca inició sesión. */
  lastSignedIn: string | null;
  status: 'active' | 'inactive';
}

const roleMap: Record<DbUserRole, { label: string; color: string }> = {
  super_admin: { label: formatSentenceCase("Super admin"), color: "bg-purple-500/10 text-purple-500" },
  admin: { label: formatSentenceCase("Admin"), color: "bg-blue-500/10 text-blue-500" },
  comercial: { label: formatSentenceCase("Comercial"), color: "bg-emerald-500/10 text-emerald-500" },
  diseno: { label: formatSentenceCase("Diseño"), color: "bg-pink-500/10 text-pink-500" },
  produccion: { label: formatSentenceCase("Producción"), color: "bg-orange-500/10 text-orange-500" },
};

// Fallback defensivo: si la DB algún día agrega un rol nuevo (o llega un
// valor raro), mostramos el string crudo en gris en vez de romper la tabla.
const UNKNOWN_ROLE = { label: formatSentenceCase("Sin rol"), color: "bg-muted text-muted-foreground" };
const getRoleConfig = (role: string | null | undefined) =>
  (role && roleMap[role as DbUserRole]) || UNKNOWN_ROLE;

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
          {/* Email en lowercase + sin tracking-widest: el email es un dato, no un label. */}
          <span className="text-[11px] text-muted-foreground lowercase">{row.original.email}</span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: formatSentenceCase("Rol"),
    cell: ({ row }) => {
      const cfg = getRoleConfig(row.original.role);
      return (
        <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none px-2 py-0.5", cfg.color)}>
          {cfg.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "lastSignedIn",
    header: formatSentenceCase("Último acceso"),
    cell: ({ row }) => (
      row.original.lastSignedIn
        ? <DateDisplay date={row.original.lastSignedIn} showTime className="text-xs font-bold text-foreground" />
        : <span className="text-xs italic text-muted-foreground">{formatSentenceCase("Nunca")}</span>
    ),
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
  const [isToggleActiveDialogOpen, setIsToggleActiveDialogOpen] = React.useState(false);
  const [isTogglingActive, setIsTogglingActive] = React.useState(false);
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      if (!supabase) {
        setUsers([]);
        return;
      }

      // Usamos el RPC SECURITY DEFINER `list_users_with_auth` (migración aplicada
      // 2026-05-23) en vez de un SELECT plano a `profiles`. El RPC hace JOIN con
      // auth.users para devolver last_sign_in_at — que no es accesible desde el
      // cliente con un SELECT normal porque auth.users solo lo lee el service_role.
      // Filtro interno: solo admin/super_admin reciben filas.
      const { data, error } = await supabase.rpc('list_users_with_auth');

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
        phone: p.whatsapp_phone || "",
        // Default 'comercial' es el mismo que aplica el trigger handle_new_user
        // si en algún momento DB devuelve role null. Antes era 'user' pero ese
        // valor no existe en el enum DB → roleMap lookup fallaba.
        role: (p.role as DbUserRole) || "comercial",
        loginMethod: 'email',
        isTeamMember: true,
        // Guardamos el ISO crudo; el formato se aplica en cada celda con formatDateTime.
        lastSignedIn: p.last_sign_in_at || null,
        status: p.is_active === false ? 'inactive' : 'active'
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

  /**
   * Actualiza un campo del perfil del usuario seleccionado en Supabase.
   * Usado por los InlineEditField del panel de detalle (full_name, whatsapp_phone).
   * Antes los onSave eran stubs vacíos → la edición parecía guardar pero no tocaba DB.
   * Re-lanza el error para que InlineEditField NO cierre el modo edición si falla.
   */
  const handleUpdateUserField = async (
    field: 'full_name' | 'whatsapp_phone',
    value: string
  ) => {
    if (!selectedUser?.id) {
      toast.error("Error", { description: "No se puede actualizar: usuario sin ID" });
      throw new Error("missing user id");
    }
    if (!supabase) {
      toast.error("Error", { description: "Supabase no está configurado." });
      throw new Error("no supabase");
    }
    try {
      const payload: Record<string, string | null> =
        field === 'whatsapp_phone'
          ? { whatsapp_phone: value || null }
          : { full_name: value };

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', selectedUser.id)
        .select();
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("No se actualizó ningún registro. ¿Tu rol tiene permiso (RLS admin) sobre profiles?");
      }
      // Reflejar el cambio en el panel de detalle y en la tabla sin refetch.
      setSelectedUser((prev) => prev ? {
        ...prev,
        name: field === 'full_name' ? value : prev.name,
        phone: field === 'whatsapp_phone' ? value : prev.phone,
      } : prev);
      setUsers((prev) => prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              name: field === 'full_name' ? value : u.name,
              phone: field === 'whatsapp_phone' ? value : u.phone,
            }
          : u
      ));
      toast.success("Usuario actualizado");
    } catch (err: any) {
      toast.error("Error al actualizar usuario", { description: err.message });
      throw err;
    }
  };

  const handleUpdateRole = async (newRole: DbUserRole) => {
    if (!selectedUser?.id || !supabase) return;
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', selectedUser.id);
      if (error) throw error;
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
      toast.success(formatSentenceCase("Rol actualizado"));
    } catch (err: any) {
      toast.error(formatSentenceCase("Error al actualizar rol"), { description: err.message });
    }
  };

  const handleToggleActive = async () => {
    if (!selectedUser?.id || !supabase) return;
    setIsTogglingActive(true);
    try {
      const isCurrentlyActive = selectedUser.status === 'active';
      const { error } = await supabase.from('profiles').update({ is_active: !isCurrentlyActive }).eq('id', selectedUser.id);
      if (error) throw error;
      const newStatus = isCurrentlyActive ? 'inactive' : 'active';
      setSelectedUser(prev => prev ? { ...prev, status: newStatus } : null);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));
      toast.success(isCurrentlyActive ? formatSentenceCase("Usuario desactivado") : formatSentenceCase("Usuario activado"));
      setIsToggleActiveDialogOpen(false);
    } catch (err: any) {
      toast.error(formatSentenceCase("Error"), { description: err.message });
    } finally {
      setIsTogglingActive(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser?.email || !supabase) return;
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw error;
      toast.success(formatSentenceCase("Correo de recuperación enviado"), { description: selectedUser.email });
    } catch (err: any) {
      toast.error(formatSentenceCase("Error al enviar correo"), { description: err.message });
    } finally {
      setIsResettingPassword(false);
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

  const newThisMonth = 0; // createdAt no está disponible en el RPC list_users_with_auth

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
              emptyLabel="Sin nombre"
              onSave={(v) => handleUpdateUserField('full_name', v)}
            />
            <InlineEditField
              label={formatSentenceCase("Correo electrónico")}
              value={selectedUser?.email || ""}
              // El email vive en auth.users (Supabase Auth), no en profiles.
              // Cambiarlo requiere flujo de re-verificación dedicado, así que
              // lo dejamos read-only acá.
              editable={false}
              onSave={async () => {}}
            />
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 py-8">
            <InlineEditPhoneField
              label={formatSentenceCase("Teléfono / contacto")}
              value={selectedUser?.phone || ""}
              onSave={(v) => handleUpdateUserField('whatsapp_phone', v)}
            />
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Rol asignado")}</p>
              <Select
                value={selectedUser?.role}
                onValueChange={(v) => handleUpdateRole(v as DbUserRole)}
              >
                <SelectTrigger className={cn(
                  "w-auto min-w-[130px] !h-8 px-3 mt-1 rounded-none border text-[10px] font-bold uppercase tracking-widest",
                  selectedUser ? getRoleConfig(selectedUser.role).color : ""
                )}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-sm border-border/20 shadow-xl">
                  {Object.entries(roleMap).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-xs font-bold uppercase">
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pt-8">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Método de login")}</p>
              <p className="text-base font-bold text-foreground mt-1">
                {selectedUser?.loginMethod
                  ? formatSentenceCase(selectedUser.loginMethod)
                  : "—"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Último acceso")}</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {selectedUser?.lastSignedIn
                    ? formatDateTime(selectedUser.lastSignedIn)
                    : formatSentenceCase("Nunca")}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-20 pt-10 border-t border-border/10 flex gap-4">
          <Button
            variant="outline"
            onClick={() => setIsToggleActiveDialogOpen(true)}
            className={cn(
              "flex-1 font-bold uppercase text-[10px] tracking-widest h-12 rounded-none",
              selectedUser?.status === 'active'
                ? "border-border/60 text-destructive hover:border-destructive hover:bg-destructive/10"
                : "border-border/60 text-primary hover:border-primary hover:bg-primary/10"
            )}
          >
            {selectedUser?.status === 'active'
              ? formatSentenceCase("Desactivar usuario")
              : formatSentenceCase("Activar usuario")}
          </Button>
          <Button
            variant="outline"
            onClick={handleResetPassword}
            disabled={isResettingPassword}
            className="flex-1 border-border/60 text-primary hover:border-primary hover:bg-primary/10 font-bold uppercase text-[10px] tracking-widest h-12 rounded-none"
          >
            {isResettingPassword
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{formatSentenceCase("Enviando...")}</>
              : formatSentenceCase("Resetear contraseña")}
          </Button>
        </div>
      </FullscreenDetail>

      <ConfirmationDialog
        isOpen={isToggleActiveDialogOpen}
        onClose={() => setIsToggleActiveDialogOpen(false)}
        onConfirm={handleToggleActive}
        isLoading={isTogglingActive}
        title={selectedUser?.status === 'active'
          ? formatSentenceCase("Desactivar usuario")
          : formatSentenceCase("Activar usuario")}
        description={selectedUser?.status === 'active'
          ? `¿Confirmas desactivar a ${selectedUser?.name}? No podrá iniciar sesión hasta ser reactivado.`
          : `¿Reactivar a ${selectedUser?.name}? Recuperará acceso completo al sistema.`}
        confirmText={selectedUser?.status === 'active'
          ? formatSentenceCase("Sí, desactivar")
          : formatSentenceCase("Sí, activar")}
        variant={selectedUser?.status === 'active' ? "warning" : "default"}
      />

    </motion.div>
  );
}
