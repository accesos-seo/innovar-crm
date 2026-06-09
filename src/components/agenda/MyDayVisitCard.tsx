import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Phone, User, AlertTriangle } from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import type { MyVisitToday } from '@/hooks/agenda/useMyVisitsToday';

interface MyDayVisitCardProps {
  visit: MyVisitToday;
  onOpenForm: (visit: MyVisitToday) => void;
}

const SERVICE_LABEL: Record<string, string> = {
  cocina_integral: 'Cocina',
  mesones: 'Mesones',
  closets: 'Closets',
  tv_center: 'TV center',
  puertas: 'Puertas',
  acabados: 'Acabados',
};

export function MyDayVisitCard({ visit, onOpenForm }: MyDayVisitCardProps) {
  const dt = parseISO(visit.scheduled_at);
  const isLate = isPast(dt) && visit.status !== 'realizada';
  const client = visit.client;

  return (
    <Card className="p-4 space-y-3 border-border/50 hover:border-primary/40 transition">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isLate ? 'text-orange-500' : 'text-primary'}`} />
            <span className="text-sm font-semibold text-foreground">
              {format(dt, "h:mm a", { locale: es })}
            </span>
            {isLate && (
              <Badge variant="outline" className="border-orange-500 text-orange-500 text-[10px]">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Atrasada
              </Badge>
            )}
          </div>
          <p className="text-base font-bold text-foreground">{client?.name ?? 'Cliente'}</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {visit.status}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {client?.address && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="break-words">{client.address}</span>
          </div>
        )}
        {client?.whatsapp_phone && (
          <a
            href={`tel:${client.whatsapp_phone}`}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Phone className="w-3.5 h-3.5" />
            {client.whatsapp_phone}
          </a>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="w-3.5 h-3.5" />
          {visit.scheduled_via === 'public_link' ? 'Agendada por el cliente' : 'Agendada por admin'}
        </div>
      </div>

      {visit.opportunity?.services?.length ? (
        <div className="flex flex-wrap gap-1">
          {visit.opportunity.services.map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px]">
              {SERVICE_LABEL[s] ?? s}
            </Badge>
          ))}
        </div>
      ) : null}

      <Button
        className="w-full"
        onClick={() => onOpenForm(visit)}
        disabled={visit.status === 'realizada'}
      >
        {visit.status === 'realizada' ? 'Visita finalizada' : 'Abrir formulario'}
      </Button>
    </Card>
  );
}
