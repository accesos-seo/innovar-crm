import { Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  viewCount: number;
  viewedAt: string | null;
}

/**
 * Mini-widget para `QuotationDetail`: muestra al admin si el cliente abrió
 * la URL pública. Sin datos personales (no IP, no user-agent).
 */
export function QuotationViewTracking({ viewCount, viewedAt }: Props) {
  if (viewCount === 0 || !viewedAt) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <EyeOff className="w-3.5 h-3.5" />
        <span>El cliente aún no abrió el link</span>
      </div>
    );
  }

  const firstView = format(new Date(viewedAt), "d MMM yyyy, HH:mm", { locale: es });

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
      <Eye className="w-3.5 h-3.5" />
      <span>
        Vista {viewCount} {viewCount === 1 ? 'vez' : 'veces'} · Primera vez {firstView}
      </span>
    </div>
  );
}
