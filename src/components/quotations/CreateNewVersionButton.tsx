import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import type { UserRole } from '@/types/auth';

interface Props {
  quotationId: string;
  status: string;
  currentUserRole: UserRole | null | undefined;
}

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];

/**
 * Botón para crear V2 a partir de una cotización rechazada.
 * Reusa la RPC existente `create_quotation_version`. La nueva versión nace en
 * `draft`, editable, con todos los items copiados.
 */
export function CreateNewVersionButton({ quotationId, status, currentUserRole }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (status !== 'rejected') return null;
  if (!currentUserRole || !ADMIN_ROLES.includes(currentUserRole)) return null;

  const handleConfirm = async () => {
    try {
      assertSupabase(supabase);
      setLoading(true);
      const { data, error } = await supabase.rpc('create_quotation_version', {
        p_quotation_id: quotationId,
      });
      if (error) throw mapSupabaseError(error);
      const newId =
        typeof data === 'string'
          ? data
          : (data as { id?: string; quotation_id?: string })?.id ??
            (data as { quotation_id?: string })?.quotation_id;
      if (!newId) throw new Error('La RPC no devolvió el id de la nueva versión.');

      toast.success('Nueva versión creada', {
        description: 'Editá los ítems y volvé a enviarla cuando esté lista.',
      });
      setOpen(false);
      navigate(`/quotations/${newId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No pudimos crear la nueva versión.';
      toast.error('Error al crear versión', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-blue-300 text-blue-700 hover:bg-blue-50"
        onClick={() => setOpen(true)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Copy className="w-4 h-4 mr-2" />
        )}
        Crear nueva versión
      </Button>

      <ConfirmationDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        isLoading={loading}
        title="Crear nueva versión"
        description="Vamos a duplicar esta cotización en una nueva versión editable (V2). La versión actual queda marcada como histórica."
        confirmText="Crear versión"
        cancelText="Cancelar"
        variant="default"
      />
    </>
  );
}
