import type { Store } from './store';

/** Almacenamiento local en un archivo JSON (desarrollo / servidor propio). */
export async function createFileStore(path: string): Promise<Store> {
  const fs = await import('node:fs/promises');
  let data: Record<string, { v: string; exp?: number }> = {};
  try {
    data = JSON.parse(await fs.readFile(path, 'utf8'));
  } catch {
    data = {};
  }
  let writing: Promise<void> = Promise.resolve();
  const flush = () => {
    writing = writing.then(() => fs.writeFile(path, JSON.stringify(data)).catch(() => {}));
    return writing;
  };
  return {
    async get(key) {
      const e = data[key];
      if (!e) return null;
      if (e.exp && e.exp < Date.now()) {
        delete data[key];
        return null;
      }
      return e.v;
    },
    async put(key, value, opts) {
      data[key] = { v: value, exp: opts?.ttl ? Date.now() + opts.ttl * 1000 : undefined };
      await flush();
    },
    async delete(key) {
      delete data[key];
      await flush();
    },
  };
}

