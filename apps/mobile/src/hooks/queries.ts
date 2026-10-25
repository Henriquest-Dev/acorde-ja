import {
  addDays,
  buildReport,
  dayKey,
  percentChange,
  periodRange,
  previousReference,
  startOfWeek,
  type ReportPeriod,
} from '@acorde/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { focusSessionsBetween } from '@/repositories/focus';
import { entriesBetween, listHabits } from '@/repositories/habits';
import { listLimits, listSchedules } from '@/repositories/limits';
import { SCREEN_TOTAL_ID, exceptionsBetween, usageBetween } from '@/repositories/usage';
import { challengeStats } from '@acorde/core';
import { listChallenges, listCheckins } from '@/repositories/challenges';
import { GOAL_LABEL, activeChallenges } from '@/services/challenge';
import { loadHourly, loadToday } from '@/services/usage';

export const qk = {
  today: ['today'] as const,
  limits: ['limits'] as const,
  schedules: ['schedules'] as const,
  habits: ['habits'] as const,
  report: (period: ReportPeriod, ref: string) => ['report', period, ref] as const,
  focus: (from: number) => ['focus', from] as const,
};

/** Snapshot de hoje (utilização real + estado das regras). Actualiza a cada minuto. */
export function useToday() {
  return useQuery({ queryKey: qk.today, queryFn: () => loadToday(), refetchInterval: 30_000 });
}

export function useLimits() {
  return useQuery({ queryKey: qk.limits, queryFn: listLimits });
}

export function useSchedules() {
  return useQuery({ queryKey: qk.schedules, queryFn: listSchedules });
}

export function useHabitsWeek(reference: Date) {
  const monday = startOfWeek(reference);
  return useQuery({
    queryKey: [...qk.habits, dayKey(monday)],
    queryFn: async () => {
      const [habits, entries] = await Promise.all([listHabits(), entriesBetween(dayKey(monday), dayKey(addDays(monday, 6)))]);
      return { habits, entries };
    },
  });
}

/** Relatório de um período, com comparação ao período anterior (dados reais). */
export function useReport(period: ReportPeriod, reference: Date) {
  return useQuery({
    queryKey: qk.report(period, dayKey(reference)),
    queryFn: async () => {
      const range = periodRange(period, reference);
      const prevRange = periodRange(period, previousReference(period, reference));
      const from = prevRange.days[0]!;
      const to = range.days[range.days.length - 1]!;
      const [rows, exceptions, limits] = await Promise.all([usageBetween(from, to), exceptionsBetween(range.days[0]!, to), listLimits()]);
      const appRows = rows.filter((r) => r.appId !== SCREEN_TOTAL_ID);
      const screenRows = rows.filter((r) => r.appId === SCREEN_TOTAL_ID);
      const report = buildReport(appRows, range);
      const screen = buildReport(screenRows, range);
      const prevScreen = buildReport(screenRows, prevRange);
      const sessions = await focusSessionsBetween(range.start.getTime(), range.end.getTime());
      return {
        range,
        report,
        screen,
        tracked: limits.map((l) => l.appId),
        change: prevScreen.hasData ? percentChange(screen.totalMs, prevScreen.totalMs) : null,
        exceptions,
        focusMs: sessions.filter((s) => s.status === 'completed').reduce((s, x) => s + x.actualMs, 0),
        focusCount: sessions.filter((s) => s.status === 'completed').length,
      };
    },
  });
}

export function useFocusHistory(fromMs: number) {
  return useQuery({ queryKey: qk.focus(fromMs), queryFn: () => focusSessionsBetween(fromMs, Date.now() + 1) });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly (readonly unknown[])[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

/** Tempo de ecrã por hora de hoje — actualiza a cada 30 s (gráfico ao vivo). */
export function useHourly() {
  return useQuery({ queryKey: ['hourly'], queryFn: () => loadHourly(), refetchInterval: 30_000 });
}

/** Desafios em curso com estatísticas (dia, sequência, progresso). */
export function useActiveChallenges() {
  return useQuery({
    queryKey: ['challenges', 'active'],
    queryFn: async () => {
      const now = new Date();
      const list = await activeChallenges(now);
      return Promise.all(
        list.map(async (c) => {
          const checkins = await listCheckins(c.id);
          return { challenge: c, checkins, label: GOAL_LABEL[c.goal], stats: challengeStats(c, checkins, now) };
        }),
      );
    },
  });
}

export function useAllChallenges() {
  return useQuery({ queryKey: ['challenges', 'all'], queryFn: listChallenges });
}
