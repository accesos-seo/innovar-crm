import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Wallet, Save, X, Zap, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { formatSentenceCase, formatCurrency } from "@/lib/format-utils";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { parseISO } from "date-fns";

const MOVEMENT_TYPES = [
  { value: "income", label: "Ingreso / pago" },
  { value: "expense", label: "Egreso / gasto" }
];

export default function FinancialCreate() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);
  const [movement, setMovement] = React.useState({
    type: "income",
    description: "",
    amount: "",
    category: "",
    date: new Date().toISOString().split('T')[0]
  });

  const handleSave = async () => {
    if (!movement.description || !movement.amount) {
      toast.error("Datos incompletos", {
        description: "Descripción y monto son obligatorios."
      });
      return;
    }

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Movimiento registrado", {
        description: "El flujo de caja ha sido actualizado."
      });
      navigate("/financials");
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
      className="max-w-3xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title={formatSentenceCase("Nuevo movimiento financiero")}
        subtitle={formatSentenceCase("Registra un ingreso o egreso en el sistema contable.")}
        icon={Wallet}
        onBack={() => navigate("/financials")}
      />

      <div className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
        <div className={cn(
          "h-1 w-full transition-colors duration-500",
          movement.type === "income" ? "bg-primary" : "bg-destructive"
        )}></div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Tipo de movimiento")} *</label>
              <Select value={movement.type} onValueChange={(v) => setMovement({...movement, type: v})}>
                <SelectTrigger className="h-12 rounded-none border-border/50 bg-background font-bold text-xs">
                  <SelectValue placeholder={formatSentenceCase("Seleccionar...")}>
                    {movement.type ? formatSentenceCase(MOVEMENT_TYPES.find(t => t.value === movement.type)?.label || movement.type) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income" className="flex items-center gap-2">
                    <span className="flex items-center gap-2 text-primary font-bold">
                      <TrendingUp className="w-4 h-4" />
                      {formatSentenceCase("Ingreso / pago")}
                    </span>
                  </SelectItem>
                  <SelectItem value="expense">
                    <span className="flex items-center gap-2 text-destructive font-bold">
                      <TrendingDown className="w-4 h-4" />
                      {formatSentenceCase("Egreso / gasto")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Monto ($)")} *</label>
              <Input 
                type="text"
                placeholder="0.00" 
                value={movement.amount}
                onChange={(e) => setMovement({...movement, amount: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-mono font-bold text-lg"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Descripción / concepto")} *</label>
              <Input 
                placeholder={formatSentenceCase("Ej. Pago inicial Proyecto Villa Skyline")} 
                value={movement.description}
                onChange={(e) => setMovement({...movement, description: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Categoría")}</label>
              <Input 
                placeholder={formatSentenceCase("Ej. Materiales, Mano de Obra, Venta")} 
                value={movement.category}
                onChange={(e) => setMovement({...movement, category: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">{formatSentenceCase("Fecha")}</label>
              <CalendarPopover
                selected={movement.date ? parseISO(movement.date) : undefined}
                onSelect={(date) => setMovement({...movement, date: date ? date.toISOString().split('T')[0] : ""})}
                className="w-full h-12 rounded-none"
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-border/10 bg-muted/20 flex items-center justify-end gap-4">
          <Button 
            variant="ghost"
            onClick={() => navigate("/financials")}
            className="font-bold text-xs h-12 px-8 rounded-none"
          >
            {formatSentenceCase("Cancelar")}
          </Button>
          <PrimaryButton 
            onClick={handleSave}
            disabled={isSaving}
            loading={isSaving}
            label="Registrar movimiento"
            icon={Zap}
            className={cn(
              "h-12 px-10 rounded-none",
              movement.type === "expense" && "from-destructive to-red-600 hover:from-red-600 hover:to-destructive shadow-destructive/20"
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}
