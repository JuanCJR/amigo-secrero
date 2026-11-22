import { Hono, type Context } from 'hono';
import type { Store } from './store';
import { hashPin, randomId, randomInt, seal, unseal, verifyPin } from './crypto';

export interface Participant {
  id: string;
  name: string;
  avatar: string; // semilla del avatar aleatorio
  pinHash?: string;
  pinSalt?: string;
}

export interface Group {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  budget: number; // CLP
  participants: Participant[];
  adminHash: string;
  adminSalt: string;
  drawn: boolean;
  drawnAt?: number;
  draw?: string; // mapa quien→a quién, cifrado
  createdAt: number;
}

export interface WishItem {
  id: string;
  url: string;
  note: string;
  title?: string;
  image?: string;
  site: string;
  addedAt: number;
}

interface Session {
  gid: string;
  role: 'admin' | 'participant';
  pid?: string;
}

const SESSION_TTL = 60 * 60 * 24 * 200;
const MAX_FAILS = 5;
const LOCK_SECONDS = 600;

type Env = { Variables: { session: Session; group: Group } };

class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

const isPin = (p: unknown): p is string => typeof p === 'string' && /^\d{4}$/.test(p);
const cleanName = (n: unknown) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, 30) : '');

function publicGroup(g: Group) {
  return {
    id: g.id,
    title: g.title,
    date: g.date,
    budget: g.budget,
    drawn: g.drawn,
    participants: g.participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, claimed: !!p.pinHash })),
  };
}

function validateNames(list: unknown): { id?: string; name: string; avatar?: string }[] {
  if (!Array.isArray(list)) throw new ApiError(400, 'bad_participants');
  const out = list.map((x) =>
    typeof x === 'string'
      ? { name: cleanName(x) }
      : { id: typeof x?.id === 'string' ? x.id : undefined, name: cleanName(x?.name), avatar: typeof x?.avatar === 'string' ? x.avatar.slice(0, 40) : undefined },
  );
  if (out.some((p) => !p.name)) throw new ApiError(400, 'empty_name');
  const seen = new Set<string>();
  for (const p of out) {
    const k = p.name.toLocaleLowerCase('es');
    if (seen.has(k)) throw new ApiError(400, 'duplicate_name');
    seen.add(k);
  }
  if (out.length < 3) throw new ApiError(400, 'too_few');
  if (out.length > 40) throw new ApiError(400, 'too_many');
  return out;
}

function validateSettings(body: any) {
  const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  if (!date) throw new ApiError(400, 'bad_date');
  const budget = Math.round(Number(body?.budget));
  if (!Number.isFinite(budget) || budget < 0 || budget > 100_000_000) throw new ApiError(400, 'bad_budget');
  const title = (typeof body?.title === 'string' ? body.title.trim().slice(0, 40) : '') || 'Amigo secreto';
  return { date, budget, title };
}

/** Sorteo: un solo ciclo aleatorio → nadie se saca a sí mismo y no hay parejas cerradas. */
function makeDraw(ids: string[]) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  const map: Record<string, string> = {};
  a.forEach((id, i) => (map[id] = a[(i + 1) % a.length]));
  return map;
}

function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return h.startsWith('[');
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaContent(html: string, names: string[]) {
  for (const n of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, 'i');
    const m = html.match(re1) || html.match(re2);
    if (m) return decodeEntities(m[1]);
  }
  return undefined;
}

export async function fetchPreview(rawUrl: string) {
  const url = new URL(rawUrl);
  const site = url.hostname.replace(/^www\./, '');
  const base = { site };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'facebookexternalhit/1.1', accept: 'text/html' },
    });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return base;
    const html = (await res.text()).slice(0, 600_000);
    let title = metaContent(html, ['og:title', 'twitter:title']);
    if (!title) {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (m) title = decodeEntities(m[1]);
    }
    let image = metaContent(html, ['og:image', 'og:image:secure_url', 'twitter:image']);
    if (image) {
      try {
        image = new URL(image, url).toString();
        if (!image.startsWith('https://')) image = undefined;
      } catch {
        image = undefined;
      }
    }
    return { site, title: title?.slice(0, 140), image };
  } catch {
    return base;
  }
}

