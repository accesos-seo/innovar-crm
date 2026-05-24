import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Save, Loader2, AlertTriangle } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import {
  useSetting,
  useUpdateSetting,
} from "@/hooks/settings/useSystemSettings";

const FLAG_KEY = "slice_3_enabled";
const WINDOW_KEY = "payment_window_days";
const MIN_ADVANCE_KEY = "suggested_min_advance_pct";

function jsonbToBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === "true") return true;
  if (
    typeof value === "object" &&
    value !== null &&
    "enabled" in (value as Record<string, unknown>)
  ) {
    return (value as { enabled: unknown }).enabled === true;
  }
  return false;
}

function jsonbToNumber(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export default function PaymentSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const flagQuery = useSetting<unknown>(FLAG_KEY);
  const windowQuery = useSetting<unknown>(WINDOW_KEY);
  const advanceQuery = useSetting<unknown>(MIN_ADVANCE_KEY);
  const updateSetting = useUpdateSetting();

  const initialLoading =
    flagQuery.isLoading || windowQuery.isLoading || advanceQuery.isLoading;

  const [enabled, setEnabled] = React.useState(false);
  const [windowDays, setWindowDays] = React.useState("7");
  const [minAdvance, setMinAdvance] = React.useState("30");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (initialLoading || hydrated) return;
    setEnabled(jsonbToBool(flagQuery.data));
    setWindowDays(String(jsonbToNumber(windowQuery.data, 7)));
    setMinAdvance(String(jsonbToNumber(advanceQuery.data, 30)));
    setHydrated(true);
  }, [initialLoading, hydrated, flagQuery.data, windowQuery.data, advanceQuery.data]);

  const isSaving = updateSetting.isPending;

  const windowNum = Number(windowDays);
  const advanceNum = Number(minAdvance);
  const windowValid =
    Number.isInteger(windowNum) && windowNum >= 1 && windowNum <= 60;
  const advanceValid =
    Number.isFinite(advanceNum) && advanceNum >= 0 && advanceNum <= 100;
  const canSave = windowValid && advanceValid;

  const handleSave = async () => {
    if (!canSave) return;
    await updateSetting.mutateAsync({ key: FLAG_KEY, value: enabled });
    await updateSetting.mutateAsync({ key: WINDOW_KEY, value: windowNum });
    await updateSetting.mutateAsync({ key: MIN_ADVANCE_KEY, value: advanceNum });
    qc.invalidateQueries({ queryKey: ["system_settings", FLAG_KEY] });
  };

  if (initialLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Cargando configuración de pagos" />
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
        title="Configuración de Pagos"
        subtitle="Activar el flujo de pago público y ajustar parámetros del módulo financiero."
        icon={Settings2}
        onBack={() => navigate("/settings")}
      />

      <div className="bg-card border border-border/10 p-8 space-y-8">
        {/* Feature flag */}
        <div className="flex items-start justify-between gap-6 pb-6 border-b border-border/10">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Flujo de pago Slice 3
            </p>
            <h3 className="text-base font-bold text-foreground mt-1">
              Activar pago desde cotización pública
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-md">
              Cuando está activo, el cliente ve datos bancarios y puede subir
              comprobante directamente desde su enlace público. Si está
              apagado, recibe un mensaje genérico ("te contactaremos por
              WhatsApp").
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(c) => setEnabled(!!c)}
            disabled={isSaving}
          />
        </div>

        {/* Window days */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Ventana de pago (días)
          </label>
          <Input
            type="number"
            min={1}
            max={60}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
            disabled={isSaving}
            className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium max-w-[160px]"
          />
          <p className="text-[10px] text-muted-foreground italic">
            Días que el cliente tiene para pagar después de aceptar. Pasado ese
            plazo, la cotización pasa a <strong>expirada</strong>.
          </p>
          {!windowValid && (
            <p className="text-[10px] text-destructive">
              Debe ser un entero entre 1 y 60.
            </p>
          )}
        </div>

        {/* Min advance pct */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Anticipo mínimo sugerido (%)
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minAdvance}
            onChange={(e) => setMinAdvance(e.target.value)}
            disabled={isSaving}
            className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium max-w-[160px]"
          />
          <p className="text-[10px] text-muted-foreground italic">
            Si el cliente reporta un pago menor a este porcentaje del total,
            mostramos una advertencia al admin antes de aprobar.
          </p>
          {!advanceValid && (
            <p className="text-[10px] text-destructive">
              Debe estar entre 0 y 100.
            </p>
          )}
        </div>

        <div className="pt-6 border-t border-border/10 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !canSave}
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

      <div className="p-6 bg-yellow-500/5 border border-yellow-500/30 rounded-sm flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-200/80 leading-relaxed">
          Apagar la bandera desactiva el flujo para todos los clientes
          inmediatamente. Las cotizaciones aceptadas vuelven al mensaje
          genérico hasta que se vuelva a activar.
        </p>
      </div>
    </motion.div>
  );
}
