export interface Person { id: number; name: string; color: number }
export interface PubPerson extends Person { claimed: boolean }
export interface Wish { id: number; url: string; note: string; title: string; image: string; site: string }
export interface PubState {
  participants: PubPerson[]; giftDate: string | null; giftAmount: number | null;
  drawn: boolean; organizerReady: boolean; log: { text: string; at: number }[];
}
export interface Overview { state: PubState; overview: (PubPerson & { wishCount: number })[] }

export class ApiError extends Error {
  constructor(public code: string, public status: number, public data: Record<string, unknown> = {}) { super(code); }
}

const KEYS = { p: 'as_token', a: 'as_admin_token' } as const;
export const tokens = {
  get: (k: 'p' | 'a') => { try { return localStorage.getItem(KEYS[k]); } catch { return null; } },
  set: (k: 'p' | 'a', v: string | null) => { try { v ? localStorage.setItem(KEYS[k], v) : localStorage.removeItem(KEYS[k]); } catch { /* noop */ } },
};

export async function api<T = any>(path: string, o: { method?: string; body?: unknown; as?: 'p' | 'a' } = {}): Promise<T> {
  const t = o.as ? tokens.get(o.as) : null;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: o.method ?? (o.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'error', res.status, data);
  return data as T;
}

export const fmtMoney = (n: number) => '$' + n.toLocaleString('es-CL');
export const fmtDate = (iso: string, cap = true) => {
  const t = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
  return cap ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

/** Flags simples por dispositivo (primera visita, revelación ya vista, etc.) */
export const flag = {
  get: (k: string) => { try { return localStorage.getItem('as_' + k); } catch { return null; } },
  set: (k: string, v = '1') => { try { localStorage.setItem('as_' + k, v); } catch { /* noop */ } },
  del: (k: string) => { try { localStorage.removeItem('as_' + k); } catch { /* noop */ } },
};
