import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Zap, Mail, MapPin, User, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatSentenceCase } from "@/lib/format-utils";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLeads } from "@/hooks/useLeads";
import { useOpportunities } from "@/hooks/useOpportunities";
import { FEATURES } from "@/lib/features";
import { EmailInputField } from "@/components/shared/EmailInputField";
import { WhatsAppField } from "@/components/shared/WhatsAppField";
import { DEFAULT_COUNTRIES } from "@/hooks/usePhoneInput";
import type { OpportunityPriority, OpportunityStatus, OpportunityDataOrigin } from "@/schemas/opportunity";
import { supabase } from "@/lib/supabaseClient";

interface OpportunityCreateInput {
  clientName: string;
  whatsappPhone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  services: string[];
  priority: OpportunityPriority;
  dataOrigin: OpportunityDataOrigin;
  status?: OpportunityStatus;
  notes?: string | null;
}

const leadSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "El apellido es obligatorio"),
  email: z.string().email("Formato de email inválido").optional().or(z.literal("")),
  phone: z.string().regex(/^\+\d{11,15}$/, "Teléfono incompleto (formato +código país + número)"),
  services: z.array(z.string()).min(1, "Selecciona al menos un servicio"),
  city: z.string().min(1, "La ciudad es obligatoria"),
  customCity: z.string().optional(),
  address: z.string().min(1, "La dirección es obligatoria"),
  priority: z.string().min(1, "Selecciona una prioridad"),
  status: z.string().min(1, "El estado es obligatorio"),
}).refine((data) => {
  if (data.city === "Otro") {
    return !!data.customCity && data.customCity.length > 0;
  }
  return true;
}, {
  message: "La ciudad personalizada es obligatoria",
  path: ["customCity"],
});

type LeadFormValues = z.infer<typeof leadSchema>;

