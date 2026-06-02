import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarClock,
  CalendarPlus,
  Clock,
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  Flag,
  MapPin,
  UserRound,
} from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { notify } from "@/components/ui/PremiumToast";
import { cn } from "@/lib/utils";
import {
  MEETINGS,
  MEETING_MINUTES,
  MEETING_HOUR_LABEL,
  VISITOR_NAME,
  fmtCO,
  fmtShort,
  fmtMonth,
  cap,
  type Meeting,
  type Phase,
} from "@/lib/reuniones";

interface Enriched extends Meeting {
  start: Date;
  end: Date;
  phase: Phase;
  monthKey: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Genera y descarga un .ics para agendar la visita en el calendario. */
function downloadIcs(m: Enriched, index: number) {
  const dt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}00Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Innovar//Reuniones//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:reunion-innovar-${index}@innovar.com`,
    `DTSTART:${dt(m.start)}`,
    `DTEND:${dt(m.end)}`,
    `SUMMARY:Reunión Innovar — visita de ${VISITOR_NAME}`,
    `DESCRIPTION:Reunión quincenal de seguimiento. Visita presencial de ${VISITOR_NAME}. ${MEETING_HOUR_LABEL} (hora de Colombia).`,
    "LOCATION:Visita a domicilio",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Visita de ${VISITOR_NAME} en 30 min`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reunion-${dt(m.start).slice(0, 8)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  notify.success(
    "Reunión agendada",
    `Descargaste la invitación para ${cap(fmtCO.format(m.start))}.`
  );
}

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
  };
}

export default function Reuniones() {
  const navigate = useNavigate();

  const meetings: Enriched[] = useMemo(() => {
    const now = new Date();
    let nextAssigned = false;
    return MEETINGS.map((m) => {
      const start = new Date(m.startUtc);
      const end = new Date(start.getTime() + MEETING_MINUTES * 60000);
      let phase: Phase = "programada";
      if (end.getTime() < now.getTime()) {
        phase = "realizada";
      } else if (!nextAssigned) {
        phase = "proxima";
        nextAssigned = true;
      }
      return {
        ...m,
        start,
        end,
        phase,
        monthKey: cap(fmtMonth.format(start)),
      };
    });
  }, []);

  const next = meetings.find((m) => m.phase === "proxima") ?? null;
  const countdown = useCountdown(next?.start ?? null);
  const totalDone = meetings.filter((m) => m.phase === "realizada").length;

  // Agrupar por mes para el timeline.
  const byMonth = useMemo(() => {
    const map = new Map<string, Enriched[]>();
    meetings.forEach((m) => {
      const arr = map.get(m.monthKey) ?? [];
      arr.push(m);
      map.set(m.monthKey, arr);
    });
    return Array.from(map.entries());
  }, [meetings]);

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 pb-20">
      <CategoryHeader
        title="Reuniones"
        subtitle={`Agenda fija de seguimiento — 2 reuniones al mes, martes de por medio. Visita de ${VISITOR_NAME}.`}
        icon={CalendarClock}
        onBack={() => navigate("/")}
        status={{ label: "2 al mes", variant: "primary" }}
      />

      {/* ── Hero: próxima reunión ── */}
      {next && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-card border border-primary/20 rounded-sm shadow-2xl shadow-primary/10"
        >
          {/* Glow decorativo */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="h-1 w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30" />

          <div className="relative p-8 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            {/* Lado izquierdo: fecha + cuenta regresiva */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> Próxima reunión
                </span>
              </div>

              <div>
                <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tight text-foreground leading-tight">
                  {cap(fmtCO.format(next.start))}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Reunión quincenal de seguimiento · Visita de {VISITOR_NAME}
                </p>
              </div>

              {/* Cuenta regresiva */}
              {countdown && (
                <div className="flex items-center gap-3">
                  {[
                    { v: countdown.days, l: "días" },
                    { v: countdown.hours, l: "horas" },
                    { v: countdown.mins, l: "min" },
                  ].map((b) => (
                    <div
                      key={b.l}
                      className="flex flex-col items-center justify-center w-20 h-20 bg-primary/5 border border-primary/20 rounded-sm"
                    >
                      <span className="text-3xl font-black tabular-nums text-foreground leading-none">
                        {pad(b.v)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">
                        {b.l}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => downloadIcs(next, meetings.indexOf(next))}
                className="inline-flex items-center gap-2 px-5 h-12 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-none hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                <CalendarPlus className="w-4 h-4" /> Agregar a mi calendario
              </button>
            </div>

            {/* Lado derecho: hora única + detalle de la visita */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-5 py-5 rounded-sm border bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground leading-tight">Hora de la visita</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Hora de Colombia · igual para ambos
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-black tabular-nums text-foreground">
                  {MEETING_HOUR_LABEL}
                </span>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border border-border/10 rounded-sm">
                <UserRound className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Visita {VISITOR_NAME} · duración estimada 1 hora
                </span>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border border-border/10 rounded-sm">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Visita a domicilio
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Resumen ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={CalendarClock} label="Programadas" value={meetings.length} hint="Jun – Nov 2026" />
        <SummaryCard icon={CheckCircle2} label="Realizadas" value={totalDone} hint="Hasta hoy" />
        <SummaryCard icon={Clock} label="Frecuencia" value="x2" hint="Por mes" />
        <SummaryCard icon={CalendarCheck} label="Día" value="Martes" hint="Quincenal" />
      </div>

      {/* ── Aviso de feriados ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-emerald-500/5 border-l-2 border-emerald-500/60 rounded-sm">
        <div className="flex items-center gap-2 shrink-0">
          <Flag className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-foreground">
            Ninguna reunión cae en feriado de Colombia.
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Si algún martes coincidiera con un festivo, la reunión se mueve automáticamente al jueves de esa semana.
        </p>
      </div>

      {/* ── Timeline por mes ── */}
      <div className="space-y-8">
        {byMonth.map(([month, ms]) => (
          <div key={month}>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                {month}
              </h3>
              <div className="flex-1 h-px bg-border/20" />
              <span className="text-[10px] font-bold text-muted-foreground/60">
                {ms.length} {ms.length === 1 ? "reunión" : "reuniones"}
              </span>
            </div>

            <div className="space-y-3">
              {ms.map((m) => (
                <MeetingRow key={m.startUtc} m={m} index={meetings.indexOf(m)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="bg-card border border-border/10 rounded-md p-5 flex flex-col gap-3 hover:border-primary/20 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <span className="text-2xl font-black tracking-tight text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground/70">{hint}</span>
    </div>
  );
}

const PHASE_META: Record<Phase, { label: string; variant: "success" | "primary" | "info" }> = {
  realizada: { label: "Realizada", variant: "success" },
  proxima: { label: "Próxima", variant: "primary" },
  programada: { label: "Programada", variant: "info" },
};

function MeetingRow({ m, index }: { m: Enriched; index: number }) {
  const isNext = m.phase === "proxima";
  const isDone = m.phase === "realizada";
  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-5 py-4 bg-card border rounded-sm transition-all",
        isNext
          ? "border-primary/30 shadow-lg shadow-primary/10"
          : "border-border/10 hover:border-primary/20",
        isDone && "opacity-60"
      )}
    >
      {/* Marcador / día */}
      <div
        className={cn(
          "flex flex-col items-center justify-center w-14 h-14 rounded-sm border shrink-0",
          isNext ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/10"
        )}
      >
        {isDone ? (
          <CalendarCheck className="w-5 h-5 text-emerald-500" />
        ) : (
          <>
            <span className="text-lg font-black leading-none text-foreground tabular-nums">
              {fmtShort.format(m.start).split(" ")[0]}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {fmtShort.format(m.start).split(" ")[1]}
            </span>
          </>
        )}
      </div>

      {/* Detalle */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground truncate">{cap(fmtCO.format(m.start))}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {MEETING_HOUR_LABEL} · {VISITOR_NAME}
          </span>
          {m.holidayNote && (
            <span className="hidden sm:flex items-center gap-1 text-amber-500">
              <Flag className="w-3 h-3" /> {m.holidayNote}
            </span>
          )}
        </div>
      </div>

      <StatusBadge variant={PHASE_META[m.phase].variant} dot={isNext}>
        {PHASE_META[m.phase].label}
      </StatusBadge>

      {!isDone && (
        <button
          onClick={() => downloadIcs(m, index)}
          className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 border border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/30 rounded-none transition-colors"
          aria-label="Agendar"
        >
          <CalendarPlus className="w-3.5 h-3.5" /> Agendar
        </button>
      )}
    </div>
  );
}
