// Voz de José Miguel: lee en voz alta lo que dice el globo (Web Speech API, sin servidor).
import { ls } from '../lib/storage';

type Listener = () => void;

const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let enabled = ls.get('voice') !== '0';
let voice: SpeechSynthesisVoice | null = null;
let unlocked = false;
let pending: { text: string; onEnd?: () => void } | null = null;
let current: SpeechSynthesisUtterance | null = null;
const listeners = new Set<Listener>();

/** Prefiere voz chilena; si no hay, otra latinoamericana; si no, cualquier español. */
function pickVoice() {
  if (!synth) return;
  const all = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!all.length) return;
  const by = (re: RegExp) => all.filter((v) => re.test(v.lang.replace('_', '-')));
  const male = (vs: SpeechSynthesisVoice[]) => vs.find((v) => /jorge|diego|juan|carlos|pablo|male|hombre|enrique|andr[eé]s|tom[aá]s/i.test(v.name)) ?? vs[0];
  const groups = [by(/^es-CL/i), by(/^es-(419|US|MX|AR|CO|PE)/i), all];
  for (const g of groups) {
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

/** Saca emojis y símbolos que el lector diría en voz alta. */
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

/** Los navegadores solo dejan hablar después de un toque: en el primero se desbloquea y se dice lo pendiente. */
function unlock() {
  if (unlocked || !synth) return;
  unlocked = true;
  // iOS exige que la primera locución ocurra dentro del gesto
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
  if (pending && enabled) {
    const p = pending;
    pending = null;
    speak(p.text, p.onEnd);
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

export const voiceSupported = !!synth;

export function isVoiceOn() {
  return enabled && !!synth;
}

export function onVoiceChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function stop() {
  pending = null;
  if (!synth) return;
  const c = current;
  current = null;
  if (c) c.onend = c.onerror = null;
  synth.cancel();
}

/**
 * Dice el texto. Devuelve true si va a hablar (o queda esperando el primer toque);
 * en ese caso onEnd se llama cuando termina.
 */
export function speak(text: string, onEnd?: () => void): boolean {
  if (!synth || !enabled) return false;
  const t = clean(text);
  if (!t) return false;
  stop();
  if (!hasActivation()) {
    pending = { text, onEnd };
    return false;
  }
  if (!voice) pickVoice();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = voice?.lang ?? 'es-CL';
  if (voice) u.voice = voice;
  u.rate = 1.08;
  u.pitch = 0.85;
  const done = () => {
    if (current !== u) return;
    current = null;
    onEnd?.();
  };
  u.onend = done;
  u.onerror = done;
  current = u;
  // Chrome a veces queda pausado tras cancel(): reanudar antes de hablar
  synth.resume();
  synth.speak(u);
  return true;
}

export function setVoiceOn(on: boolean) {
  enabled = on;
  ls.set('voice', on ? '1' : '0');
  if (!on) stop();
  listeners.forEach((l) => l());
}
