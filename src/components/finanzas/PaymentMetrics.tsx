import React, { useMemo } from 'react';
import { Wallet, TrendingUp, HandCoins } from 'lucide-react';
import { useFinancialSummary } from '@/hooks/finanzas/useFinancialSummary';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { MetricsGrid, MetricData } from '@/components/shared/MetricsGrid';
import { MetricGridSkeleton } from '@/components/shared/skeletons/MetricGridSkeleton';

export function PaymentMetrics() {
  const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  
  const { data: summary, isLoading } = useFinancialSummary(currentMonthStart, currentMonthEnd);

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

  const metrics: MetricData[] = useMemo(() => [
    {
      title: "Ingresos del Mes",
      value: formatCurrency(summary?.total_income || 0),
      description: "Recaudado en el periodo actual",
      icon: TrendingUp,
      trend: "up",
      color: "primary"
    },
    {
      title: "Saldo Pendiente",
      value: formatCurrency(summary?.pending_balance || 0),
      description: "Por recaudar de proyectos activos",
      icon: HandCoins,
      trend: "neutral",
      color: "yellow"
    },
    {
      title: "Resumen General",
      value: formatCurrency(summary?.total_income || 0),
      description: "Total histórico acumulado",
      icon: Wallet,
      trend: "up",
      color: "blue"
    }
  ], [summary]);

  if (isLoading && !summary) {
    return <MetricGridSkeleton count={3} />;
  }

  return <MetricsGrid metrics={metrics} />;
}
