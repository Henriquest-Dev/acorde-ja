import { getDb } from '@/database/db';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** "text" ou um cartão especial (ex.: "exercise:breathing"). */
  kind: string;
  createdAt: number;
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; conversation_id: string; role: ChatMessage['role']; content: string; kind: string; created_at: number }>(
    'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at',
    conversationId,
  );
  return rows.map((r) => ({ id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, kind: r.kind, createdAt: r.created_at }));
}

export async function addMessage(m: ChatMessage): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO chat_messages (id, conversation_id, role, content, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    m.id,
    m.conversationId,
    m.role,
    m.content,
    m.kind,
    m.createdAt,
  );
}

export async function clearConversation(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM chat_messages WHERE conversation_id = ?', conversationId);
}

export interface HelpOutcome {
  id: string;
  difficulty: string;
  strategy: string;
  outcome: 'helped' | 'partly' | 'not_helped' | null;
  createdAt: number;
}

export async function saveHelpOutcome(input: Omit<HelpOutcome, 'createdAt'> & { createdAt?: number }): Promise<void> {
  const o: HelpOutcome = { ...input, createdAt: input.createdAt ?? Date.now() };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO help_outcomes (id, difficulty, strategy, outcome, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET outcome = excluded.outcome`,
    o.id,
    o.difficulty,
    o.strategy,
    o.outcome,
    o.createdAt,
  );
}

/** Estratégias que mais ajudaram (só usadas se o utilizador consentir "memória"). */
export async function preferredStrategies(): Promise<{ strategy: string; helped: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ strategy: string; helped: number }>(
    "SELECT strategy, COUNT(*) AS helped FROM help_outcomes WHERE outcome = 'helped' GROUP BY strategy ORDER BY helped DESC LIMIT 3",
  );
}
