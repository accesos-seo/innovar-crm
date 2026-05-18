import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInsert, type ProjectUpdate } from "@/schemas/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Loader2, FileUp, FileText, X, Save } from "lucide-react";
import { useDebounce } from "use-debounce";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { supabase } from "@/lib/supabaseClient";

interface ProjectFormProps {
  initialData?: Partial<ProjectUpdate>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ProjectForm({ initialData, onSubmit, onCancel, isSubmitting }: ProjectFormProps) {
  const [clientSearch, setClientSearch] = React.useState("");
  const [debouncedSearch] = useDebounce(clientSearch, 300);
  const [isSearchingClients, setIsSearchingClients] = React.useState(false);
  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initialData?.name || "",
      client_id: initialData?.client_id || "",
      work_type: initialData?.work_type || "cocina",
      total_amount: initialData?.total_amount || 0,
      advance_amount: initialData?.advance_amount || 0,
      status: initialData?.status || "contacto",
      notes: initialData?.notes || "",
      estimated_install_date: initialData?.estimated_install_date || "",
      skip_design_process: initialData?.skip_design_process || false,
      is_archived: initialData?.is_archived || false,
      initial_measurements: initialData?.initial_measurements || {},
      design_3d_files: initialData?.design_3d_files || [],
      despiece_files: initialData?.despiece_files || [],
    },
  });

  const selectedClientId = watch("client_id");
  const blueprintFile = watch("blueprint");

  React.useEffect(() => {
    if (debouncedSearch.length < 2) {
      setClients([]);
      return;
    }

    const fetchClients = async () => {
      setIsSearchingClients(true);
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name')
          .ilike('name', `%${debouncedSearch}%`)
          .limit(10);
        
        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.warn("Network/Supabase Info:", error);
      } finally {
        setIsSearchingClients(false);
      }
    };

    fetchClients();
  }, [debouncedSearch]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl">
      <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
      <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Nombre del Proyecto */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Nombre del Proyecto</label>
          <Input
            {...register("name")}
            placeholder="Ej: Cocina Moderna - Residencia Bosques"
            className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
          />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{(errors.name as any).message}</p>
          )}
        </div>

        {/* Tipo de Trabajo */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Tipo de Trabajo</label>
          <select
            {...register("work_type")}
            className={cn(
              "flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              errors.work_type && "border-destructive focus-visible:ring-destructive"
            )}
          >
            <option value="cocina">Cocina</option>
            <option value="closet">Closet / Vestidor</option>
            <option value="puertas">Puertas</option>
            <option value="centro_tv">Centro TV</option>
          </select>
          {errors.work_type && (
            <p className="text-sm text-destructive mt-1">{(errors.work_type as any).message}</p>
          )}
        </div>

        {/* Cliente (Async Search) */}
        <div className="space-y-2 relative">
          <label className="text-sm font-medium text-foreground">Cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nombre..."
              className={cn("pl-10", errors.client_id && "border-destructive focus-visible:ring-destructive")}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>
          
          {/* Dropdown de resultados */}
          {clientSearch.length >= 2 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border shadow-md rounded-sm overflow-hidden">
              {isSearchingClients ? (
                <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando clientes...
                </div>
              ) : clients.length > 0 ? (
                <div className="max-h-48 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                        selectedClientId === client.id && "bg-primary/10 text-primary font-bold"
                      )}
                      onClick={() => {
                        setValue("client_id", client.id);
                        setClientSearch(client.name);
                        setClients([]);
                      }}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Sin resultados para "{clientSearch}"
                </div>
              )}
            </div>
          )}
          
          {errors.client_id && (
            <p className="text-sm text-destructive mt-1">{(errors.client_id as any).message}</p>
          )}
        </div>

        {/* Monto Total */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Monto Total ($)</label>
          <Input
            type="number"
            {...register("total_amount", { valueAsNumber: true })}
            placeholder="0.00"
            className={cn(errors.total_amount && "border-destructive focus-visible:ring-destructive")}
          />
          {errors.total_amount && (
            <p className="text-sm text-destructive mt-1">{(errors.total_amount as any).message}</p>
          )}
        </div>

        {/* Adelanto Recibido */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Adelanto Recibido ($)</label>
          <Input
            type="number"
            {...register("advance_amount", { valueAsNumber: true })}
            placeholder="0.00"
            className={cn(errors.advance_amount && "border-destructive focus-visible:ring-destructive")}
          />
          {errors.advance_amount && (
            <p className="text-sm text-destructive mt-1">{(errors.advance_amount as any).message}</p>
          )}
        </div>

        {/* Fecha Estimada de Instalación */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Fecha Estimada de Instalación</label>
          <Input
            type="date"
            {...register("estimated_install_date")}
            className={cn(errors.estimated_install_date && "border-destructive focus-visible:ring-destructive")}
          />
          {errors.estimated_install_date && (
            <p className="text-sm text-destructive mt-1">{(errors.estimated_install_date as any).message}</p>
          )}
        </div>
      </div>

      {/* Carga de Planos */}
      <div className="space-y-4 pt-4 border-t border-border/10">
        <label className="text-sm font-medium text-foreground">Planos y Documentación (Opcional)</label>
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-sm cursor-pointer bg-muted/20 hover:bg-muted/30 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileUp className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                <span className="font-bold">Haz clic para subir</span> o arrastra y suelta
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">JPG, PNG, WebP o PDF (Máx. 5MB)</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setValue("blueprint", file, { shouldValidate: true });
              }}
            />
          </label>
        </div>
        
        {/* Preview del archivo seleccionado */}
        {blueprintFile && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-primary/10 p-2 rounded-sm">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{blueprintFile.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {(blueprintFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => setValue("blueprint", undefined)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {errors.blueprint && (
          <p className="text-sm text-destructive mt-1">{(errors.blueprint as any).message}</p>
        )}
      </div>

      {/* Action Footer Sticky */}
      <div className="fixed bottom-0 left-64 right-0 bg-background/80 backdrop-blur-md border-t border-border/10 p-6 flex justify-between items-center z-50">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-8 font-bold uppercase text-xs tracking-widest h-12 rounded-none"
        >
          Cancelar
        </Button>
        <PrimaryButton 
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          label="Guardar Proyecto"
          icon={Save}
          className="px-12 h-14 rounded-md"
        />
      </div>
      </div>
    </form>
  );
}
