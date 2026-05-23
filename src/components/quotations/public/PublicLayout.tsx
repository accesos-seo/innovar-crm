import { ReactNode } from 'react';

const LOGO_URL =
  'https://stjugsrkrweakvzmizpq.supabase.co/storage/v1/object/public/Logos%20Marcas/finallogo-fondo%20(1).png';
const WEBSITE_URL = 'https://cocinasintegralespereira.co/';

interface Props {
  children: ReactNode;
}

/**
 * Wrapper standalone para las páginas públicas (sin sidebar, sin auth).
 * Mobile-first, paleta clara. Mantiene la marca Innovar consistente con
 * `PublicBooking` pero en un fondo claro adaptado a leer una propuesta larga.
 */
export function PublicLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href={WEBSITE_URL} target="_blank" rel="noreferrer">
            <img src={LOGO_URL} alt="Innovar" className="h-9 w-auto object-contain" />
          </a>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
            Cocinas de Arte
          </span>
        </div>
      </header>
      <main className="flex-1 px-3 py-5 sm:py-8">
        <div className="max-w-2xl mx-auto space-y-4">{children}</div>
      </main>
      <footer className="px-3 py-5 text-center text-[10px] uppercase tracking-widest text-gray-400">
        Innovar Cocinas · Pereira · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
