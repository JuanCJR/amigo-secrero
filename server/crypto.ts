const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function randomId(bytes = 9) {
  return b64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomInt(max: number) {
  // entero uniforme en [0, max)
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

export async function hashPin(pin: string, salt?: string) {
  const s = salt ?? randomId(12);
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(s), iterations: 60000 },
    key,
    256,
  );
  return { salt: s, hash: b64(bits) };
}

export async function verifyPin(pin: string, salt: string, hash: string) {
  const r = await hashPin(pin, salt);
  // comparación de tiempo constante
  if (r.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= r.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

async function aesKey(secret: string, context: string) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`${secret}::${context}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(secret: string, context: string, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(secret, context);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function unseal<T>(secret: string, context: string, sealed: string): Promise<T> {
  const [iv, ct] = sealed.split('.');
  const key = await aesKey(secret, context);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(dec.decode(pt)) as T;
}
