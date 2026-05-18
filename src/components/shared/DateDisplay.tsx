import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '@/lib/format-utils';

interface DateDisplayProps {
  date: any;
  showTime?: boolean;
  className?: string;
  iconClassName?: string;
}

/**
 * Standard component to display dates with the mandatory brand icon.
 * Follows the "Protocolo Global de Fechas" and design guidelines.
 */
export function DateDisplay({ 
  date, 
  showTime = false, 
  className,
  iconClassName 
}: DateDisplayProps) {
  const formattedDate = showTime ? formatDateTime(date) : formatDate(date);
  
  if (formattedDate === "—") {
    return <span className={cn("text-muted-foreground italic", className)}>—</span>;
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Calendar 
        className={cn("w-3.5 h-3.5 text-primary flex-shrink-0 opacity-80", iconClassName)} 
      />
      <span className="truncate">{formattedDate}</span>
    </div>
  );
}
