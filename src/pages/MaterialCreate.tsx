import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Package, Save, Loader2 } from "lucide-react";
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
import { useMaterials } from "@/hooks/useMaterials";
import { toast } from "sonner";

const materialSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  category: z.enum(['cocinas', 'closets', 'puertas', 'herrajes', 'accesorios', 'otros']),
  description: z.string().min(5, "La descripción debe ser más detallada"),
  price: z.number().min(0, "El precio no puede ser negativo"),
  unit: z.string().min(1, "La unidad es obligatoria"),
  photoUrl: z.string().nullable().optional(),
  active: z.boolean(),
});

type MaterialFormData = z.infer<typeof materialSchema>;

const categoryMap = {
  cocinas: "Cocinas",
  closets: "Closets",
  puertas: "Puertas",
  herrajes: "Herrajes",
  accesorios: "Accesorios",
  otros: "Otros",
};

export default function MaterialCreatePage() {
  const navigate = useNavigate();
  const { createItem, isSaving, items } = useMaterials();

  const form = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      category: "otros",
      description: "",
      price: 0,
      unit: "unidad",
      photoUrl: "",
      active: true,
    }
  });

  const onSubmit = async (data: MaterialFormData) => {
    try {
      await createItem({
        ...data,
        photoUrl: data.photoUrl || `https://picsum.photos/seed/${data.name}/200/200`,
        sortOrder: items.length + 1
      });
      toast.success("Material creado correctamente");
      navigate("/settings/materials");
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el material");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title="NUEVO MATERIAL"
        subtitle="Registro de insumos, herrajes y acabados para el catálogo de producción."
        icon={Package}
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
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Nombre del Material <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" placeholder="Ej: Melamina Roble Gris 18mm" />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />

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
                              <SelectValue placeholder="Seleccionar...">
                                {field.value ? categoryMap[field.value as keyof typeof categoryMap] : undefined}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border/10">
                            {Object.entries(categoryMap).map(([key, label]) => (
                              <SelectItem key={key} value={key} className="text-xs font-bold uppercase tracking-widest focus:bg-primary/10 focus:text-primary">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Precio Base ($) <span className="text-destructive">*</span>
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
                          Unidad de Medida <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" placeholder="Ej: tablero, pieza, mt" />
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
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          URL de Imagen (Opcional)
                        </FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-background/50 border-border/50 rounded-none h-12 focus-visible:ring-primary" placeholder="https://..." />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Descripción Técnica
                        </FormLabel>
                        <FormControl>
                          <textarea 
                            {...field} 
                            className="w-full min-h-[120px] bg-background/50 border border-border/50 rounded-none p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground"
                            placeholder="Detalles de textura, marca, calibre..."
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
                  onClick={() => navigate("/settings/materials")}
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
                      Registrar Material
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
