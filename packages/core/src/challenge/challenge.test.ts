import { describe, expect, it } from 'vitest';
import {
  type CheckIn,
  canCheckIn,
  challengeCalendar,
  challengeEndsAt,
  challengeLength,
  challengeStats,
  createChallenge,
  isChallengeActive,
  rewardForDay,
} from './index';

const today = new Date(2026, 9, 25, 10); // 25 de Outubro
const c = createChallenge({ id: 'c1', goal: 'avoid_porn', days: 30, today, now: 0 });

describe('desafio', () => {
  it('cria do dia de hoje até à data-limite (inclusive)', () => {
    expect(c.startDay).toBe('2026-10-25');
    expect(c.endDay).toBe('2026-11-23');
    expect(challengeLength(c)).toBe(30);
    expect(new Date(challengeEndsAt(c)).getDate()).toBe(24);
  });

  it('rejeita durações fora do intervalo', () => {
    expect(() => createChallenge({ id: 'x', goal: 'avoid_gambling', days: 1, today, now: 0 })).toThrow();
    expect(() => createChallenge({ id: 'x', goal: 'avoid_gambling', days: 400, today, now: 0 })).toThrow();
  });

  it('recompensas diárias e marcos especiais', () => {
    expect(rewardForDay(1)).toMatchObject({ title: 'Primeiro passo', milestone: true });
    expect(rewardForDay(7).milestone).toBe(true);
    expect(rewardForDay(2).milestone).toBe(false);
    expect(rewardForDay(30).title).toBe('Um mês');
  });

  it('calendário marca hoje, futuro, dias limpos, recaídas e falhados', () => {
    const later = new Date(2026, 9, 29, 9);
    const cal = challengeCalendar(
      c,
      [
        { day: '2026-10-25', status: 'clean' },
        { day: '2026-10-26', status: 'clean' },
        { day: '2026-10-27', status: 'relapse' },
      ],
      later,
    );
    expect(cal.slice(0, 6).map((d) => d.status)).toEqual(['clean', 'clean', 'relapse', 'missed', 'today', 'future']);
  });

  it('sequência actual, melhor sequência e progresso', () => {
    const later = new Date(2026, 9, 30, 9);
    const s = challengeStats(
      c,
      [
        ...['2026-10-25', '2026-10-26', '2026-10-28', '2026-10-29'].map((day): CheckIn => ({ day, status: 'clean' })),
        { day: '2026-10-27', status: 'relapse' },
      ],
      later,
    );
    expect(s.clean).toBe(4);
    expect(s.currentStreak).toBe(2); // 28 e 29 (hoje, 30, ainda por marcar)
    expect(s.bestStreak).toBe(2);
    expect(s.dayNumber).toBe(6);
    expect(s.daysLeft).toBe(25);
    expect(s.rewardsUnlocked).toHaveLength(4);
  });

  it('check-in só hoje e uma vez por dia', () => {
    expect(canCheckIn(c, [], today)).toBe(true);
    expect(canCheckIn(c, [{ day: '2026-10-25', status: 'clean' }], today)).toBe(false);
    expect(isChallengeActive(c, new Date(2026, 10, 24))).toBe(false);
  });
});
