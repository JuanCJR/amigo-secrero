import { createApp } from './app';
import { createDOStore } from './doStore';
import { ASSETS } from './assets.gen';

interface Env {
  DATA: any; // KVNamespace (datos antiguos, solo lectura de respaldo)
  API: any; // DurableObjectNamespace
  APP_SECRET: string;
}

/**
 * Toda la API corre dentro de un único Durable Object: lo que alguien escribe
 * (por ejemplo, el sorteo) lo ven todos en la siguiente lectura, y las
 * peticiones simultáneas se atienden en orden.
 */
export class Api {
  private app: ReturnType<typeof createApp>;
  constructor(state: any, env: Env) {
    this.app = createApp(createDOStore(state.storage, env.DATA), env.APP_SECRET);
  }
  fetch(req: Request) {
    return this.app.fetch(req);
  }
}

const decoded = new Map<string, ArrayBuffer>();
function body(path: string) {
  let b = decoded.get(path);
  if (!b) {
    const bin = atob(ASSETS[path].b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    b = u.buffer;
    decoded.set(path, b);
  }
  return b;
}

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      // sin secreto no se puede cifrar el sorteo: mejor no atender
      if (!env.APP_SECRET || env.APP_SECRET.length < 32) return Response.json({ error: 'server' }, { status: 503 });
      return env.API.get(env.API.idFromName('main')).fetch(req);
    }
    // archivos estáticos; cualquier otra ruta es la app (SPA)
    const path = ASSETS[url.pathname] ? url.pathname : '/index.html';
    const asset = ASSETS[path];
    const immutable = path.startsWith('/assets/');
    return new Response(req.method === 'HEAD' ? null : body(path), {
      headers: {
        'content-type': asset.type,
        'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...SECURITY,
      },
    });
  },
};
