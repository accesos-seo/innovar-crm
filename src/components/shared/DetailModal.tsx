import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button }    from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Input }     from "@/components/ui/input";
import { Pencil, Check, X, ExternalLink, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { cn }        from "@/lib/utils";
import { motion, useScroll, useSpring } from "framer-motion";

import { WhatsAppField } from "./WhatsAppField";
import { DEFAULT_COUNTRIES } from "@/hooks/usePhoneInput";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { emailSchema, EmailInputField } from "./EmailInputField";
import { formatDate, formatSentenceCase } from "@/lib/format-utils";
import { toast } from "sonner";

// --- Campo editable inline ---
interface InlineEditFieldProps {
  label:          string;
  value:          string;
  displayValue?:  React.ReactNode;
  onSave:         (newValue: string) => Promise<void>;
  editable?:      boolean;
  type?:          "text" | "email" | "number";
  /**
   * Texto a mostrar cuando el valor está vacío o es basura (null, undefined string,
   * "null", "undefined"). Por defecto "Sin información", pero conviene pasarlo
   * específico por campo (ej. "Dirección no registrada") para mejor UX.
   */
  emptyLabel?:    string;
}

/**
 * Normaliza valores "basura" que llegaron a la DB como string literal
 * ("undefined", "null") para que la UI los trate como vacíos.
 * Caso real: clients.address = "undefined" por código viejo que hacía
 * String(undefined) en vez de NULL. Si vemos esos strings, mostramos
 * el emptyLabel en español.
 */
function isEffectivelyEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== "string") return false;
  const trimmed = v.trim().toLowerCase();
  return trimmed === "" || trimmed === "undefined" || trimmed === "null";
}

