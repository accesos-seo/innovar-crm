import * as React from "react";
import { Search, Filter, X, User, Flag, Layers, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { FilterSheet, FilterSection, FilterOption } from "@/components/shared/FilterSheet";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatSentenceCase } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/PremiumToast";
import { Task } from "@/types/database";

interface TaskFiltersProps {
  filters: { 
    category: string; 
    assigned_to: string; 
    priority: number; 
    status: string; 
    searchTerm: string 
  };
  setFilters: (filters: any) => void;
  staff: any[];
  tasks: Task[];
  usersCanFilterAll: boolean;
}

const CATEGORIES = [
  { value: "all", label: "Todas las etiquetas" },
  { value: "operativa", label: "Operativa" },
  { value: "diseno", label: "Diseño" },
  { value: "produccion", label: "Producción" },
  { value: "administrativa", label: "Administrativa" },
  { value: "seguimiento", label: "Seguimiento" },
];

const PRIORITIES = [
  { value: "-1", label: "Todas las prioridades", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  { value: "2", label: "Alta", color: "text-red-500", dot: "bg-red-500" },
  { value: "1", label: "Media", color: "text-yellow-500", dot: "bg-yellow-500" },
  { value: "0", label: "Baja", color: "text-green-500", dot: "bg-green-500" },
];

const STATUSES = [
  { value: "all", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "en_revision", label: "En revisión" },
  { value: "completado", label: "Completado" },
  { value: "bloqueado", label: "Bloqueado" },
];

export function TaskFilters({ filters, setFilters, staff, tasks, usersCanFilterAll }: TaskFiltersProps) {
  
  const getTaskCountForStaff = (staffId: string) => {
    return tasks.filter(t => t.assigned_to === staffId).length;
  };

  const clearFilters = () => {
    setFilters({
      category: 'all',
      assigned_to: 'all',
      priority: -1,
      status: 'all',
      searchTerm: ''
    });
  };

  const isFiltered = filters.category !== 'all' || filters.assigned_to !== 'all' || filters.priority !== -1 || filters.status !== 'all';

  return (
    <div className="flex flex-1 items-center gap-4">
      {/* Barra de búsqueda principal */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder={formatSentenceCase("Buscar tareas por título o descripción...")} 
          className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
          value={filters.searchTerm}
          onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
        />
      </div>

      {/* Botón de Filtros Lateral (Sheet) */}
      <FilterSheet
        title={formatSentenceCase("Filtros de Tareas")}
        description={formatSentenceCase("Segmenta tus pendientes por colaborador, prioridad o estado.")}
        onApply={() => notify.success(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La vista se ha actualizado correctamente."))}
        onClear={clearFilters}
      >
        <div className="space-y-8">
          {/* Colaborador */}
          {usersCanFilterAll && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <User className="w-3 h-3" />
                {formatSentenceCase("Colaborador")}
              </label>
              <Select 
                value={filters.assigned_to} 
                onValueChange={(val) => setFilters({ ...filters, assigned_to: val })}
              >
                <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold">
                  <SelectValue placeholder={formatSentenceCase("Todos los colaboradores")}>
                    {filters.assigned_to !== 'all' ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={staff.find(s => s.id === filters.assigned_to)?.full_name || "U"} className="w-6 h-6" />
                        <span>{staff.find(s => s.id === filters.assigned_to)?.full_name}</span>
                      </div>
                    ) : formatSentenceCase("Todos los colaboradores")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  <SelectItem value="all">{formatSentenceCase("Todos los colaboradores")}</SelectItem>
                  {staff.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={member.full_name} className="w-6 h-6" />
                        <span>
                          {member.full_name} 
                          <span className="ml-1 text-muted-foreground font-medium">({getTaskCountForStaff(member.id)})</span>
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Estado */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" />
              {formatSentenceCase("Estado")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <Button
                  key={s.value}
                  variant={filters.status === s.value ? "default" : "outline"}
                  onClick={() => setFilters({ ...filters, status: s.value })}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider h-11 rounded-none border-border/30 relative group overflow-hidden",
                    filters.status === s.value ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="relative z-10">{s.label}</span>
                  {filters.status !== s.value && (
                    <span className="absolute top-0 left-0 w-full h-[2px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Prioridad */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Flag className="w-3 h-3" />
              {formatSentenceCase("Prioridad")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map(p => (
                <Button
                  key={p.value}
                  variant={filters.priority.toString() === p.value ? "default" : "outline"}
                  onClick={() => setFilters({ ...filters, priority: parseInt(p.value, 10) })}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-wider h-11 rounded-none border-border/30 gap-2 relative group overflow-hidden",
                    filters.priority.toString() === p.value ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full relative z-10", filters.priority.toString() === p.value ? "bg-white" : p.dot)} />
                  <span className="relative z-10">{p.label}</span>
                  {filters.priority.toString() !== p.value && (
                    <span className="absolute top-0 left-0 w-full h-[2px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Categoría / Etiquetas */}
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Layers className="w-3 h-3" />
              {formatSentenceCase("Etiquetas")}
            </label>
            <Select 
              value={filters.category} 
              onValueChange={(val) => setFilters({ ...filters, category: val })}
            >
              <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold">
                <SelectValue placeholder={formatSentenceCase("Todas las etiquetas")}>
                  {filters.category !== 'all' ? CATEGORIES.find(c => c.value === filters.category)?.label : formatSentenceCase("Todas las etiquetas")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border/50">
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterSheet>

      {/* Botón de Limpiar Rápido */}
      {(filters.searchTerm || isFiltered) && (
        <Button 
          variant="ghost" 
          onClick={clearFilters}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/10 transition-all group"
        >
          <X className="w-3 h-3 mr-2 group-hover:rotate-90 transition-transform" />
          {formatSentenceCase("Limpiar")}
        </Button>
      )}
    </div>
  );
}

