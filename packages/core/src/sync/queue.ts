/**
 * Fila de sincronização offline-first.
 *
 * - Cada operação tem um `id` (UUID gerado no dispositivo) que serve de chave
 *   de idempotência no servidor (`client_event_id`), evitando duplicados.
 * - Falhas são reagendadas com backoff exponencial e jitter.
 * - Após `maxAttempts` a operação vai para "dead letter" e fica registada.
 * - O armazenamento é injectado (SQLite no telemóvel, memória nos testes).
 */

export type SyncOperation = 'upsert' | 'delete' | 'append';

export interface SyncItem {
  id: string;
  table: string;
  op: SyncOperation;
  /** Id da linha alvo (para upsert/delete). */
  rowId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  status: 'pending' | 'dead';
}

export interface SyncStore {
  insert(item: SyncItem): Promise<void>;
  /** Devolve itens pendentes cujo `nextAttemptAt <= now`, por ordem de criação. */
  due(now: number, limit: number): Promise<SyncItem[]>;
  update(item: SyncItem): Promise<void>;
  remove(id: string): Promise<void>;
  findPendingForRow(table: string, rowId: string): Promise<SyncItem | undefined>;
  counts(): Promise<{ pending: number; dead: number }>;
}

export interface SyncTransport {
  /** Envia um lote; devolve, por id, sucesso ou o erro. Deve ser idempotente. */
  push(items: SyncItem[]): Promise<Record<string, { ok: true } | { ok: false; error: string; retryable: boolean }>>;
}

export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
  maxAttempts: number;
  /** Fonte de aleatoriedade [0,1) — injectável para testes. */
  random: () => number;
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 2_000,
  maxMs: 30 * 60_000,
  maxAttempts: 8,
  random: Math.random,
};

export function backoffDelay(attempts: number, opts: BackoffOptions): number {
  const exp = Math.min(opts.maxMs, opts.baseMs * 2 ** Math.max(0, attempts - 1));
  // "Equal jitter": metade fixa + metade aleatória.
  return Math.round(exp / 2 + (opts.random() * exp) / 2);
}

export class SyncQueue {
  constructor(
    private readonly store: SyncStore,
    private readonly backoff: BackoffOptions = DEFAULT_BACKOFF,
  ) {}

  /**
   * Enfileira uma operação. Upserts consecutivos sobre a mesma linha são
   * fundidos (o último estado vence), reduzindo tráfego e conflitos.
   */
  async enqueue(params: {
    id: string;
    table: string;
    op: SyncOperation;
    rowId: string;
    payload: Record<string, unknown>;
    now: number;
  }): Promise<SyncItem> {
    if (params.op === 'upsert') {
      const existing = await this.store.findPendingForRow(params.table, params.rowId);
      if (existing && existing.op === 'upsert' && existing.attempts === 0) {
        const merged: SyncItem = { ...existing, payload: { ...existing.payload, ...params.payload } };
        await this.store.update(merged);
        return merged;
      }
    }
    const item: SyncItem = {
      id: params.id,
      table: params.table,
      op: params.op,
      rowId: params.rowId,
      payload: params.payload,
      createdAt: params.now,
      attempts: 0,
      nextAttemptAt: params.now,
      lastError: null,
      status: 'pending',
    };
    await this.store.insert(item);
    return item;
  }

  /** Processa um lote. Seguro de chamar repetidamente (após reconexão, etc.). */
  async flush(transport: SyncTransport, now: number, batchSize = 50) {
    const items = await this.store.due(now, batchSize);
    const summary = { sent: 0, failed: 0, dead: 0 };
    if (items.length === 0) return summary;

    let results: Awaited<ReturnType<SyncTransport['push']>>;
    try {
      results = await transport.push(items);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results = Object.fromEntries(items.map((i) => [i.id, { ok: false as const, error: message, retryable: true }]));
    }

    for (const item of items) {
      const r = results[item.id] ?? { ok: false as const, error: 'sem resposta do servidor', retryable: true };
      if (r.ok) {
        await this.store.remove(item.id);
        summary.sent++;
        continue;
      }
      const attempts = item.attempts + 1;
      if (!r.retryable || attempts >= this.backoff.maxAttempts) {
        await this.store.update({ ...item, attempts, lastError: r.error, status: 'dead' });
        summary.dead++;
      } else {
        await this.store.update({
          ...item,
          attempts,
          lastError: r.error,
          nextAttemptAt: now + backoffDelay(attempts, this.backoff),
        });
        summary.failed++;
      }
    }
    return summary;
  }

  counts() {
    return this.store.counts();
  }
}

/** Armazenamento em memória (testes e web sem persistência). */
export class MemorySyncStore implements SyncStore {
  items = new Map<string, SyncItem>();
  async insert(item: SyncItem) {
    if (this.items.has(item.id)) return; // idempotente
    this.items.set(item.id, item);
  }
  async due(now: number, limit: number) {
    return [...this.items.values()]
      .filter((i) => i.status === 'pending' && i.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);
  }
  async update(item: SyncItem) {
    this.items.set(item.id, item);
  }
  async remove(id: string) {
    this.items.delete(id);
  }
  async findPendingForRow(table: string, rowId: string) {
    return [...this.items.values()].find((i) => i.status === 'pending' && i.table === table && i.rowId === rowId);
  }
  async counts() {
    const all = [...this.items.values()];
    return { pending: all.filter((i) => i.status === 'pending').length, dead: all.filter((i) => i.status === 'dead').length };
  }
}

export interface Versioned {
  updated_at: string | number;
  deleted_at?: string | number | null;
}

/**
 * Resolução de conflitos para entidades mutáveis: last-writer-wins pelo
 * `updated_at`, com eliminações (tombstones) a prevalecer em caso de empate.
 * Eventos append-only (block_events, habit_entries) nunca entram em conflito
 * porque são deduplicados pelo id.
 */
export function resolveConflict<T extends Versioned>(local: T, remote: T): T {
  const l = new Date(local.updated_at).getTime();
  const r = new Date(remote.updated_at).getTime();
  if (l === r) return local.deleted_at ? local : remote.deleted_at ? remote : remote;
  return l > r ? local : remote;
}
