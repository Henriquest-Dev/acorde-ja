/**
 * Migrações da base de dados local (SQLite). Cada entrada é aplicada uma única
 * vez, por ordem, controlada por `PRAGMA user_version`. Nunca editar uma
 * migração já publicada — acrescentar uma nova.
 */
export const MIGRATIONS: string[] = [
  // 1 — esquema inicial
  `
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_limits (
    app_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    package_names TEXT NOT NULL DEFAULT '[]',
    limit_minutes INTEGER NOT NULL CHECK (limit_minutes BETWEEN 1 AND 720),
    enabled INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usage_daily (
    day TEXT NOT NULL,
    app_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    used_ms INTEGER NOT NULL CHECK (used_ms >= 0),
    limit_ms INTEGER,
    opens INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (day, app_id)
  );
  CREATE INDEX IF NOT EXISTS usage_daily_app ON usage_daily (app_id, day);

  CREATE TABLE IF NOT EXISTS block_events (
    id TEXT PRIMARY KEY NOT NULL,
    app_id TEXT,
    kind TEXT NOT NULL,
    day TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS block_events_day ON block_events (day);

  CREATE TABLE IF NOT EXISTS exceptions (
    id TEXT PRIMARY KEY NOT NULL,
    app_id TEXT NOT NULL,
    day TEXT NOT NULL,
    extra_minutes INTEGER NOT NULL,
    reason TEXT NOT NULL,
    granted_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS exceptions_day ON exceptions (day, app_id);

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    start TEXT NOT NULL,
    "end" TEXT NOT NULL,
    days TEXT NOT NULL,
    app_ids TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    planned_ms INTEGER NOT NULL,
    actual_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    activity TEXT
  );
  CREATE INDEX IF NOT EXISTS focus_sessions_started ON focus_sessions (started_at);

  CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    frequency TEXT NOT NULL,
    target TEXT,
    reminder_time TEXT,
    reminder_ids TEXT NOT NULL DEFAULT '[]',
    sort INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS habit_entries (
    id TEXT PRIMARY KEY NOT NULL,
    habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    UNIQUE (habit_id, day)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chat_messages_conv ON chat_messages (conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS help_outcomes (
    id TEXT PRIMARY KEY NOT NULL,
    difficulty TEXT NOT NULL,
    strategy TEXT NOT NULL,
    outcome TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    tbl TEXT NOT NULL,
    op TEXT NOT NULL,
    row_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL,
    last_error TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE INDEX IF NOT EXISTS sync_queue_due ON sync_queue (status, next_attempt_at);
  `,
];
