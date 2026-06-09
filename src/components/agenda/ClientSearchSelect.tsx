import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { Client } from '@/types/database';
import { Search, ChevronDown, Check, Loader2, X, CalendarClock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ClientSearchSelectProps {
  value?: string;
  onChange: (value: string) => void;
  error?: boolean;
}

interface PendingApptInfo {
  due_date: string;
  time_slot: string | null;
}

export function ClientSearchSelect({ value, onChange, error }: ClientSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [clients, setClients] = useState<Partial<Client>[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedClientData, setSelectedClientData] = useState<Partial<Client> | null>(null);
  // Mapa client_id → info de su cita pendiente más próxima (si existe).
  // Restaura la indicación naranja que existía antes para que el usuario vea
  // de un vistazo quién ya tiene cita y no agendar dos veces a la misma persona.
  const [pendingAppts, setPendingAppts] = useState<Record<string, PendingApptInfo>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("clients")
          .select("id, name, whatsapp_phone, address, urgency")
          .is("deleted_at", null)
          .limit(10);

        if (debouncedSearch) {
          query = query.ilike("name", `%${debouncedSearch}%`);
        }

        const { data, err } = await query;
        if (err) {
          console.error("Error fetching clients for select:", err);
          return;
        }
        if (!data) return;

        setClients(data);

        // Segunda query: para los clients devueltos, buscar quién ya tiene
        // cita pendiente (no cancelada/completada, due_date >= hoy).
        const clientIds = data.map((c: Partial<Client>) => c.id).filter(Boolean) as string[];
        if (clientIds.length === 0) {
          setPendingAppts({});
          return;
        }
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const { data: appts, error: apptsErr } = await supabase
          .from('tasks')
          .select('client_id, due_date, time_slot')
          .in('client_id', clientIds)
          .not('appointment_type', 'is', null)
          .not('status', 'in', '(cancelado,completado)')
          .gte('due_date', todayStr)
          .order('due_date', { ascending: true });
        if (apptsErr) {
          console.warn('Error fetching pending appts for clients:', apptsErr);
          return;
        }
        const map: Record<string, PendingApptInfo> = {};
        (appts || []).forEach((a: { client_id: string; due_date: string; time_slot: string | null }) => {
          // Sólo guardamos la PRIMERA (más próxima) por client_id porque el order
          // es ASC y el dropdown solo necesita "tiene cita pendiente" + cuál.
          if (a.client_id && !map[a.client_id]) {
            map[a.client_id] = { due_date: a.due_date, time_slot: a.time_slot };
          }
        });
        setPendingAppts(map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchClients();
    }
  }, [debouncedSearch, open]);

  useEffect(() => {
    if (value && !clients.some(c => c.id === value)) {
      supabase.from('clients').select('id, name, whatsapp_phone, address, urgency').eq('id', value).single()
        .then(({ data }) => {
          if (data) setSelectedClientData(data);
        });
    } else if (!value) {
      setSelectedClientData(null);
    }
  }, [value, clients]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const activeClient = clients.find(c => c.id === value) || selectedClientData;

  return (
    <div className="relative w-full" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          // h-12 para matchear todos los dropdowns del modal Agendar Cita
          // (Comercial, Tipo de cita, Fecha). La h-14 anterior se veía muy
          // alta vs los Selects de shadcn que tienen data-[size=default]:h-8
          // ganando sobre cualquier h-14 inline. Estandarizamos en h-12.
          "w-full justify-between bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold hover:bg-background/90",
          error && "border-destructive",
          !activeClient && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {activeClient ? activeClient.name : "Seleccionar o buscar cliente..."}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div className="absolute z-[999] top-full left-0 w-full mt-1 bg-card border border-border/50 shadow-xl rounded-sm overflow-hidden flex flex-col max-h-[350px]">
          <div className="flex items-center px-3 py-2 border-b border-border/50 bg-muted/20 shrink-0">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre..." 
              className="border-0 focus-visible:ring-0 px-0 bg-transparent h-8 shadow-none" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-muted rounded-full ml-1">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 py-2">
              {loading ? (
                  <div className="px-2 py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Buscando...</span>
                  </div>
              ) : clients.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    No se encontraron clientes
                  </div>
              ) : (
                  clients.map((client) => {
                      const pendingAppt = client.id ? pendingAppts[client.id] : undefined;
                      const isBlocked = !!pendingAppt;
                      // Formato corto para el tooltip/línea de info: "Mar 26 May · 14:00"
                      const apptLabel = pendingAppt
                        ? (() => {
                            try {
                              const [yy, mm, dd] = pendingAppt.due_date.split('-').map(Number);
                              const dt = new Date(yy, mm - 1, dd);
                              const dayMonth = format(dt, "EEE d MMM");
                              const time = pendingAppt.time_slot ? ` · ${pendingAppt.time_slot.slice(0, 5)}` : '';
                              return `Cita ya agendada · ${dayMonth}${time}`;
                            } catch {
                              return 'Cita ya agendada';
                            }
                          })()
                        : '';

                      return (
                        <div
                          key={client.id}
                          aria-disabled={isBlocked}
                          title={isBlocked ? apptLabel : undefined}
                          className={cn(
                            "relative flex select-none items-center py-3 px-3 text-sm outline-none transition-colors border-b border-border/10 last:border-0",
                            !isBlocked && "cursor-pointer hover:bg-accent/50 hover:text-accent-foreground",
                            isBlocked && "cursor-not-allowed opacity-60 bg-orange-500/5",
                            value === client.id && !isBlocked && "bg-primary/5 text-primary border-primary/20"
                          )}
                          onClick={() => {
                            // Bloqueamos selección de clientes con cita pendiente
                            // para evitar doble agendamiento. Si quieren reagendar,
                            // primero deben cancelar la cita activa.
                            if (isBlocked) return;
                            onChange(client.id || '');
                            setOpen(false);
                            setSearchTerm('');
                          }}
                        >
                          <div className="flex flex-col flex-1 pl-6">
                              <span className={cn(
                                "font-bold text-xs",
                                isBlocked ? "text-foreground/70" : "text-foreground"
                              )}>
                                {client.name}
                              </span>
                              {isBlocked ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-500 mt-0.5">
                                  <CalendarClock className="w-3 h-3 shrink-0" />
                                  {apptLabel}
                                </span>
                              ) : (
                                (client.whatsapp_phone || client.address) && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">
                                      {[client.whatsapp_phone, client.address].filter(Boolean).join(" • ")}
                                  </span>
                                )
                              )}
                          </div>
                          {value === client.id && !isBlocked && (
                            <Check className="absolute left-3 h-4 w-4 text-primary" />
                          )}
                        </div>
                      );
                  })
              )}
          </div>
        </div>
      )}
    </div>
  );
}
