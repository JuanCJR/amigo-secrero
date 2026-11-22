import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const file = process.env.DB_FILE ?? './data/amigo.db';
if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS assignments (
  giver_id INTEGER PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  participant_id INTEGER,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
`);

export const DEFAULT_NAMES = [
  'Javi M', 'Branko', 'David', 'Damian', 'Daniela', 'Nati',
  'Osvaldo', 'Tía Marisel', 'Jorge', 'Ignacio', 'Marcela',
];

const count = db.prepare('SELECT COUNT(*) AS c FROM participants').get() as { c: number };
if (count.c === 0) {
  const ins = db.prepare('INSERT INTO participants (name, position) VALUES (?, ?)');
  DEFAULT_NAMES.forEach((n, i) => ins.run(n, i));
}

export function getSetting(key: string): string | null {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return r ? r.value : null;
}
export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
export function addLog(text: string) {
  db.prepare('INSERT INTO log (text, at) VALUES (?, ?)').run(text, Date.now());
}
