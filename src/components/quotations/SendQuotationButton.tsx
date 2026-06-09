import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useSendQuotation } from '@/hooks/quotations/useSendQuotation';
import type { UserRole } from '@/types/auth';

interface Props {
  quotationId: string;
  status: string;
  currentUserRole: UserRole | null | undefined;
  /** Si la cotización todavía no tiene `whatsapp_phone` del cliente, mostramos warning */
  clientHasWhatsapp?: boolean;
}

const SEND_ALLOWED_ROLES: UserRole[] = ['admin', 'super_admin', 'comercial'];

export function SendQuotationButton({
  quotationId,
  status,
  currentUserRole,
  clientHasWhatsapp = true,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const send = useSendQuotation();

  if (status !== 'draft') return null;
  if (!currentUserRole || !SEND_ALLOWED_ROLES.includes(currentUserRole)) return null;

  const handleConfirm = async () => {
    try {
      await send.mutateAsync({ quotationId });
      setConfirmOpen(false);
    } catch {
      // Toast ya manejado por el hook
    }
  };

  return (
    <>
      <Button
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => setConfirmOpen(true)}
      >
        <Send className="w-4 h-4 mr-2" />
        Enviar al cliente
      </Button>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        isLoading={send.isPending}
        title="¿Enviar al cliente?"
        description={
          clientHasWhatsapp
            ? 'Se bloqueará la edición y le llegará un WhatsApp con el link para revisarla. Después podés desbloquear si necesitás corregir algo.'
            : 'Atención: el cliente no tiene WhatsApp registrado. La cotización igual queda bloqueada y con link público, pero le tenés que pasar el link manualmente.'
        }
        confirmText="Sí, enviar"
        cancelText="Cancelar"
        variant="default"
      />
    </>
  );
}
