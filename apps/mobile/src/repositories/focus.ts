import { getDb } from '@/database/db';

export interface FocusSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number | null;
  plannedMs: number;
  actualMs: number;
  status: 'running' | 'completed' | 'cancelled';
  mode: 'timer' | 'pomodoro' | 'activity';
  activity: string | null;
}

export async function saveFocusSession(s: FocusSessionRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO focus_sessions (id, started_at, ended_at, planned_ms, actual_ms, status, mode, activity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ended_at = excluded.ended_at, actual_ms = excluded.actual_ms, status = excluded.status`,
    s.id,
    s.startedAt,
    s.endedAt,
    s.plannedMs,
    s.actualMs,
    s.status,
    s.mode,
    s.activity,
  );
}

export async function focusSessionsBetween(fromMs: number, toMs: number): Promise<FocusSessionRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    started_at: number;
    ended_at: number | null;
    planned_ms: number;
    actual_ms: number;
    status: FocusSessionRecord['status'];
    mode: FocusSessionRecord['mode'];
    activity: string | null;
  }>('SELECT * FROM focus_sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC', fromMs, toMs);
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    plannedMs: r.planned_ms,
    actualMs: r.actual_ms,
    status: r.status,
    mode: r.mode,
    activity: r.activity,
  }));
}