export function createApp(store: Store, secret: string) {
  const app = new Hono<Env>().basePath('/api');

  const getGroup = async (gid: string) => {
    const raw = await store.get(`group:${gid}`);
    if (!raw) throw new ApiError(404, 'group_not_found');
    return JSON.parse(raw) as Group;
  };
  const saveGroup = (g: Group) => store.put(`group:${g.id}`, JSON.stringify(g));
  const newSession = async (s: Session) => {
    const token = randomId(24);
    await store.put(`session:${token}`, JSON.stringify(s), { ttl: SESSION_TTL });
    return token;
  };
  const getWishes = async (gid: string, pid: string) =>
    JSON.parse((await store.get(`wish:${gid}:${pid}`)) || '[]') as WishItem[];

  const checkLock = async (key: string) => {
    const n = Number((await store.get(`fail:${key}`)) || 0);
    if (n >= MAX_FAILS) throw new ApiError(429, 'locked');
    return n;
  };
  const addFail = async (key: string, n: number) => {
    await store.put(`fail:${key}`, String(n + 1), { ttl: LOCK_SECONDS });
    return MAX_FAILS - (n + 1);
  };

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.code }, err.status as any);
    console.error(err);
    return c.json({ error: 'server' }, 500);
  });

  const auth = (role?: Session['role']) => async (c: Context<Env>, next: () => Promise<void>) => {
    const token = (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '');
    const raw = token ? await store.get(`session:${token}`) : null;
    if (!raw) throw new ApiError(401, 'no_session');
    const s = JSON.parse(raw) as Session;
    if (role && s.role !== role) throw new ApiError(403, 'forbidden');
    const g = await getGroup(s.gid);
    if (s.role === 'participant' && !g.participants.some((p) => p.id === s.pid)) throw new ApiError(401, 'no_session');
    c.set('session', s);
    c.set('group', g);
    await next();
  };

  // ---------- grupo (organizador) ----------
  app.post('/groups', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const settings = validateSettings(body);
    const names = validateNames(body.participants);
    if (!isPin(body.adminPin)) throw new ApiError(400, 'bad_pin');
    const { hash, salt } = await hashPin(body.adminPin);
    const g: Group = {
      id: randomId(6),
      ...settings,
      participants: names.map((p) => ({ id: randomId(6), name: p.name, avatar: p.avatar || randomId(6) })),
      adminHash: hash,
      adminSalt: salt,
      drawn: false,
      createdAt: Date.now(),
    };
    await saveGroup(g);
    const token = await newSession({ gid: g.id, role: 'admin' });
    return c.json({ group: publicGroup(g), token });
  });

  app.get('/groups/:gid', async (c) => c.json({ group: publicGroup(await getGroup(c.req.param('gid'))) }));

  app.post('/groups/:gid/admin', async (c) => {
    const g = await getGroup(c.req.param('gid'));
    const { pin } = await c.req.json().catch(() => ({}));
    const lockKey = `${g.id}:admin`;
    const n = await checkLock(lockKey);
    if (!isPin(pin) || !(await verifyPin(pin, g.adminSalt, g.adminHash))) {
      const left = await addFail(lockKey, n);
      return c.json({ error: 'wrong_pin', left }, 401);
    }
    await store.delete(`fail:${lockKey}`);
    return c.json({ token: await newSession({ gid: g.id, role: 'admin' }) });
  });

  app.get('/admin', auth('admin'), async (c) => {
    const g = c.get('group');
    const wishCounts: Record<string, number> = {};
    for (const p of g.participants) wishCounts[p.id] = (await getWishes(g.id, p.id)).length;
    return c.json({ group: publicGroup(g), wishCounts });
  });

  app.put('/admin/settings', auth('admin'), async (c) => {
    const g = c.get('group');
    Object.assign(g, validateSettings(await c.req.json().catch(() => ({}))));
    await saveGroup(g);
    return c.json({ group: publicGroup(g) });
  });

  app.put('/admin/participants', auth('admin'), async (c) => {
    const g = c.get('group');
    if (g.drawn) throw new ApiError(409, 'already_drawn');
    const body = await c.req.json().catch(() => ({}));
    const list = validateNames(body.participants);
    const byId = new Map(g.participants.map((p) => [p.id, p]));
    g.participants = list.map((p) => {
      const prev = p.id ? byId.get(p.id) : undefined;
      return prev ? { ...prev, name: p.name, avatar: p.avatar || prev.avatar } : { id: randomId(6), name: p.name, avatar: p.avatar || randomId(6) };
    });
    await saveGroup(g);
    return c.json({ group: publicGroup(g) });
  });

  app.post('/admin/reset/:pid', auth('admin'), async (c) => {
    const g = c.get('group');
    const p = g.participants.find((x) => x.id === c.req.param('pid'));
    if (!p) throw new ApiError(404, 'participant_not_found');
    delete p.pinHash;
    delete p.pinSalt;
    await saveGroup(g);
    await store.delete(`fail:${g.id}:${p.id}`);
    return c.json({ group: publicGroup(g) });
  });

  app.post('/admin/draw', auth('admin'), async (c) => {
    const g = c.get('group');
    if (g.drawn) throw new ApiError(409, 'already_drawn');
    if (g.participants.length < 3) throw new ApiError(400, 'too_few');
    g.draw = await seal(secret, `draw:${g.id}`, makeDraw(g.participants.map((p) => p.id)));
    g.drawn = true;
    g.drawnAt = Date.now();
    await saveGroup(g);
    return c.json({ group: publicGroup(g) });
  });

  // ---------- participante ----------
  app.post('/groups/:gid/enter', async (c) => {
    const g = await getGroup(c.req.param('gid'));
    const { pid, pin } = await c.req.json().catch(() => ({}));
    const p = g.participants.find((x) => x.id === pid);
    if (!p) throw new ApiError(404, 'participant_not_found');
    if (!isPin(pin)) throw new ApiError(400, 'bad_pin');
    const lockKey = `${g.id}:${p.id}`;
    if (!p.pinHash) {
      const { hash, salt } = await hashPin(pin);
      p.pinHash = hash;
      p.pinSalt = salt;
      await saveGroup(g);
      return c.json({ token: await newSession({ gid: g.id, role: 'participant', pid: p.id }), created: true });
    }
    const n = await checkLock(lockKey);
    if (!(await verifyPin(pin, p.pinSalt!, p.pinHash))) {
      const left = await addFail(lockKey, n);
      return c.json({ error: 'wrong_pin', left }, 401);
    }
    await store.delete(`fail:${lockKey}`);
    return c.json({ token: await newSession({ gid: g.id, role: 'participant', pid: p.id }), created: false });
  });

  app.get('/me', auth('participant'), async (c) => {
    const g = c.get('group');
    const me = g.participants.find((p) => p.id === c.get('session').pid)!;
    return c.json({
      group: publicGroup(g),
      me: { id: me.id, name: me.name, avatar: me.avatar },
      wishlist: await getWishes(g.id, me.id),
    });
  });

  app.get('/me/match', auth('participant'), async (c) => {
    const g = c.get('group');
    if (!g.drawn || !g.draw) throw new ApiError(409, 'not_drawn');
    const map = await unseal<Record<string, string>>(secret, `draw:${g.id}`, g.draw);
    const rid = map[c.get('session').pid!];
    const r = g.participants.find((p) => p.id === rid);
    if (!r) throw new ApiError(500, 'server');
    return c.json({ receiver: { id: r.id, name: r.name, avatar: r.avatar }, wishlist: await getWishes(g.id, r.id) });
  });

  app.post('/me/wishlist', auth('participant'), async (c) => {
    const g = c.get('group');
    const pid = c.get('session').pid!;
    const body = await c.req.json().catch(() => ({}));
    let url: URL;
    try {
      url = new URL(String(body.url || '').trim());
      if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) throw 0;
    } catch {
      throw new ApiError(400, 'bad_url');
    }
    const list = await getWishes(g.id, pid);
    if (list.length >= 15) throw new ApiError(400, 'too_many_wishes');
    if (list.some((w) => w.url === url.toString())) throw new ApiError(409, 'duplicate_wish');
    const preview = body.preview && typeof body.preview === 'object' ? body.preview : await fetchPreview(url.toString());
    const item: WishItem = {
      id: randomId(6),
      url: url.toString(),
      note: typeof body.note === 'string' ? body.note.trim().slice(0, 140) : '',
      title: typeof preview.title === 'string' ? preview.title.slice(0, 140) : undefined,
      image: typeof preview.image === 'string' && preview.image.startsWith('https://') ? preview.image : undefined,
      site: url.hostname.replace(/^www\./, ''),
      addedAt: Date.now(),
    };
    list.push(item);
    await store.put(`wish:${g.id}:${pid}`, JSON.stringify(list));
    return c.json({ item, wishlist: list });
  });

  app.delete('/me/wishlist/:id', auth('participant'), async (c) => {
    const g = c.get('group');
    const pid = c.get('session').pid!;
    const list = (await getWishes(g.id, pid)).filter((w) => w.id !== c.req.param('id'));
    await store.put(`wish:${g.id}:${pid}`, JSON.stringify(list));
    return c.json({ wishlist: list });
  });

  app.post('/preview', async (c) => {
    const { url } = await c.req.json().catch(() => ({}));
    let u: URL;
    try {
      u = new URL(String(url || '').trim());
      if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) throw 0;
    } catch {
      throw new ApiError(400, 'bad_url');
    }
    return c.json(await fetchPreview(u.toString()));
  });

  return app;
}
