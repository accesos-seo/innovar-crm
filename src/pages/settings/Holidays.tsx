import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Calendar,
  Plus,
  Search,
  Trash2,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { DetailModal, InlineEditField } from "@/components/shared/DetailModal";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { FullscreenDetail } from "@/components/shared/FullscreenDetail";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";

import { CalendarPopover } from "@/components/ui/calendar-popover";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { formatDate, formatSentenceCase } from "@/lib/format-utils";
import { format, parseISO } from "date-fns";

const holidaySchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  date: z.string().min(10, "La fecha es obligatoria"),
  year: z.number().min(2020).max(2100),
});

type HolidayFormData = z.infer<typeof holidaySchema>;

import { useHolidays, Holiday } from "@/hooks/useHolidays";

const columns: ColumnDef<Holiday>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todos"
        className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
          className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "date",
    header: formatSentenceCase("Fecha"),
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center justify-center w-10 h-10 bg-primary/10 border border-primary/20 rounded-sm">
          <span className="text-[10px] font-bold text-primary">{row.original.date.split('-')[1]}</span>
          <span className="text-sm font-black text-primary">{row.original.date.split('-')[2]}</span>
        </div>
        <DateDisplay date={row.original.date} className="text-sm font-bold text-foreground" />
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: formatSentenceCase("Nombre del festivo"),
    cell: ({ row }) => <span className="text-sm font-medium text-foreground">{row.original.name}</span>,
  },
  {
    accessorKey: "year",
    header: formatSentenceCase("Año"),
    cell: ({ row }) => <Badge variant="outline" className="text-[10px] font-bold border-border/50">{row.original.year}</Badge>,
  },
];

export default function HolidaysSettingsPage() {
  const navigate = useNavigate();
  const { items: holidays, isLoading, isSaving, createItem, updateItem, deleteItem } = useHolidays();
  const [selectedHoliday, setSelectedHoliday] = React.useState<Holiday | null>(null);

  const handleUpdate = async (field: keyof Holiday, value: any) => {
    if (!selectedHoliday) return;
    try {
      await updateItem({ id: selectedHoliday.id, [field]: value });
      setSelectedHoliday(prev => prev ? { ...prev, [field]: value } : null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!selectedHoliday) return;
    try {
      await deleteItem(selectedHoliday.id);
      setSelectedHoliday(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const metrics: MetricData[] = [
    { title: "Festivos 2026", value: holidays.filter(h => h.year === 2026).length, description: "Calendario Colombia", icon: Calendar, trend: "neutral", color: "blue" },
    { title: "Próximo", value: formatDate(holidays.find(h => new Date(h.date) > new Date())?.date), description: "Día no laboral", icon: Clock, trend: "neutral", color: "purple" },
    { title: "Total Registrados", value: holidays.length, description: "Historial completo", icon: Info, trend: "neutral", color: "green" },
    { title: "Actualizado", value: "100%", description: "Sincronizado", icon: CheckCircle2, trend: "neutral", color: "yellow" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title={formatSentenceCase("Días festivos")}
        subtitle={formatSentenceCase("Calendario de días no laborales para el cálculo de tiempos de entrega.")}
        icon={Calendar}
        onBack={() => navigate("/settings")}
        action={{
          label: formatSentenceCase("Agregar festivo"),
          icon: Plus,
          onClick: () => navigate("/settings/holidays/new")
        }}
      />

      {isLoading ? (
        <div className="h-[60vh] w-full flex items-center justify-center">
          <PremiumLoader size="lg" text="Sincronizando Calendario Nacional" />
        </div>
      ) : (
        <>
          <MetricsGrid metrics={metrics} />

          <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar festivo por nombre o fecha..." 
                className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <FilterSheet
                title="Filtros de Calendario"
                description="Segmenta los festivos por año o tipo."
                onApply={() => toast.info("Filtros aplicados")}
                onClear={() => {}}
              >
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Por Año</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="text-[10px] font-bold uppercase h-10 rounded-none border-border/30">2026</Button>
                      <Button variant="outline" className="text-[10px] font-bold uppercase h-10 rounded-none border-border/30">2027</Button>
                    </div>
                  </div>
                </div>
              </FilterSheet>

            </div>
          </div>

          <DataTable
            columns={columns}
            data={holidays}
            isLoading={isLoading}
            totalCount={holidays.length}
            pageCount={1}
            pageIndex={0}
            pageSize={10}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            onRowClick={setSelectedHoliday}
            emptyMessage={
              <EmptyState 
                title="Sin festivos registrados"
                description="No se encontraron días festivos en el calendario."
                icon={Calendar}
                action={{
                  label: "Agregar festivo",
                  icon: Plus,
                  onClick: () => navigate("/settings/holidays/new")
                }}
              />
            }
          />
        </>
      )}

      <FullscreenDetail
        open={!!selectedHoliday}
        onOpenChange={(open) => !open && setSelectedHoliday(null)}
        title={selectedHoliday?.name || ""}
        subtitle={`CONFIGURACIÓN > DÍAS FESTIVOS > ${selectedHoliday?.name}`}
        icon={Calendar}
        status={{ 
          label: 'Día No Laboral', 
          variant: 'outline' 
        }}
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pb-8">
            <InlineEditField
              label="Nombre del Festivo"
              value={selectedHoliday?.name || ""}
              onSave={async (val) => handleUpdate('name', val)}
            />
            <InlineEditField
              label="Fecha Exacta"
              value={selectedHoliday?.date || ""}
              onSave={async (val) => handleUpdate('date', val)}
            />
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 pt-8">
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Año fiscal")}</p>
              <p className="text-lg font-black text-foreground">{selectedHoliday?.year}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Impacto en producción")}</p>
              <div className="flex items-center gap-2 mt-1">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-bold text-foreground">{formatSentenceCase("Afecta tiempos de entrega")}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-20 pt-10 border-t border-border/10">
          <div className="p-6 bg-destructive/5 border border-destructive/10 rounded-sm space-y-4">
            <h4 className="text-xs font-bold text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              {formatSentenceCase("Zona de peligro")}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {formatSentenceCase("Eliminar este festivo recalculará automáticamente las fechas de entrega de todos los proyectos activos que dependan de este calendario.")}
            </p>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="w-full font-bold text-[10px] h-12 rounded-none"
            >
              {formatSentenceCase("Confirmar eliminación permanente")}
            </Button>
          </div>
        </div>
      </FullscreenDetail>
    </motion.div>
  );
}
