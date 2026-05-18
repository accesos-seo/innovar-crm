import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { CreditCard, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  category: z.enum(['cocina_base', 'mesones', 'muebles_especiales', 'extras', 'puertas_tapas', 'herrajes', 'closets', 'puertas_producto', 'centros_tv', 'otros', 'acabados_especiales']),
  description: z.string().min(5, "La descripción debe ser más detallada"),
  value: z.number().min(0, "El valor no puede ser negativo"),
  unit: z.string().min(1, "La unidad es obligatoria"),
});

type PricingFormData = z.infer<typeof pricingSchema>;

const categoryMap = {
  cocina_base: "Cocina Base",
  mesones: "Mesones",
  muebles_especiales: "Muebles Especiales",
  extras: "Extras",
  puertas_tapas: "Puertas y Tapas",
  herrajes: "Herrajes",
  closets: "Closets",
  puertas_producto: "Puertas Producto",
  centros_tv: "Centros de TV",
  acabados_especiales: "Acabados Especiales",
  otros: "Otros",
};

export default function PricingCreatePage() {
  const navigate = useNavigate();
  const { createItem, isSaving } = usePricing();

  const form = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      code: "",
      name: "",
      category: "otros",
      description: "",
      value: 0,
      unit: "ml",
    }
  });

  const onSubmit = async (data: PricingFormData) => {
    try {
      await createItem(data);
      toast.success("Precio registrado correctamente en el tarifario");
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
      className="max-w-5xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title="NUEVO PRECIO"
        subtitle="Configuración de valores base para el tarifario maestro."
        icon={CreditCard}
      />

      <Card className="bg-card border-border/10 rounded-none shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {/* Columna 1 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                    <span className="text-primary font-bold">01.</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Identidad</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Código <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" placeholder="Ej: CB-001" />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Concepto / Nombre <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" placeholder="Ej: Mueble Base Estándar" />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Columna 2 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                    <span className="text-primary font-bold">02.</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Comercial</h3>
                  </div>

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
                            <SelectTrigger className="bg-background/50 border-border/50 rounded-none h-12 focus:ring-primary">
                              <SelectValue placeholder="Seleccionar categoría">
                                {field.value ? categoryMap[field.value as keyof typeof categoryMap] : undefined}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border/10">
                            {Object.entries(categoryMap).map(([key, label]) => (
                              <SelectItem key={key} value={key} className="text-xs uppercase font-bold tracking-widest">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
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
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" 
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
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
                          <Input {...field} className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" placeholder="Ej: ml, pieza, m2" />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Columna 3 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                    <span className="text-primary font-bold">03.</span>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Detalles</h3>
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
                            className="w-full min-h-[120px] bg-background/50 border border-border/50 rounded-none p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground"
                            placeholder="Detalles técnicos para la cotización..."
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-border/10 flex justify-end gap-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => navigate("/settings/pricing")}
                  className="h-12 px-8 rounded-none border-border/50 text-xs font-bold uppercase tracking-[0.2em] hover:bg-muted/20"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="h-12 px-8 rounded-none bg-primary text-primary-foreground font-bold uppercase text-xs tracking-[0.2em] hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Registrar Valor
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
