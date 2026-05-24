import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings2, Save, Loader2, AlertTriangle,
  Pencil, X, CheckCircle2, XCircle,
} from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { cn } from "@/lib/utils";
import { useSetting, useUpdateSetting } from "@/hooks/settings/useSystemSettings";

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

  const [savedEnabled, setSavedEnabled] = React.useState(false);
  const [savedWindowDays, setSavedWindowDays] = React.useState(7);
  const [savedMinAdvance, setSavedMinAdvance] = React.useState(30);
  const [hydrated, setHydrated] = React.useState(false);

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="Configuración de Pagos"
        subtitle="Activar el flujo de pago público y ajustar parámetros del módulo financiero."
        icon={Settings2}
        onBack={() => navigate("/settings")}
      />

      {!editMode ? (
        /* ── Vista de tarjeta — mismo patrón que BankDetailCard ── */
        <motion.div
          key="view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              Configuración actual
            </h3>

            <motion.div
              className={cn(
                "border rounded-sm p-6 space-y-4 transition-all",
                savedEnabled
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/50 bg-background"
              )}
            >
              {/* Header: título + badge */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
                    Flujo de Pago Público
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {savedEnabled ? "Módulo activo para todos los clientes" : "Módulo desactivado"}
                  </p>
                </div>
                {savedEnabled ? (
                  <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                      Activo
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-sm border border-border/30">
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                      Inactivo
                    </span>
                  </div>
                )}
              </div>

              {/* Grid de parámetros */}
              <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/30">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Ventana de Pago
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {savedWindowDays} días
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Anticipo Mínimo
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {savedMinAdvance}%
                  </p>
                </div>
              </div>

              {/* Detalles adicionales */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plazo para pagar tras aceptar:</span>
                  <span className="font-medium">{savedWindowDays} días</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alerta si anticipo es menor a:</span>
                  <span className="font-medium">{savedMinAdvance}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Feature flag:</span>
                  <span className={cn(
                    "font-bold uppercase tracking-widest text-[10px]",
                    savedEnabled ? "text-primary" : "text-muted-foreground"
                  )}>
                    {savedEnabled ? "Slice 3 ON" : "Slice 3 OFF"}
                  </span>
                </div>
              </div>

              {/* Botón de acción */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={enterEditMode}
                  variant="outline"
                  size="sm"
                  className="text-xs font-bold uppercase h-9 rounded-none flex-1 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Modificar Configuración
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Advertencia */}
          <div className="p-6 bg-yellow-500/5 border border-yellow-500/30 rounded-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200/80 leading-relaxed">
              Apagar la bandera desactiva el flujo para todos los clientes
              inmediatamente. Las cotizaciones aceptadas vuelven al mensaje
              genérico hasta que se vuelva a activar.
            </p>
          </div>
        </motion.div>
      ) : (
        /* ── Modo edición — mismo patrón que formulario BankSettings ── */
        <motion.div
          key="edit"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5"
        >
          {/* Gradiente de marca */}
          <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

          <div className="p-8 space-y-10">
            {/* ── Sección 1: Estado del flujo ── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <Settings2 className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Estado del Flujo
                </h3>
              </div>

              <div className="flex items-start justify-between gap-6 p-5 bg-muted/10 border border-border/20 rounded-sm">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Flujo de pago público (Slice 3)
                  </p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    Activar pago desde cotización pública
                  </p>
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
            </div>

            {/* Divider */}
            <div className="h-[1px] w-full bg-primary/20" />

            {/* ── Sección 2: Parámetros ── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic">
                  Parámetros
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Ventana de pago (días) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={draftWindowDays}
                    onChange={(e) => setDraftWindowDays(e.target.value)}
                    disabled={isSaving}
                    className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Entero entre 1 y 60 días.
                  </p>
                  {!windowValid && draftWindowDays !== "" && (
                    <p className="text-[10px] font-bold text-destructive">Debe ser un entero entre 1 y 60.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Anticipo mínimo sugerido (%) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draftMinAdvance}
                    onChange={(e) => setDraftMinAdvance(e.target.value)}
                    disabled={isSaving}
                    className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold transition-all"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Entre 0 y 100.
                  </p>
                  {!advanceValid && draftMinAdvance !== "" && (
                    <p className="text-[10px] font-bold text-destructive">Debe estar entre 0 y 100.</p>
                  )}
                </div>
              </div>
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
                onClick={cancelEdit}
                disabled={isSaving}
                className="flex-1 sm:flex-none font-bold uppercase text-xs tracking-widest h-14 px-8 rounded-none border border-transparent hover:border-border/50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <PrimaryButton
                onClick={handleSave}
                disabled={isSaving || !canSave}
                loading={isSaving}
                label={isSaving ? "Guardando..." : "Guardar Cambios"}
                icon={isSaving ? Loader2 : Save}
                className="flex-1 sm:flex-none h-14 px-12 rounded-none"
              />
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
