import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInputField } from "@/components/shared/EmailInputField";
import { WhatsAppField } from "@/components/shared/WhatsAppField";
import { DEFAULT_COUNTRIES } from "@/hooks/usePhoneInput";
import { formatSentenceCase } from "@/lib/format-utils";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { supabase } from "@/lib/supabaseClient";

import * as z from "zod";

// Valores exactos del enum DB `public.user_role` (verificado 2026-05-23):
// admin, comercial, diseno, produccion, super_admin.
// El form viejo tenía 'disenador', 'operario', 'user' — esos NO existen
// y romperían el INSERT con CHECK constraint violation.
const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Administrador" },
  { value: "comercial", label: "Comercial" },
  { value: "diseno", label: "Diseño" },
  { value: "produccion", label: "Producción" }
];
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

const userSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  role: z.enum(["super_admin", "admin", "comercial", "diseno", "produccion"], {
    errorMap: () => ({ message: "Rol inválido" })
  }),
  // Opcional. Si se pasa, debe ser formato internacional completo: +<código país><10 dígitos>.
  phone: z
    .string()
    .regex(/^\+\d{11,15}$/, "Teléfono incompleto (formato +código país + número)")
    .optional()
    .or(z.literal(""))
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserCreate() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "comercial",
      phone: ""
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    if (!supabase) {
      toast.error("Supabase no está configurado");
      return;
    }
    setIsSaving(true);
    try {
      // La Edge Function admin-invite-user (deployada 2026-05-23, proyecto
      // xdzbjptozeqcbnaqhtye) usa service_role para llamar
      // auth.admin.inviteUserByEmail() y luego pisa role/whatsapp_phone del
      // profile creado por el trigger handle_new_user. Solo admin/super_admin
      // pueden invocarla (chequeo interno en la propia función).
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: {
          email: values.email.trim().toLowerCase(),
          full_name: values.name.trim(),
          role: values.role,
          phone: values.phone || null,
        },
      });

      if (error) {
        // FunctionsHttpError trae statusCode + el body de la respuesta del edge
        // como `context`. Tratamos de extraer el mensaje JSON si existe.
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore parse errors */ }
        toast.error("No se pudo invitar al usuario", { description: msg });
        return;
      }

      if (data?.partial) {
        toast.warning("Invitación enviada con observaciones", {
          description: data.error,
        });
      } else {
        toast.success("Invitación enviada", {
          description: `Se mandó un correo a ${values.email} para activar la cuenta.`,
        });
      }
      navigate("/settings/users");
    } catch (err: any) {
      toast.error("Error inesperado al invitar", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title={formatSentenceCase("NUEVO USUARIO")}
        subtitle={formatSentenceCase("Invita a un nuevo miembro al equipo de INNOVAR.")}
        icon={Users}
        onBack={() => navigate("/settings/users")}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Nombre Completo *")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={formatSentenceCase("Ej. Sarah Connor")}
                          {...field}
                          className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-1">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <EmailInputField
                          label="Correo Electrónico *"
                          placeholder="sarah.c@innovar.com"
                          error={fieldState.error?.message}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Rol de Acceso *")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-none border-border/50 bg-background font-bold text-xs">
                            <SelectValue placeholder={formatSentenceCase("Seleccionar...")}>
                              {field.value ? (ROLES.find(r => r.value === field.value)?.label || field.value) : undefined}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map(role => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <FormItem className="space-y-2">
                      <FormControl>
                        <WhatsAppField
                          countries={DEFAULT_COUNTRIES}
                          initialValue={field.value || ""}
                          onChange={(fullPhone) => field.onChange(fullPhone)}
                          label="Teléfono de contacto"
                        />
                      </FormControl>
                      {fieldState.error && (
                        <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                          {fieldState.error.message}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="px-8 py-6 border-t border-border/10 bg-muted/20 flex items-center justify-end gap-4">
            <Button 
              type="button"
              variant="ghost"
              onClick={() => navigate("/settings/users")}
              className="font-bold uppercase text-xs tracking-widest h-12 px-8 rounded-none"
            >
              Cancelar
            </Button>
            <PrimaryButton 
              type="submit"
              disabled={isSaving}
              loading={isSaving}
              label="Enviar Invitación"
              icon={Zap}
              className="h-12 px-10 rounded-none"
            />
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
