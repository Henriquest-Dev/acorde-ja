/**
 * Hábitos: frequência, cumprimento e evolução.
 * Deliberadamente sem "streaks", pontos ou recompensas que incentivem o uso
 * compulsivo do próprio aplicativo — mostramos apenas taxas de cumprimento.
 */

import { addDays, dayKey, startOfWeek } from '../time';

export type HabitFrequency =
  | { kind: 'daily' }
  /** Dias específicos da semana (0 = domingo … 6 = sábado). */
  | { kind: 'weekdays'; days: number[] }
  /** N vezes por semana, em quaisquer dias. */
  | { kind: 'times_per_week'; times: number };

export interface Habit {
  id: string;
  title: string;
  icon: string;
  frequency: HabitFrequency;
  /** Objectivo opcional, ex.: "20 minutos". */
  target: string | null;
  reminderTime: string | null;
  archivedAt: number | null;
  createdAt: number;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  day: string;
  completedAt: number;
}

export function isDueOn(habit: Habit, date: Date): boolean {
  if (habit.archivedAt !== null && habit.archivedAt <= date.getTime()) return false;
  switch (habit.frequency.kind) {
    case 'daily':
    case 'times_per_week':
      return true;
    case 'weekdays':
      return habit.frequency.days.includes(date.getDay());
  }
}

export function isDoneOn(habitId: string, day: string, entries: HabitEntry[]): boolean {
  return entries.some((e) => e.habitId === habitId && e.day === day);
}

/** Alterna a conclusão de um hábito num dia (idempotente por dia). */
export function toggleEntry(
  entries: HabitEntry[],
  habitId: string,
  day: string,
  makeId: () => string,
  now: number,
): { entries: HabitEntry[]; added: HabitEntry | null; removed: HabitEntry | null } {
  const existing = entries.find((e) => e.habitId === habitId && e.day === day);
  if (existing) return { entries: entries.filter((e) => e !== existing), added: null, removed: existing };
  const added = { id: makeId(), habitId, day, completedAt: now };
  return { entries: [...entries, added], added, removed: null };
}

/** Progresso semanal de um hábito: concluídos vs. esperados. */
export function weeklyProgress(habit: Habit, entries: HabitEntry[], reference: Date) {
  const monday = startOfWeek(reference);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const done = days.filter((d) => isDoneOn(habit.id, dayKey(d), entries)).length;
  let expected: number;
  switch (habit.frequency.kind) {
    case 'daily':
      expected = 7;
      break;
    case 'weekdays':
      expected = habit.frequency.days.length;
      break;
    case 'times_per_week':
      expected = habit.frequency.times;
      break;
  }
  return { done, expected, ratio: expected > 0 ? Math.min(1, done / expected) : 0, days: days.map(dayKey) };
}

/** Resumo do dia para o dashboard. */
export function todaySummary(habits: Habit[], entries: HabitEntry[], today: Date) {
  const key = dayKey(today);
  const due = habits.filter((h) => isDueOn(h, today));
  const done = due.filter((h) => isDoneOn(h.id, key, entries));
  return { due: due.length, done: done.length };
}

export function describeFrequency(f: HabitFrequency): string {
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  switch (f.kind) {
    case 'daily':
      return 'Todos os dias';
    case 'weekdays':
      return [...f.days].sort().map((d) => names[d]).join(', ');
    case 'times_per_week':
      return `${f.times}× por semana`;
  }
}

export const HABIT_SUGGESTIONS: { title: string; icon: string; target: string | null }[] = [
  { title: 'Ler 20 minutos', icon: 'book-open', target: '20 minutos' },
  { title: 'Exercício físico', icon: 'activity', target: null },
  { title: 'Meditar', icon: 'meditate', target: '10 minutos' },
  { title: 'Beber água', icon: 'water', target: '2 litros' },
  { title: 'Escrever no diário', icon: 'edit-3', target: null },
  { title: 'Dormir cedo', icon: 'moon', target: 'Antes das 23:00' },
];
