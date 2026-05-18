import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Server, 
  Key, 
  ShieldCheck, 
  Save,
  CheckCircle2,
  Clock,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/shared/PremiumLoader";

export default function NotificationsSettingsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleTestConnection = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Validando credenciales SMTP...",
        success: "Conexión exitosa con el servidor de correo.",
        error: "Error de autenticación SMTP.",
      }
    );
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Configurando Canales de Comunicación" />
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
        title="NOTIFICACIONES Y EMAIL"
        subtitle="Configuración de servidores SMTP, alertas push y canales de mensajería."
        icon={Bell}
        onBack={() => navigate("/settings")}
      />

      <Tabs defaultValue="smtp" className="w-full">
        <TabsList className="bg-muted/30 border border-border/10 p-1 rounded-none mb-8">
          <TabsTrigger value="smtp" className="data-[state=active]:bg-card data-[state=active]:text-primary rounded-none px-8 py-3 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Mail className="w-4 h-4" />
            Servidor SMTP
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-card data-[state=active]:text-primary rounded-none px-8 py-3 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Smartphone className="w-4 h-4" />
            Canales Activos
          </TabsTrigger>
          <TabsTrigger value="push" className="data-[state=active]:bg-card data-[state=active]:text-primary rounded-none px-8 py-3 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Activity className="w-4 h-4" />
            Suscripciones Push
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          <Card className="bg-card/30 border-border/10">
            <CardContent className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Servidor SMTP</label>
                  <Input defaultValue="smtp.gmail.com" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Puerto</label>
                  <Input defaultValue="587" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Usuario / Email</label>
                  <Input defaultValue="notificaciones@innovar.com" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña</label>
                  <Input type="password" value="••••••••••••" className="bg-background border-border/50 focus-visible:ring-primary rounded-none" />
                </div>
              </div>
              <div className="flex justify-between items-center pt-6 border-t border-border/5">
                <Button variant="outline" onClick={handleTestConnection} className="border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase text-[10px] tracking-widest h-12 gap-2">
                  <Server className="w-4 h-4" />
                  Probar Conexión
                </Button>
                <Button className="bg-primary text-primary-foreground font-bold uppercase text-xs tracking-widest px-12 h-12 rounded-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 gap-2">
                  <Save className="w-4 h-4" />
                  Guardar SMTP
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Notificaciones Email", icon: Mail, desc: "Alertas de sistema y reportes." },
              { label: "Notificaciones Push", icon: Bell, desc: "Alertas en tiempo real en navegador." },
              { label: "Notificaciones WhatsApp", icon: MessageSquare, desc: "Recordatorios de citas y pagos." },
            ].map((channel) => (
              <Card key={channel.label} className="bg-card/30 border-border/10">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <channel.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">{channel.label}</h3>
                    <p className="text-[10px] text-muted-foreground mt-1">{channel.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="push">
          <Card className="bg-card/30 border-border/10 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-8 border-b border-border/5">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Dispositivos Suscritos</h3>
                <p className="text-[10px] text-muted-foreground mt-1">Navegadores activos recibiendo alertas push.</p>
              </div>
              <div className="divide-y divide-border/5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-muted rounded-sm flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Chrome / Windows 11</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Activo desde: 10 Abr 2026</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase tracking-tighter">Activo</Badge>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">Desactivar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
