import * as React from "react";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Plus, 
  Search, 
  Filter,
  TrendingUp,
  Receipt,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "use-debounce";
import { formatSentenceCase } from "@/lib/format-utils";
import { notify } from "@/components/ui/PremiumToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { parseISO, startOfMonth, endOfMonth, format } from "date-fns";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { useExpenses } from "@/hooks/finanzas/useExpenses";
import { useProjects } from "@/hooks/useProjects";
import { Expense } from "@/types/database";
import { columns, statusMap } from "./expenses/ExpensesColumns";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { NewExpenseModal } from "@/components/finanzas/NewExpenseModal";
import { ExpenseDetailPanel } from "@/components/finanzas/ExpenseDetailPanel";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useFinancialSummary } from "@/hooks/finanzas/useFinancialSummary";

export default function GastosPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [selectedExpense, setSelectedExpense] = React.useState<Expense | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [expensesToDelete, setExpensesToDelete] = React.useState<Expense[]>([]);

  // Filter States
  const [filters, setFilters] = React.useState({
    approval_status: [] as string[],
    category: [] as string[],
    project_id: "all" as string,
    dateFrom: "" as string,
    dateTo: "" as string
  });

  const { data: expensesResult, isLoading } = useExpenses(
    {
      approval_status: filters.approval_status.length > 0 ? filters.approval_status[0] : "all",
      category: filters.category.length > 0 ? filters.category[0] : "all",
      project_id: filters.project_id,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      search: debouncedSearch,
    },
    { pageIndex, pageSize }
  );
  const expenses = expensesResult?.data ?? [];
  const expensesTotalCount = expensesResult?.count ?? 0;

  React.useEffect(() => { setPageIndex(0); }, [debouncedSearch, filters]);

  const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const currentMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const { data: summary } = useFinancialSummary(currentMonthStart, currentMonthEnd);

  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);

  const metrics: MetricData[] = React.useMemo(() => [
    { 
      title: formatSentenceCase("Gastos mes"), 
      value: formatCurrency(summary?.total_expenses || 0), 
      description: formatSentenceCase("Egresos registrados"), 
      icon: Receipt, 
      trend: "neutral", 
      color: "red" 
    },
    { 
      title: formatSentenceCase("Pendientes"), 
      value: expenses.filter(e => e.approval_status === 'pendiente').length, 
      description: formatSentenceCase("Por aprobar"), 
      icon: Clock, 
      trend: "neutral", 
      color: "yellow" 
    },
    { 
      title: formatSentenceCase("Aprobados"), 
      value: expenses.filter(e => e.approval_status === 'aprobado').length, 
      description: formatSentenceCase("Gastos liquidados"), 
      icon: CheckCircle2, 
      trend: "neutral", 
      color: "green" 
    },
  ], [summary, expenses]);

  const navigate = useNavigate();

  const handleDeleteSelected = React.useCallback((rows: Expense[]) => {
    setExpensesToDelete(rows);
    setIsDeleteDialogOpen(true);
  }, []);

  const toggleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      approval_status: prev.approval_status.includes(status) 
        ? prev.approval_status.filter(s => s !== status) 
        : [status] // Using single select for now as per hook compatibility but keeping UI pattern
    }));
  };

  const clearFilters = () => {
    setFilters({
      approval_status: [],
      category: [],
      project_id: "all",
      dateFrom: "",
      dateTo: ""
    });
  };

  const isFiltered = filters.approval_status.length > 0 || filters.category.length > 0 || filters.project_id !== "all" || filters.dateFrom || filters.dateTo;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader 
        title={formatSentenceCase("GESTIÓN DE GASTOS")}
        subtitle={formatSentenceCase("Control de egresos, compras y flujo de aprobación técnica.")}
        icon={Receipt}
        onBack={() => navigate("/finanzas/pagos")}
        action={{
          label: formatSentenceCase("Nuevo gasto"),
          icon: Plus,
          onClick: () => setIsModalOpen(true)
        }}
      />

      {isLoading && !expenses.length ? (
        <MetricGridSkeleton count={3} />
      ) : (
        <MetricsGrid metrics={metrics} />
      )}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={formatSentenceCase("Buscar por descripción...")} 
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <FilterSheet
          title={formatSentenceCase("Filtros de gastos")}
          description={formatSentenceCase("Segmenta tus egresos por estado, categoría o proyecto.")}
          onApply={() => notify.info(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La lista ha sido actualizada."))}
          onClear={clearFilters}
        >
          <div className="space-y-8">
            {/* Estado */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Estado")}</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusMap).map(([key, { label }]) => (
                  <Button 
                    key={key} 
                    variant={filters.approval_status.includes(key) ? "default" : "outline"}
                    onClick={() => toggleStatusFilter(key)}
                    className={cn(
                      "text-[10px] font-bold h-10 rounded-none border-border/30",
                      filters.approval_status.includes(key) ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                    )}
                  >
                    {formatSentenceCase(label)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Proyecto */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Proyecto")}</label>
              <select 
                value={filters.project_id}
                onChange={(e) => setFilters(prev => ({ ...prev, project_id: e.target.value }))}
                className="w-full bg-background border border-border/50 h-10 rounded-none focus-visible:ring-primary px-3 text-sm font-bold"
              >
                <option value="all">{formatSentenceCase("Todos los proyectos")}</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Rango de Fechas */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Rango de fechas")}</label>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatSentenceCase("Desde")}</p>
                  <CalendarPopover
                    selected={filters.dateFrom ? parseISO(filters.dateFrom) : undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date ? date.toISOString().split('T')[0] : "" }))}
                    className="w-full text-xs"
                    placeholder={formatSentenceCase("Desde")}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatSentenceCase("Hasta")}</p>
                  <CalendarPopover
                    selected={filters.dateTo ? parseISO(filters.dateTo) : undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date ? date.toISOString().split('T')[0] : "" }))}
                    className="w-full text-xs"
                    placeholder={formatSentenceCase("Hasta")}
                  />
                </div>
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
            className="text-xs font-bold text-primary"
          >
            {formatSentenceCase("Limpiar búsqueda")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        isLoading={isLoading}
        totalCount={expensesTotalCount}
        pageCount={Math.max(1, Math.ceil(expensesTotalCount / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedExpense}
        onDeleteSelected={handleDeleteSelected}
        emptyMessage={
          <EmptyState 
            title="Sin gastos registrados"
            description="No se encontraron egresos que coincidan con los filtros actuales."
            icon={Receipt}
            action={{
              label: "Registrar gasto",
              icon: Plus,
              onClick: () => setIsModalOpen(true)
            }}
          />
        }
      />

      <NewExpenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <ExpenseDetailPanel 
        expense={selectedExpense} 
        isOpen={!!selectedExpense} 
        onClose={() => setSelectedExpense(null)} 
      />

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => setIsDeleteDialogOpen(false)}
        isLoading={false}
        title={formatSentenceCase("¿Eliminar registros?")}
        description={formatSentenceCase(`¿Estás seguro de que deseas eliminar ${expensesToDelete.length} gasto(s)? Esta acción no se puede deshacer.`)}
        confirmText={formatSentenceCase("Eliminar")}
        cancelText={formatSentenceCase("Cancelar")}
      />
    </div>
  );
}
