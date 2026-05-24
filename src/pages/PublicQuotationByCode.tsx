import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import NotFoundPage from '@/pages/NotFound';

/**
 * Ruta `/c/:code` — resuelve un short_code (6 chars base62) al public_token
 * largo de la cotización y redirige a `/cotizacion/<token>`.
 *
 * Esto permite compartir URLs cortas tipo `crm.innovar.co/c/A3X9Q2` en vez
 * de la URL larga con el token hex de 32 chars.
 */
export default function PublicQuotationByCode() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (!FEATURES.phase4QuotationPublicEnabled) {
    return <NotFoundPage />;
  }

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!code) {
        setError('Falta el código en el link.');
        return;
      }
      try {
        assertSupabase(supabase);
        const { data, error } = await supabase.rpc('resolve_quotation_short_code', {
          p_code: code,
        });
        if (error) throw mapSupabaseError(error);
        const token = data as string | null;
        if (!token) {
          if (!cancelled) setError('Este código no corresponde a ninguna propuesta vigente.');
          return;
        }
        if (!cancelled) navigate(`/cotizacion/${token}`, { replace: true });
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'No pudimos resolver el código.',
          );
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
      <div className="h-[2px] w-full fixed top-0 left-0 bg-gradient-to-r from-transparent via-primary to-transparent" />
      {error ? (
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="font-heading text-2xl font-black text-foreground">
            Propuesta no encontrada
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <>
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
            Abriendo propuesta...
          </span>
        </>
      )}
    </div>
  );
}
