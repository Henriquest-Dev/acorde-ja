/**
 * Desafio de abstinência (pornografia / apostas) com calendário de recompensas.
 *
 * A pessoa escolhe uma data-limite no onboarding. Cada dia em que faz o
 * check-in («mantive-me firme») desbloqueia a recompensa desse dia; alguns dias
 * são marcos com recompensas especiais. Enquanto o desafio dura, a protecção
 * de sites fica bloqueada (ver services/challenge.ts).
 */

import { addDays, dayKey, parseDayKey, startOfLocalDay } from '../time';

export type ChallengeGoal = 'avoid_porn' | 'avoid_gambling';

export interface Challenge {
  id: string;
  goal: ChallengeGoal;
  /** Primeiro dia (YYYY-MM-DD). */
  startDay: string;
  /** Último dia, inclusive (YYYY-MM-DD). */
  endDay: string;
  createdAt: number;
  endedAt: number | null;
}

export interface CheckIn {
  day: string;
  status: 'clean' | 'relapse';
}

export interface Reward {
  icon: string;
  title: string;
  message: string;
  milestone: boolean;
}

export const CHALLENGE_PRESETS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
] as const;

export const MIN_CHALLENGE_DAYS = 3;
export const MAX_CHALLENGE_DAYS = 365;

const MILESTONES: Record<number, Omit<Reward, 'milestone'>> = {
  1: { icon: 'flag', title: 'Primeiro passo', message: 'O dia mais difícil é o primeiro. Já está feito.' },
  3: { icon: 'zap', title: 'Três dias firmes', message: 'O cérebro começa a recalibrar a recompensa.' },
  7: { icon: 'award', title: 'Uma semana livre', message: 'Sete dias seguidos. Isto é disciplina real.' },
  14: { icon: 'shield', title: 'Duas semanas', message: 'Os impulsos ficam mais fracos e mais espaçados.' },
  21: { icon: 'repeat', title: 'Novo hábito', message: '21 dias: a nova rotina está a ganhar raízes.' },
  30: { icon: 'star', title: 'Um mês', message: 'Um mês inteiro. Olhe para trás e veja a diferença.' },
  60: { icon: 'trending-up', title: 'Dois meses', message: 'Está a construir uma pessoa nova.' },
  90: { icon: 'sunrise', title: '90 dias', message: 'Três meses. A liberdade já é o seu normal.' },
  180: { icon: 'compass', title: 'Meio ano', message: 'Seis meses de escolhas certas.' },
  365: { icon: 'sun', title: 'Um ano', message: 'Um ano inteiro. Acordou mesmo.' },
};

const DAILY: Omit<Reward, 'milestone'>[] = [
  { icon: 'feather', title: 'Leveza', message: 'Mais um dia sem peso na consciência.' },
  { icon: 'heart', title: 'Cuidado', message: 'Cuidou de si hoje.' },
  { icon: 'sun', title: 'Clareza', message: 'Mente mais limpa, dia mais claro.' },
  { icon: 'anchor', title: 'Firmeza', message: 'Manteve-se firme. Orgulhe-se.' },
  { icon: 'wind', title: 'Respiro', message: 'Um dia de ar fresco para a mente.' },
  { icon: 'moon', title: 'Descanso', message: 'Durma bem: mereceu.' },
  { icon: 'droplet', title: 'Renovação', message: 'Cada dia limpo renova a sua energia.' },
];

/** Recompensa do n-ésimo dia do desafio (1 = primeiro dia). */
export function rewardForDay(n: number): Reward {
  const m = MILESTONES[n];
  if (m) return { ...m, milestone: true };
  return { ...DAILY[(n - 1) % DAILY.length]!, milestone: false };
}

export function createChallenge(params: { id: string; goal: ChallengeGoal; days: number; today: Date; now: number }): Challenge {
  const days = Math.round(params.days);
  if (days < MIN_CHALLENGE_DAYS || days > MAX_CHALLENGE_DAYS) throw new Error(`O desafio tem de durar entre ${MIN_CHALLENGE_DAYS} e ${MAX_CHALLENGE_DAYS} dias`);
  const start = startOfLocalDay(params.today);
  return {
    id: params.id,
    goal: params.goal,
    startDay: dayKey(start),
    endDay: dayKey(addDays(start, days - 1)),
    createdAt: params.now,
    endedAt: null,
  };
}

export function challengeLength(c: Challenge): number {
  return Math.round((parseDayKey(c.endDay).getTime() - parseDayKey(c.startDay).getTime()) / 86_400_000) + 1;
}

/** Fim do compromisso (meia-noite depois do último dia), em epoch ms. */
export function challengeEndsAt(c: Challenge): number {
  return addDays(parseDayKey(c.endDay), 1).getTime();
}

export function isChallengeActive(c: Challenge, now: Date): boolean {
  return c.endedAt === null && dayKey(now) <= c.endDay && dayKey(now) >= c.startDay;
}

export type CalendarStatus = 'clean' | 'relapse' | 'missed' | 'today' | 'future';

export interface CalendarDay {
  day: string;
  index: number;
  status: CalendarStatus;
  reward: Reward;
}

export function challengeCalendar(c: Challenge, checkins: CheckIn[], today: Date): CalendarDay[] {
  const todayKey = dayKey(today);
  const byDay = new Map(checkins.map((k) => [k.day, k.status]));
  const n = challengeLength(c);
  return Array.from({ length: n }, (_, i) => {
    const day = dayKey(addDays(parseDayKey(c.startDay), i));
    const recorded = byDay.get(day);
    let status: CalendarStatus;
    if (recorded) status = recorded;
    else if (day === todayKey) status = 'today';
    else if (day > todayKey) status = 'future';
    else status = 'missed';
    return { day, index: i + 1, status, reward: rewardForDay(i + 1) };
  });
}

export function challengeStats(c: Challenge, checkins: CheckIn[], today: Date) {
  const cal = challengeCalendar(c, checkins, today);
  const clean = cal.filter((d) => d.status === 'clean').length;
  let best = 0;
  let run = 0;
  for (const d of cal) {
    if (d.status === 'clean') best = Math.max(best, ++run);
    else if (d.status !== 'today' && d.status !== 'future') run = 0;
  }
  // Sequência actual: dias limpos consecutivos até hoje (hoje ainda por marcar não quebra).
  let current = 0;
  for (let i = cal.length - 1; i >= 0; i--) {
    const s = cal[i]!.status;
    if (s === 'future' || s === 'today') continue;
    if (s === 'clean') current++;
    else break;
  }
  const todayIdx = cal.findIndex((d) => d.day === dayKey(today));
  const total = cal.length;
  return {
    total,
    clean,
    currentStreak: current,
    bestStreak: best,
    dayNumber: todayIdx >= 0 ? todayIdx + 1 : dayKey(today) > c.endDay ? total : 0,
    daysLeft: Math.max(0, cal.filter((d) => d.status === 'future' || d.status === 'today').length),
    progress: total > 0 ? clean / total : 0,
    completed: dayKey(today) > c.endDay,
    rewardsUnlocked: cal.filter((d) => d.status === 'clean').map((d) => d.reward),
  };
}

/** Só se pode registar o dia de hoje (sem reescrever o passado). */
export function canCheckIn(c: Challenge, checkins: CheckIn[], today: Date): boolean {
  const key = dayKey(today);
  return isChallengeActive(c, today) && !checkins.some((k) => k.day === key);
}
