/**
 * Reuniones — agenda fija de visitas de seguimiento de Álvaro Ríos.
 *
 * Cadencia: 2 reuniones al mes, quincenales. Primera reunión: martes 9 de
 * junio de 2026. A partir del 25 de junio, las reuniones se realizan los
 * JUEVES (25 jun · 9 jul · 23 jul · …). 12 reuniones, Jun–Nov 2026.
 *
 * Horario: la cita es presencial (Álvaro Ríos visita el domicilio) y la hora
 * es la MISMA para ambas partes — no hay diferencia horaria. Se fija a las
 * 18:00 de Colombia. Como Colombia no tiene horario de verano (UTC-5 fijo),
 * 18:00 Colombia = 23:00 UTC siempre.
 *
 * Feriados: si un jueves de reunión cae en feriado de Colombia, la reunión
 * se mueve al sábado de esa misma semana. Con el calendario 2026 ninguna
 * reunión coincide con un feriado, pero la regla queda implementada.
 *
 * Es un calendario PREDISEÑADO: la fuente de verdad vive acá, no en la base,
 * para que el cliente siempre vea las próximas reuniones sin depender de datos.
 */

export const VISITOR_NAME = "Álvaro Ríos";
export const MEETING_HOUR_LABEL = "6:00 PM";
export const MEETING_MINUTES = 60;

const FIRST_MEETING = "2026-06-09"; // martes
const MEETING_COUNT = 12;
const CADENCE_DAYS = 14;

// Festivos nacionales de Colombia 2026 (fecha local). Si una reunión cae en
// uno de estos días, se reprograma al jueves siguiente.
const CO_HOLIDAYS_2026 = new Set<string>([
  "2026-01-01", // Año Nuevo
  "2026-01-12", // Reyes Magos
  "2026-03-23", // San José
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01", // Día del Trabajo
  "2026-05-18", // Ascensión del Señor
  "2026-06-08", // Corpus Christi
  "2026-06-15", // Sagrado Corazón
  "2026-06-29", // San Pedro y San Pablo
  "2026-07-20", // Independencia
  "2026-08-07", // Batalla de Boyacá
  "2026-08-17", // Asunción de la Virgen
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos
  "2026-11-16", // Independencia de Cartagena
  "2026-12-08", // Inmaculada Concepción
  "2026-12-25", // Navidad
]);

export interface Meeting {
  /** Inicio de la reunión en UTC (18:00 Colombia = 23:00Z). */
  startUtc: string;
  /** Nota si la reunión se reprogramó por feriado. */
  holidayNote?: string;
}

/** Suma días a una fecha `YYYY-MM-DD` de forma segura (ancla en mediodía UTC). */
function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Genera la agenda: primera reunión el martes 9-jun, resto jueves quincenales. */
function buildMeetings(): Meeting[] {
  const out: Meeting[] = [];
  for (let i = 0; i < MEETING_COUNT; i++) {
    // i=0 → martes 9-jun (sin corrimiento); i≥1 → jueves (+2 días sobre el martes base)
    const base = addDaysISO(FIRST_MEETING, i * CADENCE_DAYS + (i > 0 ? 2 : 0));
    let day = base;
    let holidayNote: string | undefined;
    if (CO_HOLIDAYS_2026.has(base)) {
      day = addDaysISO(base, 2); // jueves → sábado si hay feriado
      holidayNote = "Movida — el jueves era feriado en Colombia";
    }
    out.push({ startUtc: `${day}T23:00:00Z`, holidayNote });
  }
  return out;
}

export const MEETINGS: Meeting[] = buildMeetings();

export type Phase = "realizada" | "proxima" | "programada";

// ── Formateo en español, hora de Colombia (sin librerías) ───────────────────
export const fmtCO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const fmtShort = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
});

export const fmtMonth = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  month: "long",
  year: "numeric",
});

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Próxima reunión que todavía no terminó (o null si no quedan). */
export function getNextMeetingDate(): Date | null {
  const now = Date.now();
  const next = MEETINGS.map((m) => new Date(m.startUtc)).find(
    (d) => d.getTime() + MEETING_MINUTES * 60000 >= now
  );
  return next ?? null;
}
