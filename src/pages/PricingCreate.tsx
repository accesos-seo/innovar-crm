import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { CreditCard, Tag, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePricing } from "@/hooks/usePricing";
import { toast } from "sonner";

const pricingSchema = z.object({
  code: z.string().min(2, "El código es obligatorio"),
  name: z.string().min(2, "El nombre es obligatorio"),
  category: z.enum(['cocina', 'closet', 'puerta', 'centro_tv', 'meson', 'herraje', 'otro']),
  description: z.string().min(5, "La descripción debe ser más detallada"),
  value: z.number().min(0, "El valor no puede ser negativo"),
  unit: z.string().min(1, "La unidad es obligatoria"),
});

type PricingFormData = z.infer<typeof pricingSchema>;

const categoryMap = {
  cocina: "Cocina base",
  closet: "Closets",
  puerta: "Puertas",
  centro_tv: "Centro de TV",
  meson: "Mesones",
  herraje: "Herrajes",
  otro: "Otros",
};

export default function PricingCreatePage() {
  const navigate = useNavigate();
  const { createItem, isSaving } = usePricing();

  const form = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      code: "",
      name: "",
      category: undefined,
      description: "",
      value: undefined as unknown as number,
      unit: "",
    }
  });

  const onSubmit = async (data: PricingFormData) => {
    try {
      await createItem(data);
      toast.success("Precio registrado en el tarifario");
      navigate("/settings/pricing");
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar el precio");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="NUEVO PRECIO"
        subtitle="Configuración de valores base para el tarifario maestro."
        icon={CreditCard}
        onBack={() => navigate("/settings/pricing")}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5"
        >
          {/* Brand line */}
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

          <div className="p-8 space-y-10">

            {/* ── Sección 1: Identificación ────────────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Identificación
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Código <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej. CB-001"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold text-destructive" />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Concepto / Nombre <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ej. Mueble Base Estándar 60cm"
                            className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] font-bold text-destructive" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] w-full bg-primary/20" />

            {/* ── Sección 2: Valores del Tarifario ─────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Valores del Tarifario
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Categoría <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                            <SelectValue placeholder="Selecciona una categoría..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-sm border-border/20 shadow-xl">
                          {Object.entries(categoryMap).map(([key, label]) => (
                            <SelectItem key={key} value={key} className="font-medium">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[10px] font-bold text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Valor Unitario ($) <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Ej. 250000"
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Unidad <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej. ml, pieza, m²"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] font-bold text-destructive" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] w-full bg-primary/20" />

            {/* ── Sección 3: Descripción (opcional) ────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary/40 pl-4">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Descripción{" "}
                  <span className="text-muted-foreground font-medium normal-case">
                    (plantilla de cotización)
                  </span>
                </h3>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Descripción / Plantilla
                    </FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={5}
                        className="w-full bg-background/50 border border-border/50 rounded-none p-4 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground resize-none"
                        placeholder="Descripción técnica que aparecerá en la cotización del cliente..."
                      />
                    </FormControl>
                    <p className="text-[10px] text-muted-foreground italic">
                      Este texto se usa como plantilla al generar cotizaciones.
                    </p>
                    <FormMessage className="text-[10px] font-bold text-destructive" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-8 border-t border-border/10 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span className="text-primary mr-1">*</span> Campos obligatorios
            </p>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/settings/pricing")}
                className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
              >
                Cancelar
              </Button>
              <PrimaryButton
                type="submit"
                disabled={isSaving}
                loading={isSaving}
                label="Registrar Valor"
                icon={Save}
                className="flex-1 sm:flex-none h-14 px-12 rounded-none"
              />
            </div>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
