import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateClient } from "@/hooks/useClients";
import { notify } from "@/components/ui/PremiumToast";
import { UserPlus, User, Mail, MessageSquare, MapPin, FileText, CheckCircle2 } from "lucide-react";
import { formatSentenceCase } from "@/lib/format-utils";

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Alta directa de cliente (carta cliente 2026-06-11). Atajo para clientes que
 * llegan por fuera del embudo de leads (referidos, presenciales). El flujo
 * principal lead → conversión automática sigue intacto.
 */
export function NewClientModal({ isOpen, onClose }: NewClientModalProps) {
  const createClient = useCreateClient();
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    whatsapp_phone: "",
    address: "",
    notes: "",
  });

  React.useEffect(() => {
    if (!isOpen) {
      setFormData({ name: "", email: "", whatsapp_phone: "", address: "", notes: "" });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify.error("Error", "El nombre del cliente es obligatorio");
      return;
    }

    try {
      await createClient.mutateAsync({
        name: formData.name.trim(),
        // Los strings vacíos rompen las validaciones de formato (email/teléfono):
        // se normalizan a null.
        email: formData.email.trim() || null,
        whatsapp_phone: formData.whatsapp_phone.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
      });
      notify.success(formatSentenceCase("Cliente creado"), formatSentenceCase("El cliente quedó registrado en el directorio."));
      onClose();
    } catch {
      /* notifyError ya corre en el hook */
    }
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("NUEVO CLIENTE")}
      icon={UserPlus}
      subtitle={formatSentenceCase("CLIENTES > REGISTRO DIRECTO")}
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
            form="new-client-form"
            disabled={createClient.isPending || !formData.name.trim()}
            className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {createClient.isPending ? formatSentenceCase("Creando...") : formatSentenceCase("Crear cliente")}
          </Button>
        </div>
      }
    >
      <form id="new-client-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-6 border border-border/10">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <User className="w-3 h-3" /> {formatSentenceCase("Nombre completo")} <span className="text-primary">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={formatSentenceCase("Ej. María Fernanda López")}
              maxLength={255}
              className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> {formatSentenceCase("Email (opcional)")}
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="cliente@correo.com"
              className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> {formatSentenceCase("WhatsApp (opcional)")}
            </label>
            <Input
              value={formData.whatsapp_phone}
              onChange={(e) => setFormData({ ...formData, whatsapp_phone: e.target.value })}
              placeholder="+57 300 123 4567"
              className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> {formatSentenceCase("Dirección (opcional)")}
            </label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={formatSentenceCase("Ej. Cra 15 #23-45, Pereira")}
              maxLength={500}
              className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-medium"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> {formatSentenceCase("Notas (opcional)")}
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={formatSentenceCase("Cómo llegó el cliente, referidos, contexto...")}
              maxLength={2000}
              className="bg-background border-border/50 min-h-24 rounded-none focus-visible:ring-primary font-medium resize-none"
            />
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 flex gap-4 items-center">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[10px] font-bold text-primary/80 uppercase tracking-widest leading-relaxed italic">
            Use este atajo para clientes que llegan por fuera del embudo (referidos o presenciales). Las solicitudes web siguen convirtiéndose en clientes automáticamente.
          </p>
        </div>
      </form>
    </DetailModal>
  );
}
