import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
  SortingState,
  getSortedRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Trash2,
  X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { SortIcon } from "@/components/ui/SortIcon";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";

import { TableSkeleton } from "@/components/shared/skeletons/TableSkeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  totalCount: number;
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRowClick?: (row: TData) => void;
  onDeleteSelected?: (selectedRows: TData[]) => void;
  deleteButtonLabel?: string;
  emptyMessage?: React.ReactNode;
  onSortChange?: (sorting: SortingState) => void;
  pageSizeOptions?: number[];
}

function DataTableInner<TData, TValue>({
  columns,
  data,
  isLoading,
  totalCount,
  pageCount,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onDeleteSelected,
  deleteButtonLabel,
  emptyMessage = "No se encontraron resultados.",
  onSortChange,
  pageSizeOptions = [25, 50, 100, 250],
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: any) => row?.id ?? "",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    state: {
      rowSelection,
      sorting,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(nextSorting);
      onSortChange?.(nextSorting);
    },
    onPaginationChange: (updater) => {
       const nextPagination = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
       onPageChange(nextPagination.pageIndex);
       onPageSizeChange(nextPagination.pageSize);
    },
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

  if (isLoading) {
    return <TableSkeleton rows={pageSize} columns={columns.length} />;
  }

  return (
    <div className="space-y-4 relative">
      {/* Contextual Action Bar */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute -top-16 left-0 right-0 z-20 flex items-center justify-between bg-primary text-primary-foreground px-6 py-3 rounded-sm shadow-lg"
          >
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setRowSelection({})}
                aria-label="Desmarcar selección"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </Button>
              <span className="text-sm font-bold uppercase tracking-widest">
                {selectedRows.length} {formatSentenceCase("seleccionado(s)")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onDeleteSelected && (
                <Button 
                  variant="ghost" 
                  className="text-primary-foreground hover:bg-destructive hover:text-destructive-foreground gap-2 font-bold uppercase text-[10px] tracking-widest"
                  onClick={() => onDeleteSelected(selectedRows)}
                  aria-label="Eliminar seleccionados"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {formatSentenceCase(deleteButtonLabel ?? "Eliminar")}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-card rounded-sm border border-border/10 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border/10 hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  
                  return (
                    <TableHead 
                      key={header.id} 
                      className={cn(
                        "text-sm font-medium text-muted-foreground transition-colors",
                        canSort && "cursor-pointer hover:bg-muted/30 select-none group"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2 uppercase tracking-widest text-[10px] font-black group-hover:text-foreground transition-colors">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {canSort && (
                          <SortIcon 
                            columnKey={header.id} 
                            currentSort={{ 
                              key: header.id, 
                              direction: sortDir === false ? null : sortDir 
                            }} 
                          />
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border/10 hover:bg-accent/30 transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-primary"
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={columns.length} className="h-auto p-0 border-none">
                  <div className="flex items-center justify-center w-full py-12">
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="flex-1 text-xs text-muted-foreground font-medium">
          {formatSentenceCase(`Total: ${totalCount} registros`)}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Filas por página")}</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px] bg-card border-border/50 text-xs font-bold">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top" className="bg-card border-border/50">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={`${size}`} className="text-xs font-bold">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {formatSentenceCase(`Página ${pageIndex + 1} de ${pageCount}`)}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex border-border/50"
              onClick={() => onPageChange(0)}
              disabled={pageIndex === 0}
              aria-label="Ir a la primera página"
            >
              <span className="sr-only">Ir a la primera página</span>
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 border-border/50"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={pageIndex === 0}
              aria-label="Ir a la página anterior"
            >
              <span className="sr-only">Ir a la página anterior</span>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 border-border/50"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={pageIndex >= pageCount - 1}
              aria-label="Ir a la página siguiente"
            >
              <span className="sr-only">Ir a la página siguiente</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex border-border/50"
              onClick={() => onPageChange(pageCount - 1)}
              disabled={pageIndex >= pageCount - 1}
              aria-label="Ir a la última página"
            >
              <span className="sr-only">Ir a la última página</span>
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DataTable = React.memo(DataTableInner) as typeof DataTableInner;
