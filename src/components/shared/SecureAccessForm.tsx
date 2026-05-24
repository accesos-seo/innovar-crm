import React, { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, AlertCircle, User, Lock, ChevronRight, ShieldCheck, Mail } from 'lucide-react';
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { emailSchema, EmailInputField } from './EmailInputField';

interface SecureAccessFormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
  externalError?: string | null;
}

export const SecureAccessForm = ({ onSubmit, isLoading, externalError }: SecureAccessFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState<string | null>(null);
  const controls = useAnimation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const result = emailSchema.safeParse(formData.email);
    if (!result.success) { setLocalError(result.error.issues[0].message); return; }
    onSubmit(formData);
  };

  useEffect(() => {
    if (externalError || localError) {
      controls.start({ x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4, ease: "easeInOut" } });
    }
  }, [externalError, localError, controls]);

  return (
    <motion.div
      animate={controls}
      className="w-full max-w-md bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)] relative group"
    >
      <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

      <div className="p-10 pb-6 flex flex-col items-center space-y-6 relative z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <img
            src="https://stjugsrkrweakvzmizpq.supabase.co/storage/v1/object/public/Logos%20Marcas/finallogo-fondo%20(1).png"
            alt="Innovar Logo"
            className="h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(68,221,193,0.3)]"
          />
        </motion.div>

        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground font-sans">
            Acceso al Sistema
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] w-8 bg-primary/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">Terminal Operativa</span>
            <div className="h-[1px] w-8 bg-primary/30" />
          </div>
        </div>
      </div>

      <form className="p-10 pt-0 space-y-6 relative z-10" onSubmit={handleSubmit}>
        <EmailInputField
          label="Identificación"
          placeholder="nombre@ejemplo.com"
          value={formData.email}
          onChange={(e) => { setFormData({...formData, email: e.target.value}); if (localError) setLocalError(null); }}
          error={localError || undefined}
          className="bg-background/50 border-border/50 rounded-none py-3.5 text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-medium"
        />

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1 flex items-center gap-2">
            <Lock className="w-3 h-3 text-primary" /> Contraseña
          </label>
          <div className="relative group/input">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full bg-background/50 border border-border/50 rounded-none py-3.5 px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-medium"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500" />
          </div>
        </div>

        {(externalError || localError) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 bg-red-900/10 border-l-2 border-red-600 rounded-none"
          >
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider leading-tight">{externalError || localError}</p>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full h-14 relative overflow-hidden group/btn transition-all duration-500",
            "bg-foreground text-background font-black text-xs uppercase tracking-[0.2em]",
            "hover:bg-primary hover:text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
            "rounded-none shadow-xl active:scale-[0.98]"
          )}
        >
          <div className="relative z-10 flex items-center justify-center gap-3">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Autenticando...</span></>
            ) : (
              <>Ingresar al Sistema <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" /></>
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
        </button>
      </form>

      <div className="px-10 py-6 bg-muted/30 border-t border-border/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-primary/60" />
          <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest">AES-256 Encrypted</span>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 bg-primary/20 rounded-full" />
          <div className="w-1 h-1 bg-primary/40 rounded-full" />
          <div className="w-1 h-1 bg-primary/60 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
};
