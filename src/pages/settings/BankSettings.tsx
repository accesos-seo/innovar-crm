import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Save, Loader2 } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";
import { useUpdateSetting } from "@/hooks/settings/useSystemSettings";

interface BankField {
  key: string;
  label: string;
  placeholder?: string;
  helper?: string;
}

const BANK_FIELDS: BankField[] = [
  { key: "bank_name", label: "Banco", placeholder: "Ej: Bancolombia" },
  {
    key: "bank_account_number",
    label: "Número de cuenta",
    placeholder: "Solo números, sin guiones",
  },
  {
    key: "bank_account_type",
    label: "Tipo de cuenta",
    placeholder: "Ahorros / Corriente",
  },
  {
    key: "bank_holder_name",
    label: "Titular de la cuenta",
    placeholder: "Nombre completo / Razón social",
  },
  {
    key: "bank_holder_id",
    label: "Cédula o NIT del titular",
    placeholder: "Sin puntos ni guiones",
  },
  {
    key: "nequi_phone",
    label: "Nequi (celular)",
    placeholder: "+57 300 000 0000",
    helper: "Dejar vacío si no se usa.",
  },
  {
    key: "daviplata_phone",
    label: "Daviplata (celular)",
    placeholder: "+57 300 000 0000",
    helper: "Dejar vacío si no se usa.",
  },
];

const KEYS = BANK_FIELDS.map((f) => f.key);

function useBankSettings() {
  return useQuery({
    queryKey: ["system_settings", "bank_block"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", KEYS);
      if (error) throw mapSupabaseError(error);
      const out: Record<string, string> = {};
      for (const row of data ?? []) {
        const v = (row as { key: string; value: unknown }).value;
        out[(row as { key: string }).key] =
          typeof v === "string" ? v : v == null ? "" : String(v);
      }
      return out;
    },
  });
}

export default function BankSettingsPage() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useBankSettings();
  const updateSetting = useUpdateSetting();

  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (isLoading || hydrated || !settings) return;
    const next: Record<string, string> = {};
    BANK_FIELDS.forEach((f) => {
      next[f.key] = settings[f.key] ?? "";
    });
    setDraft(next);
    setHydrated(true);
  }, [isLoading, hydrated, settings]);

  const isSaving = updateSetting.isPending;

  const handleSave = async () => {
    for (const f of BANK_FIELDS) {
      const value = (draft[f.key] ?? "").trim();
      await updateSetting.mutateAsync({ key: f.key, value });
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Cargando datos bancarios" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="Datos Bancarios"
        subtitle="Cuenta de cobro mostrada al cliente en su cotización pública aprobada."
        icon={Landmark}
        onBack={() => navigate("/settings")}
      />

      <div className="bg-card border border-border/10 p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BANK_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {f.label}
              </label>
              <Input
                value={draft[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                disabled={isSaving}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium"
              />
              {f.helper && (
                <p className="text-[10px] text-muted-foreground italic">
                  {f.helper}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border/10 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-12 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 px-8"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>
      </div>

      <div className="p-6 bg-primary/5 border border-primary/20 rounded-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
          Importante
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Estos datos se muestran únicamente cuando el cliente acepta la
          cotización y el flujo de pago público está activo. Si querés ocultar
          una billetera digital, dejá el campo vacío.
        </p>
      </div>
    </motion.div>
  );
}
