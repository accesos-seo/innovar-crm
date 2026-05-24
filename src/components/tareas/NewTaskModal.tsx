import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCreateTask } from "@/hooks/tareas/useCreateTask";
import { type TaskStatus } from "@/schemas";
import { notify } from "@/components/ui/PremiumToast";
import { 
  ListTodo, 
  X, 
  Calendar as CalendarIcon, 
  User, 
  Type, 
  FileText, 
  Layers, 
  Clock, 
  Flag,
  CheckCircle2
} from "lucide-react";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatSentenceCase, formatPersonName } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: any[];
  defaultStatus?: string;
}

const CATEGORIES = [
  { value: "operativa", label: "Operativa" },
  { value: "diseno", label: "Diseño" },
  { value: "produccion", label: "Producción" },
  { value: "administrativa", label: "Administrativa" },
  { value: "seguimiento", label: "Seguimiento" },
];

const PRIORITIES = [
  { value: "0", label: "Normal", icon: "⚪" },
  { value: "1", label: "Alta", icon: "🟡" },
  { value: "2", label: "Urgente", icon: "🔴" },
];

export function NewTaskModal({ isOpen, onClose, staff, defaultStatus = 'pendiente' }: NewTaskModalProps) {
  const createTask = useCreateTask();
  const [formData, setFormData] = React.useState({
    title: '',
    description: '',
    task_category: '',
    assigned_to: '',
    priority: 0,
    due_date: '',
    estimated_hours: ''
  });

  const [date, setDate] = React.useState<Date | undefined>(undefined);

  // Sync date selection with form data
  React.useEffect(() => {
    if (date) {
      setFormData(prev => ({ ...prev, due_date: date.toISOString().split('T')[0] }));
    }
  }, [date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.task_category || !formData.assigned_to) {
      notify.error("Error", "Faltan campos obligatorios");
      return;
    }

    try {
      await createTask.mutateAsync({
        ...formData,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        status: defaultStatus as TaskStatus,
        kanban_order: 0
      });
      notify.success(formatSentenceCase("Tarea creada"), formatSentenceCase("La tarea ha sido creada exitosamente"));
      onClose();
      resetForm();
    } catch(err) {
      notify.error("Error al crear", "No se pudo crear la tarea");
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      task_category: '',
      assigned_to: '',
      priority: 0,
      due_date: '',
      estimated_hours: ''
    });
    setDate(undefined);
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("CREAR NUEVA TAREA")}
      icon={ListTodo}
      subtitle={formatSentenceCase("GESTIÓN > TAREAS > NUEVO REGISTRO")}
      footer={
        <div className="flex gap-4 w-full">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-12 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted/50 transition-all"
          >
            {formatSentenceCase("Cancelar")}
          </Button>
          <Button 
            onClick={(e) => handleSubmit(e as any)}
            disabled={createTask.isPending} 
            className="flex-1 h-12 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {createTask.isPending ? formatSentenceCase("Creando...") : formatSentenceCase("Crear tarea")}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-10">
            {/* Título */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                {formatSentenceCase("Título de la tarea")} <span className="text-primary">*</span>
              </label>
              <Input 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                placeholder={formatSentenceCase("Ej: Diseño 3D cocina")} 
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold text-base"
                required
              />
            </div>

            {/* Descripción */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                {formatSentenceCase("Descripción detallada")}
              </label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder={formatSentenceCase("Escribe aquí los detalles específicos de la tarea...")}
                className="bg-background border-border/50 min-h-[150px] rounded-none focus-visible:ring-primary font-bold resize-none p-4"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Categoría */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Categoría")} *</label>
                <Select value={formData.task_category} onValueChange={(v) => { if (v !== null) setFormData({...formData, task_category: v}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold">
                    <SelectValue placeholder={formatSentenceCase("Seleccionar")}>
                      {formData.task_category ? CATEGORIES.find(c => c.value === formData.task_category)?.label : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Asignar a */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Asignado a")} *</label>
                <Select value={formData.assigned_to} onValueChange={(v) => { if (v !== null) setFormData({...formData, assigned_to: v}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold">
                    <SelectValue placeholder={formatSentenceCase("Seleccionar")}>
                      {formData.assigned_to ? (() => {
                        const selected = staff.find(s => s.id === formData.assigned_to);
                        const display = formatPersonName(selected?.full_name, "Usuario sin nombre");
                        return (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={display} className="w-6 h-6" />
                            <span>{display}</span>
                          </div>
                        );
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {staff.map(u => {
                      const display = formatPersonName(u.full_name, "Usuario sin nombre");
                      return (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={display} className="w-6 h-6" />
                            <span>{display}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sidebar de Configuración */}
          <div className="space-y-8">
            <div className="bg-muted/5 p-6 border border-border/10 space-y-8">
              {/* Prioridad */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Prioridad")}</label>
                <Select value={formData.priority.toString()} onValueChange={(v) => { if (v !== null) setFormData({...formData, priority: parseInt(v)}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold">
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <span>{PRIORITIES.find(p => p.value === formData.priority.toString())?.icon}</span>
                        <span>{PRIORITIES.find(p => p.value === formData.priority.toString())?.label}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Límite */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Fecha límite")}</label>
                <CalendarPopover
                  selected={date}
                  onSelect={setDate}
                  className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold w-full"
                />
              </div>

              {/* Horas Estimadas */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Esfuerzo (Horas)")}</label>
                <Input 
                  type="number" 
                  step="0.5" 
                  value={formData.estimated_hours} 
                  onChange={e => setFormData({...formData, estimated_hours: e.target.value})} 
                  placeholder={formatSentenceCase("Ej: 4.5")}
                  className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold"
                />
              </div>
            </div>
            
            <div className="bg-primary/5 p-6 border border-primary/10">
              <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest text-center">
                Campos marcados con * son obligatorios para el registro en el sistema.
              </p>
            </div>
          </div>
        </div>
      </form>
    </DetailModal>
  );
}