export function InlineEditField({
  label, value, displayValue, onSave, editable = true, type = "text",
  emptyLabel = "Sin información",
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  // Si value viene como "undefined"/"null" literal, lo limpiamos para que
  // el input arranque vacío en modo edición (no con la basura adentro).
  const sanitizedValue = isEffectivelyEmpty(value) ? "" : value;
  const [draft, setDraft] = React.useState(sanitizedValue);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(isEffectivelyEmpty(value) ? "" : value);
  }, [value]);

  const handleSave = async () => {
    if (draft === value) { setIsEditing(false); setError(null); return; }
    
    // Validación de email si corresponde
    if (type === "email") {
      const result = emailSchema.safeParse(draft);
      if (!result.success) {
        setError(result.error.issues[0].message);
        toast.error("Error de validación", { description: result.error.issues[0].message });
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving field:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="group flex flex-col gap-2">
      <span className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase(label)}</span>
      {isEditing ? (
        <div className="flex items-center gap-2">
          {type === "email" ? (
            <EmailInputField 
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              error={error || undefined}
              className="h-10 text-base font-bold bg-background border-primary/30 focus-visible:ring-primary rounded-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") { setIsEditing(false); setError(null); }
              }}
            />
          ) : (
            <Input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-10 text-base font-bold bg-background border-primary/30 focus-visible:ring-primary rounded-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setIsEditing(false);
              }}
            />
          )}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-10 w-10 text-primary hover:bg-primary/10" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground hover:bg-muted" onClick={() => setIsEditing(false)} disabled={isSaving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[32px]">
          <div className="flex-1">
            {displayValue ? displayValue : (
              <span className="text-base font-bold text-foreground">
                {isEffectivelyEmpty(value)
                  ? <span className="text-muted-foreground italic font-normal text-sm">{emptyLabel}</span>
                  : value}
              </span>
            )}
          </div>
          {editable && (
            <Button
              size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
              onClick={() => { setDraft(sanitizedValue); setIsEditing(true); }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Campo editable de teléfono ---
interface InlineEditPhoneFieldProps {
  label:     string;
  value:     string;
  onSave:    (newValue: string) => Promise<void>;
  editable?: boolean;
}

export function InlineEditPhoneField({
  label, value, onSave, editable = true,
}: InlineEditPhoneFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (draft === value) { setIsEditing(false); return; }
    if (draft.length < 5) return;
    
    setIsSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving phone field:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  return (
    <div className="group flex flex-col gap-2">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <WhatsAppField
                countries={DEFAULT_COUNTRIES}
                onChange={setDraft}
                initialValue={draft}
                label=""
              />
            </div>
            <div className="flex items-center gap-1 pb-1">
              <Button size="icon" variant="ghost" className="h-12 w-12 text-primary hover:bg-primary/10" onClick={handleSave} disabled={isSaving || draft.length < 5}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-12 w-12 text-muted-foreground hover:bg-muted" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[32px]">
          <span className="text-base font-bold text-foreground">
            {value || <span className="text-muted-foreground italic font-normal text-sm">Sin teléfono</span>}
          </span>
          {editable && (
            <Button
              size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
              onClick={() => { setDraft(value); setIsEditing(true); }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Campo editable single-select (radios) ---
interface InlineEditSelectOption {
  value: string;
  label: string;
}

interface InlineEditSelectFieldProps {
  label:      string;
  value:      string | null | undefined;
  options:    InlineEditSelectOption[];
  /** displayValue opcional para render no-edición (ej. badge). Si se omite, se muestra el label de la opción. */
  displayValue?: React.ReactNode;
  onSave:     (newValue: string) => Promise<void>;
  editable?:  boolean;
  emptyLabel?: string;
  /**
   * Layout del modo edición:
   *  - "list" (default): radios chiquitos apilados verticalmente (1 columna).
   *  - "cards": cajitas grandes estilo formulario nuevo lead (grid 2-3 cols, p-4).
   *
   * "cards" replica el look-and-feel de [LeadCreate.tsx] cuando hay pocas
   * opciones tangibles (ciudades, niveles de urgencia, etc.).
   */
  variant?:   "list" | "cards";
  /**
   * Si está presente, agrega una opción extra "Otra <label>" al final que al
   * seleccionarla muestra un input libre. Si el value actual no matchea ninguna
   * de las options pero existe, se considera ya en modo custom.
   */
  allowCustom?: { customLabel: string; placeholder?: string };
}

export function InlineEditSelectField({
  label, value, options, displayValue, onSave, editable = true, emptyLabel = "Sin asignar",
  variant = "list", allowCustom,
}: InlineEditSelectFieldProps) {
  const CUSTOM_TOKEN = "__custom__";
  const [isEditing, setIsEditing] = React.useState(false);
  const isPredefined = (v: string) =>
    !!v && options.some((o) => o.value === v);
  const startsCustom = (v: string) =>
    !!allowCustom && !!v && !isPredefined(v);
  const [draft, setDraft] = React.useState<string>(value || "");
  const [customInput, setCustomInput] = React.useState<string>(
    startsCustom(value || "") ? (value as string) : "",
  );
  const [customMode, setCustomMode] = React.useState<boolean>(
    startsCustom(value || ""),
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(value || "");
    setCustomInput(startsCustom(value || "") ? (value as string) : "");
    setCustomMode(startsCustom(value || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const persist = async (newValue: string) => {
    if (newValue === value) { setIsEditing(false); return; }
    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving select field:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePick = (optValue: string) => {
    if (optValue === CUSTOM_TOKEN) {
      setCustomMode(true);
      setDraft(customInput);
      return;
    }
    setCustomMode(false);
    setDraft(optValue);
    persist(optValue);
  };

  const handleSaveCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    persist(trimmed);
  };

  const currentOption = options.find((o) => o.value === value);

  const renderOptions = () => {
    const items = [
      ...options.map((opt) => ({ value: opt.value, label: opt.label })),
      ...(allowCustom
        ? [{ value: CUSTOM_TOKEN, label: allowCustom.customLabel }]
        : []),
    ];

    if (variant === "cards") {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((opt) => {
            const selected =
              opt.value === CUSTOM_TOKEN ? customMode : draft === opt.value && !customMode;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isSaving}
                onClick={() => handlePick(opt.value)}
                className={cn(
                  "flex items-center gap-3 p-4 border text-xs font-bold uppercase tracking-wider transition-colors rounded-none text-left",
                  selected
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40 hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    selected ? "border-primary" : "border-muted-foreground/40",
                  )}
                >
                  {selected && (
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className="flex-1">{formatSentenceCase(opt.label)}</span>
                {selected && isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-1.5">
        {items.map((opt) => {
          const selected =
            opt.value === CUSTOM_TOKEN ? customMode : draft === opt.value && !customMode;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={isSaving}
              onClick={() => handlePick(opt.value)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 border text-xs font-bold uppercase tracking-wider transition-all rounded-none text-left",
                selected
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-background border-border/40 text-muted-foreground hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0",
                  selected ? "border-primary" : "border-muted-foreground/40",
                )}
              >
                {selected && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </span>
              {formatSentenceCase(opt.label)}
              {selected && isSaving && <Loader2 className="ml-auto w-3.5 h-3.5 animate-spin" />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="group flex flex-col gap-2">
      <span className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase(label)}</span>
      {isEditing ? (
        <div className="space-y-3">
          {renderOptions()}
          {customMode && allowCustom && (
            <div className="flex items-center gap-2">
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={allowCustom.placeholder ?? "Especifica..."}
                className="h-10 text-sm font-bold bg-background border-primary/30 focus-visible:ring-primary rounded-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCustom();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 text-primary hover:bg-primary/10"
                onClick={handleSaveCustom}
                disabled={isSaving || !customInput.trim()}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:bg-muted rounded-none" onClick={() => setIsEditing(false)} disabled={isSaving}>
            <X className="h-3.5 w-3.5 mr-2" />
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[32px]">
          <div className="flex-1">
            {displayValue ? displayValue : (
              <span className="text-base font-bold text-foreground">
                {currentOption
                  ? formatSentenceCase(currentOption.label)
                  : value && allowCustom
                    ? value
                    : <span className="text-muted-foreground italic font-normal text-sm">{emptyLabel}</span>}
              </span>
            )}
          </div>
          {editable && (
            <Button
              size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Campo editable con múltiples opciones (checkboxes) ---
interface InlineEditMultiSelectFieldProps {
  label:      string;
  /** Valor actual: string CSV ("Cocina, Closet") o array. Aceptamos ambos por compatibilidad. */
  value:      string | string[] | null | undefined;
  options:    string[];
  /** Recibe el valor unido por ", " listo para guardar (formato actual en DB clients.services). */
  onSave:     (newValue: string) => Promise<void>;
  editable?:  boolean;
  emptyLabel?: string;
  /**
   * "compact" (default): grid 2 cols, padding chico. Para listas largas.
   * "cards": grid 2-3 cols con p-4, estilo formulario nuevo lead.
   */
  variant?:   "compact" | "cards";
}

export function InlineEditMultiSelectField({
  label, value, options, onSave, editable = true, emptyLabel = "No especificado",
  variant = "compact",
}: InlineEditMultiSelectFieldProps) {
  const parseValue = (v: string | string[] | null | undefined): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string[]>(parseValue(value));
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(parseValue(value));
  }, [value]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft.join(", "));
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving multi-select field:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(parseValue(value));
    setIsEditing(false);
  };

  const toggle = (opt: string) => {
    setDraft((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));
  };

  const displayList = parseValue(value);

  return (
    <div className="group flex flex-col gap-2">
      <span className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase(label)}</span>
      {isEditing ? (
        <div className="space-y-3">
          <div
            className={cn(
              "grid gap-3",
              variant === "cards"
                ? "grid-cols-2 md:grid-cols-3"
                : "grid-cols-2",
            )}
          >
            {options.map((opt) => {
              const checked = draft.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={cn(
                    "flex items-center gap-3 border text-xs font-bold uppercase tracking-wider transition-colors rounded-none text-left",
                    variant === "cards" ? "p-4" : "px-3 py-2",
                    checked
                      ? "bg-primary/10 border-primary text-primary"
                      : variant === "cards"
                        ? "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40 hover:border-primary/40"
                        : "bg-background border-border/40 text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <span className={cn(
                    "border flex items-center justify-center shrink-0",
                    variant === "cards" ? "w-4 h-4" : "w-3.5 h-3.5",
                    checked ? "bg-primary border-primary" : "border-muted-foreground/40"
                  )}>
                    {checked && <Check className={cn(variant === "cards" ? "w-3 h-3" : "w-2.5 h-2.5", "text-primary-foreground")} />}
                  </span>
                  {formatSentenceCase(opt)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-9 text-[10px] font-bold uppercase text-primary hover:bg-primary/10 rounded-none" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Check className="h-3.5 w-3.5 mr-2" />}
              Guardar
            </Button>
            <Button size="sm" variant="ghost" className="h-9 text-[10px] font-bold uppercase text-muted-foreground hover:bg-muted rounded-none" onClick={handleCancel} disabled={isSaving}>
              <X className="h-3.5 w-3.5 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[32px]">
          <div className="flex-1">
            {displayList.length === 0 ? (
              <span className="text-muted-foreground italic font-normal text-sm">{emptyLabel}</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displayList.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider rounded-none">
                    {formatSentenceCase(s)}
                  </span>
                ))}
              </div>
            )}
          </div>
          {editable && (
            <Button
              size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
              onClick={() => { setDraft(parseValue(value)); setIsEditing(true); }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Campo editable de fecha ---
interface InlineEditDateFieldProps {
  label:     string;
  value:     string | Date | null | undefined;
  onSave:    (newValue: string) => Promise<void>;
  editable?: boolean;
}

export function InlineEditDateField({
  label, value, onSave, editable = true,
}: InlineEditDateFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Date | undefined>(
    value ? (typeof value === 'string' ? new Date(value) : value) : undefined
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async (date: Date | undefined) => {
    if (!date) return;
    setIsSaving(true);
    try {
      await onSave(date.toISOString());
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving date field:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="group flex flex-col gap-2">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <CalendarPopover
            selected={draft}
            onSelect={(date) => {
              setDraft(date);
              if (date) handleSave(date);
            }}
            className="flex-1 font-bold h-12"
          />
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-12 w-12 text-muted-foreground hover:bg-muted" 
            onClick={() => setIsEditing(false)} 
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[32px]">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span className="text-base font-bold text-foreground">
              {formatDate(value)}
            </span>
          </div>
          {editable && (
            <Button
              size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
              onClick={() => { 
                setDraft(value ? (typeof value === 'string' ? new Date(value) : value) : undefined); 
                setIsEditing(true); 
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Modal de detalle ---
export function DetailModal({
  open, onOpenChange, title, subtitle, status, editHref, onNavigate, isLoading, children, footer, icon: Icon,
}: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 bg-card border-border/50 overflow-hidden shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
        <DialogHeader className="px-8 pt-8 pb-6 shrink-0 bg-muted/20 border-b border-border/10">
          <div className="flex items-start justify-between gap-6 mr-8">
            <div className="flex items-start gap-4 flex-1">
              {Icon && (
                <div className="p-3 bg-primary/10 rounded-sm shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">{title}</DialogTitle>
                {subtitle && <DialogDescription className="text-xs text-muted-foreground">{subtitle}</DialogDescription>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {status && (
                <StatusBadge 
                  variant={status.variant || "primary"} 
                  dot
                  animate="scale"
                  className={status.className}
                >
                  {status.label}
                </StatusBadge>
              )}
              {editHref && onNavigate && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-border/50 text-[10px] font-bold h-9 bg-background/50 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all rounded-none" 
                  onClick={() => { onOpenChange(false); onNavigate(editHref); }}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> {formatSentenceCase("Edición completa")}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        <ScrollableContent isLoading={isLoading}>{children}</ScrollableContent>
        {footer && (
          <div className="px-8 py-6 shrink-0 flex justify-end gap-3 bg-muted/10 border-t border-border/10">{footer}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScrollableContent({ isLoading, children }: any) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className="relative flex-1 overflow-hidden flex">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted/10 z-20">
        <ProgressBar containerRef={scrollRef} />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8">
        {isLoading ? (
          <div className="space-y-6">
            <div className="h-8 bg-muted animate-pulse w-3/4 rounded-sm" />
            <div className="grid grid-cols-2 gap-8">
              <div className="h-16 bg-muted animate-pulse rounded-sm" />
              <div className="h-16 bg-muted animate-pulse rounded-sm" />
              <div className="h-16 bg-muted animate-pulse rounded-sm" />
              <div className="h-16 bg-muted animate-pulse rounded-sm" />
            </div>
            <div className="h-32 bg-muted animate-pulse rounded-sm" />
          </div>
        ) : (
          <div className="space-y-8">{children}</div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ containerRef }: any) {
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return <motion.div className="w-full bg-primary origin-top" style={{ scaleY }} />;
}
