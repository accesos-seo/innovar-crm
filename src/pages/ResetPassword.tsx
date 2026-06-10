import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { Eye, EyeOff, Lock, ShieldCheck, ChevronRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/passwordUtils';
import { notify } from '@/components/ui/PremiumToast';

type Status = 'checking' | 'form' | 'success' | 'invalid';

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-400', 'bg-primary'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i <= score ? colors[score] : 'bg-border/30'
            )}
          />
        ))}
      </div>
      <p className={cn('text-[9px] font-bold uppercase tracking-widest', score <= 1 ? 'text-red-400' : score === 2 ? 'text-yellow-400' : score === 3 ? 'text-blue-400' : 'text-primary')}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const controls = useAnimation();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);

  // Detectar sesión de recovery desde el hash del URL
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setStatus('form');
      }
    });

    // Fallback: si en 2s no llega el evento, verificar sesión manualmente
    const fallback = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setStatus('form');
      } else {
        setStatus('invalid');
      }
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  // Countdown en success
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) { navigate('/login', { replace: true }); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, navigate]);

  // Shake animation en error
  useEffect(() => {
    if (error) {
      controls.start({ x: [0, -10, 10, -10, 10, 0], transition: { duration: 0.4 } });
    }
  }, [error, controls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      // Actualizar hash en public.users (no crítico si falla — auth.users ya está actualizado)
      try {
        const bcryptHash = await hashPassword(password);
        await supabase.rpc('update_my_password_hash', { new_hash: bcryptHash });
      } catch (hashErr) {
        console.error('[ResetPassword] bcrypt sync failed (non-blocking):', hashErr);
      }

      setStatus('success');
      notify.success('Contraseña actualizada', 'Ya podés ingresar con tu nueva contraseña.');
    } catch (err: any) {
      const rawMsg: string = err?.message ?? '';
      const msg = rawMsg.includes('expired') || rawMsg.includes('invalid')
        ? 'El enlace expiró o ya fue usado. Solicitá uno nuevo.'
        : rawMsg || 'No se pudo actualizar la contraseña';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4">
      <motion.div
        animate={controls}
        className="w-full max-w-md bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]"
      >
        {/* Barra superior */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

        {/* Header */}
        <div className="p-10 pb-6 flex flex-col items-center space-y-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src="https://stjugsrkrweakvzmizpq.supabase.co/storage/v1/object/public/Logos%20Marcas/finallogo-fondo%20(1).png"
              alt="Innovar Logo"
              className="h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(68,221,193,0.3)]"
            />
          </motion.div>

          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground font-sans">
              {status === 'success' ? 'Contraseña Actualizada' : 'Nueva Contraseña'}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <div className="h-[1px] w-8 bg-primary/30" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
                {status === 'success' ? 'Acceso restaurado' : 'Restablece tu acceso'}
              </span>
              <div className="h-[1px] w-8 bg-primary/30" />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-10 pt-0">

          {/* --- CHECKING --- */}
          {status === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Verificando enlace...
              </p>
            </div>
          )}

          {/* --- INVALID --- */}
          {status === 'invalid' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-red-900/10 border-l-2 border-red-600">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Enlace inválido o expirado</p>
                  <p className="text-[10px] text-red-400/80 mt-1">Los enlaces de recuperación son válidos por 1 hora y solo pueden usarse una vez.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full h-14 bg-foreground text-background font-black text-xs uppercase tracking-[0.2em] rounded-none hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              >
                Solicitar nuevo enlace
              </button>
            </motion.div>
          )}

          {/* --- FORM --- */}
          {status === 'form' && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Nueva contraseña */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1 flex items-center gap-2">
                  <Lock className="w-3 h-3 text-primary" /> Nueva contraseña
                </label>
                <div className="relative group/input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="Mínimo 8 caracteres"
                    disabled={isSubmitting}
                    className="w-full bg-background/50 border border-border/50 rounded-none py-3.5 px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-medium"
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
                <StrengthBar password={password} />
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1 flex items-center gap-2">
                  <Lock className="w-3 h-3 text-primary" /> Confirmar contraseña
                </label>
                <div className="relative group/input">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                    placeholder="Repetí tu nueva contraseña"
                    disabled={isSubmitting}
                    className={cn(
                      'w-full bg-background/50 border rounded-none py-3.5 px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-300 font-medium',
                      confirmPassword && password !== confirmPassword
                        ? 'border-red-500/70 focus:border-red-500'
                        : confirmPassword && password === confirmPassword
                        ? 'border-primary/70 focus:border-primary'
                        : 'border-border/50 focus:border-primary'
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {confirmPassword && password === confirmPassword && (
                    <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  )}
                  <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary group-focus-within/input:w-full transition-all duration-500" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 bg-red-900/10 border-l-2 border-red-600"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider leading-tight">{error}</p>
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !password || !confirmPassword}
                className={cn(
                  'w-full h-14 relative overflow-hidden group/btn transition-all duration-500',
                  'bg-foreground text-background font-black text-xs uppercase tracking-[0.2em]',
                  'hover:bg-primary hover:text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed',
                  'rounded-none shadow-xl active:scale-[0.98]'
                )}
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Actualizando...</span></>
                  ) : (
                    <>Establecer nueva contraseña <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" /></>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
              </button>
            </motion.form>
          )}

          {/* --- SUCCESS --- */}
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center gap-4 py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-foreground font-semibold">Tu contraseña fue actualizada</p>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                    Redirigiendo al login en {countdown}s...
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-[2px] bg-border/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 4, ease: 'linear' }}
                />
              </div>

              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full h-14 bg-foreground text-background font-black text-xs uppercase tracking-[0.2em] rounded-none hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-xl"
              >
                Ingresar ahora
              </button>
            </motion.div>
          )}
        </div>

        {/* Footer */}
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
    </div>
  );
}
