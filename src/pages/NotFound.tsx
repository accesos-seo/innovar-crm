import { useNavigate } from "react-router-dom";
import { Home, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Compass className="w-10 h-10 text-primary" />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Error 404
          </p>
          <h1 className="text-4xl font-black font-heading uppercase tracking-tight text-foreground">
            Ruta no encontrada
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La página que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/")} className="gap-2 rounded-sm">
            <Home className="w-4 h-4" />
            Volver al inicio
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} className="rounded-sm">
            Página anterior
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
