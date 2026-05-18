import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { User, Save, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { EmailInputField } from "@/components/shared/EmailInputField";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

const clientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  whatsappPhone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  address: z.string().optional()
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function ClientCreate() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      whatsappPhone: "",
      address: ""
    },
  });

  const onSubmit = async (values: ClientFormValues) => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(formatSentenceCase("Cliente creado"), {
        description: formatSentenceCase("El registro se ha guardado correctamente.")
      });
      navigate("/clients");
    } catch (error) {
      toast.error(formatSentenceCase("Error al guardar"));
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
        title={formatSentenceCase("NUEVO CLIENTE")}
        subtitle={formatSentenceCase("Registro de nuevo cliente en la base de datos centralizada.")}
        icon={User}
        onBack={() => navigate("/clients")}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Nombre completo *")}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={formatSentenceCase("Ej. Juan Pérez")} 
                        {...field}
                        className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="md:col-span-1">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <EmailInputField 
                          label="Email"
                          placeholder="juan@ejemplo.com"
                          error={fieldState.error?.message}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="whatsappPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <PhoneInput 
                          required
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Dirección de obra")}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={formatSentenceCase("Calle, ciudad, barrio...")} 
                          {...field}
                          className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary"
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
              onClick={() => navigate("/clients")}
              className="font-bold uppercase text-xs tracking-widest h-12 px-8 rounded-none"
            >
              {formatSentenceCase("Cancelar")}
            </Button>
            <PrimaryButton 
              type="submit"
              disabled={isSaving}
              loading={isSaving}
              label="Guardar cliente"
              icon={Zap}
              className="h-12 px-10 rounded-none"
            />
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
