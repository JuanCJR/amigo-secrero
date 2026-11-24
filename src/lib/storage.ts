const P = 'as:';
export const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(P + k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(P + k, v);
    } catch {
      /* sin almacenamiento: seguimos igual */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(P + k);
    } catch {
      /* nada */
    }
  },
};

export interface KnownGroup {
  gid: string;
  role: 'admin' | 'participant';
  title: string;
  name?: string;
}
export function knownGroups(): KnownGroup[] {
  try {
    return JSON.parse(ls.get('groups') || '[]');
  } catch {
    return [];
  }
}
export function rememberGroup(g: KnownGroup) {
  const list = knownGroups().filter((x) => !(x.gid === g.gid && x.role === g.role));
  list.unshift(g);
  ls.set('groups', JSON.stringify(list.slice(0, 6)));
}
export function forgetGroup(gid: string, role: KnownGroup['role']) {
  ls.set('groups', JSON.stringify(knownGroups().filter((x) => !(x.gid === gid && x.role === role))));
}
export const tokens = {
  participant: (gid: string) => ls.get(`p:${gid}`),
  admin: (gid: string) => ls.get(`a:${gid}`),
  setParticipant: (gid: string, t: string) => ls.set(`p:${gid}`, t),
  setAdmin: (gid: string, t: string) => ls.set(`a:${gid}`, t),
  clearParticipant: (gid: string) => ls.del(`p:${gid}`),
  clearAdmin: (gid: string) => ls.del(`a:${gid}`),
};
export const seen = {
  has: (k: string) => ls.get(`seen:${k}`) === '1',
  mark: (k: string) => ls.set(`seen:${k}`, '1'),
};
