export interface Store {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Adaptador para Cloudflare KV. */
export function createKVStore(kv: {
  get(k: string): Promise<string | null>;
  put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>;
  delete(k: string): Promise<void>;
}): Store {
  return {
    get: (k) => kv.get(k),
    put: (k, v, o) => kv.put(k, v, o?.ttl ? { expirationTtl: Math.max(60, o.ttl) } : undefined),
    delete: (k) => kv.delete(k),
  };
}
