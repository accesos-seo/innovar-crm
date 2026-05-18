import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";

interface DeleteFlowProps {
  itemId: string;
  itemName: string;
  onDelete: (id: string) => Promise<void>;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function DeleteFlow({ 
  itemId, 
  itemName, 
  onDelete,
  onSuccess,
  trigger 
}: DeleteFlowProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      // 1. Ejecución de la acción (Llamada a la API / Mutación)
      await onDelete(itemId);
      
      // 2. Feedback de éxito
      toast.success("Registro eliminado correctamente.");
      
      // 3. Cerrar el modal
      setIsModalOpen(false);
      
      // 4. Actualización (Refetch de datos o Invalidar Query)
      if (onSuccess) onSuccess();

    } catch (error) {
      // Feedback de error
      toast.error("Ocurrió un error al intentar eliminar el registro.");
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger as React.ReactElement, {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsModalOpen(true);
          }
        })
      ) : (
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(true);
          }}
          className="h-8 rounded-none font-bold uppercase text-[10px] tracking-widest"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Eliminar
        </Button>
      )}

      <ConfirmationDialog
        isOpen={isModalOpen}
        onClose={() => !isDeleting && setIsModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Eliminar registro"
        description={`¿Estás seguro de que deseas eliminar "${itemName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </>
  );
}
