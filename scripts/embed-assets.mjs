// Empaqueta los archivos de dist/ dentro del Worker (server/assets.gen.ts).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};
const root = 'dist';
const out = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else out['/' + relative(root, p).split('\\').join('/')] = { type: TYPES[extname(p)] || 'application/octet-stream', b64: readFileSync(p).toString('base64') };
  }
};
walk(root);
writeFileSync('server/assets.gen.ts', `// Generado por scripts/embed-assets.mjs — no editar\nexport const ASSETS: Record<string, { type: string; b64: string }> = ${JSON.stringify(out)};\n`);
console.log(`Empaquetados ${Object.keys(out).length} archivos`);
