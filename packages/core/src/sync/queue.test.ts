import { describe, expect, it } from 'vitest';
import { MemorySyncStore, SyncQueue, backoffDelay, resolveConflict, type SyncTransport } from './queue';

const opts = { baseMs: 1000, maxMs: 60_000, maxAttempts: 3, random: () => 0.5 };

function okTransport(seen: string[]): SyncTransport {
  return { push: async (items) => Object.fromEntries(items.map((i) => (seen.push(i.id), [i.id, { ok: true as const }]))) };
}

describe('SyncQueue', () => {
  it('envia e remove itens após sucesso', async () => {
    const store = new MemorySyncStore();
    const q = new SyncQueue(store, opts);
    await q.enqueue({ id: 'e1', table: 'habit_entries', op: 'append', rowId: 'h1', payload: { a: 1 }, now: 0 });
    const seen: string[] = [];
    expect(await q.flush(okTransport(seen), 0)).toEqual({ sent: 1, failed: 0, dead: 0 });
    expect(seen).toEqual(['e1']);
    expect(await q.counts()).toEqual({ pending: 0, dead: 0 });
  });

  it('protege contra duplicação: o mesmo id não é enfileirado duas vezes', async () => {
    const store = new MemorySyncStore();
    const q = new SyncQueue(store, opts);
    await q.enqueue({ id: 'e1', table: 'block_events', op: 'append', rowId: 'r', payload: {}, now: 0 });
    await q.enqueue({ id: 'e1', table: 'block_events', op: 'append', rowId: 'r', payload: {}, now: 0 });
    expect((await q.counts()).pending).toBe(1);
  });

  it('funde upserts sobre a mesma linha', async () => {
    const store = new MemorySyncStore();
    const q = new SyncQueue(store, opts);
    await q.enqueue({ id: 'a', table: 'app_limits', op: 'upsert', rowId: 'insta', payload: { limit: 30, enabled: true }, now: 0 });
    await q.enqueue({ id: 'b', table: 'app_limits', op: 'upsert', rowId: 'insta', payload: { limit: 25 }, now: 1 });
    const items = await store.due(10, 10);
    expect(items).toHaveLength(1);
    expect(items[0]!.payload).toEqual({ limit: 25, enabled: true });
  });

  it('falha na sincronização (sem Internet): reagenda com backoff e reenvia após reconexão', async () => {
    const store = new MemorySyncStore();
    const q = new SyncQueue(store, opts);
    await q.enqueue({ id: 'e1', table: 'focus_sessions', op: 'upsert', rowId: 'f1', payload: {}, now: 0 });
    const offline: SyncTransport = { push: async () => { throw new Error('Network request failed'); } };
    expect(await q.flush(offline, 0)).toEqual({ sent: 0, failed: 1, dead: 0 });
    const item = store.items.get('e1')!;
    expect(item.attempts).toBe(1);
    expect(item.lastError).toBe('Network request failed');
    expect(item.nextAttemptAt).toBe(750); // 1000/2 + 0.5*1000/2
    // Antes do backoff nada é enviado.
    const seen: string[] = [];
    expect((await q.flush(okTransport(seen), 500)).sent).toBe(0);
    expect((await q.flush(okTransport(seen), 750)).sent).toBe(1);
  });

  it('move para dead letter após o máximo de tentativas ou erro não recuperável', async () => {
    const store = new MemorySyncStore();
    const q = new SyncQueue(store, opts);
    await q.enqueue({ id: 'e1', table: 't', op: 'append', rowId: 'r', payload: {}, now: 0 });
    await q.enqueue({ id: 'e2', table: 't', op: 'append', rowId: 'r2', payload: {}, now: 0 });
    const t: SyncTransport = {
      push: async (items) =>
        Object.fromEntries(items.map((i) => [i.id, { ok: false as const, error: 'x', retryable: i.id === 'e1' }])),
    };
    await q.flush(t, 0);
    expect(store.items.get('e2')!.status).toBe('dead');
    await q.flush(t, 10_000);
    await q.flush(t, 100_000);
    expect(store.items.get('e1')!.status).toBe('dead');
    expect(await q.counts()).toEqual({ pending: 0, dead: 2 });
  });

  it('backoff cresce exponencialmente com tecto', () => {
    expect(backoffDelay(1, opts)).toBe(750);
    expect(backoffDelay(2, opts)).toBe(1500);
    expect(backoffDelay(20, opts)).toBe(45_000);
  });
});

describe('resolveConflict', () => {
  it('last-writer-wins', () => {
    const a = { id: 1, updated_at: '2026-05-12T10:00:00Z', v: 'local' };
    const b = { id: 1, updated_at: '2026-05-12T11:00:00Z', v: 'remote' };
    expect(resolveConflict(a, b).v).toBe('remote');
    expect(resolveConflict(b, a).v).toBe('remote');
  });
  it('eliminação prevalece em empate', () => {
    const a: { updated_at: number; deleted_at: number | null } = { updated_at: 5, deleted_at: 5 };
    const b: { updated_at: number; deleted_at: number | null } = { updated_at: 5, deleted_at: null };
    expect(resolveConflict(a, b)).toBe(a);
  });
});
