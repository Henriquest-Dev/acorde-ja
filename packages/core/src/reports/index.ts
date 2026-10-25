/**
 * Agregação de relatórios a partir dos registos diários de utilização
 * (usage_daily), que são sempre dados reais medidos pelo sistema.
 */

import { addDays, dayKey, startOfLocalDay, startOfMonth, startOfWeek } from '../time';

export interface UsageDailyRow {
  day: string;
  appId: string;
  appName: string;
  usedMs: number;
  limitMs: number | null;
  /** Número de aberturas, quando o sistema o disponibiliza. */
  opens: number | null;
}

export type ReportPeriod = 'day' | 'week' | 'month';

export interface PeriodRange {
  start: Date;
  /** Exclusivo. */
  end: Date;
  days: string[];
}

export function periodRange(period: ReportPeriod, reference: Date): PeriodRange {
  let start: Date;
  let end: Date;
  switch (period) {
    case 'day':
      start = startOfLocalDay(reference);
      end = addDays(start, 1);
      break;
    case 'week':
      start = startOfWeek(reference);
      end = addDays(start, 7);
      break;
    case 'month':
      start = startOfMonth(reference);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      break;
  }
  const days: string[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(dayKey(d));
  return { start, end, days };
}

export function previousReference(period: ReportPeriod, reference: Date): Date {
  switch (period) {
    case 'day':
      return addDays(reference, -1);
    case 'week':
      return addDays(reference, -7);
    case 'month':
      return new Date(reference.getFullYear(), reference.getMonth() - 1, Math.min(reference.getDate(), 28));
  }
}

export interface AppTotal {
  appId: string;
  appName: string;
  usedMs: number;
  exceededMs: number;
  opens: number | null;
}

export interface PeriodReport {
  totalMs: number;
  exceededMs: number;
  byApp: AppTotal[];
  /** Total por dia, na ordem de `range.days`. */
  byDay: { day: string; totalMs: number }[];
  hasData: boolean;
}

export function buildReport(rows: UsageDailyRow[], range: PeriodRange): PeriodReport {
  const inRange = rows.filter((r) => range.days.includes(r.day));
  const apps = new Map<string, AppTotal>();
  for (const r of inRange) {
    const t = apps.get(r.appId) ?? { appId: r.appId, appName: r.appName, usedMs: 0, exceededMs: 0, opens: null };
    t.usedMs += r.usedMs;
    if (r.limitMs !== null) t.exceededMs += Math.max(0, r.usedMs - r.limitMs);
    if (r.opens !== null) t.opens = (t.opens ?? 0) + r.opens;
    apps.set(r.appId, t);
  }
  const byApp = [...apps.values()].sort((a, b) => b.usedMs - a.usedMs);
  const byDay = range.days.map((day) => ({
    day,
    totalMs: inRange.filter((r) => r.day === day).reduce((s, r) => s + r.usedMs, 0),
  }));
  return {
    totalMs: byApp.reduce((s, a) => s + a.usedMs, 0),
    exceededMs: byApp.reduce((s, a) => s + a.exceededMs, 0),
    byApp,
    byDay,
    hasData: inRange.length > 0,
  };
}

/** Variação percentual face ao período anterior; `null` sem linha de base. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Mantém as `top` aplicações seleccionadas e agrega as restantes em «Outros»,
 * como no ecrã de relatórios.
 */
export function withOthers(byApp: AppTotal[], keepIds: string[]): AppTotal[] {
  const kept = byApp.filter((a) => keepIds.includes(a.appId));
  const rest = byApp.filter((a) => !keepIds.includes(a.appId));
  if (rest.length === 0) return kept;
  return [
    ...kept,
    {
      appId: '__others__',
      appName: 'Outros',
      usedMs: rest.reduce((s, a) => s + a.usedMs, 0),
      exceededMs: rest.reduce((s, a) => s + a.exceededMs, 0),
      opens: null,
    },
  ];
}

/** Gera CSV (RFC 4180) com os dados do relatório. */
export function reportToCsv(rows: UsageDailyRow[]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['dia', 'app', 'minutos_utilizados', 'limite_minutos', 'aberturas'];
  const lines = rows
    .slice()
    .sort((a, b) => (a.day === b.day ? a.appName.localeCompare(b.appName) : a.day.localeCompare(b.day)))
    .map((r) =>
      [r.day, r.appName, Math.round(r.usedMs / 60_000), r.limitMs === null ? null : Math.round(r.limitMs / 60_000), r.opens]
        .map(esc)
        .join(','),
    );
  return [header.join(','), ...lines].join('\n') + '\n';
}
