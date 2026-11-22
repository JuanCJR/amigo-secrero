import { createApp } from './app';
import { createKVStore } from './store';

interface Env {
  DATA: any; // KVNamespace
  APP_SECRET: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export default {
  async fetch(req: Request, env: Env, ctx: unknown) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      return createApp(createKVStore(env.DATA), env.APP_SECRET).fetch(req, env, ctx as any);
    }
    return env.ASSETS.fetch(req);
  },
};
