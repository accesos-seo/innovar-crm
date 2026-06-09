import * as React from 'react';
import { Shield, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useSetting } from '@/hooks/settings/useSystemSettings';

export function CompanyTrustSection() {
  const [expanded, setExpanded] = React.useState(false);
  const { data: certificateUrl } = useSetting<string>('company_certificate_url');

  if (!certificateUrl) return null;

  return (
    <div className="bg-card/40 border border-border/25 rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 sm:px-10 py-4 flex items-center justify-between gap-4 hover:bg-card/70 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400/80">
            Empresa verificada
          </span>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            — Innovar Cocinas Integrales
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-6 sm:px-10 pb-6 space-y-4 border-t border-border/25">
          <p className="text-sm text-muted-foreground pt-4 leading-relaxed">
            Somos una empresa legalmente registrada ante la Cámara de Comercio de
            Pereira. Podés verificar nuestra existencia y representación legal en el
            certificado oficial.
          </p>
          <a
            href={certificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm text-emerald-400 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver certificado de existencia
          </a>
        </div>
      )}
    </div>
  );
}
