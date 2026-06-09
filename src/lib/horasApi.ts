import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, unwrapSupabase } from "@/lib/errors";
import { netMinutes } from "@/lib/horas/calc";
import type { WorkContract, WorkLog, WorkLogInput } from "@/lib/horas/types";

const HHMM = /^(\d{1,2}):(\d{2})$/;

export const workLogSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  day_type: z.enum(["operativo", "no_operativo"]),
  start_time: z.string().regex(HHMM, "Hora inválida").nullable(),
  end_time: z.string().regex(HHMM, "Hora inválida").nullable(),
  break_minutes: z.number().int().min(0),
  note: z.string().trim().max(500).nullable(),
}).superRefine((v, ctx) => {
  if (v.day_type === "no_operativo") return;
  const toMin = (s: string) => { const m = HHMM.exec(s)!; return Number(m[1]) * 60 + Number(m[2]); };
  if (v.start_time && v.end_time) {
    const start = toMin(v.start_time), end = toMin(v.end_time);
    if (start >= end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El inicio debe ser anterior al fin", path: ["end_time"] });
    } else if (v.break_minutes >= end - start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El receso no puede ser igual o mayor a la jornada", path: ["break_minutes"] });
    }
  }
});

export type ValidatedWorkLog = z.infer<typeof workLogSchema>;

const CONTRACT_COLS = "brand_id, monthly_hours, period_start, initial_balance_minutes";
const LOG_COLS = "id, brand_id, work_date, day_type, start_time, end_time, break_minutes, net_minutes, note";

function trimSeconds(t: string | null): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}:\d{2})/.exec(t);
  return m ? m[1] : t;
}

function normalizeLog(row: any): WorkLog {
  return {
    id: String(row.id),
    brand_id: row.brand_id,
    work_date: row.work_date,
    day_type: row.day_type,
    start_time: trimSeconds(row.start_time),
    end_time: trimSeconds(row.end_time),
    break_minutes: row.break_minutes ?? 0,
    net_minutes: row.net_minutes ?? 0,
    note: row.note ?? null,
  };
}

export async function fetchContract(brandId: string): Promise<WorkContract> {
  assertSupabase(supabase);
  const res = await supabase.from("work_contracts").select(CONTRACT_COLS).eq("brand_id", brandId).single();
  const data = unwrapSupabase(res) as any;
  return {
    brand_id: data.brand_id,
    monthly_hours: Number(data.monthly_hours),
    period_start: data.period_start,
    initial_balance_minutes: data.initial_balance_minutes ?? 0,
  };
}

export async function fetchLogs(brandId: string): Promise<WorkLog[]> {
  assertSupabase(supabase);
  const res = await supabase.from("work_logs").select(LOG_COLS).eq("brand_id", brandId).order("work_date", { ascending: true });
  const rows = unwrapSupabase(res) as any[];
  return rows.map(normalizeLog);
}

function toRow(brandId: string, input: ValidatedWorkLog) {
  const isOff = input.day_type === "no_operativo";
  const start = isOff ? null : input.start_time;
  const end = isOff ? null : input.end_time;
  const breakMin = isOff ? 0 : input.break_minutes;
  return {
    brand_id: brandId,
    work_date: input.work_date,
    day_type: input.day_type,
    start_time: start,
    end_time: end,
    break_minutes: breakMin,
    net_minutes: netMinutes({ day_type: input.day_type, start_time: start, end_time: end, break_minutes: breakMin }),
    note: input.note?.trim() || null,
  };
}

export async function insertLog(brandId: string, input: WorkLogInput): Promise<WorkLog> {
  assertSupabase(supabase);
  const valid = workLogSchema.parse(input);
  const res = await supabase.from("work_logs").insert(toRow(brandId, valid)).select(LOG_COLS).single();
  return normalizeLog(unwrapSupabase(res));
}

export async function updateLog(id: string, brandId: string, input: WorkLogInput): Promise<WorkLog> {
  assertSupabase(supabase);
  const valid = workLogSchema.parse(input);
  const { brand_id: _b, ...patch } = toRow(brandId, valid);
  const res = await supabase.from("work_logs").update(patch).eq("id", id).select(LOG_COLS).single();
  return normalizeLog(unwrapSupabase(res));
}

export async function deleteLog(id: string): Promise<void> {
  assertSupabase(supabase);
  const { error } = await supabase!.from("work_logs").delete().eq("id", id);
  if (error) throw error;
}
