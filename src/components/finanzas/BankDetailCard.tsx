import * as React from 'react';
import { motion } from 'framer-motion';
import { BankDetail } from '@/hooks/useBankDetails';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BankDetailCardProps {
  detail: BankDetail;
  isActive: boolean;
  onSetActive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function BankDetailCard({
  detail,
  isActive,
  onSetActive,
  onDelete,
  isLoading = false,
}: BankDetailCardProps) {
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (window.confirm('¿Eliminar este dato bancario?')) {
      setDeleting(true);
      try {
        await onDelete(detail.id);
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'border rounded-sm p-6 space-y-4 transition-all',
        isActive
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/50 bg-background hover:border-border/80'
      )}
    >
      {/* Header con badge activo */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
            {detail.bank_name.toUpperCase()}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {detail.account_type === 'ahorro' ? 'Cuenta Ahorro' : 'Cuenta Corriente'}
          </p>
        </div>
        {isActive && (
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-sm">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
              Activa
            </span>
          </div>
        )}
      </div>

      {/* Información */}
      <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/30">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Número de Cuenta
          </p>
          <p className="text-sm font-medium text-foreground mt-1">
            {detail.account_number}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Titular
          </p>
          <p className="text-sm font-medium text-foreground mt-1">
            {detail.holder_name}
          </p>
        </div>
      </div>

      {/* Detalles adicionales */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cédula:</span>
          <span className="font-medium">{detail.holder_id}</span>
        </div>
        {detail.nequi_phone && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nequi:</span>
            <span className="font-medium">{detail.nequi_phone}</span>
          </div>
        )}
        {detail.daviplata_phone && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Daviplata:</span>
            <span className="font-medium">{detail.daviplata_phone}</span>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        {!isActive && (
          <Button
            onClick={() => onSetActive(detail.id)}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="text-xs font-bold uppercase h-9 rounded-none flex-1"
          >
            Activar
          </Button>
        )}
        <Button
          onClick={handleDelete}
          disabled={isLoading || deleting}
          variant="ghost"
          size="sm"
          className="text-xs font-bold uppercase h-9 rounded-none text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Eliminar
        </Button>
      </div>
    </motion.div>
  );
}
