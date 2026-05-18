import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AvailableSlot } from "@/hooks/agenda/useAvailableSlots";

interface SlotPickerProps {
  slots: AvailableSlot[];
  selectedSlotId?: string;
  onSelectSlot: (slotId: string, slotDate: string, startTime: string) => void;
  isLoading?: boolean;
}

export function SlotPicker({ slots, selectedSlotId, onSelectSlot, isLoading }: SlotPickerProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-md border border-border/50" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-4 border border-dashed border-border/50 rounded-md text-center text-sm text-muted-foreground bg-muted/20">
        No hay horarios disponibles para esta fecha. Intenta con otro día (recuerda que habilitamos Martes y Jueves).
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((slot) => {
        const isSelected = selectedSlotId === slot.slot_id;
        
        // Parse time to friendly format
        const [h, m] = slot.start_time.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(h, m, 0, 0);
        const displayTime = format(dateObj, "h:mm a");

        return (
          <Button
            key={slot.slot_id}
            type="button"
            variant={isSelected ? "default" : "outline"}
            onClick={() => onSelectSlot(slot.slot_id, slot.slot_date, slot.start_time)}
            className={`
              h-12 rounded-none font-bold text-xs uppercase tracking-widest border-border/50 hover:bg-accent/50 
              ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary border-primary shadow-sm' : 'bg-muted/30 text-foreground'}
            `}
          >
            {displayTime}
          </Button>
        );
      })}
    </div>
  );
}
