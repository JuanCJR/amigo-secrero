import { createApp } from './app';
import { createKVStore } from './store';
import { ASSETS } from './assets.gen';

interface Env {
  DATA: any; // KVNamespace
  APP_SECRET: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_MODEL?: string;
  TTS_MONTHLY_CHARS?: string;
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
  async fetch(req: Request, env: Env, ctx: unknown) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      // sin secreto no se puede cifrar el sorteo: mejor no atender
      if (!env.APP_SECRET || env.APP_SECRET.length < 32) return Response.json({ error: 'server' }, { status: 503 });
      return createApp(createKVStore(env.DATA), env.APP_SECRET, {
        apiKey: env.ELEVENLABS_API_KEY,
        voiceId: env.ELEVENLABS_VOICE_ID,
        model: env.ELEVENLABS_MODEL,
        monthlyChars: env.TTS_MONTHLY_CHARS ? Number(env.TTS_MONTHLY_CHARS) : undefined,
      }).fetch(req, env, ctx as any);
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
