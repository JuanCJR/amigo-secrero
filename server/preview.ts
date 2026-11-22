import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface Preview { url: string; title: string; image: string; site: string }

/** Normaliza lo que la persona pegó. Devuelve null si no parece un link. */
export function normalizeUrl(raw: string): string | null {
  let s = (raw ?? '').trim();
  if (!s || s.length > 800 || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') || u.hostname.endsWith('.')) return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch { return null; }
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') ||
      l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb') || l.startsWith('::ffff:');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublicHost(host: string) {
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('private');
    return;
  }
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('private');
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('private');
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
function meta(html: string, keys: string[]): string {
  for (const k of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, 'i');
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1]) return decode(m[1]);
  }
  return '';
}

const cache = new Map<string, { at: number; p: Preview }>();

export async function getPreview(url: string): Promise<Preview> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.p;

  const base: Preview = { url, title: '', image: '', site: new URL(url).hostname.replace(/^www\./, '') };
  try {
    let current = url;
    let res: Response | null = null;
    for (let i = 0; i < 4; i++) {
      const u = new URL(current);
      await assertPublicHost(u.hostname);
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; AmigoSecretoBot/1.0)', accept: 'text/html' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location')!, current).toString();
        res = null;
        continue;
      }
      break;
    }
    if (res && res.ok && (res.headers.get('content-type') ?? '').includes('html') && res.body) {
      const reader = res.body.getReader();
      let html = '';
      const dec = new TextDecoder();
      while (html.length < 300_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
      reader.cancel().catch(() => {});
      base.title = meta(html, ['og:title', 'twitter:title']) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '');
      const img = meta(html, ['og:image', 'twitter:image']);
      if (img) {
        try {
          const iu = new URL(img, current);
          if (iu.protocol === 'https:' || iu.protocol === 'http:') base.image = iu.toString();
        } catch { /* ignore */ }
      }
      base.site = meta(html, ['og:site_name']) || base.site;
      base.title = base.title.slice(0, 160);
    }
  } catch { /* sin vista previa: igual sirve el link */ }
  cache.set(url, { at: Date.now(), p: base });
  return base;
}
