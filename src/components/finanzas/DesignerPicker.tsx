import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveDesigners } from "@/hooks/useActiveDesigners";

const ASSIGN_LATER_VALUE = "__assign_later__";

interface DesignerPickerProps {
  value: string | null;
  onChange: (designerId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Select de diseñadores activos. Devuelve `null` cuando se elige
 * "Asignar después" — el backend lo trata como sin asignación.
 */
export function DesignerPicker({
  value,
  onChange,
  disabled,
  placeholder = "Seleccionar diseñador",
}: DesignerPickerProps) {
  const { data: designers = [], isLoading } = useActiveDesigners();

  const selectValue = value === null ? ASSIGN_LATER_VALUE : value;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => {
        if (v === null) return;
        onChange(v === ASSIGN_LATER_VALUE ? null : v);
      }}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
        <SelectValue placeholder={isLoading ? "Cargando..." : placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-card border-border/50">
        <SelectItem value={ASSIGN_LATER_VALUE}>Asignar después</SelectItem>
        {designers.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
