import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Client } from '@/types/database';
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ClientSearchSelectProps {
  value?: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export function ClientSearchSelect({ value, onChange, error }: ClientSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebounce(searchTerm, 300);
  const [clients, setClients] = useState<Partial<Client>[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedClientData, setSelectedClientData] = useState<Partial<Client> | null>(null);
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
        } else if (data) {
          setClients(data);
        }
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
                  clients.map((client) => (
                      <div 
                        key={client.id}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center py-3 px-3 text-sm outline-none hover:bg-accent/50 hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors border-b border-border/10 last:border-0",
                          value === client.id && "bg-primary/5 text-primary border-primary/20"
                        )}
                        onClick={() => {
                          onChange(client.id || '');
                          setOpen(false);
                          setSearchTerm(''); // Clear search on select so next open is fresh
                        }}
                      >
                        <div className="flex flex-col flex-1 pl-6">
                            <span className="font-bold text-foreground text-xs">{client.name}</span>
                            {(client.whatsapp_phone || client.address) && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">
                                {[client.whatsapp_phone, client.address].filter(Boolean).join(" • ")}
                            </span>
                            )}
                        </div>
                        {value === client.id && (
                          <Check className="absolute left-3 h-4 w-4 text-primary" />
                        )}
                      </div>
                  ))
              )}
          </div>
        </div>
      )}
    </div>
  );
}
