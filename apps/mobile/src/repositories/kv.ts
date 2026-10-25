import { getDb } from '@/database/db';

/** Armazenamento chave-valor tipado sobre SQLite (preferências, estado do onboarding…). */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    key,
    JSON.stringify(value),
    Date.now(),
  );
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM kv WHERE key = ?', key);
}
