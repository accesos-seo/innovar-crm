import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BankDetails {
  bank_name?: string;
  bank_account_number?: string;
  bank_account_type?: string;
  bank_holder_name?: string;
  bank_holder_id?: string;
  nequi_phone?: string;
  daviplata_phone?: string;
}

interface BankDetailsCardProps {
  details: BankDetails;
  isLoading?: boolean;
}

export function BankDetailsCard({ details, isLoading }: BankDetailsCardProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const BankField = ({
    label,
    value,
    copyKey,
  }: {
    label: string;
    value?: string;
    copyKey: string;
  }) => {
    if (!value) return null;

    return (
      <div className="flex items-center justify-between p-3 bg-background/50 border border-border/30 rounded-sm group hover:border-primary/30 transition-all">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="text-sm font-semibold text-foreground break-words mt-1">
            {value}
          </p>
        </div>
        <button
          onClick={() => copyToClipboard(value, copyKey)}
          className="shrink-0 ml-3 p-2 rounded-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors opacity-0 group-hover:opacity-100"
          title="Copiar"
        >
          {copiedKey === copyKey ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
        <div className="px-6 sm:px-10 py-8 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-background/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasBankTransfer =
    details.bank_name &&
    details.bank_account_number &&
    details.bank_holder_name;

  const hasNequi = details.nequi_phone;
  const hasDaviplata = details.daviplata_phone;

  if (!hasBankTransfer && !hasNequi && !hasDaviplata) {
    return null;
  }

  return (
    <div className="bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
      <div className="px-6 sm:px-10 py-8 space-y-8">
        <div>
          <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-primary/80 mb-4">
            Datos de Pago
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Copiar los datos y realizar el abono. Al subir el comprobante, nuestro
            equipo lo verificará para confirmar tu proyecto.
          </p>
        </div>

        {hasBankTransfer && (
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Transferencia Bancaria
            </h4>
            <div className="space-y-3">
              <BankField
                label="Banco"
                value={details.bank_name}
                copyKey="bank_name"
              />
              <BankField
                label="Número de Cuenta"
                value={details.bank_account_number}
                copyKey="bank_account_number"
              />
              {details.bank_account_type && (
                <BankField
                  label="Tipo de Cuenta"
                  value={details.bank_account_type}
                  copyKey="bank_account_type"
                />
              )}
              <BankField
                label="Titular"
                value={details.bank_holder_name}
                copyKey="bank_holder_name"
              />
              {details.bank_holder_id && (
                <BankField
                  label="Cédula / NIT"
                  value={details.bank_holder_id}
                  copyKey="bank_holder_id"
                />
              )}
            </div>
          </div>
        )}

        {hasNequi && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Nequi
            </h4>
            <BankField
              label="Número de Celular"
              value={details.nequi_phone}
              copyKey="nequi_phone"
            />
          </div>
        )}

        {hasDaviplata && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Daviplata
            </h4>
            <BankField
              label="Número de Celular"
              value={details.daviplata_phone}
              copyKey="daviplata_phone"
            />
          </div>
        )}
      </div>
    </div>
  );
}
