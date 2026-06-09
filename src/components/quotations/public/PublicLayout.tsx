import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Globe, Facebook, Instagram } from 'lucide-react';
import { InnovarMark } from './InnovarMark';

interface Props {
  children: ReactNode;
}

const COMPANY = {
  address: 'Km 9 vía Cerritos, Pereira, Colombia',
  phone: '+57 313 680 2025',
  phoneHref: 'tel:+573136802025',
  whatsappHref: 'https://wa.me/573136802025',
  email: 'innovarcocinasarte@gmail.com',
  emailHref: 'mailto:innovarcocinasarte@gmail.com',
  website: 'cocinasintegralespereira.co',
  websiteHref: 'https://cocinasintegralespereira.co/',
  facebook: 'https://www.facebook.com/innovarcocinasdiseno/',
  instagram: 'https://www.instagram.com/cocinasintegralesenpereira/',
  tiktok: null as string | null, // pendiente que Alvaro confirme la URL
};

/**
 * Wrapper standalone dark premium para las páginas públicas.
 * Mobile-first, paleta de marca (negro profundo + verde menta).
 */
export function PublicLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top accent — fina franja con gradient menta como sello editorial */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary to-transparent shrink-0" />

      <header className="px-5 py-10 sm:py-14 flex flex-col items-center">
        <motion.a
          href={COMPANY.websiteHref}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="block transition-transform hover:scale-[1.02]"
        >
          <InnovarMark variant="hero" />
        </motion.a>
      </header>

      <main className="flex-1 px-3 sm:px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
          className="max-w-2xl mx-auto space-y-6"
        >
          {children}
        </motion.div>
      </main>

      <footer className="border-t border-border/20 bg-background/40">
        <div className="max-w-2xl mx-auto px-5 py-10 space-y-7">
          {/* Logo inline + tagline */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <InnovarMark variant="inline" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
              Cocinas de Diseño · Pereira
            </span>
          </div>

          {/* Contacto en grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <FooterLink
              icon={<MapPin className="w-3.5 h-3.5 text-primary/70" />}
              label="Visítanos"
              value={COMPANY.address}
            />
            <FooterLink
              icon={<Phone className="w-3.5 h-3.5 text-primary/70" />}
              label="Llamanos"
              value={COMPANY.phone}
              href={COMPANY.phoneHref}
            />
            <FooterLink
              icon={<Mail className="w-3.5 h-3.5 text-primary/70" />}
              label="Escribinos"
              value={COMPANY.email}
              href={COMPANY.emailHref}
            />
            <FooterLink
              icon={<Globe className="w-3.5 h-3.5 text-primary/70" />}
              label="Sitio web"
              value={COMPANY.website}
              href={COMPANY.websiteHref}
              external
            />
          </div>

          {/* Redes sociales */}
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-border/15">
            <SocialIcon
              href={COMPANY.facebook}
              label="Facebook"
              icon={<Facebook className="w-4 h-4" />}
            />
            <SocialIcon
              href={COMPANY.instagram}
              label="Instagram"
              icon={<Instagram className="w-4 h-4" />}
            />
            {COMPANY.tiktok && (
              <SocialIcon href={COMPANY.tiktok} label="TikTok" icon={<TikTokIcon />} />
            )}
            <SocialIcon
              href={COMPANY.whatsappHref}
              label="WhatsApp"
              icon={<WhatsAppIcon />}
            />
          </div>

          {/* Fineprint */}
          <p className="text-center text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/50 pt-2">
            © {new Date().getFullYear()} Innovar Cocinas · Documento confidencial
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterLink({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const content = (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 mb-0.5">
          {label}
        </p>
        <p className="text-foreground/90 font-medium truncate">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        className="block hover:text-primary transition-colors"
      >
        {content}
      </a>
    );
  }
  return content;
}

function SocialIcon({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="w-9 h-9 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
    >
      {icon}
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
    </svg>
  );
}
