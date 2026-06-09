/**
 * Motor de cálculo del módulo "Horas" — funciones puras.
 * Sin red, sin React, sin estado. Testeable sin dependencias externas.
 *
 * MODELO DE PERÍODO: ciclo anclado en un día (ej. 25→24).
 * Si anchorDay=1, funciona como mes calendario normal.
 */

import type { MonthSummary, WorkContract, WorkLog } from "./types";

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MONTHS_LONG = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function parseHHMM(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function ymd(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}
function idx(year: number, month: number) { return year * 12 + (month - 1); }
function fromIdx(i: number) { return { year: Math.floor(i / 12), month: (i % 12) + 1 }; }

export function netMinutes(row: Pick<WorkLog,"day_type"|"start_time"|"end_time"|"break_minutes">): number {
  if (row.day_type === "no_operativo") return 0;
  const start = parseHHMM(row.start_time);
  const end = parseHHMM(row.end_time);
  if (start === null || end === null) return 0;
  return Math.max(0, (end - start) - Math.max(0, row.break_minutes || 0));
}

export function isInProgress(row: Pick<WorkLog,"day_type"|"start_time"|"end_time">): boolean {
  return row.day_type === "operativo" && !!row.start_time && !row.end_time;
}

export function anchorDayOf(contract: WorkContract): number {
  const d = Number(contract.period_start.split("-")[2]);
  return d >= 1 ? d : 1;
}

export function periodStartOfDate(workDate: string, anchorDay: number): { year: number; month: number } {
  const { y, m, d } = ymd(workDate);
  if (d >= anchorDay) return { year: y, month: m };
  return fromIdx(idx(y, m) - 1);
}

export function addMonths(year: number, month: number, delta: number) {
  return fromIdx(idx(year, month) + delta);
}

export function periodLabel(year: number, month: number, anchorDay: number): string {
  if (anchorDay <= 1) return `${MONTHS_LONG[month - 1]} ${year}`;
  const end = addMonths(year, month, 1);
  return `${anchorDay} ${MONTHS_SHORT[month - 1]} – ${anchorDay - 1} ${MONTHS_SHORT[end.month - 1]} ${end.year}`;
}

function contractStart(contract: WorkContract) {
  return periodStartOfDate(contract.period_start, anchorDayOf(contract));
}

export function hasTarget(contract: WorkContract, year: number, month: number): boolean {
  const c = contractStart(contract);
  return idx(year, month) >= idx(c.year, c.month);
}

export function periodTarget(contract: WorkContract, year: number, month: number): number {
  return hasTarget(contract, year, month) ? Math.round(contract.monthly_hours * 60) : 0;
}

export function periodNet(rows: WorkLog[], contract: WorkContract, year: number, month: number): number {
  const aday = anchorDayOf(contract);
  const target = idx(year, month);
  let total = 0;
  for (const r of rows) {
    const p = periodStartOfDate(r.work_date, aday);
    if (idx(p.year, p.month) === target) total += r.net_minutes;
  }
  return total;
}

export function balanceEntering(rows: WorkLog[], contract: WorkContract, year: number, month: number): number {
  const c = contractStart(contract);
  const cIdx = idx(c.year, c.month);
  const tIdx = idx(year, month);
  const target = Math.round(contract.monthly_hours * 60);
  let balance = contract.initial_balance_minutes;
  for (let i = cIdx; i < tIdx; i++) {
    const { year: py, month: pm } = fromIdx(i);
    balance += periodNet(rows, contract, py, pm) - target;
  }
  return balance;
}

export function currentAccumulatedBalance(rows: WorkLog[], contract: WorkContract, today: string): number {
  const p = periodStartOfDate(today, anchorDayOf(contract));
  return balanceEntering(rows, contract, p.year, p.month);
}

export function buildMonthSummary(rows: WorkLog[], contract: WorkContract, year: number, month: number): MonthSummary {
  const netMin = periodNet(rows, contract, year, month);
  const targetMin = periodTarget(contract, year, month);
  const entering = balanceEntering(rows, contract, year, month);
  const result = netMin - targetMin;
  return {
    year, month,
    netMinutes: netMin,
    targetMinutes: targetMin,
    hasTarget: hasTarget(contract, year, month),
    balanceEnteringMinutes: entering,
    resultMinutes: result,
    projectedMinutes: entering + result,
  };
}

export function formatMinutes(total: number): string {
  const sign = total < 0 ? "−" : "";
  const abs = Math.abs(Math.round(total));
  return `${sign}${Math.floor(abs / 60)}h ${String(abs % 60).padStart(2, "0")}m`;
}

export function minutesToHours(total: number): number {
  return Math.round((total / 60) * 100) / 100;
}
