import React from 'react';
import { Payment } from '@/types/database';
import { DetailModal } from '@/components/shared/DetailModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, ExternalLink, Receipt, CreditCard, Tag, HandCoins, Calculator, Briefcase } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatSentenceCase } from '@/lib/format-utils';

interface PaymentDetailPanelProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentDetailPanel({ payment, isOpen, onClose }: PaymentDetailPanelProps) {
  if (!payment) return null;

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatCurrency(payment.amount)}
      icon={HandCoins}
      subtitle={formatSentenceCase(`FINANZAS > INGRESOS > COMPROBANTE DE PAGO`)}
      status={{ 
        label: formatSentenceCase(payment.payment_type.replace('_', ' ')), 
        variant: "secondary" 
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-12">
          {/* SECCIÓN 1: RESUMEN MONETARIO */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Resumen de la transacción")}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 p-8 border border-border/10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Monto registrado</p>
                <p className="text-3xl font-black text-primary">{formatCurrency(payment.amount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Método de pago</p>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold uppercase">{payment.payment_method.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/10 w-full" />

          {/* SECCIÓN 2: NOTAS Y COMPROBANTE */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <Tag className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Notas adicionales")}</h3>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed font-medium bg-muted/5 p-6 border border-border/10 italic">
                {payment.notes || formatSentenceCase("No se registraron observaciones adicionales para este pago.")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <Receipt className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Soporte digital")}</h3>
              </div>
              {payment.receipt_url ? (
                <a 
                  href={payment.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 p-8 border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-all group"
                >
                  <Receipt className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-black text-sm uppercase tracking-widest">Ver comprobante de pago</p>
                    <p className="text-[10px] font-bold text-primary/60 uppercase">El archivo se abrirá en una nueva pestaña</p>
                  </div>
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              ) : (
                <div className="p-8 border border-dashed border-border/30 text-muted-foreground text-xs font-bold uppercase tracking-widest text-center italic bg-muted/5">
                  No se cargó un comprobante digital para esta transacción.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar de Detalles */}
        <div className="space-y-8">
          <div className="space-y-6 bg-muted/5 p-6 border border-border/10">
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Entidad / Cliente</p>
              {payment.clients && (
                <a href={`/directory/${payment.clients.id}`} className="flex items-center gap-2 text-primary hover:underline group">
                  <User className="w-3 h-3" />
                  <span className="text-xs font-bold truncate">{payment.clients.name}</span>
                </a>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t border-border/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Vínculo de Proyecto</p>
              {payment.projects ? (
                <a href={`/projects/${payment.projects.id}`} className="flex items-center gap-2 text-primary hover:underline group">
                  <Briefcase className="w-3 h-3" />
                  <span className="text-xs font-bold truncate">{payment.projects.name}</span>
                </a>
              ) : (
                <p className="text-xs font-bold text-muted-foreground italic">Gasto general (No asignado)</p>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t border-border/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Fecha Contable</p>
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3 text-primary" />
                {payment.received_at ? format(parseISO(payment.received_at), "d 'de' MMMM yyyy", { locale: es }) : '---'}
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-border/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Registrado por</p>
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-primary" />
                <span className="text-xs font-bold text-foreground">{payment.profiles?.full_name || 'Personal Administrativo'}</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-primary/5 border border-primary/10">
            <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest text-center leading-relaxed">
              Este registro es parte integral de la contabilidad oficial de la empresa.
            </p>
          </div>
        </div>
      </div>
    </DetailModal>
  );
}
