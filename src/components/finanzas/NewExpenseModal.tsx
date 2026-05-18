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
import { Label } from "@/components/ui/label";
import { useCreateExpense } from "@/hooks/finanzas/useCreateExpense";
import { type ExpenseCategory } from "@/schemas";
import { useProjects } from "@/hooks/useProjects";
import { notify } from "@/components/ui/PremiumToast";
import { format } from "date-fns";
import { Paperclip, X, Save, Receipt, Calculator, Calendar as CalendarIcon, FileText, CheckCircle2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";
import { CalendarPopover } from "@/components/ui/calendar-popover";

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "materiales", label: "Materiales" },
  { value: "operativo", label: "Operativo" },
  { value: "nomina", label: "Nómina" },
  { value: "transporte", label: "Transporte" },
  { value: "herramientas", label: "Herramientas" },
  { value: "servicios_publicos", label: "Servicios públicos" },
  { value: "arriendo", label: "Arriendo" },
  { value: "subcontrato", label: "Subcontrato" },
  { value: "otro", label: "Otro" },
];

export function NewExpenseModal({ isOpen, onClose }: NewExpenseModalProps) {
  const createExpense = useCreateExpense();
  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  // Pattern displayData from AGENTS.md
  const [displayData, setDisplayData] = React.useState({
    amount: ""
  });

  const [formData, setFormData] = React.useState({
    project_id: "",
    category: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    description: ""
  });
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [file, setFile] = React.useState<File | null>(null);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (date) {
      setFormData(prev => ({ ...prev, expense_date: format(date, "yyyy-MM-dd") }));
    }
  }, [date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(displayData.amount) || 0;
    
    if (amountNum <= 0 || !formData.category || !formData.expense_date || !formData.description) {
      notify.error("Error", "Faltan campos obligatorios");
      return;
    }

    try {
      await createExpense.mutateAsync({
        expenseData: {
          project_id: formData.project_id || null,
          amount: amountNum,
          category: formData.category as ExpenseCategory,
          expense_date: formData.expense_date,
          description: formData.description,
          approval_status: "pendiente"
        },
        file: file || undefined
      });
      
      notify.success(formatSentenceCase("Gasto registrado"), formatSentenceCase("El egreso ha sido registrado y está pendiente de aprobación."));
      onClose();
      resetForm();
    } catch(err) {
      notify.error("Error al registrar", "No se pudo registrar el gasto.");
    }
  };

  const resetForm = () => {
    setDisplayData({ amount: "" });
    setFormData({
      project_id: "",
      category: "",
      expense_date: format(new Date(), "yyyy-MM-dd"),
      description: ""
    });
    setDate(new Date());
    setFile(null);
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("REGISTRAR GASTO")}
      icon={Receipt}
      subtitle={formatSentenceCase("FINANZAS > EGRESOS")}
      footer={
        <div className="flex gap-4 w-full">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-14 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted/50 transition-all"
          >
            {formatSentenceCase("Cancelar")}
          </Button>
          <Button 
            type="submit"
            form="new-expense-form"
            disabled={createExpense.isPending} 
            className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {createExpense.isPending ? formatSentenceCase("Registrando...") : formatSentenceCase("Registrar gasto")}
          </Button>
        </div>
      }
    >
      <form id="new-expense-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SECCIÓN 1: IDENTIFICACIÓN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <Briefcase className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("CATEGORÍA Y PROYECTO")}</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-6 bg-muted/5 p-6 border border-border/10">
              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Categoría")} <span className="text-primary">*</span>
                </label>
                <Select value={formData.category} onValueChange={(v) => { if (v !== null) setFormData({...formData, category: v}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                    <SelectValue placeholder={formatSentenceCase("Seleccionar")}>
                      {formData.category ? CATEGORIES.find(c => c.value === formData.category)?.label : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Proyecto (opcional)")}
                </label>
                <Select value={formData.project_id} onValueChange={(v) => { if (v !== null) setFormData({...formData, project_id: v}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                    <SelectValue placeholder={formatSentenceCase("Gastos generales de oficina / General")}>
                      {formData.project_id ? projects.find((p: any) => p.id === formData.project_id)?.name : "Gastos Generales / Oficina"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    <SelectItem value="">Gastos Generales / Oficina</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: INFORMACIÓN FINANCIERA */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("INFORMACIÓN FINANCIERA")}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-6 border border-border/10">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Monto")} <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                  <Input 
                    type="text" 
                    value={displayData.amount} 
                    onChange={e => setDisplayData({ amount: e.target.value.replace(/[^0-9]/g, "") })} 
                    placeholder="0" 
                    className="pl-8 bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-black text-2xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Fecha del gasto")} <span className="text-primary">*</span>
                </label>
                <CalendarPopover
                  selected={date}
                  onSelect={setDate}
                  className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: DETALLES Y SOPORTES */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("DETALLES Y SOPORTES")}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Descripción")} <span className="text-primary">*</span>
              </label>
              <Textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder={formatSentenceCase("Ej. Láminas melamina 18mm blanco para cocina Pérez")}
                className="bg-background border-border/50 h-full min-h-[140px] rounded-none focus-visible:ring-primary font-medium resize-none p-4"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Comprobante")}
              </label>
              <div className="relative h-full">
                <Input 
                  type="file" 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="receipt-upload"
                  accept="image/*,.pdf"
                />
                <label 
                  htmlFor="receipt-upload"
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 w-full h-full min-h-[140px] border border-dashed transition-all cursor-pointer font-bold text-xs uppercase tracking-widest text-center",
                    file 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-border/50 hover:border-primary/50 hover:bg-muted/30 text-muted-foreground"
                  )}
                >
                  {file ? (
                    <>
                      <Save className="w-8 h-8" />
                      <span className="max-w-[200px] truncate">{file.name}</span>
                      <span className="text-[10px] opacity-60">({(file.size / 1024).toFixed(0)} KB)</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-8 h-8 opacity-40" />
                      <span className="px-4">{formatSentenceCase("Subir archivo de soporte (Imagen o PDF)")}</span>
                    </>
                  )}
                </label>
                {file && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setFile(null)}
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90 shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest leading-relaxed italic">
            Todos los gastos registrados ingresan en estado pendiente y deben ser validados por gerencia antes de afectar el balance real de la empresa.
          </p>
        </div>
      </form>
    </DetailModal>
  );
}
