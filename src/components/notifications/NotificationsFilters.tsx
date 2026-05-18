import React from 'react';
import { Button } from '@/components/ui/button';

interface NotificationsFiltersProps {
  filterType: string;
  setFilterType: (val: string) => void;
}

export function NotificationsFilters({ filterType, setFilterType }: NotificationsFiltersProps) {
  const filters = [
    { id: 'all', label: 'Todas' },
    { id: 'booking', label: 'Citas' },
    { id: 'project', label: 'Proyectos' },
    { id: 'system', label: 'Sistema' }
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 min-w-full">
      {filters.map((f) => (
        <Button
          key={f.id}
          variant={filterType === f.id ? 'default' : 'outline'}
          onClick={() => setFilterType(f.id)}
          className={`rounded-full px-6 transition-all ${
            filterType === f.id 
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
              : 'border-border/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
