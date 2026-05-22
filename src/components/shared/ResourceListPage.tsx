import * as React from "react";
import { LucideIcon, Plus, Search } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useDebounce } from "use-debounce";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { DataTable } from "@/components/shared/DataTable";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/ui/PremiumToast";
import { formatSentenceCase } from "@/lib/format-utils";

export interface ResourceQueryResult<TData> {
  data: TData[];
  isLoading: boolean;
  totalCount: number;
  deleteItems?: (ids: string[]) => Promise<void>;
}

export interface ResourceListPageProps<TData> {
  // Header
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onBack?: () => void;
  createLabel?: string;
  onCreateClick?: () => void;

  // Data (hook injection — valid React pattern, called at component top level)
  // hookParams: optional extra args forwarded verbatim to useQueryHook (e.g. filter state)
  useQueryHook: (
    search: string,
    pagination: { pageIndex: number; pageSize: number },
    hookParams?: unknown
  ) => ResourceQueryResult<TData>;
  hookParams?: unknown;

  // Table
  columns: ColumnDef<TData, any>[];
  searchPlaceholder?: string;
  pageSize?: number;

  // Metrics
  metrics?: MetricData[];
  metricsCount?: number;

  // Filters
  filterTitle?: string;
  filterDescription?: string;
  filterContent?: React.ReactNode;
  isFiltered?: boolean;
  onClearFilters?: () => void;

  // Row interactions
  onRowClick?: (row: TData) => void;

  // Delete — if not provided, falls back to deleteItems from useQueryHook result
  onConfirmDelete?: (rows: TData[]) => Promise<void>;
  deleteTitle?: string;
  deleteDescription?: (count: number) => string;
  deleteConfirmText?: string;
  deleteButtonLabel?: string;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;

  // Extra content (detail panels, modals)
  children?: React.ReactNode;
}

export function ResourceListPage<TData>({
  title,
  subtitle,
  icon,
  onBack,
  createLabel,
  onCreateClick,
  useQueryHook,
  hookParams,
  columns,
  searchPlaceholder,
  pageSize: defaultPageSize = 20,
  metrics,
  metricsCount = 4,
  filterTitle,
  filterDescription,
  filterContent,
  isFiltered,
  onClearFilters,
  onRowClick,
  onConfirmDelete,
  deleteTitle,
  deleteDescription,
  deleteConfirmText,
  deleteButtonLabel,
  emptyTitle = "Sin registros",
  emptyDescription = "No se encontraron elementos que coincidan con los filtros actuales.",
  emptyIcon,
  children,
}: ResourceListPageProps<TData>) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(defaultPageSize);
  const [itemsToDelete, setItemsToDelete] = React.useState<TData[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => { setPageIndex(0); }, [debouncedSearch, isFiltered]);

  const { data, isLoading, totalCount, deleteItems } = useQueryHook(debouncedSearch, { pageIndex, pageSize }, hookParams);

  const effectiveDelete = onConfirmDelete ?? (deleteItems
    ? async (rows: TData[]) => {
        const ids = rows.map((r: any) => r.id as string);
        await deleteItems(ids);
      }
    : undefined);

  const handleDeleteSelected = React.useCallback((rows: TData[]) => {
    setItemsToDelete(rows);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = async () => {
    if (!effectiveDelete) return;
    setIsDeleting(true);
    try {
      await effectiveDelete(itemsToDelete);
    } finally {
      setIsDeleting(false);
      setItemsToDelete([]);
      setIsDeleteDialogOpen(false);
    }
  };

  const showClearButton = searchTerm || isFiltered;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader
        title={formatSentenceCase(title)}
        subtitle={subtitle ? formatSentenceCase(subtitle) : undefined}
        icon={icon}
        onBack={onBack}
        action={
          createLabel && onCreateClick
            ? { label: formatSentenceCase(createLabel), icon: Plus, onClick: onCreateClick }
            : undefined
        }
      />

      {isLoading && !metrics?.length ? (
        <MetricGridSkeleton count={metricsCount} />
      ) : metrics?.length ? (
        <MetricsGrid metrics={metrics} />
      ) : null}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder ? formatSentenceCase(searchPlaceholder) : formatSentenceCase("Buscar...")}
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filterContent && (
          <FilterSheet
            title={formatSentenceCase(filterTitle ?? "Filtros")}
            description={filterDescription ? formatSentenceCase(filterDescription) : undefined}
            onApply={() => notify.info(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La lista ha sido actualizada."))}
            onClear={onClearFilters}
          >
            {filterContent}
          </FilterSheet>
        )}

        {showClearButton && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchTerm("");
              onClearFilters?.();
            }}
            className="text-xs font-bold text-primary"
          >
            {formatSentenceCase("Limpiar búsqueda")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        totalCount={totalCount}
        pageCount={Math.max(1, Math.ceil(totalCount / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={onRowClick}
        onDeleteSelected={effectiveDelete ? handleDeleteSelected : undefined}
        deleteButtonLabel={deleteButtonLabel}
        emptyMessage={
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={emptyIcon ?? icon}
            action={
              createLabel && onCreateClick
                ? { label: createLabel, icon: Plus, onClick: onCreateClick }
                : undefined
            }
          />
        }
      />

      {effectiveDelete && (
        <ConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleConfirmDelete}
          isLoading={isDeleting}
          title={formatSentenceCase(deleteTitle ?? "¿Eliminar elementos?")}
          description={formatSentenceCase(
            deleteDescription
              ? deleteDescription(itemsToDelete.length)
              : `¿Estás seguro de que deseas eliminar ${itemsToDelete.length} elemento(s)? Esta acción no se puede deshacer.`
          )}
          confirmText={formatSentenceCase(deleteConfirmText ?? "Eliminar")}
          cancelText={formatSentenceCase("Cancelar")}
        />
      )}

      {children}
    </div>
  );
}
