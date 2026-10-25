import { addDays, dayKey, startOfLocalDay, type ExceptionGrant, type OverrideReason, type UsageDailyRow } from '@acorde/core';
import { getDb } from '@/database/db';

/** Linha especial com o tempo de ecrã total do dia (todas as aplicações). */
export const SCREEN_TOTAL_ID = '__screen__';

interface UsageRow {
  day: string;
  app_id: string;
  app_name: string;
  used_ms: number;
  limit_ms: number | null;
  opens: number | null;
}

export async function upsertUsage(rows: UsageDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const r of rows) {
      await tx.runAsync(
        `INSERT INTO usage_daily (day, app_id, app_name, used_ms, limit_ms, opens, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(day, app_id) DO UPDATE SET app_name = excluded.app_name, used_ms = excluded.used_ms,
           limit_ms = excluded.limit_ms, opens = excluded.opens, updated_at = excluded.updated_at`,
        r.day,
        r.appId,
        r.appName,
        Math.round(r.usedMs),
        r.limitMs,
        r.opens,
        now,
      );
    }
  });
}

/** Substitui os dados de um dia (a medição do sistema é a fonte de verdade). */
export async function replaceDay(day: string, rows: UsageDailyRow[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM usage_daily WHERE day = ?', day);
  await upsertUsage(rows);
}

export async function usageBetween(fromDay: string, toDayInclusive: string): Promise<UsageDailyRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UsageRow>(
    'SELECT * FROM usage_daily WHERE day >= ? AND day <= ? ORDER BY day',
    fromDay,
    toDayInclusive,
  );
  return rows.map((r) => ({ day: r.day, appId: r.app_id, appName: r.app_name, usedMs: r.used_ms, limitMs: r.limit_ms, opens: r.opens }));
}

export async function daysWithData(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string }>('SELECT DISTINCT day FROM usage_daily ORDER BY day');
  return rows.map((r) => r.day);
}

export async function pruneUsageOlderThan(days: number, now = new Date()): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM usage_daily WHERE day < ?', dayKey(addDays(startOfLocalDay(now), -days)));
}

// --- Excepções (tempo extra) -------------------------------------------------

export async function exceptionsForDay(day: string): Promise<ExceptionGrant[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; app_id: string; day: string; extra_minutes: number; reason: string; granted_at: number }>(
    'SELECT * FROM exceptions WHERE day = ?',
    day,
  );
  return rows.map((r) => ({
    id: r.id,
    appId: r.app_id,
    day: r.day,
    extraMinutes: r.extra_minutes,
    reason: r.reason as OverrideReason,
    grantedAt: r.granted_at,
  }));
}

export async function insertException(g: ExceptionGrant): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO exceptions (id, app_id, day, extra_minutes, reason, granted_at) VALUES (?, ?, ?, ?, ?, ?)',
    g.id,
    g.appId,
    g.day,
    g.extraMinutes,
    g.reason,
    g.grantedAt,
  );
}

export async function exceptionsBetween(fromDay: string, toDay: string): Promise<ExceptionGrant[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; app_id: string; day: string; extra_minutes: number; reason: string; granted_at: number }>(
    'SELECT * FROM exceptions WHERE day >= ? AND day <= ?',
    fromDay,
    toDay,
  );
  return rows.map((r) => ({ id: r.id, appId: r.app_id, day: r.day, extraMinutes: r.extra_minutes, reason: r.reason as OverrideReason, grantedAt: r.granted_at }));
}

// --- Eventos de bloqueio -----------------------------------------------------

export interface BlockEvent {
  id: string;
  appId: string | null;
  kind: string;
  day: string;
  meta: Record<string, unknown>;
  createdAt: number;
}

export async function insertEvents(events: BlockEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const e of events) {
      await tx.runAsync(
        'INSERT OR IGNORE INTO block_events (id, app_id, kind, day, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        e.id,
        e.appId,
        e.kind,
        e.day,
        JSON.stringify(e.meta ?? {}),
        e.createdAt,
      );
    }
  });
}

export async function eventsBetween(fromDay: string, toDay: string): Promise<BlockEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; app_id: string | null; kind: string; day: string; meta: string; created_at: number }>(
    'SELECT * FROM block_events WHERE day >= ? AND day <= ? ORDER BY created_at DESC',
    fromDay,
    toDay,
  );
  return rows.map((r) => ({ id: r.id, appId: r.app_id, kind: r.kind, day: r.day, meta: JSON.parse(r.meta), createdAt: r.created_at }));
}
