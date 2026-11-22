import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db';

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pin, salt, 32);
  return `${salt.toString('hex')}:${h.toString('hex')}`;
}
export function checkPin(pin: string, stored: string): boolean {
  const [s, h] = stored.split(':');
  if (!s || !h) return false;
  const calc = scryptSync(pin, Buffer.from(s, 'hex'), 32);
  const real = Buffer.from(h, 'hex');
  return calc.length === real.length && timingSafeEqual(calc, real);
}

export function newSession(role: 'participant' | 'admin', participantId: number | null): string {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, participant_id, role, created_at) VALUES (?, ?, ?, ?)')
    .run(token, participantId, role, Date.now());
  return token;
}
export function sessionFor(token: string | undefined) {
  if (!token) return null;
  return db.prepare('SELECT participant_id AS participantId, role FROM sessions WHERE token = ?').get(token) as
    | { participantId: number | null; role: 'participant' | 'admin' }
    | undefined ?? null;
}

/** Límite de intentos: 3 fallos → 60 s de espera. */
const fails = new Map<string, { n: number; until: number }>();
export function lockedFor(key: string): number {
  const f = fails.get(key);
  if (!f) return 0;
  return Math.max(0, Math.ceil((f.until - Date.now()) / 1000));
}
export function registerFail(key: string) {
  const f = fails.get(key) ?? { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= 3) { f.until = Date.now() + 60_000; f.n = 0; }
  fails.set(key, f);
}
export function clearFails(key: string) { fails.delete(key); }
export function triesLeft(key: string): number { return 3 - (fails.get(key)?.n ?? 0); }
