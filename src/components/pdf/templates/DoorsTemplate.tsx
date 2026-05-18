/**
 * REGLA 4: Capa PDF (Diseño Editorial)
 * Módulo: Cotizador de Puertas Independientes
 */

import * as React from 'react';
import { DoorOpen, Sparkles, MapPin, Globe, Instagram, Phone } from 'lucide-react';

interface DoorsTemplateProps {
  data: {
    client_name: string;
    total_amount: number;
    configuration: any;
    date: string;
  };
}

export const DoorsTemplate: React.FC<DoorsTemplateProps> = ({ data }) => {
  const { configuration: config, client_name, total_amount, date } = data;

  return (
    <div className="w-[800px] min-h-[1100px] bg-white p-12 text-slate-900 font-sans selection:bg-primary/30 shadow-none border border-slate-100">
      
      {/* 1. SECCIÓN IDENTIDAD (Branding & Contexto) */}
      <header className="flex justify-between items-start border-b-2 border-slate-900 pb-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 flex items-center justify-center rounded-sm">
              <DoorOpen className="text-white w-7 h-7" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">Innovar <span className="text-primary not-italic">Interior</span></h1>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Propuesta De Ingeniería: Puertas Independientes</p>
            <p className="text-sm font-bold font-mono">CODE: PUE-{Math.random().toString(36).substring(7).toUpperCase()}</p>
          </div>
        </div>

        <div className="text-right space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Cliente Propietario</p>
            <h2 className="text-2xl font-black uppercase text-slate-900">{client_name}</h2>
          </div>
          <p className="text-xs font-bold text-slate-500">{date}</p>
        </div>
      </header>

      {/* 2. SECCIÓN RELACIÓN (Briefing) */}
      <section className="py-12 grid grid-cols-2 gap-12">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary italic underline decoration-primary/30 underline-offset-8 mb-6">Memorándum de Proyecto</h3>
          <p className="text-xs leading-relaxed text-slate-600 font-medium italic">
            "Este diseño contempla la fabricación y suministro de puertas arquitectónicas a medida estándar, 
            garantizando un cierre hermético y estética superior en cada vano."
          </p>
        </div>
        <div className="bg-slate-50 p-6 border-l-4 border-slate-900 flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Estado del Diseño</p>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-tight">Parametrización Validada de Acceso</span>
          </div>
        </div>
      </section>

      {/* 3. SECCIÓN INGENIERÍA (Technical Specs) */}
      <section className="py-12">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 italic mb-10">Especificaciones Técnicas de Puertas</h3>
        
        <div className="grid grid-cols-5 border-t border-slate-200">
           <div className="col-span-2 py-4 border-b border-slate-200 uppercase text-[9px] font-black text-slate-400 italic tracking-widest">Parámetro</div>
           <div className="col-span-3 py-4 border-b border-slate-200 uppercase text-[9px] font-black text-slate-400 italic tracking-widest">Configuración</div>
           
           <div className="col-span-2 py-6 border-b border-slate-100 text-xs font-bold uppercase tracking-tight">Tipo de Puerta</div>
           <div className="col-span-3 py-6 border-b border-slate-100 text-xs font-mono font-bold text-slate-900 uppercase">
             {config.type?.replace(/_/g, ' ') || 'Estandar'}
           </div>

           <div className="col-span-2 py-6 border-b border-slate-100 text-xs font-bold uppercase tracking-tight">Cantidad</div>
           <div className="col-span-3 py-6 border-b border-slate-100 text-xs font-mono font-bold text-slate-900">
             {config.quantity} Unidades
           </div>

           <div className="col-span-2 py-6 border-b border-slate-100 text-xs font-bold uppercase tracking-tight">Dintel Sugerido</div>
           <div className="col-span-3 py-6 border-b border-slate-100 text-xs font-mono font-bold text-primary">
             {config.includeDintel ? 'INCLUYE DINTEL' : 'SIN DINTEL'}
           </div>

           <div className="col-span-2 py-6 border-b border-slate-100 text-xs font-bold uppercase tracking-tight">Dimensiones de Fabricación</div>
           <div className="col-span-3 py-6 border-b border-slate-100 text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider italic">
             Altura máxima estándar: 2.20m. Ancho variable según vano pre-validado.
           </div>

           <div className="col-span-2 py-6 border-b border-slate-100 text-xs font-bold uppercase tracking-tight text-primary">Hardware & Garantía</div>
           <div className="col-span-3 py-6 border-b border-slate-100 text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">
             Incluye marco, bisagras o rieles según corresponda, y chapa estándar. No incluye pintura de pared ni desmonte de puerta anterior.
           </div>
        </div>
      </section>

      {/* 4. SECCIÓN CONVERSIÓN (Financiero) */}
      <section className="py-12 mt-12 bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="flex justify-between items-end relative z-10 w-full">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">Inversión Final de Proyecto</p>
              <h4 className="text-6xl font-black font-mono tracking-tighter">$ {total_amount.toLocaleString('es-CO')}</h4>
            </div>
            <div className="flex gap-6 mt-4 opacity-70">
              <div className="space-y-1">
                <p className="text-[8px] font-bold uppercase">Base Prod. ({config.quantity} ud)</p>
                <p className="text-xs font-mono font-bold text-white">$ {(config.subtotal || 0).toLocaleString('es-CO')}</p>
              </div>
              {config.manualDiscount > 0 && (
                <div className="space-y-1">
                  <p className="text-[8px] font-bold uppercase text-emerald-400">Dto. {config.manualDiscount}%</p>
                  <p className="text-xs font-mono font-bold text-emerald-400">- $ {(config.discountAmount || 0).toLocaleString('es-CO')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="text-right space-y-6">
            <div className="p-4 border border-white/10 bg-white/5 backdrop-blur-md">
              <p className="text-[9px] font-black uppercase tracking-widest mb-1 italic">Vigencia</p>
              <p className="text-xs font-bold">15 Días</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECCIÓN PRESENCIA (Footer) */}
      <footer className="mt-20 border-t border-slate-100 pt-10 grid grid-cols-4 gap-8">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-primary" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Showroom Innovar Interior</p>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
             <Instagram className="w-4 h-4" />
             <Globe className="w-4 h-4" />
             <Phone className="w-4 h-4" />
          </div>
        </div>
        <div className="col-span-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Innovar <span className="text-slate-900 font-black">Interior</span> © 2026</p>
        </div>
      </footer>

    </div>
  );
};
