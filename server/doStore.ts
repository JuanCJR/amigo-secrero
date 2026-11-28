import type { Store } from './store';

interface Entry {
  v?: string;
  exp?: number;
  /** marca de borrado: evita que un valor viejo de KV "reviva" */
  gone?: true;
}

interface DOStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface KV {
  get(k: string): Promise<string | null>;
}

/** Claves con vencimiento: no se copian desde KV (allá vencen solas). */
const temporary = (k: string) => k.startsWith('session:') || k.startsWith('fail:');

/**
 * Almacenamiento dentro de un Durable Object: lo que se escribe se lee al tiro
 * (KV puede tardar un minuto o más en mostrar un cambio, por eso el sorteo no
 * aparecía). Los datos que siguen en KV de antes se leen como respaldo y los
 * permanentes se copian aquí la primera vez.
 */
export function createDOStore(storage: DOStorage, legacy?: KV): Store {
  return {
    async get(key) {
      const e = await storage.get<Entry>(key);
      if (e) {
        if (e.gone) return null;
        if (e.exp && e.exp < Date.now()) {
          await storage.delete(key);
          return null;
        }
        return e.v ?? null;
      }
      if (!legacy || key.startsWith('fail:')) return null;
      const v = await legacy.get(key);
      if (v !== null && !temporary(key)) await storage.put<Entry>(key, { v });
      return v;
    },
    async put(key, value, opts) {
      await storage.put<Entry>(key, { v: value, exp: opts?.ttl ? Date.now() + opts.ttl * 1000 : undefined });
    },
    async delete(key) {
      if (legacy && !key.startsWith('fail:')) await storage.put<Entry>(key, { gone: true });
      else await storage.delete(key);
    },
  };
}
