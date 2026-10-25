import type { Challenge, ChallengeGoal, CheckIn } from '@acorde/core';
import { getDb } from '@/database/db';

interface Row {
  id: string;
  goal: ChallengeGoal;
  start_day: string;
  end_day: string;
  created_at: number;
  ended_at: number | null;
}

const toChallenge = (r: Row): Challenge => ({
  id: r.id,
  goal: r.goal,
  startDay: r.start_day,
  endDay: r.end_day,
  createdAt: r.created_at,
  endedAt: r.ended_at,
});

export async function listChallenges(): Promise<Challenge[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM challenges ORDER BY created_at DESC');
  return rows.map(toChallenge);
}

export async function saveChallenge(c: Challenge): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO challenges (id, goal, start_day, end_day, created_at, ended_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET end_day = excluded.end_day, ended_at = excluded.ended_at`,
    c.id,
    c.goal,
    c.startDay,
    c.endDay,
    c.createdAt,
    c.endedAt,
  );
}

export async function listCheckins(challengeId: string): Promise<CheckIn[]> {
  const db = await getDb();
  return db.getAllAsync<CheckIn>('SELECT day, status FROM challenge_checkins WHERE challenge_id = ? ORDER BY day', challengeId);
}

export async function addCheckin(challengeId: string, checkin: CheckIn): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO challenge_checkins (challenge_id, day, status, created_at) VALUES (?, ?, ?, ?)',
    challengeId,
    checkin.day,
    checkin.status,
    Date.now(),
  );
}
