import {
  challengeEndsAt,
  createChallenge,
  dayKey,
  isChallengeActive,
  type Challenge,
  type ChallengeGoal,
  type ShieldCategory,
} from '@acorde/core';
import { randomUUID } from 'expo-crypto';
import { shield } from '@/native/device';
import { addCheckin, listChallenges, listCheckins, saveChallenge } from '@/repositories/challenges';
import { usePrefs } from '@/stores/prefs';
import { applyShield } from './shield';

export const GOAL_CATEGORY: Record<ChallengeGoal, ShieldCategory> = { avoid_porn: 'adult', avoid_gambling: 'gambling' };

export const GOAL_LABEL: Record<ChallengeGoal, string> = {
  avoid_porn: 'Livre de pornografia',
  avoid_gambling: 'Livre de apostas',
};

/** Desafios em curso (um por objectivo). */
export async function activeChallenges(now = new Date()): Promise<Challenge[]> {
  return (await listChallenges()).filter((c) => isChallengeActive(c, now));
}

/** Data (epoch ms) até à qual a protecção está bloqueada; 0 se não houver desafio. */
export async function protectionLockedUntil(now = new Date()): Promise<number> {
  const active = await activeChallenges(now);
  return active.reduce((max, c) => Math.max(max, challengeEndsAt(c)), 0);
}

/**
 * Começa um desafio: activa e bloqueia a categoria de sites correspondente até
 * à data-limite. Durante esse período não é possível desligar a protecção no
 * aplicativo, e o filtro é religado automaticamente se a VPN for desligada.
 */
export async function startChallenges(goals: ChallengeGoal[], days: number, now = new Date()) {
  const created: Challenge[] = [];
  for (const goal of goals) {
    const c = createChallenge({ id: randomUUID(), goal, days, today: now, now: now.getTime() });
    await saveChallenge(c);
    created.push(c);
  }
  await enforceChallengeLock(now);
  return created;
}

/** Garante que as categorias dos desafios activos estão ligadas e bloqueadas. */
export async function enforceChallengeLock(now = new Date()) {
  const active = await activeChallenges(now);
  if (active.length === 0) return { status: 'none' as const };
  const { prefs, update } = usePrefs.getState();
  const categories = { ...prefs.shield.categories };
  for (const c of active) categories[GOAL_CATEGORY[c.goal]] = true;
  const next = { ...prefs.shield, categories };
  await update({ shield: next });
  const until = Math.max(...active.map(challengeEndsAt));
  const result = await applyShield(next);
  await shield.lock(until).catch(() => null);
  return { status: 'locked' as const, until, shield: result };
}

export async function checkIn(challenge: Challenge, status: 'clean' | 'relapse', now = new Date()) {
  await addCheckin(challenge.id, { day: dayKey(now), status });
}

export { listCheckins };
