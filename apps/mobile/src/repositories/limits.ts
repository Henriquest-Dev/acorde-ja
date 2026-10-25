import { DEFAULT_APPS, appLimitSchema, type BlockSchedule } from '@acorde/core';
import { getDb, inTransaction } from '@/database/db';

export interface AppLimit {
  appId: string;
  name: string;
  packageNames: string[];
  limitMinutes: number;
  enabled: boolean;
  sort: number;
}

interface LimitRow {
  app_id: string;
  name: string;
  package_names: string;
  limit_minutes: number;
  enabled: number;
  sort: number;
}

const toLimit = (r: LimitRow): AppLimit => ({
  appId: r.app_id,
  name: r.name,
  packageNames: JSON.parse(r.package_names) as string[],
  limitMinutes: r.limit_minutes,
  enabled: r.enabled === 1,
  sort: r.sort,
});

export async function listLimits(): Promise<AppLimit[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LimitRow>('SELECT * FROM app_limits ORDER BY sort, name');
  return rows.map(toLimit);
}

/** Cria os limites iniciais do onboarding (Instagram 30, TikTok 20, Facebook 20, YouTube 40). */
export async function ensureDefaultLimits(): Promise<void> {
  const db = await getDb();
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM app_limits');
  if ((count?.n ?? 0) > 0) return;
  const now = Date.now();
  await inTransaction(db, async (tx) => {
    for (const [i, app] of DEFAULT_APPS.entries()) {
      await tx.runAsync(
        'INSERT INTO app_limits (app_id, name, package_names, limit_minutes, enabled, sort, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        app.id,
        app.name,
        JSON.stringify(app.androidPackages),
        app.defaultLimitMinutes,
        i,
        now,
      );
    }
  });
}

export async function upsertLimit(limit: Omit<AppLimit, 'sort'> & { sort?: number }): Promise<AppLimit> {
  appLimitSchema.parse(limit);
  const db = await getDb();
  const sort = limit.sort ?? (await db.getFirstAsync<{ s: number }>('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM app_limits'))?.s ?? 0;
  await db.runAsync(
    `INSERT INTO app_limits (app_id, name, package_names, limit_minutes, enabled, sort, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(app_id) DO UPDATE SET name = excluded.name, package_names = excluded.package_names,
       limit_minutes = excluded.limit_minutes, enabled = excluded.enabled, updated_at = excluded.updated_at`,
    limit.appId,
    limit.name,
    JSON.stringify(limit.packageNames),
    limit.limitMinutes,
    limit.enabled ? 1 : 0,
    sort,
    Date.now(),
  );
  return { ...limit, sort };
}

export async function deleteLimit(appId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM app_limits WHERE app_id = ?', appId);
}

interface ScheduleRow {
  id: string;
  label: string;
  enabled: number;
  start: string;
  end: string;
  days: string;
  app_ids: string;
}

export type LabeledSchedule = BlockSchedule & { label: string };

export async function listSchedules(): Promise<LabeledSchedule[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ScheduleRow>('SELECT * FROM schedules ORDER BY start');
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    enabled: r.enabled === 1,
    start: r.start,
    end: r.end,
    days: JSON.parse(r.days) as number[],
    appIds: JSON.parse(r.app_ids) as string[],
  }));
}

export async function upsertSchedule(s: LabeledSchedule): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO schedules (id, label, enabled, start, "end", days, app_ids, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, enabled = excluded.enabled, start = excluded.start,
       "end" = excluded."end", days = excluded.days, app_ids = excluded.app_ids, updated_at = excluded.updated_at`,
    s.id,
    s.label,
    s.enabled ? 1 : 0,
    s.start,
    s.end,
    JSON.stringify(s.days),
    JSON.stringify(s.appIds),
    Date.now(),
  );
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM schedules WHERE id = ?', id);
}

/** Horário nocturno por defeito (22:00–07:00), desactivado até o utilizador o ligar. */
export const NIGHT_SCHEDULE_ID = 'night';
export async function ensureDefaultSchedule(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT id FROM schedules WHERE id = ?', NIGHT_SCHEDULE_ID);
  if (row) return;
  await upsertSchedule({
    id: NIGHT_SCHEDULE_ID,
    label: 'Horário de bloqueio',
    enabled: false,
    start: '22:00',
    end: '07:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    appIds: [],
  });
}
