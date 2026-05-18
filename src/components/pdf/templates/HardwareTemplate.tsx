/**
 * REGLA 4: Capa de PDF de Alta Ingeniería
 * Módulo: Cotizador de Herrajes
 */

import React from 'react';
import { 
  Box, 
  MapPin, 
  Globe, 
  Instagram, 
  Phone,
  Layout,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { HardwareCalculationResults, HARDWARE_LEGAL_NOTE } from '@/features/hardware/logic';

interface HardwareTemplateProps {
  data: {
    client_name: string;
    total_amount: number;
    configuration: HardwareCalculationResults;
    date: string;
  };
}

export const HardwareTemplate: React.FC<HardwareTemplateProps> = ({ data }) => {
  const { configuration } = data;

  return (
    <div className="w-[800px] bg-white text-slate-900 font-sans p-10 shadow-2xl border border-slate-100 flex flex-col gap-10">
      
      {/* 1. IDENTIDAD */}
      <div className="flex justify-between items-start border-b-4 border-emerald-500 pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="bg-emerald-600 p-2 rounded-sm rotate-3">
               <Box className="text-white w-8 h-8" />
             </div>
             <div>
               <h1 className="text-3xl font-black italic tracking-tighter text-slate-900 uppercase">INNOVAR</h1>
               <p className="text-[10px] font-bold tracking-[0.4em] text-emerald-600 leading-none">MOBILIARIO ÉLITE</p>
             </div>
          </div>
          <div className="flex gap-6 mt-4 opacity-70">
            <div className="flex items-center gap-1.5"><MapPin size={10} className="text-emerald-600" /><span className="text-[9px] font-bold">CALI, VALLE</span></div>
            <div className="flex items-center gap-1.5"><Globe size={10} className="text-emerald-600" /><span className="text-[9px] font-bold">WWW.INNOVAR.COM</span></div>
            <div className="flex items-center gap-1.5"><Instagram size={10} className="text-emerald-600" /><span className="text-[9px] font-bold">@INNOVAR_DESIGN</span></div>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-6 py-2 rounded-none mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">COTIZACIÓN TÉCNICA</p>
          </div>
          <p className="text-[11px] font-black italic uppercase text-slate-400">FICHA DE HERRAJES · {data.date}</p>
        </div>
      </div>

      {/* 2. RELACIÓN */}
      <div className="grid grid-cols-2 gap-12 bg-slate-50 p-6 border-l-8 border-emerald-500">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">PROYECTO VINCULADO</p>
          <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{data.client_name}</h2>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">VALIDEZ COMERCIAL</p>
          <p className="text-sm font-bold text-slate-700 uppercase">15 DÍAS CALENDARIO</p>
        </div>
      </div>

      {/* 3. INGENIERÍA: TABLA DE HERRAJES */}
      <div className="space-y-6 flex-1">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 className="text-emerald-500 w-5 h-5" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] border-b-2 border-slate-100 flex-1 pb-1">Desglose Técnico de Accesorios</h3>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-4 py-3 text-[10px] font-black text-left uppercase tracking-widest w-[45%]">Descripción del Herraje</th>
              <th className="px-4 py-3 text-[10px] font-black text-center uppercase tracking-widest">Cat.</th>
              <th className="px-4 py-3 text-[10px] font-black text-center uppercase tracking-widest">Cant.</th>
              <th className="px-4 py-3 text-[10px] font-black text-right uppercase tracking-widest">Unitario</th>
              <th className="px-4 py-3 text-[10px] font-black text-right uppercase tracking-widest">Subtotal</th>
            </tr>
          </thead>
          <tbody className="border-x border-slate-100">
            {configuration.detailedItems.map((item, idx) => (
              <tr key={idx} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                <td className="px-4 py-4">
                  <p className="text-xs font-black text-slate-900 uppercase italic leading-tight">{item.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{item.description}</p>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="text-[9px] font-black text-emerald-600 uppercase">{item.category}</span>
                </td>
                <td className="px-4 py-4 text-center text-xs font-black text-slate-900 font-mono">{item.quantity}</td>
                <td className="px-4 py-4 text-right text-[10px] font-bold text-slate-500 font-mono">${item.price.toLocaleString('es-CO')}</td>
                <td className="px-4 py-4 text-right text-xs font-black text-emerald-700 font-mono">${item.subtotal.toLocaleString('es-CO')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* NOTA LEGAL EN INGENIERÍA */}
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 flex items-start gap-4">
           <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
           <p className="text-[10px] text-emerald-800 font-black italic leading-relaxed uppercase">
             {HARDWARE_LEGAL_NOTE}
           </p>
        </div>
      </div>

      {/* 4. CONVERSIÓN */}
      <div className="bg-slate-900 text-white p-8 grid grid-cols-2 gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="space-y-4 relative z-10 border-r border-white/10 pr-8">
           <div className="flex justify-between items-center text-white/50">
             <span className="text-[9px] font-black uppercase tracking-widest">Subtotal Bruto</span>
             <span className="text-sm font-black font-mono">${configuration.hardwareCost.toLocaleString('es-CO')}</span>
           </div>
           <div className="flex justify-between items-center text-rose-400">
             <span className="text-[9px] font-black uppercase tracking-widest">Descuento Global</span>
             <span className="text-sm font-black font-mono">-${configuration.discountAmount.toLocaleString('es-CO')}</span>
           </div>
        </div>

        <div className="text-right flex flex-col justify-end items-end relative z-10">
           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-2">Inversión Final Neta</p>
           <h2 className="text-5xl font-black font-mono text-white tracking-tighter">
             ${data.total_amount.toLocaleString('es-CO')}
           </h2>
        </div>
      </div>

      {/* 5. PRESENCIA */}
      <div className="flex justify-between items-center px-6 pt-6 border-t border-slate-100 opacity-60">
        <div className="flex gap-10">
           <div className="space-y-1">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">GERENCIA COMERCIAL</p>
             <div className="flex items-center gap-2"><Phone size={10} /><span className="text-[9px] font-bold">+57 321 000 0000</span></div>
           </div>
        </div>
         <div className="text-right">
           <p className="text-[10px] font-black text-slate-800 uppercase italic">DISEÑO · CALIDAD · INNOVACIÓN</p>
           <p className="text-[8px] font-bold text-slate-400">Documento generado automáticamente por el sistema Innovar Cloud.</p>
         </div>
      </div>
    </div>
  );
};
