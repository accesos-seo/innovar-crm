import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Sliders, 
  Save, 
  ShieldCheck, 
  Wallet, 
  Percent, 
  AlertTriangle, 
  Info,
  Database,
  Globe,
  Mail,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/shared/PremiumLoader";

export default function ParametersSettingsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
    toast.success("Parámetros actualizados correctamente.");
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Cargando Configuración de Sistema" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-12 pb-20"
    >
      <CategoryHeader 
        title="PARÁMETROS Y FINANZAS"
        subtitle="Configuración global del sistema y umbrales de control financiero."
        icon={Sliders}
        onBack={() => navigate("/settings")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sistema */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Identidad del Sistema</h2>
          </div>
          
          <Card className="bg-card/30 border-border/10">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nombre de la Plataforma</label>
                <Input defaultValue="INNOVAR Admin" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email de Soporte</label>
                <Input defaultValue="soporte@innovar.com" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/5 rounded-sm">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-foreground">Modo Mantenimiento</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Desactiva el acceso público</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Finanzas */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Umbrales Financieros</h2>
          </div>

          <Card className="bg-card/30 border-border/10">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-primary" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Umbral de Pendiente</label>
                  </div>
                  <span className="text-xs font-bold text-primary">40%</span>
                </div>
                <Input type="number" defaultValue="40" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
                <p className="text-[10px] text-muted-foreground italic">Alerta cuando el saldo pendiente supera este porcentaje del contrato.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Umbral de Cobranza</label>
                  </div>
                  <span className="text-xs font-bold text-emerald-500">70%</span>
                </div>
                <Input type="number" defaultValue="70" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Umbral Bajo Margen</label>
                  </div>
                  <span className="text-xs font-bold text-destructive">10%</span>
                </div>
                <Input type="number" defaultValue="10" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-8 border-t border-border/10">
        <Button 
          onClick={handleSave}
          className="bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest px-12 py-6 rounded-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 gap-2"
        >
          <Save className="w-4 h-4" />
          Guardar Cambios
        </Button>
      </div>
    </motion.div>
  );
}
