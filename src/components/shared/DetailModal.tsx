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
}

export function InlineEditField({
  label, value, displayValue, onSave, editable = true, type = "text",
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(value);
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
                {value ? value : <span className="text-muted-foreground italic font-normal text-sm">Sin valor</span>}
              </span>
            )}
          </div>
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
