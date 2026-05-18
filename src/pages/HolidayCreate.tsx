import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Calendar, Save, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

export default function HolidayCreate() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);
  const [holiday, setHoliday] = React.useState({
    name: "",
    date: new Date(),
    year: new Date().getFullYear()
  });

  const handleSave = async () => {
    if (!holiday.name) {
      toast.error("Datos incompletos", {
        description: "El nombre del festivo es obligatorio."
      });
      return;
    }

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Festivo guardado", {
        description: "El calendario ha sido actualizado."
      });
      navigate("/settings/holidays");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title="NUEVO FESTIVO"
        subtitle="Agrega un día no laboral al calendario operativo."
        icon={Calendar}
        onBack={() => navigate("/settings/holidays")}
      />

      <div className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
        
        <div className="p-8 space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre del Festivo *</label>
              <Input 
                placeholder="Ej. Batalla de Boyacá" 
                value={holiday.name}
                onChange={(e) => setHoliday({...holiday, name: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fecha *</label>
                <CalendarPopover 
                  selected={holiday.date}
                  onSelect={(date) => date && setHoliday({...holiday, date, year: date.getFullYear()})}
                  className="w-full h-12 rounded-none border-border/50 bg-background"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Año</label>
                <Input 
                  type="number"
                  value={holiday.year}
                  disabled
                  className="bg-muted/50 border-border/50 h-12 rounded-none font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-border/10 bg-muted/20 flex items-center justify-end gap-4">
          <Button 
            variant="ghost"
            onClick={() => navigate("/settings/holidays")}
            className="font-bold uppercase text-xs tracking-widest h-12 px-8 rounded-none"
          >
            Cancelar
          </Button>
          <PrimaryButton 
            onClick={handleSave}
            disabled={isSaving}
            loading={isSaving}
            label="Guardar Festivo"
            icon={Zap}
            className="h-12 px-10 rounded-none"
          />
        </div>
      </div>
    </motion.div>
  );
}
