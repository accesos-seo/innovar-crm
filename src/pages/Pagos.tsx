import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PaymentMetrics } from '@/components/finanzas/PaymentMetrics';
import { PaymentsList } from '@/components/finanzas/PaymentsList';
import { NewPaymentModal } from '@/components/finanzas/NewPaymentModal';
import { PaymentDetailPanel } from '@/components/finanzas/PaymentDetailPanel';
import { PaymentVerifyModal } from '@/components/finanzas/PaymentVerifyModal';
import { ManualPaymentModal } from '@/components/finanzas/ManualPaymentModal';
import { usePayments } from '@/hooks/finanzas/usePayments';
import { Payment } from '@/types/database';
import { useProjects } from '@/hooks/useProjects';
import { useFeatureFlag } from '@/hooks/settings/useFeatureFlag';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Plus, HandCoins, Search, Receipt } from 'lucide-react';
import { FilterSheet } from '@/components/shared/FilterSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatSentenceCase } from '@/lib/format-utils';
import { notify } from '@/components/ui/PremiumToast';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import {
  PAYMENT_METHOD_LABELS_ES,
  PAYMENT_TYPE_LABELS_ES,
  paymentMethodSchema,
  paymentTypeSchema,
} from '@/schemas/payment';

type TabKey = 'pending' | 'verified' | 'rejected';