const SERVICES = ["Cocina", "Closet", "Centro TV", "Herrajes", "Otros"];
const CITIES = ["Pereira", "La Virginia", "Dosquebradas", "Cuba", "Santa Rosa", "Otro"];
const PRIORITIES = ["Lo antes posible", "Mediano plazo", "Solo averiguando"] as const;
const STATUSES = [
  { value: "pending", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Cotizado" },
  { value: "lost", label: "Perdido" },
];

const URGENCY_MAP: Record<string, string> = {
  "Lo antes posible": "high",
  "Mediano plazo": "medium",
  "Solo averiguando": "low",
};

const PRIORITY_MAP: Record<string, OpportunityPriority> = {
  "Lo antes posible": "ASAP",
  "Mediano plazo": "SHORT",
  "Solo averiguando": "LON",
};

const STATUS_MAP: Record<string, OpportunityStatus> = {
  pending: "new",
  contacted: "contacted",
  qualified: "quoted",
  lost: "lost",
};

export default function LeadCreate() {
  const navigate = useNavigate();
  const { createLead } = useLeads();
  const { createOpportunity } = useOpportunities();
  const [isSaving, setIsSaving] = React.useState(false);
  const [conflictDialog, setConflictDialog] = React.useState<{
    existingName: string;
    pendingInput: OpportunityCreateInput;
  } | null>(null);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      services: [],
      city: "Pereira",
      customCity: "",
      address: "",
      priority: "Mediano plazo",
      status: "pending",
    },
  });

  const onSubmit = async (values: LeadFormValues) => {
    setIsSaving(true);
    try {
      const resolvedCity =
        values.city === "Otro" ? values.customCity || null : values.city;
      const fullName = `${values.firstName} ${values.lastName}`.trim();
      const phoneWithCountry = values.phone;

      if (FEATURES.opportunitiesEnabled) {
        const opportunityInput: OpportunityCreateInput = {
          clientName: fullName,
          whatsappPhone: phoneWithCountry,
          email: values.email || null,
          address: values.address,
          city: resolvedCity,
          services: values.services,
          priority: PRIORITY_MAP[values.priority] ?? "SHORT",
          dataOrigin: "manual",
          status: STATUS_MAP[values.status] ?? "new",
          notes: null,
        };

        // Pre-check: si el teléfono ya pertenece a un cliente con distinto nombre,
        // mostrar diálogo bloqueante en lugar de avanzar silenciosamente.
        const normalizedPhone = phoneWithCountry.replace(/[^0-9]/g, "");
        const phoneWithPlus = `+${normalizedPhone}`;

        let existingClient: { id: string; name: string } | null = null;
        if (supabase) {
          const { data: byPlain } = await supabase
            .from("clients")
            .select("id, name")
            .eq("whatsapp_phone", normalizedPhone)
            .is("deleted_at", null)
            .limit(1);
          existingClient = byPlain?.[0] ?? null;

          if (!existingClient) {
            const { data: byPlus } = await supabase
              .from("clients")
              .select("id, name")
              .eq("whatsapp_phone", phoneWithPlus)
              .is("deleted_at", null)
              .limit(1);
            existingClient = byPlus?.[0] ?? null;
          }
        }

        if (
          existingClient?.name &&
          existingClient.name.toLowerCase().trim() !== fullName.toLowerCase().trim()
        ) {
          setConflictDialog({ existingName: existingClient.name, pendingInput: opportunityInput });
          setIsSaving(false);
          return;
        }

        await createOpportunity(opportunityInput);
      } else {
        // Comportamiento legacy: insert plano en `clients`.
        const mappedLead = {
          name: fullName,
          email: values.email || null,
          whatsapp_phone: phoneWithCountry,
          services: values.services.join(", "),
          city: resolvedCity,
          address: values.address,
          urgency: URGENCY_MAP[values.priority as string],
          status: values.status,
        };
        await createLead(mappedLead);
      }

      navigate("/solicitudes/leads");
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Error al guardar el lead. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const onError = (errors: any) => {
    const firstErrorKey = Object.keys(errors)[0];
    const element = document.getElementsByName(firstErrorKey)[0] ||
                    document.querySelector(`[id*="${firstErrorKey}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in element) (element as any).focus();
    }
    toast.error("Errores en el formulario", {
      description: "Por favor revisa los campos resaltados en rojo.",
    });
  };

  const handleConflictConfirm = async () => {
    if (!conflictDialog) return;
    setIsSaving(true);
    const pendingInput = conflictDialog.pendingInput;
    setConflictDialog(null);
    try {
      await createOpportunity(pendingInput);
      navigate("/solicitudes/leads");
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Error al guardar el lead. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const watchCity = form.watch("city");

  return (
    <>
      {/* Diálogo bloqueante: número de teléfono ya registrado con otro nombre */}
      <Dialog open={!!conflictDialog} onOpenChange={() => setConflictDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-none border border-border/20 bg-card">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <DialogTitle className="text-sm font-black uppercase tracking-widest">
                Número ya registrado
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Este número de WhatsApp ya pertenece al cliente{" "}
              <span className="font-bold text-foreground">
                "{conflictDialog?.existingName}"
              </span>
              .<br /><br />
              Si continúas, la oportunidad se creará para ese cliente existente.
              Para registrar un cliente nuevo, cancela y usa un número diferente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-2 flex-col sm:flex-row">
            <Button
              variant="ghost"
              className="flex-1 rounded-none border border-border/50 text-xs font-bold uppercase tracking-widest h-11"
              onClick={() => setConflictDialog(null)}
            >
              Cancelar (cambiar número)
            </Button>
            <PrimaryButton
              label={`Crear para "${conflictDialog?.existingName}"`}
              loading={isSaving}
              onClick={handleConflictConfirm}
              className="flex-1 rounded-none text-xs h-11"
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto w-full space-y-8 pb-20"
      >
        <CategoryHeader
          title={formatSentenceCase("NUEVA SOLICITUD (LEAD)")}
          subtitle={formatSentenceCase("Conversión de prospectos a clientes. Completa los datos con precisión.")}
          icon={Zap}
          onBack={() => navigate("/solicitudes/leads")}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onError)} className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
            <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>

            <div className="p-8 space-y-10">
              {/* Sección: Identificación */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">{formatSentenceCase("Identificación del prospecto")}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest">{formatSentenceCase("Nombre *")}</FormLabel>
                        <FormControl>
                          <Input placeholder={formatSentenceCase("Ej. Carlos")} {...field} className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest">{formatSentenceCase("Apellido *")}</FormLabel>
                        <FormControl>
                          <Input placeholder={formatSentenceCase("Ej. Rodríguez")} {...field} className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Sección: Contacto */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                  <Mail className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">{formatSentenceCase("Canales de comunicación")}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <WhatsAppField
                            countries={DEFAULT_COUNTRIES}
                            initialValue={field.value}
                            onChange={(fullPhone) => field.onChange(fullPhone)}
                            label="Teléfono WhatsApp *"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormControl>
                          <EmailInputField
                            label="Email (Opcional)"
                            placeholder="carlos@ejemplo.com"
                            error={fieldState.error?.message}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Sección: Proyecto y Ubicación */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">{formatSentenceCase("Detalles del requerimiento")}</h3>
                </div>

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="services"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary">{formatSentenceCase("Servicios de interés *")}</FormLabel>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {SERVICES.map((item) => (
                            <div key={item}>
                              <FormField
                                control={form.control}
                                name="services"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      className="flex flex-row items-center space-x-3 space-y-0 rounded-none border border-border/50 p-4 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                                      onClick={() => {
                                        const current = field.value || [];
                                        const next = current.includes(item)
                                          ? current.filter((value: string) => value !== item)
                                          : [...current, item];
                                        field.onChange(next);
                                      }}
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(item)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, item])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value: string) => value !== item
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-xs font-bold uppercase cursor-pointer">
                                        {formatSentenceCase(item)}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold uppercase tracking-widest">{formatSentenceCase("Ciudad *")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                                <SelectValue placeholder={formatSentenceCase("Selecciona una ciudad")}>
                                  {field.value ? formatSentenceCase(field.value) : undefined}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="rounded-sm border-border/20 shadow-xl">
                              {CITIES.map(c => (
                                <SelectItem key={c} value={c} className="font-medium">{formatSentenceCase(c)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchCity === "Otro" && (
                      <FormField
                        control={form.control}
                        name="customCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-primary">{formatSentenceCase("Especificar ciudad *")}</FormLabel>
                            <FormControl>
                              <Input placeholder={formatSentenceCase("Nombre de la ciudad")} {...field} className="h-12 rounded-none border-primary/30 bg-primary/5 focus:bg-background font-bold transition-all" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest">{formatSentenceCase("Dirección para visita técnica *")}</FormLabel>
                            <FormControl>
                              <Input placeholder={formatSentenceCase("Ej. Transversal 24 # 45-12, Conjunto Alameda")} {...field} className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background transition-all" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección: Prioridad y Estado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{formatSentenceCase("Prioridad del proyecto *")}</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-3">
                          {PRIORITIES.map((p) => (
                            <label
                              key={p}
                              className={cn(
                                "flex items-center gap-4 p-4 border transition-all cursor-pointer group",
                                field.value === p ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-background hover:border-primary/30"
                              )}
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                field.value === p ? "border-primary" : "border-muted-foreground group-hover:border-primary/50"
                              )}>
                                {field.value === p && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                              </div>
                              <input
                                type="radio"
                                className="hidden"
                                name="priority"
                                value={p}
                                checked={field.value === p}
                                onChange={() => field.onChange(p)}
                              />
                              <span className={cn("text-xs font-bold uppercase tracking-wider", field.value === p ? "text-primary" : "text-muted-foreground")}>{formatSentenceCase(p)}</span>
                            </label>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{formatSentenceCase("Estado inicial del embudo *")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background px-6 font-bold shadow-sm">
                            <SelectValue placeholder={formatSentenceCase("Asignar estado")}>
                              {field.value ? formatSentenceCase(STATUSES.find(s => s.value === field.value)?.label || field.value) : undefined}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-sm border-border/20 shadow-2xl">
                          {STATUSES.map(s => (
                            <SelectItem key={s.value} value={s.value} className="h-10 font-bold uppercase text-[10px] tracking-widest">{formatSentenceCase(s.label)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="p-6 bg-muted/30 border border-dashed border-border/50 flex items-start gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground">{formatSentenceCase("Sugerencia comercial")}</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed italic">{formatSentenceCase("Los nuevos registros deben quedar en")} <b>"{formatSentenceCase("Nuevo")}"</b> {formatSentenceCase("para que el equipo comercial inicie el primer contacto en menos de 15 minutos.")}</p>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Footer del Formulario */}
            <div className="px-8 py-8 border-t border-border/10 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span className="text-primary mr-1">*</span> {formatSentenceCase("Campos mandatorios para procesamiento técnico")}
              </p>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/solicitudes/leads")}
                  className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
                >
                  {formatSentenceCase("Cancelar")}
                </Button>
                <PrimaryButton
                  type="submit"
                  disabled={isSaving}
                  loading={isSaving}
                  label="Registrar Lead"
                  icon={Zap}
                  className="flex-1 sm:flex-none h-14 px-12 rounded-none"
                />
              </div>
            </div>
          </form>
        </Form>
      </motion.div>
    </>
  );
}
