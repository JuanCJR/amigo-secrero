/**
 * Servidor simulado para la versión demo: reemplaza fetch('/api/...') y guarda todo
 * en el navegador (localStorage, o memoria si no está disponible).
 * Es una copia fiel de las reglas del servidor real (server/index.ts).
 */
import { drawCycle } from '../../server/draw';
import { normalizeUrl } from '../util';

interface P { id: number; name: string; pin: string | null; position: number }
interface W { id: number; participantId: number; url: string; note: string; title: string; image: string; site: string }
interface DB {
  participants: P[]; wishes: W[]; assignments: Record<number, number>;
  settings: { giftDate: string | null; giftAmount: number | null; drawn: boolean; adminPin: string | null };
  log: { text: string; at: number }[]; nextId: number;
  sessions: Record<string, { role: 'participant' | 'admin'; pid: number | null }>;
}
const KEY = 'as_demo_db_v1';
const NAMES = ['Javi M', 'Branko', 'David', 'Damian', 'Daniela', 'Nati', 'Osvaldo', 'Tía Marisel', 'Jorge', 'Ignacio', 'Marcela'];
const FREE = new Set(['Osvaldo', 'Marcela', 'Jorge']); // quedan libres para probar el alta

function seed(): DB {
  const participants = NAMES.map((name, i) => ({ id: i + 1, name, pin: FREE.has(name) ? null : '1111', position: i }));
  const sample = (pid: number, id: number, host: string, title: string, note = ''): W =>
    ({ id, participantId: pid, url: `https://${host}/producto/${id}`, note, title, image: '', site: host });
  const byName = (n: string) => participants.find((p) => p.name === n)!.id;
  return {
    participants,
    wishes: [
      sample(byName('Nati'), 1, 'mercadolibre.cl', 'Zapatillas running livianas', 'Talla 37'),
      sample(byName('Nati'), 2, 'falabella.com', 'Set de tazas de cerámica'),
      sample(byName('Daniela'), 3, 'amazon.com', 'Libro de recetas navideñas'),
      sample(byName('Branko'), 4, 'mercadolibre.cl', 'Audífonos inalámbricos', 'Color negro'),
    ],
    assignments: {}, nextId: 100,
    settings: { giftDate: '2026-12-24', giftAmount: 15000, drawn: false, adminPin: '123456' },
    log: [], sessions: {},
  };
}
let mem: DB | null = null;
function load(): DB {
  if (mem) return mem;
  try { const r = localStorage.getItem(KEY); if (r) { mem = JSON.parse(r); return mem!; } } catch { /* sin storage */ }
  mem = seed();
  return mem;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* noop */ } };
export const resetDemo = () => { mem = null; try { localStorage.removeItem(KEY); } catch { /* noop */ } };

const COLORS = 8;
const pub = (p: P) => ({ id: p.id, name: p.name, color: p.id % COLORS });
const pstate = (db: DB) => ({
  participants: [...db.participants].sort((a, b) => a.position - b.position).map((p) => ({ ...pub(p), claimed: !!p.pin })),
  giftDate: db.settings.giftDate, giftAmount: db.settings.giftAmount, drawn: db.settings.drawn,
  organizerReady: !!db.settings.adminPin, log: [...db.log].reverse().slice(0, 6),
});
const wishOut = (w: W) => ({ id: w.id, url: w.url, note: w.note, title: w.title, image: w.image, site: w.site });
const overview = (db: DB) => ({
  state: pstate(db),
  overview: [...db.participants].sort((a, b) => a.position - b.position).map((p) => ({
    ...pub(p), claimed: !!p.pin, wishCount: db.wishes.filter((w) => w.participantId === p.id).length,
  })),
});
const rnd = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const fails = new Map<string, { n: number; until: number }>();
const wait = (k: string) => Math.max(0, Math.ceil(((fails.get(k)?.until ?? 0) - Date.now()) / 1000));
const fail = (k: string) => { const f = fails.get(k) ?? { n: 0, until: 0 }; f.n++; if (f.n >= 3) { f.until = Date.now() + 60000; f.n = 0; } fails.set(k, f); };
const left = (k: string) => 3 - (fails.get(k)?.n ?? 0);

