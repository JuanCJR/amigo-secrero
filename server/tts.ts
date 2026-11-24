import type { Context } from 'hono';
import type { Store } from './store';

export interface TtsConfig {
  apiKey?: string;
  /** voz de ElevenLabs */
  voiceId?: string;
  model?: string;
  /** tope de caracteres nuevos por mes (protege la cuota de ElevenLabs) */
  monthlyChars?: number;
}

const MAX_LEN = 260;
// "Charlie": voz de fábrica, disponible también en el plan gratis
const DEFAULT_VOICE = 'IKne3meq5aSn9XLyUdCD';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toB64(buf: ArrayBuffer) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

const audio = (body: Uint8Array<ArrayBuffer>) =>
  new Response(body, {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable' },
  });

/**
 * GET /api/tts?t=texto → mp3 con la voz de José Miguel.
 * Cada frase se genera una sola vez en ElevenLabs y queda guardada; si no hay clave o se acabó la cuota,
 * responde 503 y el navegador usa su propia voz.
 */
export function ttsHandler(store: Store, cfg: TtsConfig) {
  const voice = cfg.voiceId || DEFAULT_VOICE;
  const model = cfg.model || DEFAULT_MODEL;
  const budget = cfg.monthlyChars ?? 9000;
  return async (c: Context) => {
    const text = (c.req.query('t') || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_LEN) return c.json({ error: 'bad_text' }, 400);
    const key = `tts:${await sha256(`${voice}|${model}|${text}`)}`;
    const cached = await store.get(key);
    if (cached) return audio(fromB64(cached));
    if (!cfg.apiKey) return c.json({ error: 'tts_off' }, 503);

    const month = `tts:chars:${new Date().toISOString().slice(0, 7)}`;
    const used = Number((await store.get(month)) || 0);
    if (used + text.length > budget) return c.json({ error: 'tts_quota' }, 503);

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': cfg.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: model,
        language_code: 'es',
        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
      }),
    });
    if (!r.ok) return c.json({ error: 'tts_failed' }, 503);
    const buf = await r.arrayBuffer();
    await store.put(month, String(used + text.length), { ttl: 60 * 60 * 24 * 40 });
    await store.put(key, toB64(buf));
    return audio(new Uint8Array(buf));
  };
}
