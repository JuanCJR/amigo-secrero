// Voz de José Miguel: lee en voz alta lo que dice el globo.
// Primero pide al servidor el audio generado con IA (ElevenLabs); si no está disponible,
// usa la voz que trae el navegador (Web Speech API).
import { ls } from '../lib/storage';

type Listener = () => void;

const hasWindow = typeof window !== 'undefined';
const synth: SpeechSynthesis | null = hasWindow && 'speechSynthesis' in window ? window.speechSynthesis : null;
const player: HTMLAudioElement | null = hasWindow ? new Audio() : null;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

let enabled = ls.get('voice') !== '0';
let voice: SpeechSynthesisVoice | null = null;
let unlocked = false;
/** el servidor dijo que no hay voz de IA (sin clave o sin cuota): no volver a preguntar en esta visita */
let aiOff = false;
let pending: { text: string; onEnd?: () => void } | null = null;
let seq = 0;
const clips = new Map<string, string>();
const listeners = new Set<Listener>();

/** Prefiere voz chilena; si no hay, otra latinoamericana; si no, cualquier español. */
function pickVoice() {
  if (!synth) return;
  const all = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!all.length) return;
  const by = (re: RegExp) => all.filter((v) => re.test(v.lang.replace('_', '-')));
  const male = (vs: SpeechSynthesisVoice[]) => vs.find((v) => /jorge|diego|juan|carlos|pablo|male|hombre|enrique|andr[eé]s|tom[aá]s/i.test(v.name)) ?? vs[0];
  for (const g of [by(/^es-CL/i), by(/^es-(419|US|MX|AR|CO|PE)/i), all]) {
    if (g.length) {
      voice = male(g);
      return;
    }
  }
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

/** Saca emojis y símbolos que no se deben leer en voz alta. */
function clean(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasActivation() {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return unlocked || (ua ? ua.hasBeenActive : false);
}

/** Los navegadores solo dejan sonar audio después de un toque: en el primero se desbloquea y se dice lo pendiente. */
function unlock() {
  if (unlocked) return;
  unlocked = true;
  // iOS exige que el primer sonido ocurra dentro del gesto
  if (player) {
    player.src = SILENT;
    player.play().catch(() => {});
  }
  if (synth) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  }
  if (pending && enabled) {
    const p = pending;
    pending = null;
    speak(p.text, p.onEnd);
  }
}
if (hasWindow) {
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

export const voiceSupported = !!(player || synth);

export function isVoiceOn() {
  return enabled && voiceSupported;
}

export function onVoiceChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function stop() {
  pending = null;
  seq++;
  if (player) {
    player.onended = player.onerror = null;
    player.pause();
  }
  synth?.cancel();
}

function browserSpeak(t: string, done: () => void) {
  if (!synth) return done();
  if (!voice) pickVoice();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = voice?.lang ?? 'es-CL';
  if (voice) u.voice = voice;
  u.rate = 1.08;
  u.pitch = 0.85;
  u.onend = u.onerror = done;
  // Chrome a veces queda pausado tras cancel(): reanudar antes de hablar
  synth.resume();
  synth.speak(u);
}

async function aiClip(t: string): Promise<string | null> {
  if (aiOff) return null;
  const hit = clips.get(t);
  if (hit) return hit;
  try {
    const r = await fetch(`/api/tts?t=${encodeURIComponent(t)}`);
    if (!r.ok) {
      if (r.status === 503) aiOff = true;
      return null;
    }
    const url = URL.createObjectURL(await r.blob());
    clips.set(t, url);
    if (clips.size > 40) {
      const [k, old] = clips.entries().next().value as [string, string];
      URL.revokeObjectURL(old);
      clips.delete(k);
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Dice el texto. Devuelve true si va a hablar (o queda esperando el primer toque);
 * en ese caso onEnd se llama cuando termina.
 */
export function speak(text: string, onEnd?: () => void): boolean {
  if (!voiceSupported || !enabled) return false;
  const t = clean(text);
  if (!t) return false;
  stop();
  if (!hasActivation()) {
    pending = { text, onEnd };
    return false;
  }
  const id = seq;
  const done = () => {
    if (id !== seq) return;
    seq++;
    onEnd?.();
  };
  let fell = false;
  const fallback = () => {
    if (fell || id !== seq) return;
    fell = true;
    browserSpeak(t, done);
  };
  aiClip(t).then((url) => {
    if (id !== seq) return;
    if (!url || !player) return fallback();
    player.onended = done;
    player.onerror = fallback;
    player.src = url;
    player.play().catch(fallback);
  });
  return true;
}

export function setVoiceOn(on: boolean) {
  enabled = on;
  ls.set('voice', on ? '1' : '0');
  if (!on) stop();
  listeners.forEach((l) => l());
}
