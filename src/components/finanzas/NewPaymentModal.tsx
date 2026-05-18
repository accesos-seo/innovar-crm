import React, { useState } from 'react';
import { DetailModal } from '@/components/shared/DetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useCreatePayment } from '@/hooks/finanzas/useCreatePayment';
import { type PaymentMethod, type PaymentType } from '@/schemas';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { notify } from '@/components/ui/PremiumToast';
import { ClientSearchSelect } from '@/components/agenda/ClientSearchSelect';
import { format } from 'date-fns';
import { 
  HandCoins, 
  X, 
  Briefcase, 
  User, 
  Calculator, 
  Calendar as CalendarIcon, 
  CreditCard, 
  FileStack, 
  Paperclip, 
  FileText,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { formatSentenceCase } from '@/lib/format-utils';
import { cn } from '@/lib/utils';
import { CalendarPopover } from '@/components/ui/calendar-popover';

interface NewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "credito", label: "Crédito" },
  { value: "cheque", label: "Cheque" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "pse", label: "PSE" },
];

const TYPE_OPTIONS = [
  { value: "anticipo", label: "Anticipo" },
  { value: "abono", label: "Abono" },
  { value: "pago_final", label: "Pago Final" },
  { value: "reembolso", label: "Reembolso" },
];

export function NewPaymentModal({ isOpen, onClose }: NewPaymentModalProps) {
  const createPayment = useCreatePayment();
  const { clients = [] } = useClients();
  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  // Patrón displayData para inputs numéricos (AGENTS.md)
  const [displayAmount, setDisplayAmount] = useState('');
  
  const [formData, setFormData] = useState({
    project_id: '',
    client_id: '',
    payment_method: '',
    payment_type: '',
    received_at: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [file, setFile] = useState<File | null>(null);

  React.useEffect(() => {
    if (date) {
      setFormData(prev => ({ ...prev, received_at: format(date, 'yyyy-MM-dd') }));
    }
  }, [date]);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleProjectChange = (projectId: string | null) => {
    if (projectId === null) return;
    const proj = projects.find((p: any) => p.id === projectId);
    setFormData(prev => ({
      ...prev,
      project_id: projectId,
      client_id: proj ? proj.client_id : prev.client_id
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !displayAmount || !formData.payment_method || !formData.payment_type || !formData.received_at) {
      notify.error("Error", "Faltan campos obligatorios");
      return;
    }

    try {
      await createPayment.mutateAsync({
        paymentData: {
          project_id: formData.project_id || null,
          client_id: formData.client_id,
          amount: parseFloat(displayAmount.replace(/[^0-9.]/g, '')) || 0,
          payment_method: formData.payment_method as PaymentMethod,
          payment_type: formData.payment_type as PaymentType,
          received_at: formData.received_at,
          notes: formData.notes || null,
        },
        file: file || undefined
      });
      notify.success(formatSentenceCase("Pago registrado"), formatSentenceCase("El pago ha sido registrado exitosamente."));
      onClose();
      resetForm();
    } catch(err) {
      notify.error("Error al registrar", "No se pudo registrar el pago.");
    }
  };

  const resetForm = () => {
    setDisplayAmount('');
    setFormData({
      project_id: '',
      client_id: '',
      payment_method: '',
      payment_type: '',
      received_at: format(new Date(), 'yyyy-MM-dd'),
      notes: ''
    });
    setDate(new Date());
    setFile(null);
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("REGISTRAR PAGO")}
      icon={HandCoins}
      subtitle={formatSentenceCase("FINANZAS > INGRESOS")}
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
            form="new-payment-form"
            disabled={createPayment.isPending} 
            className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {createPayment.isPending ? formatSentenceCase("Registrando...") : formatSentenceCase("Registrar pago")}
          </Button>
        </div>
      }
    >
      <form id="new-payment-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SECCIÓN 1: IDENTIFICACIÓN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <Briefcase className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("PROYECTO Y CLIENTE")}</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-6 bg-muted/5 p-6 border border-border/10">
              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Cliente")} <span className="text-primary">*</span>
                </label>
                <ClientSearchSelect 
                  value={formData.client_id} 
                  onChange={v => setFormData(prev => ({...prev, client_id: v}))} 
                />
              </div>

              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Proyecto (Opcional)")}
                </label>
                <Select value={formData.project_id} onValueChange={handleProjectChange}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                    <SelectValue placeholder={formatSentenceCase("General / Sin proyecto")}>
                      {formData.project_id ? projects.find((p: any) => p.id === formData.project_id)?.name : "Sin Proyecto / General"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    <SelectItem value="">Sin proyecto / General</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CONFIGURACIÓN PAGO */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("CONFIGURACIÓN DE PAGO")}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-6 border border-border/10">
              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Método de pago")} <span className="text-primary">*</span>
                </label>
                <Select value={formData.payment_method} onValueChange={(v) => { if (v !== null) setFormData({...formData, payment_method: v}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                    <SelectValue placeholder={formatSentenceCase("Seleccionar")}>
                      {formData.payment_method ? METHOD_OPTIONS.find(o => o.value === formData.payment_method)?.label : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {METHOD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Tipo de pago")} <span className="text-primary">*</span>
                </label>
                <Select value={formData.payment_type} onValueChange={(v) => { if (v !== null) setFormData({...formData, payment_type: v}); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                    <SelectValue placeholder={formatSentenceCase("Seleccionar")}>
                      {formData.payment_type ? TYPE_OPTIONS.find(o => o.value === formData.payment_type)?.label : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: VALORES Y FECHAS */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
            <Calculator className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("DATOS DE LA TRANSACCIÓN")}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Monto (COP)")} <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
                <Input 
                  type="text" 
                  value={displayAmount} 
                  onChange={e => setDisplayAmount(e.target.value.replace(/[^0-9]/g, ""))} 
                  placeholder="0" 
                  className="pl-8 bg-background border-border/50 h-14 rounded-none focus-visible:ring-primary font-black text-2xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Fecha de recepción")} <span className="text-primary">*</span>
              </label>
              <CalendarPopover
                selected={date}
                onSelect={setDate}
                className="bg-background border-border/50 h-14 rounded-none focus:ring-primary font-medium w-full"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: COMPROBANTE Y NOTAS */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("SOPORTES Y OBSERVACIONES")}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Comprobante (Opcional)")}
              </label>
              <div className="relative h-full">
                <Input 
                  type="file" 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="payment-receipt-upload"
                  accept="image/*,.pdf"
                />
                <label 
                  htmlFor="payment-receipt-upload"
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 w-full h-full min-h-[140px] border border-dashed transition-all cursor-pointer font-bold text-xs uppercase tracking-widest",
                    file 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-border/50 hover:border-primary/50 hover:bg-muted/30 text-muted-foreground"
                  )}
                >
                  {file ? (
                    <>
                      <FileCheck className="w-8 h-8" />
                      <span className="max-w-[200px] truncate">{file.name}</span>
                      <span className="text-[10px] opacity-60">({(file.size / 1024).toFixed(0)} KB)</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-8 h-8 opacity-40" />
                      <span className="text-center px-4">{formatSentenceCase("Subir comprobante digital (Imagen o PDF)")}</span>
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

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Notas")}
              </label>
              <Textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                placeholder={formatSentenceCase("Detalles adicionales del pago...")}
                className="bg-background border-border/50 h-full min-h-[140px] rounded-none focus-visible:ring-primary font-medium resize-none p-4"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <HandCoins className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest leading-relaxed italic">
            El registro generará un comprobante automático de ingreso. Asegúrese que el monto sea correcto antes de proceder.
          </p>
        </div>
      </form>
    </DetailModal>
  );
}