export default function PagosPage() {
  const slice3 = useFeatureFlag('slice_3_enabled');
  const location = useLocation();

  const pendingPaymentIdRef = useRef<string | null>(
    (location.state as { paymentId?: string } | null)?.paymentId ?? null
  );

  const [filters, setFilters] = useState({
    project_id: 'all',
    payment_method: 'all',
    payment_type: 'all',
    date_from: '',
    date_to: ''
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<Payment | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Legacy fetch (sin filtro de verification_status) — alimenta el layout
  // OFF-flag y los tabs Verified/Rejected cuando el flag está ON.
  const { data: payments = [], isLoading } = usePayments(filters);

  // Sólo cuando flag ON: contador de pendientes vive en su propio query para
  // que el badge no dependa del filtro general.
  const { data: pendingPayments = [] } = usePayments({
    ...filters,
    verification_status: slice3 ? 'pending' : undefined,
  });

  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  const matches = (p: Payment) =>
    !searchTerm ||
    (p.projects as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.clients as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase());

  const filteredAll = useMemo(
    () => payments.filter(matches),
    [payments, searchTerm]
  );

  const tabSplit = useMemo(() => {
    const acc: Record<TabKey, Payment[]> = {
      pending: [],
      verified: [],
      rejected: [],
    };
    for (const p of filteredAll) {
      const v = (p.verification_status ?? null) as TabKey | null;
      if (v === 'pending' || v === 'verified' || v === 'rejected') {
        acc[v].push(p);
      } else {
        // Legacy rows sin verification_status caen en "verified" (ya cobrados).
        acc.verified.push(p);
      }
    }
    return acc;
  }, [filteredAll]);

  const pendingCount = slice3
    ? pendingPayments.filter(matches).length
    : tabSplit.pending.length;

  const clearFilters = () => {
    setFilters({
      project_id: 'all',
      payment_method: 'all',
      payment_type: 'all',
      date_from: '',
      date_to: ''
    });
  };

  const isFiltered =
    filters.project_id !== 'all' ||
    filters.payment_method !== 'all' ||
    filters.payment_type !== 'all' ||
    !!filters.date_from ||
    !!filters.date_to;

  const handlePaymentClick = useCallback((p: Payment) => {
    if (slice3 && p.verification_status === 'pending') {
      setVerifyingPayment(p);
    } else {
      setSelectedPayment(p);
    }
  }, [slice3]);

  useEffect(() => {
    if (!pendingPaymentIdRef.current || payments.length === 0) return;
    const target = payments.find(p => p.id === pendingPaymentIdRef.current);
    if (!target) return;
    pendingPaymentIdRef.current = null;
    handlePaymentClick(target);
  }, [payments, handlePaymentClick]);

  const FiltersBar = (
    <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:border-l-primary hover:border-l-4 group">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={formatSentenceCase('Buscar por proyecto o ID...')}
          className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <FilterSheet
        title={formatSentenceCase('Filtros de pagos')}
        description={formatSentenceCase('Ajusta los criterios de búsqueda para localizar abonos específicos.')}
        onApply={() => notify.info(formatSentenceCase('Filtros aplicados'), formatSentenceCase('La lista de pagos ha sido actualizada.'))}
        onClear={clearFilters}
      >
        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase('Proyecto')}</label>
            <Select value={filters.project_id} onValueChange={v => { if (v !== null) setFilters({...filters, project_id: v}); }}>
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
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase('Método de Pago')}</label>
            <Select value={filters.payment_method} onValueChange={v => { if (v !== null) setFilters({...filters, payment_method: v}); }}>
              <SelectTrigger className="rounded-none border-border/30 font-bold h-10">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                {paymentMethodSchema.options.map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS_ES[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase('Tipo de Pago')}</label>
            <Select value={filters.payment_type} onValueChange={v => { if (v !== null) setFilters({...filters, payment_type: v}); }}>
              <SelectTrigger className="rounded-none border-border/30 font-bold h-10">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {paymentTypeSchema.options.map((t) => (
                  <SelectItem key={t} value={t}>{PAYMENT_TYPE_LABELS_ES[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase('Rango de Fechas')}</label>
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
            setSearchTerm('');
            clearFilters();
          }}
          className="text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
        >
          {formatSentenceCase('Limpiar')}
        </Button>
      )}
    </div>
  );

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
        <div className="flex items-center gap-3">
          {slice3 && (
            <Button
              variant="outline"
              onClick={() => setIsManualOpen(true)}
              className="h-12 px-6 rounded-none border-primary/40 text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/10"
            >
              <Receipt className="w-4 h-4 mr-2" />
              Registrar pago manual
            </Button>
          )}
          <PrimaryButton
            onClick={() => setIsModalOpen(true)}
            label="Registrar Pago"
            icon={Plus}
            className="h-12 px-8 rounded-none"
          />
        </div>
      </div>

      <PaymentMetrics />

      {FiltersBar}

      {slice3 ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (v === null) return;
            setActiveTab(v as TabKey);
          }}
          className="w-full"
        >
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="pending" className="data-active:bg-primary data-active:text-primary-foreground font-medium flex items-center gap-2">
              Por verificar
              <Badge
                variant="outline"
                className={
                  pendingCount > 0
                    ? 'border-yellow-500/60 text-yellow-300 bg-yellow-500/10'
                    : 'border-border/40 text-muted-foreground'
                }
              >
                {pendingCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="verified" className="data-active:bg-primary data-active:text-primary-foreground font-medium">
              Verificados
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-active:bg-primary data-active:text-primary-foreground font-medium">
              Rechazados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="bg-card/30 border border-border/10 p-1">
              {isLoading ? (
                <LoadingRow />
              ) : (
                <PaymentsList
                  payments={tabSplit.pending}
                  onPaymentClick={handlePaymentClick}
                  onRegister={() => setIsManualOpen(true)}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="verified" className="mt-4">
            <div className="bg-card/30 border border-border/10 p-1">
              {isLoading ? (
                <LoadingRow />
              ) : (
                <PaymentsList
                  payments={tabSplit.verified}
                  onPaymentClick={handlePaymentClick}
                  onRegister={() => setIsModalOpen(true)}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            <div className="bg-card/30 border border-border/10 p-1">
              {isLoading ? (
                <LoadingRow />
              ) : (
                <PaymentsList
                  payments={tabSplit.rejected}
                  onPaymentClick={handlePaymentClick}
                  onRegister={() => setIsModalOpen(true)}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="bg-card/30 border border-border/10 p-1">
          {isLoading ? (
            <LoadingRow />
          ) : (
            <PaymentsList
              payments={filteredAll}
              onPaymentClick={handlePaymentClick}
              onRegister={() => setIsModalOpen(true)}
            />
          )}
        </div>
      )}

      <NewPaymentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <ManualPaymentModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      <PaymentVerifyModal
        payment={verifyingPayment}
        isOpen={!!verifyingPayment}
        onClose={() => setVerifyingPayment(null)}
      />

      <PaymentDetailPanel
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="h-64 flex items-center justify-center text-muted-foreground bg-card/50 font-black tracking-widest text-[10px] uppercase">
      <div className="animate-pulse">Cargando registros financieros...</div>
    </div>
  );
}
