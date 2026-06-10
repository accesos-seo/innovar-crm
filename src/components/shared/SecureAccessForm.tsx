import React, { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff, AlertCircle, Lock, ChevronRight, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { emailSchema, EmailInputField } from './EmailInputField';

interface SecureAccessFormProps {
  onSubmit: (data: any) => void;
  onGoogleLogin: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  isLoading: boolean;
  externalError?: string | null;
}

export const SecureAccessForm = ({ onSubmit, onGoogleLogin, onForgotPassword, isLoading, externalError }: SecureAccessFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const controls = useAnimation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const result = emailSchema.safeParse(formData.email);
    if (!result.success) { setLocalError(result.error.issues[0].message); return; }
    onSubmit(formData);
  };

  const handleGoogleClick = async () => {
    try {
      setGoogleLoading(true);
      setLocalError(null);
      await onGoogleLogin();
    } catch (err: any) {
      setLocalError(err.message || 'Error al autenticar con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const result = emailSchema.safeParse(forgotEmail);
    if (!result.success) { setLocalError(result.error.issues[0].message); return; }

    try {
      setForgotSubmitting(true);
      await onForgotPassword(forgotEmail);
      setForgotSuccess(true);
      setTimeout(() => {
        setIsForgotPassword(false);
        setForgotEmail('');
        setForgotSuccess(false);
      }, 3000);
    } catch (err: any) {
      setLocalError(err.message || 'Error al enviar el enlace');
    } finally {
      setForgotSubmitting(false);
    }
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
            {isForgotPassword ? 'Recuperar Acceso' : 'Acceso al Sistema'}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] w-8 bg-primary/30" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
              {isForgotPassword ? 'Restablece tu contraseña' : 'Terminal Operativa'}
            </span>
            <div className="h-[1px] w-8 bg-primary/30" />
          </div>
        </div>
      </div>

      <form className="p-10 pt-0 space-y-6 relative z-10" onSubmit={isForgotPassword ? handleForgotSubmit : handleSubmit}>
        {!isForgotPassword ? (
          <>
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

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={googleLoading}
              className={cn(
                "w-full h-12 relative overflow-hidden group/google transition-all duration-500",
                "bg-white/10 hover:bg-white/20 disabled:bg-muted text-foreground font-semibold text-xs uppercase tracking-[0.1em]",
                "border border-border/50 hover:border-primary/50 rounded-none shadow-lg active:scale-[0.98]"
              )}
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {googleLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Conectando...</span></>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Login con Google
                  </>
                )}
              </div>
            </button>

            <div className="flex items-center gap-2">
              <div className="h-[1px] flex-1 bg-border/20" />
              <span className="text-[10px] text-muted-foreground/60">O</span>
              <div className="h-[1px] flex-1 bg-border/20" />
            </div>

            <button
              type="button"
              onClick={() => setIsForgotPassword(true)}
              className="w-full text-center text-xs text-primary hover:text-primary/80 uppercase font-semibold tracking-wider transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        ) : (
          <>
            {forgotSuccess ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-green-900/10 border-l-2 border-green-600 rounded-none text-center"
              >
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider">
                  ✓ Email enviado. Revisa tu bandeja de entrada.
                </p>
              </motion.div>
            ) : (
              <>
                <EmailInputField
                  label="Tu Email"
                  placeholder="nombre@ejemplo.com"
                  value={forgotEmail}
                  onChange={(e) => { setForgotEmail(e.target.value); if (localError) setLocalError(null); }}
                  className="bg-background/50 border-border/50 rounded-none py-3.5 text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-medium"
                />

                {localError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-red-900/10 border-l-2 border-red-600 rounded-none"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider leading-tight">{localError}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className={cn(
                    "w-full h-14 relative overflow-hidden group/btn transition-all duration-500",
                    "bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.2em]",
                    "hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
                    "rounded-none shadow-xl active:scale-[0.98]"
                  )}
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {forgotSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span>Enviando...</span></>
                    ) : (
                      <>Enviar Enlace de Recuperación <ChevronRight size={16} /></>
                    )}
                  </div>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => { setIsForgotPassword(false); setForgotEmail(''); setLocalError(null); }}
              className="w-full flex items-center justify-center gap-2 text-center text-xs text-muted-foreground hover:text-foreground uppercase font-semibold tracking-wider transition-colors"
            >
              <ArrowLeft size={14} /> Volver al Login
            </button>
          </>
        )}
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
