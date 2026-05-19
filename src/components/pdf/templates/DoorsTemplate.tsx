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

  // Soporta tanto la nueva estructura (doors[]) como la legacy
  const doors: any[] = Array.isArray(config?.doors) ? config.doors : [];
  const calcItems: any[] = Array.isArray(config?.items) ? config.items : [];
  const totalUnits = config?.totalUnits ?? doors.reduce((s, d) => s + (d.quantity || 0), 0);
  const subtotalProductos = config?.subtotalProductos ?? 0;
  const transport = config?.transport ?? 0;
  const discountAmount = config?.discountAmount ?? 0;
  const discountPercent = config?.discountPercent ?? 0;

  // Helper para encontrar el cálculo de una puerta por id
  const calcFor = (id: string) => calcItems.find(i => i.id === id) ?? { pricePerUnit: 0, widthRange: '50-85', lineTotal: 0 };

  return (
    <div className="w-[800px] min-h-[1100px] bg-white p-12 text-slate-900 font-sans selection:bg-primary/30 shadow-none border border-slate-100">

      {/* 1. SECCIÓN IDENTIDAD */}
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

      {/* 2. SECCIÓN RELACIÓN */}
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
            <span className="text-xs font-bold uppercase tracking-tight">
              {doors.length} {doors.length === 1 ? 'vano configurado' : 'vanos configurados'} · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. SECCIÓN INGENIERÍA — LISTA DE PUERTAS */}
      <section className="py-12">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900 italic mb-10">Especificaciones Técnicas por Vano</h3>

        <div className="border-t border-slate-200">
          {/* Cabecera tabla */}
          <div className="grid grid-cols-[3rem_1fr_1fr_3rem_1fr_4rem_1fr] gap-2 py-3 border-b border-slate-200 uppercase text-[9px] font-black text-slate-400 italic tracking-widest">
            <div>#</div>
            <div>Tipo</div>
            <div>Ancho</div>
            <div>Cant.</div>
            <div>Herrajes</div>
            <div>Dintel</div>
            <div className="text-right">Subtotal</div>
          </div>

          {doors.map((d, idx) => {
            const c = calcFor(d.id);
            return (
              <div key={d.id ?? idx} className="grid grid-cols-[3rem_1fr_1fr_3rem_1fr_4rem_1fr] gap-2 py-4 border-b border-slate-100 text-[11px]">
                <div className="font-mono font-bold text-slate-400">{String(idx + 1).padStart(2, '0')}</div>
                <div className="font-bold uppercase text-slate-900">
                  {d.type}
                  {d.location && (
                    <div className="text-[9px] font-medium text-slate-500 normal-case mt-1">{d.location}</div>
                  )}
                </div>
                <div className="font-mono font-bold text-slate-700">
                  {d.width}cm · {d.height}m
                  <div className="text-[9px] font-medium text-slate-400 uppercase">Rango {c.widthRange}</div>
                </div>
                <div className="font-mono font-bold text-slate-900">{d.quantity}</div>
                <div className="font-bold uppercase text-slate-700">{d.hardwareColor}</div>
                <div className={`text-[9px] font-black uppercase ${d.hasLintel ? 'text-primary' : 'text-slate-400'}`}>
                  {d.hasLintel ? 'Sí' : 'No'}
                </div>
                <div className="text-right font-mono font-bold text-slate-900">
                  $ {(c.lineTotal || 0).toLocaleString('es-CO')}
                </div>
              </div>
            );
          })}

          {/* Fila garantía/notas */}
          <div className="py-6 text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">
            Incluye marco, bisagras o rieles según corresponda, y chapa estándar.
            No incluye pintura de pared ni desmonte de puerta anterior.
            Color de herrajes (Aluminio/Negro) y dintel sin recargo.
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
                <p className="text-[8px] font-bold uppercase">Base Prod. ({totalUnits} ud)</p>
                <p className="text-xs font-mono font-bold text-white">$ {subtotalProductos.toLocaleString('es-CO')}</p>
              </div>
              {transport > 0 && (
                <div className="space-y-1">
                  <p className="text-[8px] font-bold uppercase">Transporte</p>
                  <p className="text-xs font-mono font-bold text-white">$ {transport.toLocaleString('es-CO')}</p>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="space-y-1">
                  <p className="text-[8px] font-bold uppercase text-emerald-400">Dto. {discountPercent}%</p>
                  <p className="text-xs font-mono font-bold text-emerald-400">- $ {discountAmount.toLocaleString('es-CO')}</p>
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

      {/* 5. FOOTER */}
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
