import type { Habit, HabitEntry, HabitFrequency } from '@acorde/core';
import { getDb } from '@/database/db';

interface HabitRow {
  id: string;
  title: string;
  icon: string;
  frequency: string;
  target: string | null;
  reminder_time: string | null;
  reminder_ids: string;
  sort: number;
  archived_at: number | null;
  created_at: number;
}

export type StoredHabit = Habit & { reminderIds: string[]; sort: number };

const toHabit = (r: HabitRow): StoredHabit => ({
  id: r.id,
  title: r.title,
  icon: r.icon,
  frequency: JSON.parse(r.frequency) as HabitFrequency,
  target: r.target,
  reminderTime: r.reminder_time,
  reminderIds: JSON.parse(r.reminder_ids) as string[],
  sort: r.sort,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
});

export async function listHabits(includeArchived = false): Promise<StoredHabit[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT * FROM habits ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY sort, created_at`,
  );
  return rows.map(toHabit);
}

export async function getHabit(id: string): Promise<StoredHabit | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', id);
  return r ? toHabit(r) : null;
}

export async function saveHabit(h: StoredHabit): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO habits (id, title, icon, frequency, target, reminder_time, reminder_ids, sort, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, icon = excluded.icon, frequency = excluded.frequency,
       target = excluded.target, reminder_time = excluded.reminder_time, reminder_ids = excluded.reminder_ids,
       sort = excluded.sort, archived_at = excluded.archived_at, updated_at = excluded.updated_at`,
    h.id,
    h.title,
    h.icon,
    JSON.stringify(h.frequency),
    h.target,
    h.reminderTime,
    JSON.stringify(h.reminderIds),
    h.sort,
    h.archivedAt,
    h.createdAt,
    Date.now(),
  );
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM habits WHERE id = ?', id);
}

export async function entriesBetween(fromDay: string, toDay: string): Promise<HabitEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; habit_id: string; day: string; completed_at: number }>(
    'SELECT * FROM habit_entries WHERE day >= ? AND day <= ?',
    fromDay,
    toDay,
  );
  return rows.map((r) => ({ id: r.id, habitId: r.habit_id, day: r.day, completedAt: r.completed_at }));
}

export async function addEntry(e: HabitEntry): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO habit_entries (id, habit_id, day, completed_at) VALUES (?, ?, ?, ?)',
    e.id,
    e.habitId,
    e.day,
    e.completedAt,
  );
}

export async function removeEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM habit_entries WHERE id = ?', id);
}
