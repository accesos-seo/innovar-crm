import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Landmark, Save, Smartphone, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useBankDetails } from "@/hooks/useBankDetails";
import {
  useCreateBankDetail,
  useDeleteBankDetail,
  useSetActiveBankDetail,
  type CreateBankDetailInput,
} from "@/hooks/useBankDetailsMutations";
import { BankDetailCard } from "@/components/finanzas/BankDetailCard";

const BANK_OPTIONS = [
  { value: "bancolombia", label: "Bancolombia" },
  { value: "banco_de_bogota", label: "Banco de Bogotá" },
  { value: "banco_occidente", label: "Banco Occidente" },
  { value: "banco_caja_social", label: "Banco Caja Social" },
  { value: "bbva", label: "BBVA" },
  { value: "santander", label: "Santander" },
  { value: "citibank", label: "Citibank" },
  { value: "banco_av_villas", label: "Banco AV Villas" },
  { value: "banco_popular", label: "Banco Popular" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "otro", label: "Otro" },
];

const bankDetailSchema = z.object({
  bank_name: z.string().min(1, "Selecciona un banco"),
  account_number: z
    .string()
    .min(1, "Número de cuenta requerido")
    .regex(/^\d+$/, "Solo dígitos")
    .min(8, "Mínimo 8 dígitos")
    .max(20, "Máximo 20 dígitos"),
  account_type: z.enum(["ahorro", "corriente"]),
  holder_name: z.string().min(3, "Mínimo 3 caracteres"),
  holder_id: z
    .string()
    .min(1, "Cédula o NIT requerido")
    .regex(/^\d+$/, "Solo dígitos")
    .min(8, "Mínimo 8 dígitos")
    .max(11, "Máximo 11 dígitos"),
  nequi_phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?57\d{9,10}$/.test(val.replace(/\s+/g, "")), {
      message: "Formato inválido. Ej: +573001234567",
    }),
  daviplata_phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\+?57\d{9,10}$/.test(val.replace(/\s+/g, "")),
      { message: "Formato inválido. Ej: +573001234567" }
    ),
});

type BankDetailFormValues = z.infer<typeof bankDetailSchema>;

export default function BankSettingsPage() {
  const navigate = useNavigate();
  const { data: bankDetails, isLoading } = useBankDetails();
  const createBankDetail = useCreateBankDetail();
  const deleteBankDetail = useDeleteBankDetail();
  const setActiveBankDetail = useSetActiveBankDetail();

  const isProcessing =
    createBankDetail.isPending ||
    deleteBankDetail.isPending ||
    setActiveBankDetail.isPending;

  const form = useForm<BankDetailFormValues>({
    resolver: zodResolver(bankDetailSchema),
    defaultValues: {
      bank_name: "",
      account_number: "",
      account_type: "ahorro",
      holder_name: "",
      holder_id: "",
      nequi_phone: "",
      daviplata_phone: "",
    },
  });

  const onSubmit = async (values: BankDetailFormValues) => {
    await createBankDetail.mutateAsync(values as CreateBankDetailInput);
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Cargando datos bancarios" />
      </div>
    );
  }

  const activeDetail = bankDetails?.find((d) => d.is_active);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="Datos Bancarios"
        subtitle="Cuenta de cobro mostrada al cliente en su cotización pública aprobada."
        icon={Landmark}
        onBack={() => navigate("/settings")}
      />

      {/* Cuentas existentes */}
      {bankDetails && bankDetails.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Cuentas configuradas
          </h3>
          {bankDetails.map((detail) => (
            <BankDetailCard
              key={detail.id}
              detail={detail}
              isActive={detail.id === activeDetail?.id}
              onSetActive={(id) => setActiveBankDetail.mutateAsync(id)}
              onDelete={(id) => deleteBankDetail.mutateAsync(id)}
              isLoading={isProcessing}
            />
          ))}
        </div>
      )}

      {/* Formulario inline — mismo patrón que LeadCreate */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5"
        >
          {/* Gradiente de marca */}
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

          <div className="p-8 space-y-10">
            {/* ── Sección 1: Datos de la cuenta ─────────────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <Landmark className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Datos de la cuenta
                </h3>
              </div>

              {/* Fila 1: Banco · Tipo · Número */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                        Banco *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                            <SelectValue placeholder="Selecciona un banco" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-sm border-border/20 shadow-xl">
                          {BANK_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="font-medium"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="account_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                        Tipo de cuenta *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-sm border-border/20 shadow-xl">
                          <SelectItem value="ahorro" className="font-medium">
                            Ahorros
                          </SelectItem>
                          <SelectItem value="corriente" className="font-medium">
                            Corriente
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="account_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                        Número de cuenta *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej. 12345678901234"
                          inputMode="numeric"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Fila 2: Titular · Cédula/NIT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="holder_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                        Titular de la cuenta *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej. Innovar Cocinas SAS"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="holder_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                        Cédula o NIT del titular *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ej. 900123456"
                          inputMode="numeric"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Sección 2: Billeteras digitales ────────────────────────── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <Smartphone className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Billeteras digitales{" "}
                  <span className="text-muted-foreground font-medium normal-case">
                    (opcional)
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="nequi_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Nequi (celular)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="+573001234567"
                          type="tel"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground italic">
                        Dejar vacío si no se usa.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="daviplata_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Daviplata (celular)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="+573001234567"
                          type="tel"
                          className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                        />
                      </FormControl>
                      <p className="text-[10px] text-muted-foreground italic">
                        Dejar vacío si no se usa.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Footer del formulario */}
          <div className="px-8 py-8 border-t border-border/10 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span className="text-primary mr-1">*</span> Campos obligatorios
            </p>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => form.reset()}
                className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
              >
                Limpiar
              </Button>
              <PrimaryButton
                type="submit"
                disabled={isProcessing}
                loading={createBankDetail.isPending}
                label="Guardar cuenta"
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
