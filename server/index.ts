import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { db, getSetting, setSetting, addLog } from './db';
import { checkPin, clearFails, hashPin, lockedFor, newSession, registerFail, sessionFor, triesLeft } from './auth';
import { drawCycle } from './draw';
import { getPreview, normalizeUrl } from './preview';

export const app = new Hono();

type P = { id: number; name: string; pin_hash: string | null; position: number };
const COLORS = 8;
const colorOf = (id: number) => id % COLORS;

const isDrawn = () => getSetting('drawn') === '1';
const bad = (c: Context, error: string, status: 400 | 401 | 403 | 404 | 409 | 429 = 400, extra: object = {}) =>
  c.json({ error, ...extra }, status);

const okPin = (p: unknown, len: number): p is string => typeof p === 'string' && new RegExp(`^\\d{${len}}$`).test(p);

// ORGANIZER_PIN opcional: deja fija la clave del organizador desde el despliegue.
if (process.env.ORGANIZER_PIN && /^\d{6}$/.test(process.env.ORGANIZER_PIN) && !getSetting('admin_pin_hash')) {
  setSetting('admin_pin_hash', hashPin(process.env.ORGANIZER_PIN));
}

function auth(c: Context) {
  const h = c.req.header('authorization') ?? '';
  return sessionFor(h.startsWith('Bearer ') ? h.slice(7) : undefined);
}
function me(c: Context): P | null {
  const s = auth(c);
  if (!s || s.role !== 'participant' || !s.participantId) return null;
  return (db.prepare('SELECT * FROM participants WHERE id = ?').get(s.participantId) as P | undefined) ?? null;
}
const isAdmin = (c: Context) => auth(c)?.role === 'admin';

const pub = (p: P) => ({ id: p.id, name: p.name, color: colorOf(p.id) });

function publicState() {
  const parts = (db.prepare('SELECT * FROM participants ORDER BY position, id').all() as P[])
    .map((p) => ({ ...pub(p), claimed: !!p.pin_hash }));
  const log = db.prepare('SELECT text, at FROM log ORDER BY id DESC LIMIT 6').all();
  return {
    participants: parts,
    giftDate: getSetting('gift_date'),
    giftAmount: getSetting('gift_amount') ? Number(getSetting('gift_amount')) : null,
    drawn: isDrawn(),
    organizerReady: !!getSetting('admin_pin_hash'),
    log,
  };
}

const wishOut = (w: any) => ({ id: w.id, url: w.url, note: w.note, title: w.title, image: w.image, site: w.site });

// ───────────── público ─────────────
app.get('/api/state', (c) => c.json(publicState()));

// ───────────── participantes ─────────────
app.post('/api/claim', async (c) => {
  const { participantId, pin } = await c.req.json().catch(() => ({}));
  if (!okPin(pin, 4)) return bad(c, 'pin_format');
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId) as P | undefined;
  if (!p) return bad(c, 'not_found', 404);
  if (p.pin_hash) return bad(c, 'already_claimed', 409);
  // atómico: solo si sigue sin clave
  const r = db.prepare('UPDATE participants SET pin_hash = ? WHERE id = ? AND pin_hash IS NULL').run(hashPin(pin), p.id);
  if (!r.changes) return bad(c, 'already_claimed', 409);
  return c.json({ token: newSession('participant', p.id), me: pub(p) });
});

app.post('/api/login', async (c) => {
  const { participantId, pin } = await c.req.json().catch(() => ({}));
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId) as P | undefined;
  if (!p) return bad(c, 'not_found', 404);
  if (!p.pin_hash) return bad(c, 'not_claimed', 409);
  const key = `p${p.id}`;
  const wait = lockedFor(key);
  if (wait) return bad(c, 'locked', 429, { wait });
  if (!okPin(pin, 4) || !checkPin(pin, p.pin_hash)) {
    registerFail(key);
    const w = lockedFor(key);
    return w ? bad(c, 'locked', 429, { wait: w }) : bad(c, 'wrong_pin', 401, { left: triesLeft(key) });
  }
  clearFails(key);
  return c.json({ token: newSession('participant', p.id), me: pub(p) });
});

