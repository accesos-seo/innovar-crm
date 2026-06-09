export type DayType = "operativo" | "no_operativo";

export interface WorkLog {
  id: string;
  brand_id: string;
  work_date: string; // 'YYYY-MM-DD'
  day_type: DayType;
  start_time: string | null; // 'HH:MM', null si no_operativo
  end_time: string | null;   // 'HH:MM', null = jornada en curso
  break_minutes: number;
  net_minutes: number;       // denormalizado — lo escribe la app
  note: string | null;
}

export interface WorkContract {
  brand_id: string;
  monthly_hours: number;
  period_start: string; // 'YYYY-MM-DD'
  initial_balance_minutes: number;
}

export interface MonthSummary {
  year: number;
  month: number; // 1–12
  netMinutes: number;
  targetMinutes: number;
  hasTarget: boolean;
  balanceEnteringMinutes: number;
  resultMinutes: number;
  projectedMinutes: number;
}

export interface WorkLogInput {
  work_date: string;
  day_type: DayType;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  note: string | null;
}
