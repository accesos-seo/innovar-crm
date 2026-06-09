/**
 * Identidad de marca Innovar reusable en las pantallas públicas.
 *
 * Logo servido desde /public/ del repo (sin dependencia de bucket externo).
 * Hay 2 variantes:
 *  - 'hero'   → logo cuadrado sobre fondo negro (cabecera grande)
 *  - 'inline' → logo horizontal compacto transparente (footer, vistas chicas)
 *
 * Si la imagen falla a cargar, cae a un placeholder tipográfico.
 */
import { useState } from 'react';

const LOGO_HERO = '/innovar-logo-black.png'; // sobre fondo negro, isotipo + nombre + tagline

interface Props {
  variant?: 'hero' | 'inline';
}

export function InnovarMark({ variant = 'hero' }: Props) {
  const [imgError, setImgError] = useState(false);

  // Inline (footer): mismo logo negro, más chico, sin halo.
  // El logo "web" horizontal trae fondo claro que rompe el look dark.
  if (variant === 'inline') {
    if (imgError) return <TypographicPlaceholder size="md" />;
    return (
      <img
        src={LOGO_HERO}
        alt="Innovar Cocinas de Diseño"
        className="h-14 sm:h-16 w-auto object-contain opacity-90"
        onError={() => setImgError(true)}
      />
    );
  }

  // Hero: logo grande con halo verde menta
  if (imgError) return <TypographicPlaceholder size="lg" />;
  return (
    <div className="relative">
      <div className="absolute inset-0 -m-6 bg-primary/20 blur-3xl rounded-full" aria-hidden="true" />
      <img
        src={LOGO_HERO}
        alt="Innovar Cocinas de Diseño"
        className="relative h-28 sm:h-36 w-auto object-contain drop-shadow-[0_0_24px_rgba(68,221,193,0.35)]"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

function TypographicPlaceholder({ size }: { size: 'lg' | 'md' }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`font-heading font-black tracking-[0.35em] text-foreground drop-shadow-[0_0_24px_rgba(68,221,193,0.35)] ${
          size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-xl'
        }`}
      >
        INNOVAR
      </span>
      <span
        className={`font-bold uppercase tracking-[0.3em] text-muted-foreground/70 ${
          size === 'lg' ? 'text-[10px] sm:text-xs' : 'text-[9px]'
        }`}
      >
        Cocinas de Diseño
      </span>
    </div>
  );
}
