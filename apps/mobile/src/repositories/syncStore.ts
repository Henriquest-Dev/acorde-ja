import type { SyncItem, SyncStore } from '@acorde/core';
import { getDb } from '@/database/db';

interface Row {
  id: string;
  tbl: string;
  op: SyncItem['op'];
  row_id: string;
  payload: string;
  created_at: number;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  status: SyncItem['status'];
}

const toItem = (r: Row): SyncItem => ({
  id: r.id,
  table: r.tbl,
  op: r.op,
  rowId: r.row_id,
  payload: JSON.parse(r.payload) as Record<string, unknown>,
  createdAt: r.created_at,
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  lastError: r.last_error,
  status: r.status,
});

/** Implementação SQLite da fila de sincronização (persistente entre reinícios). */
export const sqliteSyncStore: SyncStore = {
  async insert(item) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR IGNORE INTO sync_queue (id, tbl, op, row_id, payload, created_at, attempts, next_attempt_at, last_error, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      item.id,
      item.table,
      item.op,
      item.rowId,
      JSON.stringify(item.payload),
      item.createdAt,
      item.attempts,
      item.nextAttemptAt,
      item.lastError,
      item.status,
    );
  },
  async due(now, limit) {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>(
      "SELECT * FROM sync_queue WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at LIMIT ?",
      now,
      limit,
    );
    return rows.map(toItem);
  },
  async update(item) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE sync_queue SET payload = ?, attempts = ?, next_attempt_at = ?, last_error = ?, status = ? WHERE id = ?',
      JSON.stringify(item.payload),
      item.attempts,
      item.nextAttemptAt,
      item.lastError,
      item.status,
      item.id,
    );
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
  },
  async findPendingForRow(table, rowId) {
    const db = await getDb();
    const r = await db.getFirstAsync<Row>(
      "SELECT * FROM sync_queue WHERE status = 'pending' AND tbl = ? AND row_id = ? ORDER BY created_at DESC LIMIT 1",
      table,
      rowId,
    );
    return r ? toItem(r) : undefined;
  },
  async counts() {
    const db = await getDb();
    const r = await db.getFirstAsync<{ pending: number; dead: number }>(
      "SELECT SUM(status = 'pending') AS pending, SUM(status = 'dead') AS dead FROM sync_queue",
    );
    return { pending: r?.pending ?? 0, dead: r?.dead ?? 0 };
  },
};

export async function deadLetters(): Promise<SyncItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>("SELECT * FROM sync_queue WHERE status = 'dead' ORDER BY created_at DESC LIMIT 50");
  return rows.map(toItem);
}

export async function retryDeadLetters(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE sync_queue SET status = 'pending', attempts = 0, next_attempt_at = ? WHERE status = 'dead'", Date.now());
}
