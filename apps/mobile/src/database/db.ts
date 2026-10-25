import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function migrate(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version]!;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(sql);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
  return version;
}

/** Abre (uma única vez) a base de dados local e aplica as migrações pendentes. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('acorde-ja.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/** Apaga todos os dados locais (Privacidade → Apagar dados do dispositivo). */
export async function wipeLocalDatabase(): Promise<void> {
  const db = await getDb();
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const t of tables) await tx.execAsync(`DELETE FROM "${t.name}"`);
  });
}
