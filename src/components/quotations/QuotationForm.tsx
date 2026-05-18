import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quotationSchema, type QuotationInsert } from "@/schemas/quotation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Loader2, Save, Plus, Trash2 } from "lucide-react";
import { useDebounce } from "use-debounce";
import { supabase } from "@/lib/supabaseClient";

interface QuotationFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function QuotationForm({ initialData, onSubmit, onCancel, isSubmitting }: QuotationFormProps) {
  const [clientSearch, setClientSearch] = React.useState("");
  const [debouncedSearch] = useDebounce(clientSearch, 300);
  const [isSearchingClients, setIsSearchingClients] = React.useState(false);
  const [clients, setClients] = React.useState<{ id: string; name: string }[]>([]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      client_id: initialData?.client_id || "",
      quotation_number: initialData?.quotation_number || "draft", // Will be overridden on backend
      version: initialData?.version || 1,
      line_items: initialData?.line_items || [
        { item_type: "material", description: "", quantity: 1, unit_price: 0, discount_percent: 0, total_line: 0 }
      ],
      subtotal: initialData?.subtotal || 0,
      tax_percent: initialData?.tax_percent || 16,
      tax_amount: initialData?.tax_amount || 0,
      discount_global: initialData?.discount_global || 0,
      total_amount: initialData?.total_amount || 0,
      payment_terms: initialData?.payment_terms || "50% anticipo, 50% contra entrega",
      validity_days: initialData?.validity_days || 30,
      delivery_time_days: initialData?.delivery_time_days || 15,
      notes_client: initialData?.notes_client || "",
      notes_internal: initialData?.notes_internal || "",
      status: initialData?.status || "DRAFT",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const selectedClientId = watch("client_id");
  const lineItems = watch("line_items");
  const taxPercent = watch("tax_percent");
  const discountGlobal = watch("discount_global");

  // Calcular totales automáticamente
  React.useEffect(() => {
    let subtotal = 0;
    const updatedItems = lineItems.map((item: any) => {
      const lineTotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
      subtotal += lineTotal;
      return { ...item, total_line: lineTotal };
    });

    const taxAmount = subtotal * (taxPercent / 100);
    const totalAmount = subtotal + taxAmount - discountGlobal;

    setValue("subtotal", subtotal);
    setValue("tax_amount", taxAmount);
    setValue("total_amount", totalAmount);
  }, [lineItems, taxPercent, discountGlobal, setValue]);

  // Búsqueda real de clientes en Supabase
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-card p-8 border border-border/10 rounded-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

        {/* Tiempo de Entrega */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Tiempo de Entrega (Días)</label>
          <Input
            type="number"
            {...register("delivery_time_days", { valueAsNumber: true })}
            placeholder="Ej: 15"
            className={cn(errors.delivery_time_days && "border-destructive focus-visible:ring-destructive")}
          />
          {errors.delivery_time_days && (
            <p className="text-sm text-destructive mt-1">{(errors.delivery_time_days as any).message}</p>
          )}
        </div>
      </div>

      {/* Líneas de Ítem */}
      <div className="space-y-4 pt-4 border-t border-border/10">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-foreground">Líneas de presupuesto</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ item_type: "material", description: "", quantity: 1, unit_price: 0, discount_percent: 0, total_line: 0 })}
            className="text-xs font-bold tracking-tight"
          >
            <Plus className="w-4 h-4 mr-2" /> Agregar ítem
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-wrap md:flex-nowrap gap-4 items-start p-4 bg-muted/20 border border-border/10 rounded-sm">
              <div className="w-full md:w-1/6 space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground">Tipo</label>
                <select
                  {...register(`line_items.${index}.item_type`)}
                  className="flex h-10 w-full rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="material">Material</option>
                  <option value="accesorio">Accesorio</option>
                  <option value="mano_obra">Mano de Obra</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="w-full md:w-2/6 space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground">Descripción</label>
                <Input {...register(`line_items.${index}.description`)} placeholder="Descripción del ítem" />
              </div>
              <div className="w-full md:w-1/6 space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground">Cant.</label>
                <Input type="number" {...register(`line_items.${index}.quantity`, { valueAsNumber: true })} />
              </div>
              <div className="w-full md:w-1/6 space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground">P. unitario</label>
                <Input type="number" {...register(`line_items.${index}.unit_price`, { valueAsNumber: true })} />
              </div>
              <div className="w-full md:w-1/6 space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground">Total</label>
                <div className="h-10 flex items-center px-3 border border-transparent bg-background/50 font-bold">
                  ${(watch(`line_items.${index}.quantity`) * watch(`line_items.${index}.unit_price`)).toLocaleString()}
                </div>
              </div>
              <div className="pt-6">
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {errors.line_items && (
          <p className="text-sm text-destructive mt-1">{(errors.line_items as any).message}</p>
        )}
      </div>

      {/* Totales */}
      <div className="flex flex-col md:flex-row justify-end gap-8 pt-4 border-t border-border/10">
        <div className="w-full md:w-1/3 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-bold">${watch("subtotal")?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Impuestos ({watch("tax_percent")}%):</span>
            <span className="font-bold">${watch("tax_amount")?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Descuento Global:</span>
            <Input type="number" {...register("discount_global", { valueAsNumber: true })} className="w-24 h-8 text-right" />
          </div>
          <div className="flex justify-between items-center text-lg border-t border-border/10 pt-4">
            <span className="font-bold">Total:</span>
            <span className="font-black text-primary">${watch("total_amount")?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Action Footer Sticky */}
      <div className="fixed bottom-0 left-64 right-0 bg-background/80 backdrop-blur-md border-t border-border/10 p-6 flex justify-between items-center z-50">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-8 font-bold text-sm tracking-tight h-12 rounded-none"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "px-12 bg-gradient-to-r from-primary to-primary-dark",
            "hover:from-primary-dark hover:to-primary",
            "text-primary-foreground font-bold text-sm tracking-tight h-14",
            "rounded-md shadow-lg shadow-primary/20 transition-all duration-300",
            "active:scale-95 border-none flex items-center gap-2"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar cotización
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
