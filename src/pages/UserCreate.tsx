import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Users, Save, X, Zap, Shield, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInputField } from "@/components/shared/EmailInputField";
import { formatSentenceCase } from "@/lib/format-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

import * as z from "zod";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Administrador" },
  { value: "disenador", label: "Diseñador" },
  { value: "operario", label: "Operario" },
  { value: "user", label: "Usuario Estándar" }
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
  role: z.string().min(1, "El rol es obligatorio"),
  phone: z.string().optional()
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
      role: "user",
      phone: ""
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Usuario invitado", {
        description: `Se ha enviado una invitación a ${values.email}`
      });
      navigate("/settings/users");
    } catch (error) {
      toast.error("Error al guardar");
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
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Teléfono de Contacto")}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="+57 300 000 0000" 
                          {...field}
                          className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-mono"
                        />
                      </FormControl>
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
