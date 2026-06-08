import { useState } from "react";
import { Clock, Plus } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useHoras } from "@/hooks/useHoras";
import { ProgressHero } from "@/components/horas/ProgressHero";
import { MonthSwitcher } from "@/components/horas/MonthSwitcher";
import { WorkLogTable } from "@/components/horas/WorkLogTable";
import { WorkLogFormModal } from "@/components/horas/WorkLogFormModal";
import type { WorkLog, WorkLogInput } from "@/lib/horas/types";

const pad = (n: number) => String(n).padStart(2, "0");
function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export default function Horas() {
  const [offset, setOffset] = useState(0);

  const {
    isLoading,
    isError,
    hasContract,
    periodLabel,
    canGoNext,
    monthLogs,
    summary,
    accumulatedMinutes,
    isReadOnly,
    addLog,
    updateLog,
    deleteLog,
  } = useHoras(offset);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [toDelete, setToDelete] = useState<WorkLog | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (log: WorkLog) => {
    setEditing(log);
    setFormOpen(true);
  };

  const handleSubmit = async (input: WorkLogInput) => {
    if (editing) {
      await updateLog.mutateAsync({ id: editing.id, input });
    } else {
      await addLog.mutateAsync(input);
    }
  };

  return (
    <div className="space-y-6">
      <CategoryHeader
        title="Horas"
        subtitle="Registro de horas laborales y progreso del período."
        icon={Clock}
        hideBack
        action={
          !isReadOnly && hasContract
            ? { label: "Cargar día", icon: Plus, onClick: openCreate }
            : undefined
        }
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthSwitcher
          label={periodLabel}
          canGoNext={canGoNext}
          onPrev={() => setOffset((o) => o - 1)}
          onNext={() => setOffset((o) => Math.min(0, o + 1))}
        />
        {isReadOnly && (
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
            Vista de solo lectura
          </span>
        )}
      </div>

      {isLoading && (
        <div className="py-20 flex justify-center">
          <PremiumLoader size="md" text="Cargando horas" />
        </div>
      )}

      {!isLoading && (isError || !hasContract) && (
        <EmptyState
          icon={Clock}
          title="Sin configuración de horas"
          description="Todavía no hay un contrato de horas cargado. Una vez configurado, acá vas a ver el progreso del período."
        />
      )}

      {!isLoading && hasContract && summary && (
        <>
          <ProgressHero summary={summary} accumulatedMinutes={accumulatedMinutes} monthLabel={periodLabel} />

          {monthLogs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={`Sin registros en ${periodLabel}`}
              description={
                isReadOnly
                  ? "Cuando se carguen las jornadas de este período, van a aparecer acá."
                  : "Usá \"Cargar día\" para registrar la primera jornada del período."
              }
            />
          ) : (
            <WorkLogTable logs={monthLogs} readOnly={isReadOnly} onEdit={openEdit} onDelete={setToDelete} />
          )}
        </>
      )}

      {!isReadOnly && (
        <WorkLogFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          editing={editing}
          defaultDate={todayISO()}
          onSubmit={handleSubmit}
          isSaving={addLog.isPending || updateLog.isPending}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar este día?</DialogTitle>
            <DialogDescription>
              {toDelete
                ? `Se eliminará el registro del ${toDelete.work_date}. Esta acción no se puede deshacer.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleteLog.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (toDelete) deleteLog.mutate(toDelete.id);
                setToDelete(null);
              }}
              disabled={deleteLog.isPending}
            >
              {deleteLog.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
