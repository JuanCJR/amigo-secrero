import { useEffect, useRef, useState } from 'react';
import { gsap, SplitText, prefersReduced, useGSAP } from '../anim/gsap';
import { fx } from '../anim/fx';
import { jm, type JMState } from './controller';
import { clearSlot, setSlot } from './slots';

export interface Msg { text: string; kind?: 'info' | 'error' | 'success'; nonce: number }
let nonceCounter = 1;
export const mk = (text: string, kind: Msg['kind'] = 'info'): Msg => ({ text, kind, nonce: nonceCounter++ });

const seen = new Set<string>();
const PUNCT = /[.,!?¡¿:;…]/;

export function MascotSlot({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    setSlot(el);
    return () => clearSlot(el);
  }, []);
  return <div ref={ref} className={`jm-slot ${className}`} aria-hidden="true" />;
}

export function Bubble({ msg, onTyped }: { msg: Msg; onTyped?: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const cb = useRef(onTyped);
  cb.current = onTyped;

  useGSAP(() => {
    const p = textRef.current!;
    const bubble = root.current!;
    let done = false;
    let split = null as { chars: Element[]; revert: () => void } | null;
    const finish = () => {
      if (done) return;
      done = true;
      jm.talkEnd();
      cb.current?.();
    };

    if (prefersReduced()) {
      gsap.set(bubble, { opacity: 1 });
      jm.talkStart();
      gsap.delayedCall(0.7, finish);
      return () => { finish(); };
    }
    jm.puff();
    gsap.fromTo(bubble, { scale: 0.15, rotation: -5, opacity: 0, transformOrigin: '0% 65%' },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.75, ease: 'jmPop' });
    gsap.fromTo(bubble.querySelectorAll('.bubble-puff'),
      { scale: 0.2, opacity: 0.75 },
      { scale: () => gsap.utils.random(1.6, 2.6), opacity: 0, duration: 0.9, stagger: 0.05, ease: 'power2.out' });

    const sp = SplitText.create(p, { type: 'words,chars', aria: 'none' }) as unknown as { chars: Element[]; revert: () => void };
    split = sp;
    const chars = sp.chars as HTMLElement[];
    if (!chars.length) { sp.revert(); finish(); return () => { finish(); }; }
    gsap.set(chars, { opacity: 0 });
    const fast = seen.has(msg.text);
    seen.add(msg.text);
    const step = fast ? 0.008 : 0.019;
    const tl = gsap.timeline({ onComplete: finish });
    let t = 0.28;
    tl.call(() => jm.talkStart(), undefined, 0.2);
    chars.forEach((c) => {
      tl.fromTo(c, { opacity: 0, y: 4, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.14, ease: 'back.out(2)' }, t);
      t += PUNCT.test(c.textContent ?? '') ? (fast ? 0.05 : 0.12) : step;
    });
    const skip = () => {
      if (tl.progress() < 1) { tl.progress(1, false); } 
      finish();
    };
    bubble.addEventListener('pointerdown', skip);
    return () => {
      bubble.removeEventListener('pointerdown', skip);
      tl.kill();
      split?.revert();
      finish();
    };
  }, { dependencies: [msg.nonce], scope: root });

  const live = msg.kind === 'error' ? 'alert' : 'status';
  return (
    <div className={`bubble bubble--${msg.kind ?? 'info'}`} ref={root} key={msg.nonce}>
      <div className="sr-only" role={live} aria-live={msg.kind === 'error' ? 'assertive' : 'polite'}>
        José Miguel dice: {msg.text}
      </div>
      <p className="bubble-text" ref={textRef} aria-hidden="true" title="Toca para leer todo">{msg.text}</p>
      <span className="bubble-tail" aria-hidden="true" />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="bubble-puff" aria-hidden="true" style={{ left: `${-4 + i * 4}%`, top: `${[10, 70, 35, 90, 0, 55][i]}%` }} />
      ))}
    </div>
  );
}

const POKES = ['¡Jaja, cosquillas!', 'Ey, tranqui, que me apagas la brasa.', 'Todo bien por acá. ¿Seguimos?', '¡Auch! Eso es mi brasa, ojo.'];

/** Zona de José Miguel: su hueco + su globo. Siempre dice qué hacer ahora. */
export function Guide({ msg, base = 'idle', bubbleOnly = false, onTyped }: {
  msg: Msg; base?: JMState; bubbleOnly?: boolean; onTyped?: () => void;
}) {
  const [override, setOverride] = useState<Msg | null>(null);
  const shown = override ?? msg;

  useEffect(() => { jm.set(base); }, [base]);
  useEffect(() => { setOverride(null); }, [msg.nonce]);
  useEffect(() => {
    if (msg.kind === 'error') jm.flash('worried', 3400);
    if (msg.kind === 'success') {
      jm.flash('celebrate', 1900);
      const p = jm.centerPos();
      fx.confetti(p.x, p.y, { count: 28, power: 420, spread: Math.PI * 0.8 });
    }
  }, [msg.nonce, msg.kind]);
  useEffect(() => {
    let n = 0, last = 0;
    const on = () => {
      if (Date.now() - last < 1500) return;
      last = Date.now();
      setOverride(mk(POKES[n++ % POKES.length]));
    };
    window.addEventListener('jm:poke', on);
    return () => window.removeEventListener('jm:poke', on);
  }, [setOverride]);

  return (
    <section className={`guide ${bubbleOnly ? 'guide--bubble-only' : ''}`} aria-label="José Miguel">
      {!bubbleOnly && <MascotSlot />}
      <Bubble msg={shown} onTyped={onTyped} />
    </section>
  );
}

