import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Person, type PublicGroup, type WishItem } from './api';
import { tokens } from './storage';

// caché en memoria para que las pantallas rendericen al instante (y Flip encuentre sus pares)
const cache = new Map<string, unknown>();
export const peek = <T,>(k: string) => cache.get(k) as T | undefined;
export const put = (k: string, v: unknown) => cache.set(k, v);

function useResource<T>(key: string | null, loader: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(() => (key ? peek<T>(key) : undefined));
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(!data);
  const reload = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      const d = await loader();
      cache.set(key, d);
      setData(d);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    reload();
  }, [reload]);
  const mutate = useCallback(
    (d: T) => {
      if (key) cache.set(key, d);
      setData(d);
    },
    [key],
  );
  return { data, error, loading, reload, mutate };
}

export const useGroup = (gid: string) =>
  useResource<PublicGroup>(`group:${gid}`, async () => (await api<{ group: PublicGroup }>(`/groups/${gid}`)).group);

export interface MeData {
  group: PublicGroup;
  me: Person;
  wishlist: WishItem[];
}
export const useMe = (gid: string) =>
  useResource<MeData>(`me:${gid}`, async () => {
    const d = await api<MeData>('/me', { token: tokens.participant(gid) });
    cache.set(`group:${gid}`, d.group);
    return d;
  });

export interface MatchData {
  receiver: Person;
  wishlist: WishItem[];
}
export const useMatch = (gid: string, enabled = true) =>
  useResource<MatchData>(enabled ? `match:${gid}` : null, () => api<MatchData>('/me/match', { token: tokens.participant(gid) }));

export interface AdminData {
  group: PublicGroup;
  wishCounts: Record<string, number>;
}
export const useAdmin = (gid: string) =>
  useResource<AdminData>(`admin:${gid}`, () => api<AdminData>('/admin', { token: tokens.admin(gid) }));

export const isAuthError = (e: unknown) => e instanceof ApiError && (e.code === 'no_session' || e.status === 401 || e.status === 403);
