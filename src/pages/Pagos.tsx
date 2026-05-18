import React, { useState } from 'react';
import { PaymentMetrics } from '@/components/finanzas/PaymentMetrics';
import { PaymentsList } from '@/components/finanzas/PaymentsList';
import { NewPaymentModal } from '@/components/finanzas/NewPaymentModal';
import { PaymentDetailPanel } from '@/components/finanzas/PaymentDetailPanel';
import { usePayments } from '@/hooks/finanzas/usePayments';
import { Payment } from '@/types/database';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, HandCoins, Search, Filter } from 'lucide-react';
import { FilterSheet } from '@/components/shared/FilterSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatSentenceCase } from '@/lib/format-utils';
import { cn } from '@/lib/utils';
import { notify } from '@/components/ui/PremiumToast';
import { PrimaryButton } from '@/components/shared/PrimaryButton';

export default function PagosPage() {
  const [filters, setFilters] = useState({
    project_id: 'all',
    payment_method: 'all',
    payment_type: 'all',
    date_from: '',
    date_to: ''
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const { data: payments = [], isLoading } = usePayments(filters);
  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  const [searchTerm, setSearchTerm] = useState("");

  const filteredPayments = payments.filter(p => 
    !searchTerm || (p.projects as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.clients as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearFilters = () => {
    setFilters({
      project_id: 'all',
      payment_method: 'all',
      payment_type: 'all',
      date_from: '',
      date_to: ''
    });
  };

  const isFiltered = filters.project_id !== 'all' || filters.payment_method !== 'all' || filters.payment_type !== 'all' || filters.date_from || filters.date_to;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-none border border-primary/20 flex items-center justify-center">
            <HandCoins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-[10px] font-black text-primary tracking-[0.3em] uppercase">Módulo Financiero</h1>
            <h2 className="text-3xl font-heading font-bold text-foreground">Pagos</h2>
          </div>
        </div>
        <PrimaryButton 
          onClick={() => setIsModalOpen(true)} 
          label="Registrar Pago"
          icon={Plus}
          className="h-12 px-8 rounded-none"
        />
      </div>

      <PaymentMetrics />

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:border-l-primary hover:border-l-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={formatSentenceCase("Buscar por proyecto o ID...")} 
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <FilterSheet
          title={formatSentenceCase("Filtros de pagos")}
          description={formatSentenceCase("Ajusta los criterios de búsqueda para localizar abonos específicos.")}
          onApply={() => notify.info(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La lista de pagos ha sido actualizada."))}
          onClear={clearFilters}
        >
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Proyecto")}</label>
              <Select value={filters.project_id} onValueChange={v => setFilters({...filters, project_id: v})}>
                <SelectTrigger className="rounded-none border-border/30 font-bold h-10">
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proyectos</SelectItem>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Método de Pago")}</label>
              <Select value={filters.payment_method} onValueChange={v => setFilters({...filters, payment_method: v})}>
                <SelectTrigger className="rounded-none border-border/30 font-bold h-10">
                  <SelectValue placeholder="Seleccionar método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los métodos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="nequi">Nequi</SelectItem>
                  <SelectItem value="daviplata">Daviplata</SelectItem>
                  <SelectItem value="pse">PSE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Tipo de Pago")}</label>
              <Select value={filters.payment_type} onValueChange={v => setFilters({...filters, payment_type: v})}>
                <SelectTrigger className="rounded-none border-border/30 font-bold h-10">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="anticipo">Anticipo</SelectItem>
                  <SelectItem value="abono">Abono</SelectItem>
                  <SelectItem value="pago_final">Pago Final</SelectItem>
                  <SelectItem value="reembolso">Reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Rango de Fechas")}</label>
              <div className="grid grid-cols-1 gap-3">
                <Input 
                  type="date" 
                  value={filters.date_from} 
                  onChange={e => setFilters({...filters, date_from: e.target.value})} 
                  className="rounded-none border-border/30 font-bold h-10"
                />
                <Input 
                  type="date" 
                  value={filters.date_to} 
                  onChange={e => setFilters({...filters, date_to: e.target.value})} 
                  className="rounded-none border-border/30 font-bold h-10"
                />
              </div>
            </div>
          </div>
        </FilterSheet>

        {(searchTerm || isFiltered) && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setSearchTerm("");
              clearFilters();
            }}
            className="text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
          >
            {formatSentenceCase("Limpiar")}
          </Button>
        )}
      </div>

      <div className="bg-card/30 border border-border/10 p-1">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground bg-card/50 font-black tracking-widest text-[10px] uppercase">
            <div className="animate-pulse">Cargando registros financieros...</div>
          </div>
        ) : (
          <PaymentsList 
            payments={filteredPayments} 
            onPaymentClick={setSelectedPayment} 
            onRegister={() => setIsModalOpen(true)}
          />
        )}
      </div>

      <NewPaymentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <PaymentDetailPanel 
        payment={selectedPayment} 
        isOpen={!!selectedPayment} 
        onClose={() => setSelectedPayment(null)} 
      />
    </div>
  );
}
