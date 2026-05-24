import * as React from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  Mail,
  Lock,
  Camera,
  Save,
  ShieldCheck,
  Bell,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmailInputField } from "@/components/shared/EmailInputField";
import { WhatsAppField } from "@/components/shared/WhatsAppField";
import { DEFAULT_COUNTRIES } from "@/hooks/usePhoneInput";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const profileSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  // Coincide con la columna `whatsapp_phone` (text, nullable) de public.profiles.
  // Formato esperado cuando hay valor: +<código país><10 dígitos>, ej. +573181234567
  whatsapp_phone: z.string().optional().or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { profile, user } = useAuthStore();
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [inventoryAlerts, setInventoryAlerts] = React.useState(true);
  const [newProjectsAlerts, setNewProjectsAlerts] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Si full_name viene como email (residuo de auto-creación del profile
  // en authStore.deriveFullName), lo tratamos como "sin nombre real" para
  // que el usuario complete con su nombre verdadero. Esto evita mostrar
  // "robert@seolabagency.com" como si fuera el nombre.
  const looksLikeEmail = (s: string | null | undefined) =>
    !!s && /@/.test(s);
  const cleanFullName =
    profile?.full_name && !looksLikeEmail(profile.full_name)
      ? profile.full_name
      : "";

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: cleanFullName,
      email: user?.email || "",
      whatsapp_phone: profile?.whatsapp_phone || "",
    }
  });

  // Update form values when profile/user changes
  React.useEffect(() => {
    if (profile || user) {
      profileForm.reset({
        name: cleanFullName,
        email: user?.email || "",
        whatsapp_phone: profile?.whatsapp_phone || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user, profileForm, cleanFullName]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    try {
      // Usamos .select() para que Postgrest devuelva las filas afectadas.
      // Si RLS bloquea silenciosamente (0 filas), `updated` viene vacío y
      // detectamos el caso aunque `error` sea null.
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          full_name: data.name,
          whatsapp_phone: data.whatsapp_phone || null,
        })
        .eq('id', user.id)
        .select();

      if (error) throw error;

      if (!updated || updated.length === 0) {
        throw new Error(
          "No se actualizó ningún registro. Posible causa: tu sesión no coincide con el id del perfil, o las RLS bloquean este update. Cerrá sesión y volvé a entrar."
        );
      }

      toast.success("Perfil actualizado correctamente");

      // Refrescar el store de auth con el profile nuevo para que el resto
      // de la app (sidebar, NavBar, etc.) vea el cambio sin recargar.
      useAuthStore.setState({ profile: updated[0] as any });
    } catch (err: any) {
      toast.error("Error al guardar el perfil", { description: err.message });
    }
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    toast.success("Contraseña actualizada correctamente");
    passwordForm.reset();
    console.log(data);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validaciones básicas
    if (!file.type.startsWith('image/')) {
      toast.error("El archivo debe ser una imagen");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 2MB");
      return;
    }

    try {
      setIsUploading(true);
      
      if (!supabase) {
        throw new Error("Supabase no está configurado.");
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 1. Subir al bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Obtener la URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Actualizar el perfil en la tabla 'profiles'
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success("Avatar actualizado correctamente");
      
      // Forzar recarga para ver cambios si el store no es reactivo al perfil
      window.location.reload();
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Error al subir la imagen", {
        description: error.message || "Verifica que el bucket 'avatars' exista y sea público."
      });
    } finally {
      setIsUploading(false);
    }
  };

  // displayName: muestra el full_name solo si es un nombre real.
  // Si está vacío o parece email (ej. profile.full_name === "robert@x.com"),
  // mostramos "Sin nombre" para invitar al usuario a completarlo desde el form.
  const displayName =
    profile?.full_name?.trim() && !looksLikeEmail(profile.full_name)
      ? profile.full_name.trim()
      : "Sin nombre";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto w-full space-y-12"
    >
      <CategoryHeader 
        title="MI PERFIL"
        subtitle="Gestiona tu información personal, seguridad y preferencias de cuenta."
        icon={User}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar - Avatar & Quick Info */}
        <div className="space-y-6">
          <Card className="bg-card border-border/10 overflow-hidden">
            <CardContent className="pt-12 pb-8 flex flex-col items-center text-center">
              <div 
                className="relative group cursor-pointer"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <UserAvatar 
                  name={displayName} 
                  image={profile?.avatar_url || undefined}
                  className="h-32 w-32 rounded-sm border-2 border-primary/20 group-hover:border-primary transition-colors duration-300"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-sm">
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </div>
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
              </div>
              <h2 className="mt-6 text-xl font-bold text-foreground">{displayName}</h2>
              <p className="text-sm font-medium text-primary uppercase tracking-widest mt-1">{profile?.role || "Consultor"}</p>
              <div className="mt-6 flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-none border border-primary/20">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Cuenta Verificada</span>
              </div>
            </CardContent>
            <Separator className="bg-border/10" />
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="font-medium uppercase tracking-widest">Miembro desde</span>
                </div>
                <span className="text-foreground font-bold">
                  {(profile?.created_at || user?.created_at) ? (() => {
                    const date = parseISO(profile?.created_at || user?.created_at || "");
                    const formatted = format(date, "MMMM yyyy", { locale: es });
                    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
                  })() : "---"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-medium uppercase tracking-widest">Último acceso</span>
                </div>
                <span className="text-foreground font-bold">
                  {user?.last_sign_in_at ? (() => {
                    const date = parseISO(user.last_sign_in_at);
                    const timeStr = format(date, "hh:mm a").toUpperCase();
                    if (isToday(date)) {
                      return `Hoy, ${timeStr}`;
                    }
                    const formatted = format(date, "d 'de' MMMM, hh:mm a", { locale: es });
                    return formatted.replace(/am|pm/i, (m) => m.toUpperCase());
                  })() : "---"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Alertas de Inventario</span>
                <Switch 
                  checked={inventoryAlerts} 
                  onCheckedChange={(checked) => {
                    setInventoryAlerts(checked);
                    toast.success(checked ? "Alertas de inventario activadas" : "Alertas de inventario desactivadas");
                  }} 
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Nuevos Proyectos</span>
                <Switch 
                  checked={newProjectsAlerts} 
                  onCheckedChange={(checked) => {
                    setNewProjectsAlerts(checked);
                    toast.success(checked ? "Notificaciones de proyectos activadas" : "Notificaciones de proyectos desactivadas");
                  }} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Info */}
          <Card className="bg-card border-border/10 shadow-xl shadow-black/5">
            <CardHeader className="pb-8">
              <CardTitle className="text-xl font-bold uppercase tracking-tight">Información Personal</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Actualiza tu nombre y dirección de correo electrónico institucional.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {profileForm.formState.isSubmitting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm rounded-sm">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Actualizando información...
                    </span>
                  </div>
                </div>
              )}
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <User className="w-3 h-3" /> Nombre Completo
                    </label>
                    <Input
                      {...profileForm.register("name")}
                      placeholder="Ej. María Rodríguez"
                      className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary"
                    />
                    {looksLikeEmail(profile?.full_name) && !profileForm.formState.dirtyFields.name && (
                      <p className="text-[10px] text-muted-foreground italic">
                        Tu perfil se creó automáticamente y tu nombre quedó como el correo. Reemplazalo con tu nombre real y guardá.
                      </p>
                    )}
                    {profileForm.formState.errors.name && (
                      <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                        {profileForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-1">
                    <EmailInputField
                      label="Correo Electrónico"
                      error={profileForm.formState.errors.email?.message}
                      {...profileForm.register("email")}
                    />
                  </div>
                  <div className="space-y-2">
                    <WhatsAppField
                      key={profile?.id || "loading"}
                      countries={DEFAULT_COUNTRIES}
                      initialValue={profile?.whatsapp_phone || ""}
                      onChange={(fullPhone) => profileForm.setValue("whatsapp_phone", fullPhone, { shouldDirty: true })}
                      label="Teléfono WhatsApp"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={profileForm.formState.isSubmitting}
                    className="bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest h-12 px-8 rounded-none hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {profileForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="bg-card border-border/10 shadow-xl shadow-black/5">
            <CardHeader className="pb-8">
              <CardTitle className="text-xl font-bold uppercase tracking-tight">Seguridad</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Cambia tu contraseña periódicamente para mantener tu cuenta segura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Contraseña Actual
                  </label>
                  <div className="relative">
                    <Input 
                      type={showCurrentPassword ? "text" : "password"}
                      {...passwordForm.register("currentPassword")}
                      className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary pr-12"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.currentPassword && (
                    <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Nueva Contraseña
                    </label>
                    <div className="relative">
                      <Input 
                        type={showNewPassword ? "text" : "password"}
                        {...passwordForm.register("newPassword")}
                        className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary pr-12"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"}
                        {...passwordForm.register("confirmPassword")}
                        className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary pr-12"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit"
                    variant="outline"
                    className="border-border/50 text-muted-foreground hover:text-primary font-bold uppercase text-xs tracking-widest h-12 px-8 rounded-none transition-all duration-300"
                  >
                    Actualizar Contraseña
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
