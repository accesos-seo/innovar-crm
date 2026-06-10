import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/passwordUtils';
import { notify } from '@/components/ui/PremiumToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Status = 'form' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('form');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        setStatus('invalid');
      }
    };
    checkSession();
  }, [searchParams]);

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        navigate('/login', { replace: true });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validar contraseña
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres');
        setIsSubmitting(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        setIsSubmitting(false);
        return;
      }

      // Verificar sesión
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        setStatus('invalid');
        setIsSubmitting(false);
        return;
      }

      // Actualizar en auth.users
      const { error: updateAuthError } = await supabase.auth.updateUser({ password });
      if (updateAuthError) throw updateAuthError;

      // Hashear y actualizar en public.users
      const bcryptHash = await hashPassword(password);
      const { error: rpcError } = await supabase.rpc('update_my_password_hash', {
        new_hash: bcryptHash,
      });
      if (rpcError) throw rpcError;

      setStatus('success');
      notify.success('Contraseña actualizada', 'Tu contraseña ha sido restablecida correctamente.');
    } catch (err: any) {
      setError(err.message || 'Error al restablecer la contraseña');
      notify.error('Error', err.message || 'No se pudo restablecer la contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        {status === 'invalid' && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-6 text-center">
            <h1 className="text-xl font-bold text-white mb-2">Enlace expirado</h1>
            <p className="text-red-100 mb-6">
              Este enlace de recuperación es inválido o ha expirado.
            </p>
            <Button
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Volver al login
            </Button>
          </div>
        )}

        {status === 'form' && (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-lg p-8">
            <h1 className="text-2xl font-bold text-white mb-6">Restablecer contraseña</h1>

            {error && (
              <div className="bg-red-950 border border-red-700 rounded p-3 mb-4 text-red-100">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Nueva contraseña
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Confirmar contraseña
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                disabled={isSubmitting}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12"
            >
              {isSubmitting ? 'Procesando...' : 'Restablecer contraseña'}
            </Button>
          </form>
        )}

        {status === 'success' && (
          <div className="bg-green-950 border border-green-700 rounded-lg p-6 text-center">
            <h1 className="text-xl font-bold text-white mb-2">¡Éxito!</h1>
            <p className="text-green-100 mb-4">
              Tu contraseña ha sido restablecida. Serás redirigido al login en 4 segundos...
            </p>
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="w-full"
            >
              Ir al login ahora
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
