import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useMyVisitsToday, type MyVisitToday } from '@/hooks/agenda/useMyVisitsToday';
import { useFinishVisit } from '@/hooks/agenda/useFinishVisit';
import { MyDayVisitCard } from '@/components/agenda/MyDayVisitCard';
import { VisitMeasurementsForm } from '@/components/agenda/VisitMeasurementsForm';
import { Calendar, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';

export default function MyDay() {
  const { data: visits = [], isLoading, isError, error } = useMyVisitsToday();
  const finishMutation = useFinishVisit();
  const [openVisit, setOpenVisit] = useState<MyVisitToday | null>(null);

  const summary = useMemo(() => {
    const total = visits.length;
    const pendientes = visits.filter((v) => v.status !== 'realizada').length;
    const completas = visits.filter((v) => v.status === 'realizada').length;
    const next = visits.find((v) => v.status !== 'realizada');
    return { total, pendientes, completas, next };
  }, [visits]);

  const todayLabel = format(new Date(), "eeee d 'de' MMMM", { locale: es });

  const handleFinish = (input: {
    measurements: any;
    photoPaths: string[];
    notes: string;
  }) => {
    if (!openVisit) return;
    finishMutation.mutate(
      {
        visitId: openVisit.id,
        measurements: input.measurements,
        photoPaths: input.photoPaths,
        notes: input.notes,
      },
      {
        onSuccess: () => setOpenVisit(null),
      }
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
          Mi día
        </p>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground capitalize">
          {todayLabel}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tus visitas técnicas asignadas para hoy.
        </p>
      </header>

      {/* Métricas top */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="Pendientes" value={summary.pendientes} Icon={ClipboardList} />
        <MetricCard
          label="Próxima"
          value={summary.next ? format(parseISO(summary.next.scheduled_at), 'HH:mm') : '—'}
          Icon={Calendar}
        />
        <MetricCard
          label="Completadas"
          value={summary.completas}
          Icon={CheckCircle2}
          tone="primary"
        />
      </div>

      {/* Lista */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">
            No se pudieron cargar las visitas: {(error as Error)?.message ?? 'error'}
          </p>
        </Card>
      )}

      {!isLoading && !isError && visits.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <p className="text-base font-medium text-foreground">Sin visitas hoy</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cuando un cliente confirme una visita en tu agenda, aparecerá acá.
          </p>
        </Card>
      )}

      {visits.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {visits.map((v) => (
            <MyDayVisitCard key={v.id} visit={v} onOpenForm={setOpenVisit} />
          ))}
        </div>
      )}

      <Dialog open={!!openVisit} onOpenChange={(o) => !o && setOpenVisit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openVisit ? `Visita — ${openVisit.client?.name ?? 'Cliente'}` : 'Visita'}
            </DialogTitle>
          </DialogHeader>
          {openVisit && (
            <VisitMeasurementsForm
              visitId={openVisit.id}
              initialPhotos={openVisit.photos ?? []}
              initialNotes={openVisit.notes ?? ''}
              onSubmit={handleFinish}
              isSubmitting={finishMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  label,
  value,
  Icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  Icon: typeof Calendar;
  tone?: 'default' | 'primary';
}) {
  return (
    <Card className="p-3 sm:p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`text-2xl font-bold ${
          tone === 'primary' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
