import React from 'react';
import { Payment } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Receipt, HandCoins, Plus } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

interface PaymentsListProps {
  payments: Payment[];
  onPaymentClick: (payment: Payment) => void;
  onRegister?: () => void;
}

export function PaymentsList({ payments, onPaymentClick, onRegister }: PaymentsListProps) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

  const getMethodBadge = (method: string) => {
    const shadowClass = "shadow-[0_0_8px_rgba(var(--color),0.2)]"; // Dynamic shadow if I used variables, but I'll stick to hardcoded for consistency with existing code
    
    switch (method.toLowerCase()) {
      case 'transferencia':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)] uppercase text-[10px] rounded-none">Transferencia</Badge>;
      case 'efectivo':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)] uppercase text-[10px] rounded-none">Efectivo</Badge>;
      case 'tarjeta':
      case 'tarjeta_credito':
      case 'tarjeta_debito':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)] uppercase text-[10px] rounded-none">Tarjeta</Badge>;
      case 'nequi':
        return <Badge className="bg-[#cc338b]/20 text-[#cc338b] border-[#cc338b]/30 shadow-[0_0_8px_rgba(204,51,139,0.2)] uppercase text-[10px] rounded-none">Nequi</Badge>;
      case 'daviplata':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)] uppercase text-[10px] rounded-none">Daviplata</Badge>;
      case 'pse':
        return <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 shadow-[0_0_8_px_rgba(37,99,235,0.2)] uppercase text-[10px] rounded-none">PSE</Badge>;
      default:
        return <Badge className="bg-primary/20 text-primary border-primary/30 shadow-[0_0_8px_rgba(0,255,200,0.15)] uppercase text-[10px] rounded-none">{method.replace('_', ' ')}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'anticipo': return <Badge className="bg-primary/20 text-primary border-primary/30 shadow-[0_0_8px_rgba(0,255,200,0.15)] uppercase text-[10px] rounded-none">Anticipo</Badge>;
      case 'abono': return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)] uppercase text-[10px] rounded-none">Abono</Badge>;
      case 'pago_final': return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.2)] uppercase text-[10px] rounded-none">Final</Badge>;
      case 'reembolso': return <Badge variant="destructive" className="shadow-[0_0_8px_rgba(239,68,68,0.2)] uppercase text-[10px] rounded-none">Reembolso</Badge>;
      default: return <Badge variant="secondary" className="shadow-[0_0_8px_rgba(100,100,100,0.2)] uppercase text-[10px] rounded-none">{type}</Badge>;
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-semibold tracking-wider">Cliente</th>
              <th className="px-4 py-3 font-semibold tracking-wider hidden md:table-cell">Proyecto</th>
              <th className="px-4 py-3 font-semibold tracking-wider">Monto</th>
              <th className="px-4 py-3 font-semibold tracking-wider hidden sm:table-cell">Método</th>
              <th className="px-4 py-3 font-semibold tracking-wider hidden lg:table-cell">Tipo</th>
              <th className="px-4 py-3 font-semibold tracking-wider">Fecha</th>
              <th className="px-4 py-3 font-semibold tracking-wider hidden xl:table-cell">Registrado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {payments.map(payment => (
              <tr 
                key={payment.id} 
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onPaymentClick(payment)}
              >
                <td className="px-4 py-3 font-medium text-foreground max-w-[180px] truncate" title={payment.clients?.name || ''}>
                  {payment.clients?.name || '---'}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate" title={payment.projects?.name || ''}>
                  {payment.projects?.name || 'Sin proyecto'}
                </td>
                <td className="px-4 py-3 font-bold text-foreground">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {getMethodBadge(payment.payment_method)}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {getTypeBadge(payment.payment_type)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {format(parseISO(payment.received_at), "d MMM yyyy", { locale: es })}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                  {payment.profiles?.full_name || '---'}
                </td>
              </tr>
            ))}
            
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-0 border-none">
                  <EmptyState 
                    title="No se encontraron pagos"
                    description="No hay registros de pagos que coincidan con los filtros actuales."
                    icon={HandCoins}
                    action={onRegister ? {
                      label: "Registrar Pago",
                      icon: Plus,
                      onClick: onRegister
                    } : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
