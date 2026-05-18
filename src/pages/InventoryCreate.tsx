import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Package, Save, X, Zap, Barcode, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

export default function InventoryCreate() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = React.useState(false);
  const [item, setItem] = React.useState({
    name: "",
    category: "",
    brand: "",
    price: "",
    stock: ""
  });

  const handleSave = async () => {
    if (!item.name || !item.category) {
      toast.error("Datos incompletos", {
        description: "Nombre y categoría son obligatorios."
      });
      return;
    }

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Item registrado", {
        description: "El catálogo de hardware ha sido actualizado."
      });
      navigate("/inventory");
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
        title="NUEVO ITEM DE HARDWARE"
        subtitle="Registra un nuevo componente o herraje en el inventario."
        icon={Package}
        onBack={() => navigate("/inventory")}
      />

      <div className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-2xl shadow-primary/5">
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0"></div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre del Producto *</label>
              <Input 
                placeholder="Ej. Bisagra Blum 110° Recta" 
                value={item.name}
                onChange={(e) => setItem({...item, name: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Categoría *</label>
              <Input 
                placeholder="Ej. Bisagras" 
                value={item.category}
                onChange={(e) => setItem({...item, category: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Marca</label>
              <Input 
                placeholder="Ej. Blum" 
                value={item.brand}
                onChange={(e) => setItem({...item, brand: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Precio Unitario ($)</label>
              <Input 
                type="text"
                placeholder="0.00" 
                value={item.price}
                onChange={(e) => setItem({...item, price: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Stock Inicial</label>
              <Input 
                type="text"
                placeholder="0" 
                value={item.stock}
                onChange={(e) => setItem({...item, stock: e.target.value})}
                className="bg-background border-border/50 h-12 rounded-none focus-visible:ring-primary font-mono"
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-border/10 bg-muted/20 flex items-center justify-end gap-4">
          <Button 
            variant="ghost"
            onClick={() => navigate("/inventory")}
            className="font-bold uppercase text-xs tracking-widest h-12 px-8 rounded-none"
          >
            Cancelar
          </Button>
          <PrimaryButton 
            onClick={handleSave}
            disabled={isSaving}
            loading={isSaving}
            label="Guardar Item"
            icon={Zap}
            className="h-12 px-10 rounded-none"
          />
        </div>
      </div>
    </motion.div>
  );
}
