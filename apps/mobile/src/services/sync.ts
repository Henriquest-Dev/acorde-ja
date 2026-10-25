import { SyncQueue, type SyncItem, type SyncTransport } from '@acorde/core';
import { randomUUID } from 'expo-crypto';
import { sqliteSyncStore } from '@/repositories/syncStore';
import { usePrefs } from '@/stores/prefs';
import { getSupabase } from './supabase';

/**
 * Tabelas remotas sincronizáveis e se contêm dados comportamentais sensíveis
 * (exigem o consentimento específico `syncSensitive`).
 */
const REMOTE_TABLES: Record<string, { sensitive: boolean; conflict: string; key: string }> = {
  app_limits: { sensitive: false, conflict: 'user_id,app_id', key: 'app_id' },
  usage_daily: { sensitive: false, conflict: 'user_id,device_id,day,app_id', key: 'id' },
  focus_sessions: { sensitive: false, conflict: 'id', key: 'id' },
  block_events: { sensitive: false, conflict: 'id', key: 'id' },
  override_requests: { sensitive: false, conflict: 'id', key: 'id' },
  habits: { sensitive: true, conflict: 'id', key: 'id' },
  habit_entries: { sensitive: true, conflict: 'id', key: 'id' },
  recovery_checkins: { sensitive: true, conflict: 'id', key: 'id' },
};

export const syncQueue = new SyncQueue(sqliteSyncStore);

/** Enfileira uma alteração para sincronização — apenas com consentimento. */
export async function enqueueSync(table: keyof typeof REMOTE_TABLES, op: SyncItem['op'], rowId: string, payload: Record<string, unknown>) {
  const { prefs } = usePrefs.getState();
  if (!prefs.cloudSync) return;
  if (REMOTE_TABLES[table]?.sensitive && !prefs.syncSensitive) return;
  await syncQueue.enqueue({ id: randomUUID(), table, op, rowId, payload, now: Date.now() });
}

/** Erros PostgREST que não vale a pena repetir (dados inválidos, RLS). */
function isRetryable(code: string | undefined, status: number | undefined) {
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return !(code && /^(22|23|42)/.test(code));
}

const supabaseTransport: SyncTransport = {
  async push(items) {
    const sb = getSupabase();
    if (!sb) throw new Error('Servidor não configurado');
    const { data: session } = await sb.auth.getSession();
    if (!session.session) throw new Error('Sessão não iniciada');
    const results: Awaited<ReturnType<SyncTransport['push']>> = {};
    for (const item of items) {
      let res;
      const cfg = REMOTE_TABLES[item.table];
      if (!cfg) {
        results[item.id] = { ok: false, error: `tabela desconhecida: ${item.table}`, retryable: false };
        continue;
      }
      if (item.op === 'delete') {
        res = await sb.from(item.table).delete().eq(cfg.key, item.rowId);
      } else {
        // A chave única (ou o id gerado no dispositivo) torna o reenvio idempotente.
        const row = { ...item.payload, client_event_id: item.id };
        res = await sb.from(item.table).upsert(row, { onConflict: cfg.conflict });
      }
      results[item.id] = res.error
        ? { ok: false, error: res.error.message, retryable: isRetryable(res.error.code, res.status) }
        : { ok: true };
    }
    return results;
  },
};

let flushing = false;
export async function flushSync(): Promise<{ sent: number; failed: number; dead: number } | null> {
  if (flushing || !usePrefs.getState().prefs.cloudSync) return null;
  flushing = true;
  try {
    return await syncQueue.flush(supabaseTransport, Date.now());
  } finally {
    flushing = false;
  }
}
