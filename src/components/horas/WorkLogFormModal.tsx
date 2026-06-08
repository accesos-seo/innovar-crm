import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { netMinutes, formatMinutes } from "@/lib/horas/calc";
import type { WorkLog, WorkLogInput } from "@/lib/horas/types";

const INPUT_CLS = "h-12 rounded-none border-border/50 bg-background/50";

interface WorkLogFormModalProps {
  open: boolean;
  onClose: () => void;
  editing: WorkLog | null;
  defaultDate: string;
  onSubmit: (input: WorkLogInput) => Promise<unknown>;
  isSaving: boolean;
}

export function WorkLogFormModal({ open, onClose, editing, defaultDate, onSubmit, isSaving }: WorkLogFormModalProps) {
  const [operativo, setOperativo] = useState(true);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [breakMin, setBreakMin] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setOperativo(editing.day_type === "operativo");
      setDate(editing.work_date);
      setStart(editing.start_time ?? "");
      setEnd(editing.end_time ?? "");
      setBreakMin(String(editing.break_minutes ?? 0));
      setNote(editing.note ?? "");
    } else {
      setOperativo(true);
      setDate(defaultDate);
      setStart("");
      setEnd("");
      setBreakMin("0");
      setNote("");
    }
    setError(null);
  }, [open, editing, defaultDate]);

  const previewNet = operativo
    ? netMinutes({ day_type: "operativo", start_time: start || null, end_time: end || null, break_minutes: Number(breakMin) || 0 })
    : 0;

  const handleSubmit = async () => {
    setError(null);
    const input: WorkLogInput = {
      work_date: date,
      day_type: operativo ? "operativo" : "no_operativo",
      start_time: operativo && start ? start : null,
      end_time: operativo && end ? end : null,
      break_minutes: operativo ? Number(breakMin) || 0 : 0,
      note: note.trim() || null,
    };
    if (operativo && start && end && start >= end) {
      setError("El inicio debe ser anterior al fin.");
      return;
    }
    try {
      await onSubmit(input);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo guardar. Revisá los datos.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar día" : "Cargar día"}</DialogTitle>
          <DialogDescription>Horarios en hora Colombia. El total neto se calcula solo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} />
          </div>

          <div className="flex items-center justify-between border border-border/50 px-4 h-12">
            <span className="text-sm font-medium">{operativo ? "Día operativo" : "Día no operativo"}</span>
            <Switch checked={operativo} onCheckedChange={setOperativo} />
          </div>

          {operativo && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Inicio</Label>
                  <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT_CLS} />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Fin <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                  </Label>
                  <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT_CLS} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Receso (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  value={breakMin}
                  onChange={(e) => setBreakMin(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="flex items-center justify-between text-sm border-l-2 border-primary/40 bg-primary/5 px-3 py-2">
                <span className="text-muted-foreground">Neto calculado</span>
                <span className="font-black text-primary">
                  {end ? formatMinutes(previewNet) : "— (jornada en curso)"}
                </span>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>
              Nota <span className="text-muted-foreground/50 font-normal">(opcional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Jornada extendida"
              className={cn("rounded-none border-border/50 bg-background/50 min-h-[70px]")}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !date}>
            {isSaving ? "Guardando…" : editing ? "Guardar cambios" : "Registrar día"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
