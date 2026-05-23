import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';
import { useActiveVisitors, type ActiveVisitor } from '@/hooks/agenda/useActiveVisitors';
import { useAssignVisitTo } from '@/hooks/agenda/useAssignVisitTo';
import { usePermissions } from '@/hooks/usePermissions';

interface VisitOwnerPickerProps {
  visitId: string;
  /** UUID del visitante actual (visits.visited_by / tasks.assigned_to). */
  currentVisitorId: string | null | undefined;
  /** Nombre del visitante actual para fallback cuando aún no carga la lista. */
  currentVisitorName?: string | null;
  /** Si está deshabilitado externamente (ej. visit cancelada / realizada). */
  disabled?: boolean;
}

/**
 * Picker de "¿Quién va?" para una visita técnica. Solo admin/super_admin
 * pueden cambiar el valor. Para comercial el dropdown aparece read-only.
 *
 * Llama a la RPC `assign_visit_to` que:
 *  - libera el availability_slot del visitante anterior
 *  - hace UPDATE visits.visited_by + scheduled_via='admin'
 *  - dispara visit_to_task_mirror (UPDATE branch) que re-asigna tasks.assigned_to
 *    y pre-crea el nuevo slot
 */
export function VisitOwnerPicker({
  visitId,
  currentVisitorId,
  currentVisitorName,
  disabled = false,
}: VisitOwnerPickerProps) {
  const { isAdmin } = usePermissions();
  const { data: visitors = [], isLoading } = useActiveVisitors();
  const assignMutation = useAssignVisitTo();
  const [localValue, setLocalValue] = useState<string | undefined>(
    currentVisitorId ?? undefined
  );

  const isReadOnly = !isAdmin || disabled || assignMutation.isPending;

  const handleChange = (next: string | null) => {
    if (!next || next === currentVisitorId) return;
    setLocalValue(next);
    assignMutation.mutate(
      { visitId, newVisitorId: next },
      {
        onError: () => {
          // revertir UI al valor server
          setLocalValue(currentVisitorId ?? undefined);
        },
      }
    );
  };

  const formatLabel = (v: ActiveVisitor) => {
    const roleLabel =
      v.role === 'admin' || v.role === 'super_admin' ? 'Admin' : 'Comercial';
    return `${v.full_name ?? '—'} · ${roleLabel}`;
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <User className="w-3.5 h-3.5" />
        ¿Quién va?
      </Label>

      {isReadOnly ? (
        <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {currentVisitorName ??
              visitors.find((v) => v.id === currentVisitorId)?.full_name ??
              'Sin asignar'}
          </span>
          {!isAdmin && (
            <Badge variant="outline" className="text-[10px]">
              Solo admin reasigna
            </Badge>
          )}
        </div>
      ) : (
        <Select value={localValue} onValueChange={handleChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={isLoading ? 'Cargando…' : 'Seleccionar visitante'} />
          </SelectTrigger>
          <SelectContent>
            {visitors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {formatLabel(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {assignMutation.isPending && (
        <p className="text-[11px] text-muted-foreground">Reasignando…</p>
      )}
    </div>
  );
}
