/**
 * Utilitários de tempo. Todas as funções recebem `now` explicitamente para
 * serem determinísticas e testáveis (relógio, fuso horário e meia-noite local).
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Chave do dia local no formato YYYY-MM-DD, segundo o fuso do dispositivo. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Início do dia local (meia-noite) para a data indicada. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Próxima meia-noite local — momento do reinício diário dos limites. */
export function nextLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Segunda-feira da semana local da data (semana ISO). */
export function startOfWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  return addDays(d, -dow);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** "1h 35min", "45 min", "0 min". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MINUTE));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

/** "3h 00min" — sempre com horas, como no anel do dashboard. */
export function formatHoursMinutes(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MINUTE));
  return `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, '0')}min`;
}

/** "25:00" */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** Iniciais usadas nos gráficos semanais (segunda a domingo). */
export const WEEK_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "Seg, 12 de Maio" */
export function formatShortDate(date: Date): string {
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/** "12 de Maio" */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function weekdayName(date: Date): string {
  return WEEKDAYS_LONG[date.getDay()]!;
}

export function greeting(date: Date): string {
  const h = date.getHours();
  if (h >= 6 && h < 13) return 'Bom dia!';
  if (h >= 13 && h < 20) return 'Boa tarde!';
  return 'Boa noite!';
}

/** "22:00" → minutos desde a meia-noite. */
export function parseTimeOfDay(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Hora inválida: ${value}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Hora inválida: ${value}`);
  return h * 60 + m;
}

export interface ClockSample {
  /** Date.now() no momento da amostra. */
  wallMs: number;
  /** Relógio monotónico (performance.now / elapsedRealtime) no mesmo momento. */
  monotonicMs: number;
  /** Desvio do fuso horário em minutos (Date#getTimezoneOffset). */
  tzOffsetMin: number;
}

export type ClockAnomaly =
  | { kind: 'none' }
  | { kind: 'timezone_changed'; fromOffsetMin: number; toOffsetMin: number }
  | { kind: 'clock_moved'; driftMs: number };

/**
 * Compara duas amostras do relógio. Se o relógio de parede avançou de forma
 * diferente do relógio monotónico, o utilizador (ou a rede) alterou a hora.
 * O motor de regras usa isto para não reiniciar limites indevidamente.
 */
export function detectClockAnomaly(
  prev: ClockSample,
  next: ClockSample,
  toleranceMs = 2 * MINUTE,
): ClockAnomaly {
  if (prev.tzOffsetMin !== next.tzOffsetMin) {
    return { kind: 'timezone_changed', fromOffsetMin: prev.tzOffsetMin, toOffsetMin: next.tzOffsetMin };
  }
  // Se o monotónico recuou, o dispositivo reiniciou: não é possível comparar.
  if (next.monotonicMs < prev.monotonicMs) return { kind: 'none' };
  const drift = next.wallMs - prev.wallMs - (next.monotonicMs - prev.monotonicMs);
  if (Math.abs(drift) > toleranceMs) return { kind: 'clock_moved', driftMs: drift };
  return { kind: 'none' };
}
