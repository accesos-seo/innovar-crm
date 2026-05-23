import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  CalendarCheck,
  Clock,
  ChevronRight,
  ShieldCheck,
  UserRound,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBookingContext,
  usePublicVisitSlots,
  useBookPublicVisit,
  type PublicSlot,
} from "@/hooks/agenda/usePublicBooking";

const LOGO_URL =
  "https://stjugsrkrweakvzmizpq.supabase.co/storage/v1/object/public/Logos%20Marcas/finallogo-fondo%20(1).png";
const WINDOW_DAYS = 21; // mostramos próximas 3 semanas de martes/jueves

interface ConfirmedVisit {
  scheduled_at: string;
  staff_name: string | null;
  client_name: string;
}

export default function PublicBooking() {
  const { token } = useParams<{ token: string }>();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedVisit | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ctxQ = useBookingContext(token);
  const fromDate = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const toDate = useMemo(() => format(addDays(new Date(), WINDOW_DAYS), "yyyy-MM-dd"), []);

  const slotsQ = usePublicVisitSlots(
    token,
    ctxQ.data ? fromDate : undefined,
    ctxQ.data ? toDate : undefined,
  );

  const bookMut = useBookPublicVisit();

  const slotsByDay = useMemo(() => {
    const rows = (slotsQ.data ?? []).filter((s) => s.is_available);
    const map = new Map<string, PublicSlot[]>();
    for (const slot of rows) {
      const dayKey = slot.slot_start.slice(0, 10);
      const arr = map.get(dayKey) ?? [];
      arr.push(slot);
      map.set(dayKey, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slotsQ.data]);

  const handleConfirm = async () => {
    if (!token || !selectedSlot) return;
    setErrorMsg(null);
    try {
      const result = await bookMut.mutateAsync({ token, scheduledAt: selectedSlot });
      setConfirmed({
        scheduled_at: result.scheduled_at,
        staff_name: result.staff_name,
        client_name: result.client_name,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo agendar. Intenta de nuevo.";
      setErrorMsg(msg);
      setSelectedSlot(null);
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (ctxQ.isLoading) {
    return <Shell><CenteredSpinner label="Validando link..." /></Shell>;
  }

  // ── INVALID TOKEN ─────────────────────────────────────────────────────────
  if (ctxQ.isError || !ctxQ.data) {
    return (
      <Shell>
        <InvalidLinkCard />
      </Shell>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <Shell>
        <SuccessCard confirmed={confirmed} />
      </Shell>
    );
  }

  // ── FORM ──────────────────────────────────────────────────────────────────
  const ctx = ctxQ.data;
  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-2xl bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]"
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary/20 via-white to-primary/20 shrink-0" />

        <div className="p-8 sm:p-10 pb-6 flex flex-col items-center space-y-5">
          <img
            src={LOGO_URL}
            alt="Innovar"
            className="h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(68,221,193,0.3)]"
          />
          <div className="text-center space-y-2">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-foreground">
              Agenda tu visita técnica
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-[1px] w-8 bg-primary/30" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">
                Innovar Cocinas de Arte
              </span>
              <div className="h-[1px] w-8 bg-primary/30" />
            </div>
          </div>
        </div>

        <div className="px-8 sm:px-10 pb-2 space-y-6">
          {/* Cliente + comercial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoBlock
              icon={<UserRound className="w-3 h-3 text-primary" />}
              label="Cliente"
              value={ctx.client_name}
            />
            <InfoBlock
              icon={<ShieldCheck className="w-3 h-3 text-primary" />}
              label="Te atiende"
              value={ctx.staff_name ?? "Asesor Innovar"}
            />
          </div>

          {/* Política */}
          <div className="p-4 bg-primary/5 border-l-2 border-primary/40 rounded-none">
            <p className="text-[11px] font-bold text-foreground/80 leading-relaxed">
              Las visitas duran ~90 minutos y solo se agendan los{" "}
              <span className="text-primary font-black uppercase">Martes y Jueves</span>.
            </p>
          </div>

          {/* Slots */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">
                Selecciona fecha y horario
              </h2>
            </div>

            {slotsQ.isLoading ? (
              <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Buscando horarios disponibles...
                </span>
              </div>
            ) : slotsByDay.length === 0 ? (
              <EmptySlots />
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {slotsByDay.map(([dayKey, slots]) => (
                  <DayGroup
                    key={dayKey}
                    dayKey={dayKey}
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={(s) => {
                      setSelectedSlot(s);
                      setErrorMsg(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-red-900/10 border-l-2 border-red-600 rounded-none"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider leading-tight">
                {errorMsg}
              </p>
            </motion.div>
          )}
        </div>

        <div className="px-8 sm:px-10 py-6">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSlot || bookMut.isPending}
            className={cn(
              "w-full h-14 relative overflow-hidden group/btn transition-all duration-500",
              "bg-foreground text-background font-black text-xs uppercase tracking-[0.2em]",
              "hover:bg-primary hover:text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed",
              "rounded-none shadow-xl active:scale-[0.98]",
            )}
          >
            <div className="relative z-10 flex items-center justify-center gap-3">
              {bookMut.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Agendando...</span>
                </>
              ) : (
                <>
                  Confirmar visita
                  <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </div>

        <div className="px-8 sm:px-10 py-5 bg-muted/30 border-t border-border/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-primary/60" />
            <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest">
              Link único · vence en 7 días
            </span>
          </div>
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-primary/20 rounded-full" />
            <div className="w-1 h-1 bg-primary/40 rounded-full" />
            <div className="w-1 h-1 bg-primary/60 rounded-full" />
          </div>
        </div>
      </motion.div>
    </Shell>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 sm:py-12">
      {children}
    </div>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-muted-foreground">
      <Loader2 className="w-7 h-7 text-primary animate-spin" />
      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{label}</span>
    </div>
  );
}

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-background/40 border border-border/30 p-4 rounded-none">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
          {label}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground truncate">{value}</p>
    </div>
  );
}

function EmptySlots() {
  return (
    <div className="p-6 border border-border/20 bg-muted/5 text-center space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        No hay horarios disponibles
      </p>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        No quedan slots libres en las próximas 3 semanas. Por favor escríbenos por WhatsApp para
        coordinar manualmente.
      </p>
    </div>
  );
}

function DayGroup({
  dayKey,
  slots,
  selectedSlot,
  onSelect,
}: {
  dayKey: string;
  slots: PublicSlot[];
  selectedSlot: string | null;
  onSelect: (s: string) => void;
}) {
  const [yy, mm, dd] = dayKey.split("-").map(Number);
  const date = new Date(yy, mm - 1, dd);
  const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="border border-border/20 rounded-none">
      <div className="px-4 py-2.5 bg-muted/10 border-b border-border/20">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
          {dayLabel}
        </span>
      </div>
      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {slots.map((s) => {
          const isSelected = selectedSlot === s.slot_start;
          const timeLabel = format(new Date(s.slot_start), "HH:mm");
          return (
            <button
              key={s.slot_start}
              type="button"
              onClick={() => onSelect(s.slot_start)}
              className={cn(
                "h-11 px-3 flex items-center justify-center gap-1.5 border transition-all",
                "text-xs font-black uppercase tracking-wider",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-background/40 text-foreground border-border/30 hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              <Clock className="w-3 h-3 opacity-70" />
              {timeLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InvalidLinkCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]"
    >
      <div className="h-1 w-full bg-gradient-to-r from-red-600/20 via-red-500 to-red-600/20 shrink-0" />
      <div className="p-10 flex flex-col items-center space-y-5 text-center">
        <img src={LOGO_URL} alt="Innovar" className="h-14 w-auto opacity-70" />
        <AlertCircle className="w-10 h-10 text-red-500/80" />
        <div className="space-y-2">
          <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
            Este link ya no es válido
          </h2>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Es posible que ya hayas agendado tu visita, o que el link haya vencido (7 días). Si
            necesitas reagendar, escríbenos por WhatsApp y te enviamos un nuevo link.
          </p>
        </div>
      </div>
      <div className="px-10 py-5 bg-muted/30 border-t border-border/10 flex items-center justify-center">
        <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest">
          Innovar Cocinas de Arte
        </span>
      </div>
    </motion.div>
  );
}

function SuccessCard({ confirmed }: { confirmed: ConfirmedVisit }) {
  const date = new Date(confirmed.scheduled_at);
  const dayLabel = format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  const timeLabel = format(date, "HH:mm");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-xl bg-card border border-border/40 rounded-sm overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.6)]"
    >
      <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 shrink-0" />
      <div className="p-10 flex flex-col items-center space-y-6 text-center">
        <img
          src={LOGO_URL}
          alt="Innovar"
          className="h-14 w-auto drop-shadow-[0_0_15px_rgba(68,221,193,0.4)]"
        />

        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 220 }}
          className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center border-2 border-primary/40"
        >
          <CheckCircle2 className="w-9 h-9 text-primary" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tighter text-foreground">
            ¡Listo, {confirmed.client_name.split(" ")[0]}!
          </h2>
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.25em] font-bold">
            Visita técnica confirmada
          </p>
        </div>

        <div className="w-full space-y-3">
          <div className="bg-background/40 border border-border/30 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarCheck className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
                Fecha y hora
              </span>
            </div>
            <p className="text-sm font-bold text-foreground capitalize">{dayLabel}</p>
            <p className="text-lg font-black text-primary mt-1">{timeLabel}</p>
          </div>

          {confirmed.staff_name && (
            <div className="bg-background/40 border border-border/30 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <UserRound className="w-3 h-3 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
                  Tu asesor
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">{confirmed.staff_name}</p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/70 leading-relaxed max-w-sm">
          Te confirmaremos por WhatsApp un recordatorio el día anterior. Si necesitas reagendar,
          contáctanos directamente.
        </p>
      </div>

      <div className="px-10 py-5 bg-muted/30 border-t border-border/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-primary/60" />
          <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest">
            Innovar Cocinas de Arte
          </span>
        </div>
      </div>
    </motion.div>
  );
}
