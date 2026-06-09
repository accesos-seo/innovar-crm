import { useState } from 'react';
import { Share2, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  /** Si está disponible, generamos una URL corta `/c/<short_code>` en vez de la larga */
  shortCode?: string | null;
}

/**
 * Botón "Compartir" para que el cliente reenvíe el link a un familiar/pareja.
 * Usa Web Share API (mobile nativo) con fallback a portapapeles.
 *
 * Copy intencionalmente neutral (sin nombre del cliente) — el destinatario
 * recibe un link impersonal tipo "te comparto la propuesta de Innovar".
 */
export function ShareQuotationButton({ shortCode }: Props) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    // Si hay short_code, construimos la URL corta /c/<code>; si no, usamos la actual.
    const shortUrl =
      shortCode && typeof window !== 'undefined'
        ? `${window.location.origin}/c/${shortCode}`
        : null;
    const url = shortUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
    if (!url) return;

    const title = 'Innovar Cocinas de Diseño';
    const text = 'Te comparto la propuesta que me prepararon en Innovar Cocinas:';

    setLoading(true);

    // Web Share API nativa (mobile y algunos desktops)
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text, url });
        setLoading(false);
        return;
      } catch (err) {
        // Usuario canceló o falló — fallback a copiar
        if ((err as Error).name === 'AbortError') {
          setLoading(false);
          return;
        }
      }
    }

    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado', {
        description: 'Pegalo en WhatsApp o donde quieras compartirlo.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No pudimos copiar el link', {
        description: 'Copialo manualmente desde la barra del navegador.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-4 rounded-sm border transition-all',
        'text-[10px] font-black uppercase tracking-[0.25em]',
        copied
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5',
      )}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Share2 className="w-3.5 h-3.5" />
      )}
      {copied ? 'Copiado' : 'Compartir'}
    </button>
  );
}
