import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SecureAccessForm } from '@/components/shared/SecureAccessForm';
import { useAuthStore } from '@/store/authStore';
import { loginWithGoogle } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { notify } from '@/components/ui/PremiumToast';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = (location.state as any)?.from || '/';

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const handleLogin = async (formData: any) => {
    try {
      setError(null);
      await login(formData.email, formData.password);
      notify.success('Acceso concedido', 'Bienvenido al sistema.');
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      const errorMessage = err.message === 'Invalid login credentials'
        ? 'Credenciales inválidas'
        : 'Error al intentar acceder';
      setError(errorMessage);
      notify.error(errorMessage);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Error al conectar con Google');
      notify.error('Error', err.message || 'No se pudo conectar con Google');
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('request-password-reset', {
        body: { email },
      });
      // No confiar solo en `error`: invoke() no siempre propaga un 500 con cuerpo JSON.
      // La EF responde { sent: true } en éxito; cualquier otra cosa = fallo de envío.
      if (error || !data?.sent) {
        let detail = 'No se pudo enviar el email. Intenta de nuevo en unos minutos.';
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* cuerpo no legible */ }
        throw new Error(detail);
      }
      notify.success('Email enviado', 'Revisa tu bandeja de entrada para restablecer tu contraseña.');
    } catch (err: any) {
      throw new Error(err.message || 'No se pudo enviar el email');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full flex justify-center animate-in fade-in zoom-in duration-500">
        <SecureAccessForm
          onSubmit={handleLogin}
          onGoogleLogin={handleGoogleLogin}
          onForgotPassword={handleForgotPassword}
          isLoading={isLoading}
          externalError={error}
        />
      </div>
    </div>
  );
}
