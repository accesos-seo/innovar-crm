/**
 * REGLA 4: Capa de PDF de Alta Ingeniería
 * Módulo: Cotizador de Acabados Especiales
 */

import React from 'react';
import { 
  Sparkles, 
  MapPin, 
  Globe, 
  Instagram, 
  Phone,
  Layout,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { SpecialFinishesResults, SPECIAL_FINISH_LEGAL_NOTE } from '@/features/special_finishes/logic';

interface SpecialFinishesTemplateProps {
  data: {
    client_name: string;
    total_amount: number;
    configuration: SpecialFinishesResults & { description: string; includeLed: boolean; ledMl: number };
    date: string;
  };
}

export const SpecialFinishesTemplate: React.FC<SpecialFinishesTemplateProps> = ({ data }) => {
  const { configuration } = data;

  return (
    <div className="w-[800px] bg-white text-slate-900 font-sans p-10 shadow-2xl border border-slate-100 flex flex-col gap-10">
      
      {/* 1. IDENTIDAD */}
      <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="bg-slate-900 p-2 rounded-sm rotate-3">
               <Sparkles className="text-emerald-400 w-8 h-8" />
             </div>
             <div>
               <h1 className="text-3xl font-black italic tracking-tighter text-slate-900 uppercase">INNOVAR</h1>
               <p className="text-[10px] font-bold tracking-[0.4em] text-slate-500 leading-none">MOBILIARIO ÉLITE</p>
             </div>
          </div>
          <div className="flex gap-6 mt-4 opacity-70">
            <div className="flex items-center gap-1.5"><MapPin size={10} className="text-slate-900" /><span className="text-[9px] font-bold">CALI, VALLE</span></div>
            <div className="flex items-center gap-1.5"><Globe size={10} className="text-slate-900" /><span className="text-[9px] font-bold">WWW.INNOVAR.COM</span></div>
            <div className="flex items-center gap-1.5"><Instagram size={10} className="text-slate-900" /><span className="text-[9px] font-bold">@INNOVAR_DESIGN</span></div>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-emerald-600 text-white px-6 py-2 rounded-none mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">ESPECIFICACIÓN DE ACABADOS</p>
          </div>
          <p className="text-[11px] font-black italic uppercase text-slate-400">PÓLIZA DE DISEÑO · {data.date}</p>
        </div>
      </div>

      {/* 2. RELACIÓN */}
      <div className="grid grid-cols-2 gap-12 bg-slate-50 p-6 border-l-8 border-slate-900 shadow-sm">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">PROYECTO VINCULADO</p>
          <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{data.client_name}</h2>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CATEGORÍA</p>
          <p className="text-sm font-bold text-emerald-600 uppercase">ACABADOS HIGH-END</p>
        </div>
      </div>

      {/* 3. INGENIERÍA: DESCRIPCIÓN Y DESGLOSE */}
      <div className="space-y-8 flex-1">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <FileText className="text-slate-900 w-5 h-5" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b-2 border-slate-100 flex-1 pb-1">Descripción del Encargo</h3>
          </div>
          <div className="bg-slate-50 p-6 border-l-2 border-emerald-500">
             <p className="text-xs font-medium text-slate-700 leading-relaxed italic whitespace-pre-line">
               "{configuration.description || 'Sin descripción técnica proporcionada.'}"
             </p>
          </div>
        </div>

        <div className="space-y-4">
           <div className="flex items-center gap-3">
             <Layers className="text-slate-900 w-5 h-5" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em] border-b-2 border-slate-100 flex-1 pb-1">Desglose de Puertas & Vidrios</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200">
                <th className="px-4 py-3 text-[10px] font-black text-left uppercase tracking-widest">Ref. Puerta</th>
                <th className="px-4 py-3 text-[10px] font-black text-center uppercase tracking-widest">Dimensiones</th>
                <th className="px-4 py-3 text-[10px] font-black text-center uppercase tracking-widest">Área (m²)</th>
                <th className="px-4 py-3 text-[10px] font-black text-right uppercase tracking-widest">Costo Base</th>
              </tr>
            </thead>
            <tbody>
              {configuration.detailedDoors.map((door, idx) => (
                <tr key={idx} className="border-b border-slate-100 italic">
                  <td className="px-4 py-3 text-xs font-black text-slate-900">PUERTA PERFILERÍA A-0{idx + 1}</td>
                  <td className="px-4 py-3 text-center text-[11px] font-bold text-slate-600 font-mono">
                    {door.height.toFixed(2)}m × {door.width.toFixed(2)}m
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-black text-emerald-600 font-mono">
                    {door.area.toFixed(2)} m²
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-black text-slate-900 font-mono">
                    ${door.cost.toLocaleString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* NOTA EN PUERTAS Y LOGÍSTICA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
           <div className="p-4 bg-slate-50 border border-slate-200 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="space-y-1">
                 <p className="text-[9px] font-black text-slate-900 uppercase">Especificación Material</p>
                 <p className="text-[10px] text-slate-600 font-medium italic">{SPECIAL_FINISH_LEGAL_NOTE}</p>
              </div>
           </div>
           {configuration.includeLed && (
             <div className="p-4 bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="space-y-1">
                   <p className="text-[9px] font-black text-emerald-800 uppercase">Sitema de Iluminación</p>
                   <p className="text-[10px] text-emerald-700 font-medium italic">Incluye {configuration.ledMl} metros lineales de luz LED.</p>
                </div>
             </div>
           )}
        </div>
      </div>

      {/* 4. CONVERSIÓN */}
      <div className="bg-slate-900 text-white p-8 grid grid-cols-2 gap-8 relative">
        <div className="space-y-4 border-r border-white/10 pr-8">
           <div className="flex justify-between items-center text-white/50">
             <span className="text-[9px] font-black uppercase tracking-widest">Resumen de Insumos</span>
             <span className="text-sm font-black font-mono">${configuration.acabadosSubtotal.toLocaleString('es-CO')}</span>
           </div>
           <div className="flex justify-between items-center text-emerald-400">
             <span className="text-[9px] font-black uppercase tracking-widest">Descuento Aplicado</span>
             <span className="text-sm font-black font-mono">-${configuration.discountAmount.toLocaleString('es-CO')}</span>
           </div>
        </div>

        <div className="text-right flex flex-col justify-end items-end">
           <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-2">Total Módulo Acabados</p>
           <h2 className="text-5xl font-black font-mono text-white tracking-tighter">
             ${data.total_amount.toLocaleString('es-CO')}
           </h2>
        </div>
      </div>

      {/* 5. PRESENCIA */}
      <div className="flex justify-between items-center px-6 pt-6 border-t border-slate-100 opacity-60 italic">
         <div className="space-y-1">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CONTROL DE CALIDAD</p>
           <div className="flex items-center gap-2 font-bold text-[9px] text-slate-900 underline underline-offset-4">WWW.INNOVAR.COM</div>
         </div>
         <div className="text-right">
           <p className="text-[9px] font-black text-slate-800 uppercase">DISEÑO ARQUITECTÓNICO · VALLE DEL CAUCA</p>
         </div>
      </div>
    </div>
  );
};
