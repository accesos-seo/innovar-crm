import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGoogleCallback } from '@/lib/auth';
import { notify } from '@/components/ui/PremiumToast';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Acceso denegado por Google. Intenta de nuevo.',
  server_error: 'Error en el servidor de Google. Intenta más tarde.',
  temporarily_unavailable: 'Servicio no disponible. Intenta más tarde.',
  invalid_scope: 'Permisos inválidos. Contacta con soporte.',
  unsupported_response_type: 'Configuración inválida. Contacta con soporte.',
  invalid_client: 'Aplicación no configurada correctamente. Contacta con soporte.',
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const processCallback = async () => {
      // Buscar error en query params
      const errorCode = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorCode) {
        const message = OAUTH_ERROR_MESSAGES[errorCode] || errorDescription || 'Error desconocido';
        notify.error('Error de Google OAuth', message);
        navigate('/login', { replace: true });
        return;
      }

      try {
        await handleGoogleCallback();
        navigate('/', { replace: true });
      } catch (err: any) {
        notify.error('Error', err.message || 'No se pudo completar el login con Google');
        navigate('/login', { replace: true });
      }
    };

    processCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-slate-300">Verificando tu sesión...</p>
      </div>
    </div>
  );
}
