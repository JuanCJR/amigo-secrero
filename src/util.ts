/** Misma regla que el servidor: normaliza lo que la persona pegó. */
export function normalizeUrl(raw: string): string | null {
  let s = (raw ?? '').trim();
  if (!s || s.length > 800 || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') || u.hostname.endsWith('.')) return null;
    return u.toString();
  } catch { return null; }
}