app.get('/api/me', (c) => {
  const p = me(c);
  if (!p) return bad(c, 'unauthorized', 401);
  const wishes = (db.prepare('SELECT * FROM wishes WHERE participant_id = ? ORDER BY id DESC').all(p.id) as any[]).map(wishOut);
  return c.json({ me: pub(p), wishes, state: publicState() });
});

app.get('/api/preview', async (c) => {
  if (!me(c) && !isAdmin(c)) return bad(c, 'unauthorized', 401);
  const url = normalizeUrl(c.req.query('url') ?? '');
  if (!url) return bad(c, 'bad_link');
  return c.json(await getPreview(url));
});

app.post('/api/wishes', async (c) => {
  const p = me(c);
  if (!p) return bad(c, 'unauthorized', 401);
  const { url: raw, note } = await c.req.json().catch(() => ({}));
  const url = normalizeUrl(String(raw ?? ''));
  if (!url) return bad(c, 'bad_link');
  const total = (db.prepare('SELECT COUNT(*) AS c FROM wishes WHERE participant_id = ?').get(p.id) as { c: number }).c;
  if (total >= 15) return bad(c, 'too_many');
  const dup = db.prepare('SELECT id FROM wishes WHERE participant_id = ? AND url = ?').get(p.id, url);
  if (dup) return bad(c, 'duplicate', 409);
  const pr = await getPreview(url);
  const info = db.prepare('INSERT INTO wishes (participant_id, url, note, title, image, site, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, url, String(note ?? '').trim().slice(0, 200), pr.title, pr.image, pr.site, Date.now());
  const w = db.prepare('SELECT * FROM wishes WHERE id = ?').get(info.lastInsertRowid);
  return c.json({ wish: wishOut(w) });
});

app.delete('/api/wishes/:id', (c) => {
  const p = me(c);
  if (!p) return bad(c, 'unauthorized', 401);
  db.prepare('DELETE FROM wishes WHERE id = ? AND participant_id = ?').run(Number(c.req.param('id')), p.id);
  return c.json({ ok: true });
});

/** Solo devuelve el amigo secreto de QUIEN pregunta, y solo después del sorteo. */
app.get('/api/reveal', (c) => {
  const p = me(c);
  if (!p) return bad(c, 'unauthorized', 401);
  if (!isDrawn()) return bad(c, 'not_drawn', 409);
  const a = db.prepare('SELECT receiver_id AS rid FROM assignments WHERE giver_id = ?').get(p.id) as { rid: number } | undefined;
  if (!a) return bad(c, 'no_assignment', 404);
  const r = db.prepare('SELECT * FROM participants WHERE id = ?').get(a.rid) as P;
  const wishes = (db.prepare('SELECT * FROM wishes WHERE participant_id = ? ORDER BY id DESC').all(r.id) as any[]).map(wishOut);
  return c.json({ receiver: pub(r), wishes });
});

// ───────────── organizador (no participa, no ve resultados) ─────────────
app.post('/api/admin/setup', async (c) => {
  const { pin } = await c.req.json().catch(() => ({}));
  if (getSetting('admin_pin_hash')) return bad(c, 'already_setup', 409);
  if (!okPin(pin, 6)) return bad(c, 'pin_format');
  setSetting('admin_pin_hash', hashPin(pin));
  return c.json({ token: newSession('admin', null) });
});
app.post('/api/admin/login', async (c) => {
  const { pin } = await c.req.json().catch(() => ({}));
  const stored = getSetting('admin_pin_hash');
  if (!stored) return bad(c, 'not_setup', 409);
  const wait = lockedFor('admin');
  if (wait) return bad(c, 'locked', 429, { wait });
  if (!okPin(pin, 6) || !checkPin(pin, stored)) {
    registerFail('admin');
    const w = lockedFor('admin');
    return w ? bad(c, 'locked', 429, { wait: w }) : bad(c, 'wrong_pin', 401, { left: triesLeft('admin') });
  }
  clearFails('admin');
  return c.json({ token: newSession('admin', null) });
});

function adminOverview() {
  const parts = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM wishes w WHERE w.participant_id = p.id) AS wishCount
    FROM participants p ORDER BY position, id`).all() as (P & { wishCount: number })[];
  return {
    state: publicState(),
    overview: parts.map((p) => ({ ...pub(p), claimed: !!p.pin_hash, wishCount: p.wishCount })),
  };
}
app.get('/api/admin/overview', (c) => (isAdmin(c) ? c.json(adminOverview()) : bad(c, 'unauthorized', 401)));

app.put('/api/admin/settings', async (c) => {
  if (!isAdmin(c)) return bad(c, 'unauthorized', 401);
  const { giftDate, giftAmount } = await c.req.json().catch(() => ({}));
  if (giftDate !== undefined && giftDate !== null && giftDate !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(giftDate) || Number.isNaN(Date.parse(giftDate))) return bad(c, 'bad_date');
    setSetting('gift_date', giftDate);
  }
  if (giftAmount !== undefined && giftAmount !== null && giftAmount !== '') {
    const n = Number(giftAmount);
    if (!Number.isInteger(n) || n < 500 || n > 10_000_000) return bad(c, 'bad_amount');
    setSetting('gift_amount', String(n));
  }
  return c.json(adminOverview());
});

app.post('/api/admin/participants', async (c) => {
  if (!isAdmin(c)) return bad(c, 'unauthorized', 401);
  if (isDrawn()) return bad(c, 'already_drawn', 409);
  const { name } = await c.req.json().catch(() => ({}));
  const n = String(name ?? '').trim().slice(0, 30);
  if (!n) return bad(c, 'bad_name');
  const dup = db.prepare('SELECT id FROM participants WHERE lower(name) = lower(?)').get(n);
  if (dup) return bad(c, 'duplicate', 409);
  const pos = (db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM participants').get() as { p: number }).p;
  db.prepare('INSERT INTO participants (name, position) VALUES (?, ?)').run(n, pos);
  return c.json(adminOverview());
});
app.patch('/api/admin/participants/:id', async (c) => {
  if (!isAdmin(c)) return bad(c, 'unauthorized', 401);
  const { name } = await c.req.json().catch(() => ({}));
  const n = String(name ?? '').trim().slice(0, 30);
  if (!n) return bad(c, 'bad_name');
  db.prepare('UPDATE participants SET name = ? WHERE id = ?').run(n, Number(c.req.param('id')));
  return c.json(adminOverview());
});
app.delete('/api/admin/participants/:id', (c) => {
  if (!isAdmin(c)) return bad(c, 'unauthorized', 401);
  if (isDrawn()) return bad(c, 'already_drawn', 409);
  db.prepare('DELETE FROM participants WHERE id = ?').run(Number(c.req.param('id')));
  return c.json(adminOverview());
});
app.post('/api/admin/participants/:id/reset-pin', (c) => {
  if (!isAdmin(c)) return bad(c, 'unauthorized', 401);
  const id = Number(c.req.param('id'));
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as P | undefined;
  if (!p) return bad(c, 'not_found', 404);
  db.prepare('UPDATE participants SET pin_hash = NULL WHERE id = ?').run(id);
  db.prepare('DELETE FROM sessions WHERE participant_id = ?').run(id);
  clearFails(`p${id}`);
  addLog(`${p.name} reinició su clave`); // visible para todos: nadie lo hace a escondidas
  return c.json(adminOverview());
});

app.post('/api/admin/draw', (c) => {
  if (!isAdmin(c)) return bad(c, 'unauthorized', 401);
  if (isDrawn()) return bad(c, 'already_drawn', 409);
  const parts = db.prepare('SELECT id FROM participants').all() as { id: number }[];
  if (parts.length < 3) return bad(c, 'too_few');
  const map = drawCycle(parts.map((p) => p.id));
  const tx = db.transaction(() => {
    const ins = db.prepare('INSERT INTO assignments (giver_id, receiver_id) VALUES (?, ?)');
    for (const [g, r] of map) ins.run(g, r);
    setSetting('drawn', '1');
    addLog('El organizador hizo el sorteo');
  });
  tx();
  // Importante: NO se devuelve ninguna asignación.
  return c.json({ ok: true, count: parts.length, ...adminOverview() });
});

// ───────────── estáticos (build) ─────────────
if (existsSync('./dist/index.html')) {
  const html = readFileSync('./dist/index.html', 'utf8');
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', (c) => c.html(html));
}

if (!process.env.VITEST) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port }, () => console.log(`Amigo secreto listo en http://localhost:${port}`));
}
