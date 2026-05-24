import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Package, Tag, FileText, Save, Loader2 } from "lucide-react";
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
import { useMaterials } from "@/hooks/useMaterials";
import { toast } from "sonner";

const materialSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  category: z.enum(['cocinas', 'closets', 'puertas', 'herrajes', 'accesorios', 'otros'], {
    required_error: "Selecciona una categoría",
    invalid_type_error: "Selecciona una categoría",
  }),
  description: z.string().min(5, "La descripción debe ser más detallada"),
  price: z.number({
    required_error: "El precio es obligatorio",
    invalid_type_error: "Ingresa un precio válido",
  }).min(0, "El precio no puede ser negativo"),
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
      category: undefined,
      description: "",
      price: undefined as unknown as number,
      unit: "",
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
      className="max-w-4xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="NUEVO MATERIAL"
        subtitle="Registro de insumos, herrajes y acabados para el catálogo de producción."
        icon={Package}
        onBack={() => navigate("/settings/materials")}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5"
        >
          {/* Brand line */}
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

          <div className="p-8 space-y-10">

            {/* ── Sección 1: Datos principales ─────────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <Package className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Datos del Material
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Nombre del Material <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ej: Melamina Roble Gris 18mm"
                            className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                          />
                        </FormControl>
                        <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                      </FormItem>
                    )}
                  />
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
                          value={field.value ?? ""}
                          placeholder="Ej. 85000"
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : Number(e.target.value)
                            )
                          }
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] w-full bg-primary/20" />

            {/* ── Sección 2: Clasificación ──────────────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Clasificación
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <SelectValue placeholder="Seleccionar categoría..." />
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
                        <Input
                          {...field}
                          placeholder="Ej: tablero, pieza, mt"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="h-[1px] w-full bg-primary/20" />

            {/* ── Sección 3: Detalles técnicos ─────────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary/40 pl-4">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Detalles Técnicos{" "}
                  <span className="text-muted-foreground font-medium normal-case">
                    (opcional)
                  </span>
                </h3>
              </div>

              <FormField
                control={form.control}
                name="photoUrl"
                render={({ field }) => (
                  <FormItem className="max-w-md">
                    <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      URL de Imagen
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://..."
                        className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                      />
                    </FormControl>
                    <p className="text-[10px] text-muted-foreground italic">
                      Se muestra en el catálogo de producción. Dejar vacío para usar imagen genérica.
                    </p>
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
                        rows={5}
                        className="w-full bg-background/50 border border-border/50 rounded-none p-4 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground resize-none"
                        placeholder="Detalles de textura, marca, calibre, proveedor..."
                      />
                    </FormControl>
                    <FormMessage className="text-[10px] uppercase font-bold text-destructive" />
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
                onClick={() => navigate("/settings/materials")}
                className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
              >
                Cancelar
              </Button>
              <PrimaryButton
                type="submit"
                disabled={isSaving}
                loading={isSaving}
                label="Registrar Material"
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
