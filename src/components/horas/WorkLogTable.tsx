import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { formatMinutes, isInProgress } from "@/lib/horas/calc";
import type { WorkLog } from "@/lib/horas/types";

const DIA_SEMANA = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function diaDe(workDate: string): string {
  const [y, m, d] = workDate.split("-").map(Number);
  return DIA_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
function fechaCorta(workDate: string): string {
  const [y, m, d] = workDate.split("-");
  return `${d}/${m}/${y}`;
}
function hhmm(t: string | null): string {
  return t ?? "—";
}

interface WorkLogTableProps {
  logs: WorkLog[];
  readOnly: boolean;
  onEdit: (log: WorkLog) => void;
  onDelete: (log: WorkLog) => void;
}

export function WorkLogTable({ logs, readOnly, onEdit, onDelete }: WorkLogTableProps) {
  return (
    <div className="border border-border/50 bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5 border-r border-border/40 text-[10px] font-black uppercase tracking-[0.15em]">Fecha</TableHead>
            <TableHead className="pl-5 text-[10px] font-black uppercase tracking-[0.15em]">Día</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-[0.15em]">
              Inicio <span className="text-muted-foreground/40 normal-case font-normal">(Col)</span>
            </TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-[0.15em]">Fin</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-[0.15em]">Receso</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-[0.15em]">Neto</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-[0.15em]">Nota</TableHead>
            {!readOnly && <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.15em]">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const off = log.day_type === "no_operativo";
            const inProgress = isInProgress(log);
            return (
              <TableRow key={log.id} className={cn(off && "opacity-50")}>
                <TableCell className="pl-5 border-r border-border/40">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-mono text-xs">{fechaCorta(log.work_date)}</span>
                  </div>
                </TableCell>
                <TableCell className="pl-5 text-sm">{diaDe(log.work_date)}</TableCell>
                <TableCell className="font-mono text-xs">{off ? "—" : hhmm(log.start_time)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {off ? "—" : inProgress ? <StatusBadge variant="warning">En curso</StatusBadge> : hhmm(log.end_time)}
                </TableCell>
                <TableCell className="font-mono text-xs">{off ? "—" : `${log.break_minutes} min`}</TableCell>
                <TableCell className="text-sm font-bold">
                  {off ? (
                    <span className="text-muted-foreground/60 font-normal text-xs">Día no operativo</span>
                  ) : (
                    formatMinutes(log.net_minutes)
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground/80 max-w-[220px] truncate">
                  {log.note ?? ""}
                </TableCell>
                {!readOnly && (
                  <TableCell className="text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onEdit(log)}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Editar día"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(log)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                      aria-label="Eliminar día"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
