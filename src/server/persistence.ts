import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

type HeldDb = { path: string; db: DatabaseSync };

const globalDb = globalThis as unknown as { __proveitSqlite?: HeldDb };

function configuredPath(): string | null {
  const explicit = process.env.PROVEIT_DB_PATH?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "test" || process.env.VERCEL) return null;
  return resolve(process.cwd(), ".data", "proveit-demo.sqlite");
}

function database(): DatabaseSync | null {
  const path = configuredPath();
  if (!path) return null;
  const held = globalDb.__proveitSqlite;
  if (held?.path === path) return held.db;
  if (held) held.db.close();

  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  globalDb.__proveitSqlite = { path, db };
  return db;
}

/**
 * Tiny persistence seam for the hackathon build. Product code stores structured server state as JSON,
 * while SQLite supplies durable local storage and atomic replacement. Tests stay isolated unless they
 * explicitly set PROVEIT_DB_PATH.
 */
export function loadJson<T>(key: string): T | null {
  const db = database();
  if (!db) return null;
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get(key) as { value?: unknown } | undefined;
  if (!row || typeof row.value !== "string") return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  const db = database();
  if (!db) return;
  db.prepare(`
    INSERT INTO app_state(key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), Date.now());
}

export function deleteJson(key: string): void {
  database()?.prepare("DELETE FROM app_state WHERE key = ?").run(key);
}

export function persistenceEnabled(): boolean {
  return configuredPath() !== null;
}

/** Tests that switch database files use this to close the cached SQLite handle cleanly. */
export function closePersistenceForTests(): void {
  globalDb.__proveitSqlite?.db.close();
  delete globalDb.__proveitSqlite;
}
