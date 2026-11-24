import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { createApp } from './app';
import { createFileStore } from './fileStore';

const port = Number(process.env.PORT || 8787);
const secret = process.env.APP_SECRET || 'dev-secret-cambiar-en-produccion';
const store = await createFileStore(process.env.DATA_FILE || './data.json');

const root = new Hono();
root.route('/', createApp(store, secret));
if (process.env.SERVE_STATIC) {
  root.use('/*', serveStatic({ root: './dist' }));
  root.get('*', async (c) => c.html(await readFile('./dist/index.html', 'utf8')));
}
serve({ fetch: root.fetch, port }, () => console.log(`API lista en http://localhost:${port}`));
