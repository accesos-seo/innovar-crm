import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Save, Loader2, AlertTriangle, Pencil, X, CheckCircle2, XCircle } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { cn } from "@/lib/utils";
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

  // Valores guardados (fuente de verdad)
  const [savedEnabled, setSavedEnabled] = React.useState(false);
  const [savedWindowDays, setSavedWindowDays] = React.useState(7);
  const [savedMinAdvance, setSavedMinAdvance] = React.useState(30);
  const [hydrated, setHydrated] = React.useState(false);

  // Valores del draft (mientras se edita)
  const [editMode, setEditMode] = React.useState(false);
  const [draftEnabled, setDraftEnabled] = React.useState(false);
  const [draftWindowDays, setDraftWindowDays] = React.useState("7");
  const [draftMinAdvance, setDraftMinAdvance] = React.useState("30");

  React.useEffect(() => {
    if (initialLoading || hydrated) return;
    const e = jsonbToBool(flagQuery.data);
    const w = jsonbToNumber(windowQuery.data, 7);
    const a = jsonbToNumber(advanceQuery.data, 30);
    setSavedEnabled(e);
    setSavedWindowDays(w);
    setSavedMinAdvance(a);
    setDraftEnabled(e);
    setDraftWindowDays(String(w));
    setDraftMinAdvance(String(a));
    setHydrated(true);
  }, [initialLoading, hydrated, flagQuery.data, windowQuery.data, advanceQuery.data]);

  const enterEditMode = () => {
    setDraftEnabled(savedEnabled);
    setDraftWindowDays(String(savedWindowDays));
    setDraftMinAdvance(String(savedMinAdvance));
    setEditMode(true);
  };

  const cancelEdit = () => setEditMode(false);

  const isSaving = updateSetting.isPending;
  const windowNum = Number(draftWindowDays);
  const advanceNum = Number(draftMinAdvance);
  const windowValid = Number.isInteger(windowNum) && windowNum >= 1 && windowNum <= 60;
  const advanceValid = Number.isFinite(advanceNum) && advanceNum >= 0 && advanceNum <= 100;
  const canSave = windowValid && advanceValid;

  const handleSave = async () => {
    if (!canSave) return;
    await updateSetting.mutateAsync({ key: FLAG_KEY, value: draftEnabled });
    await updateSetting.mutateAsync({ key: WINDOW_KEY, value: windowNum });
    await updateSetting.mutateAsync({ key: MIN_ADVANCE_KEY, value: advanceNum });
    qc.invalidateQueries({ queryKey: ["system_settings", FLAG_KEY] });
    setSavedEnabled(draftEnabled);
    setSavedWindowDays(windowNum);
    setSavedMinAdvance(advanceNum);
    setEditMode(false);
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
      className="max-w-3xl mx-auto w-full space-y-10 pb-20"
    >
      <CategoryHeader
        title="Configuración de Pagos"
        subtitle="Activar el flujo de pago público y ajustar parámetros del módulo financiero."
        icon={Settings2}
        onBack={() => navigate("/settings")}
      />

      {/* Vista principal: tarjeta read-only con configuración actual */}
      {!editMode ? (
        <motion.div
          key="view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Card de configuración actual */}
          <div className="bg-card border border-border/10 rounded-sm overflow-hidden">
            {/* Estado del flujo — destacado */}
            <div className={cn(
              "flex items-center justify-between p-6 border-b border-border/10",
              savedEnabled ? "bg-primary/5" : "bg-muted/10"
            )}>
              <div className="flex items-center gap-4">
                {savedEnabled
                  ? <CheckCircle2 className="w-5 h-5 text-primary" />
                  : <XCircle className="w-5 h-5 text-muted-foreground" />
                }
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Flujo de Pago Público
                  </p>
                  <p className={cn(
                    "text-sm font-bold mt-0.5",
                    savedEnabled ? "text-primary" : "text-muted-foreground"
                  )}>
                    {savedEnabled ? "Activo" : "Inactivo"}
                  </p>
                </div>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest",
                savedEnabled
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted/20 text-muted-foreground border border-border/30"
              )}>
                {savedEnabled ? "Slice 3 ON" : "Slice 3 OFF"}
              </div>
            </div>

            {/* Parámetros */}
            <div className="grid grid-cols-2 gap-0 divide-x divide-border/10">
              <div className="p-6 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Ventana de Pago
                </p>
                <p className="text-2xl font-black text-foreground">
                  {savedWindowDays} <span className="text-xs font-bold text-muted-foreground">días</span>
                </p>
                <p className="text-[10px] text-muted-foreground italic">
                  Plazo para pagar tras aceptar
                </p>
              </div>
              <div className="p-6 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Anticipo Mínimo
                </p>
                <p className="text-2xl font-black text-foreground">
                  {savedMinAdvance}<span className="text-xs font-bold text-muted-foreground">%</span>
                </p>
                <p className="text-[10px] text-muted-foreground italic">
                  Alerta si pago es menor
                </p>
              </div>
            </div>
          </div>

          {/* Botón editar */}
          <div className="flex justify-center">
            <Button
              onClick={enterEditMode}
              variant="outline"
              className="h-12 px-8 rounded-none font-bold uppercase text-xs tracking-widest border-border/50 hover:border-primary/50 hover:bg-primary/5 gap-2"
            >
              <Pencil className="w-4 h-4" />
              Modificar Configuración
            </Button>
          </div>
        </motion.div>
      ) : (
        /* Modo edición */
        <motion.div
          key="edit"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/10 p-8 space-y-8 rounded-sm"
        >
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
                comprobante directamente desde su enlace público.
              </p>
            </div>
            <Switch
              checked={draftEnabled}
              onCheckedChange={(c) => setDraftEnabled(!!c)}
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
              value={draftWindowDays}
              onChange={(e) => setDraftWindowDays(e.target.value)}
              disabled={isSaving}
              className="bg-background/50 border-border/50 h-12 rounded-none focus:bg-background font-bold max-w-[160px]"
            />
            <p className="text-[10px] text-muted-foreground italic">
              Entero entre 1 y 60.
            </p>
            {!windowValid && draftWindowDays !== "" && (
              <p className="text-[10px] text-destructive">Debe ser un entero entre 1 y 60.</p>
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
              value={draftMinAdvance}
              onChange={(e) => setDraftMinAdvance(e.target.value)}
              disabled={isSaving}
              className="bg-background/50 border-border/50 h-12 rounded-none focus:bg-background font-bold max-w-[160px]"
            />
            <p className="text-[10px] text-muted-foreground italic">
              Entre 0 y 100.
            </p>
            {!advanceValid && draftMinAdvance !== "" && (
              <p className="text-[10px] text-destructive">Debe estar entre 0 y 100.</p>
            )}
          </div>

          {/* Botones */}
          <div className="pt-6 border-t border-border/10 flex gap-3 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEdit}
              disabled={isSaving}
              className="h-14 px-8 rounded-none font-bold uppercase text-xs tracking-widest border border-transparent hover:border-border/50"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <PrimaryButton
              onClick={handleSave}
              disabled={isSaving || !canSave}
              label={isSaving ? "Guardando..." : "Guardar Cambios"}
              icon={isSaving ? Loader2 : Save}
              className="h-14 px-8 rounded-none"
            />
          </div>
        </motion.div>
      )}

      {/* Advertencia siempre visible */}
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