type R = { s: number; j: unknown };
const ok = (j: unknown): R => ({ s: 200, j });
const err = (error: string, s = 400, extra: object = {}): R => ({ s, j: { error, ...extra } });

function route(method: string, path: string, query: URLSearchParams, body: any, token: string | null): R {
  const db = load();
  const sess = token ? db.sessions[token] : undefined;
  const me = sess?.role === 'participant' ? db.participants.find((p) => p.id === sess.pid) : undefined;
  const admin = sess?.role === 'admin';
  const m = (re: RegExp) => path.match(re);
  let r: RegExpMatchArray | null;

  if (method === 'GET' && path === '/state') return ok(pstate(db));

  if (method === 'POST' && path === '/claim') {
    const p = db.participants.find((x) => x.id === body?.participantId);
    if (!/^\d{4}$/.test(body?.pin ?? '')) return err('pin_format');
    if (!p) return err('not_found', 404);
    if (p.pin) return err('already_claimed', 409);
    p.pin = body.pin; const t = rnd(); db.sessions[t] = { role: 'participant', pid: p.id }; save();
    return ok({ token: t, me: pub(p) });
  }
  if (method === 'POST' && path === '/login') {
    const p = db.participants.find((x) => x.id === body?.participantId);
    if (!p) return err('not_found', 404);
    if (!p.pin) return err('not_claimed', 409);
    const k = 'p' + p.id;
    if (wait(k)) return err('locked', 429, { wait: wait(k) });
    if (p.pin !== body?.pin) { fail(k); return wait(k) ? err('locked', 429, { wait: wait(k) }) : err('wrong_pin', 401, { left: left(k) }); }
    fails.delete(k); const t = rnd(); db.sessions[t] = { role: 'participant', pid: p.id }; save();
    return ok({ token: t, me: pub(p) });
  }
  if (method === 'GET' && path === '/me') {
    if (!me) return err('unauthorized', 401);
    return ok({ me: pub(me), wishes: db.wishes.filter((w) => w.participantId === me.id).reverse().map(wishOut), state: pstate(db) });
  }
  if (method === 'GET' && path === '/preview') {
    if (!me && !admin) return err('unauthorized', 401);
    const url = normalizeUrl(query.get('url') ?? '');
    if (!url) return err('bad_link');
    return ok({ url, title: '', image: '', site: new URL(url).hostname.replace(/^www\./, '') });
  }
  if (method === 'POST' && path === '/wishes') {
    if (!me) return err('unauthorized', 401);
    const url = normalizeUrl(String(body?.url ?? ''));
    if (!url) return err('bad_link');
    if (db.wishes.filter((w) => w.participantId === me.id).length >= 15) return err('too_many');
    if (db.wishes.some((w) => w.participantId === me.id && w.url === url)) return err('duplicate', 409);
    const w: W = { id: db.nextId++, participantId: me.id, url, note: String(body?.note ?? '').trim().slice(0, 200), title: '', image: '', site: new URL(url).hostname.replace(/^www\./, '') };
    db.wishes.push(w); save();
    return ok({ wish: wishOut(w) });
  }
  if ((r = m(/^\/wishes\/(\d+)$/)) && method === 'DELETE') {
    if (!me) return err('unauthorized', 401);
    db.wishes = db.wishes.filter((w) => !(w.id === Number(r![1]) && w.participantId === me.id)); save();
    return ok({ ok: true });
  }
  if (method === 'GET' && path === '/reveal') {
    if (!me) return err('unauthorized', 401);
    if (!db.settings.drawn) return err('not_drawn', 409);
    const rid = db.assignments[me.id];
    const rc = db.participants.find((p) => p.id === rid);
    if (!rc) return err('no_assignment', 404);
    return ok({ receiver: pub(rc), wishes: db.wishes.filter((w) => w.participantId === rc.id).reverse().map(wishOut) });
  }

  // ── organizador
  if (method === 'POST' && path === '/admin/setup') {
    if (db.settings.adminPin) return err('already_setup', 409);
    if (!/^\d{6}$/.test(body?.pin ?? '')) return err('pin_format');
    db.settings.adminPin = body.pin; const t = rnd(); db.sessions[t] = { role: 'admin', pid: null }; save(); return ok({ token: t });
  }
  if (method === 'POST' && path === '/admin/login') {
    if (!db.settings.adminPin) return err('not_setup', 409);
    if (wait('admin')) return err('locked', 429, { wait: wait('admin') });
    if (db.settings.adminPin !== body?.pin) { fail('admin'); return wait('admin') ? err('locked', 429, { wait: wait('admin') }) : err('wrong_pin', 401, { left: left('admin') }); }
    fails.delete('admin'); const t = rnd(); db.sessions[t] = { role: 'admin', pid: null }; save(); return ok({ token: t });
  }
  if (path.startsWith('/admin/') && !admin) return err('unauthorized', 401);
  if (method === 'GET' && path === '/admin/overview') return ok(overview(db));
  if (method === 'PUT' && path === '/admin/settings') {
    const { giftDate, giftAmount } = body ?? {};
    if (giftDate) { if (!/^\d{4}-\d{2}-\d{2}$/.test(giftDate)) return err('bad_date'); db.settings.giftDate = giftDate; }
    if (giftAmount) { const n = Number(giftAmount); if (!Number.isInteger(n) || n < 500 || n > 10_000_000) return err('bad_amount'); db.settings.giftAmount = n; }
    save(); return ok(overview(db));
  }
  if (method === 'POST' && path === '/admin/participants') {
    if (db.settings.drawn) return err('already_drawn', 409);
    const n = String(body?.name ?? '').trim().slice(0, 30);
    if (!n) return err('bad_name');
    if (db.participants.some((p) => p.name.toLowerCase() === n.toLowerCase())) return err('duplicate', 409);
    db.participants.push({ id: db.nextId++, name: n, pin: null, position: db.participants.length + 100 }); save(); return ok(overview(db));
  }
  if ((r = m(/^\/admin\/participants\/(\d+)$/))) {
    const id = Number(r[1]);
    if (method === 'PATCH') {
      const n = String(body?.name ?? '').trim().slice(0, 30);
      if (!n) return err('bad_name');
      const p = db.participants.find((x) => x.id === id); if (p) p.name = n; save(); return ok(overview(db));
    }
    if (method === 'DELETE') {
      if (db.settings.drawn) return err('already_drawn', 409);
      db.participants = db.participants.filter((p) => p.id !== id); db.wishes = db.wishes.filter((w) => w.participantId !== id); save(); return ok(overview(db));
    }
  }
  if ((r = m(/^\/admin\/participants\/(\d+)\/reset-pin$/)) && method === 'POST') {
    const p = db.participants.find((x) => x.id === Number(r![1]));
    if (!p) return err('not_found', 404);
    p.pin = null; for (const t of Object.keys(db.sessions)) if (db.sessions[t].pid === p.id) delete db.sessions[t];
    db.log.push({ text: `${p.name} reinició su clave`, at: Date.now() }); save(); return ok(overview(db));
  }
  if (method === 'POST' && path === '/admin/draw') {
    if (db.settings.drawn) return err('already_drawn', 409);
    if (db.participants.length < 3) return err('too_few');
    const map = drawCycle(db.participants.map((p) => p.id));
    db.assignments = Object.fromEntries(map);
    db.settings.drawn = true; db.log.push({ text: 'El organizador hizo el sorteo', at: Date.now() }); save();
    return ok({ ok: true, count: db.participants.length, ...overview(db) });
  }
  return err('not_found', 404);
}

export function installMock() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const u = new URL(raw, location.href);
    const i = u.pathname.indexOf('/api/');
    if (i < 0 && !raw.startsWith('/api')) return real(input, init);
    const path = raw.startsWith('/api') ? new URL(raw, 'http://x').pathname.slice(4) : u.pathname.slice(i + 4);
    const q = new URL(raw, 'http://x').searchParams;
    const h = new Headers(init?.headers);
    const auth = h.get('authorization');
    let body: unknown;
    try { body = init?.body ? JSON.parse(String(init.body)) : undefined; } catch { body = undefined; }
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180)); // latencia creíble
    const res = route((init?.method ?? 'GET').toUpperCase(), path, q, body, auth?.startsWith('Bearer ') ? auth.slice(7) : null);
    return new Response(JSON.stringify(res.j), { status: res.s, headers: { 'content-type': 'application/json' } });
  };
}
