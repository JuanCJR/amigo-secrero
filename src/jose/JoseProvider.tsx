import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { gsap, motion } from '../lib/gsap';
import { Rig } from './Rig';
import { JoseController, SMOKE_RATE, type Mood, type Reaction } from './controller';

export interface Say {
  text: string;
  mood?: Mood;
  /** selector o elemento que José debe señalar */
  point?: string | HTMLElement | null;
  /** no tocar el estado de ánimo (escenas hero lo controlan) */
  keepMood?: boolean;
}
interface Msg extends Say {
  id: number;
}

interface JoseApi {
  say: (s: Say | string) => void;
  setMood: (m: Mood, target?: { x: number; y: number }) => void;
  react: (r: Reaction) => void;
  ctrl: () => JoseController | null;
  msg: Msg | null;
  smokeBurst: (to: { x: number; y: number }, n?: number) => void;
  puff: (x: number, y: number, opts?: { size?: number; rise?: number; life?: number }) => void;
  registerSlot: (el: HTMLElement) => () => void;
  holderEl: () => HTMLDivElement | null;
  reposition: (instant?: boolean) => void;
  setTyping: (b: boolean) => void;
}

const Ctx = createContext<JoseApi | null>(null);
export const useJose = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('JoseProvider faltante');
  return c;
};

const BASE_W = 120;
const BASE_H = 150;

const QUIPS = [
  '¡Jaja, cosquillas no! Sigue con el botón grande de abajo.',
  'Oye, cuidado que me apagas. Tú dale nomás, yo te guío.',
  'Tranqui, aquí estoy. Cuando quieras, toca el botón de abajo.',
];

export function JoseProvider({ children }: { children: ReactNode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const smokeRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<JoseController | null>(null);
  const slots = useRef<HTMLElement[]>([]);
  const lastRect = useRef('');
  const scaleRef = useRef(1);
  const [msg, setMsg] = useState<Msg | null>(null);
  const msgRef = useRef<Msg | null>(null);
  const baseMood = useRef<Mood>('idle');
  const sleeping = useRef(false);
  const quipping = useRef<gsap.core.Tween | null>(null);
  const idCounter = useRef(0);
  const typing = useRef(false);
  const pool = useRef<HTMLDivElement[]>([]);

  // ---------- humo ----------
  const getPuff = () => {
    let el = pool.current.pop();
    if (!el) {
      el = document.createElement('div');
      el.className = 'puff';
      smokeRef.current?.appendChild(el);
    }
    return el;
  };
  const release = (el: HTMLDivElement) => {
    gsap.set(el, { opacity: 0 });
    pool.current.push(el);
  };
  const puff = useCallback((x: number, y: number, o: { size?: number; rise?: number; life?: number } = {}) => {
    if (motion.reduced || !smokeRef.current) return;
    const el = getPuff();
    const s = (o.size ?? 26) * scaleRef.current;
    const life = o.life ?? gsap.utils.random(2.4, 3.6);
    gsap.set(el, { width: s, height: s, x: x - s / 2, y: y - s / 2, scale: 0.3, opacity: 0, rotation: gsap.utils.random(0, 360) });
    const tl = gsap.timeline({ onComplete: () => release(el) });
    tl.to(el, { opacity: gsap.utils.random(0.45, 0.7), duration: 0.3, ease: 'power1.out' }, 0)
      .to(el, { y: `-=${(o.rise ?? gsap.utils.random(70, 120)) * scaleRef.current}`, duration: life, ease: 'sine.out' }, 0)
      .to(el, { x: `+=${gsap.utils.random(-28, 34) * scaleRef.current}`, duration: life, ease: 'sine.inOut' }, 0)
      .to(el, { scale: gsap.utils.random(1.8, 2.8), rotation: '+=120', duration: life, ease: 'power1.out' }, 0)
      .to(el, { opacity: 0, duration: life * 0.55, ease: 'power1.in' }, life * 0.45);
  }, []);

  const smokeBurst = useCallback((to: { x: number; y: number }, n = 5) => {
    const c = ctrlRef.current;
    if (!c || motion.reduced) return;
    const from = c.emberScreen();
    for (let i = 0; i < n; i++) {
      const el = getPuff();
      const s = gsap.utils.random(14, 24);
      gsap.set(el, { width: s, height: s, x: from.x - s / 2, y: from.y - s / 2, scale: 0.4, opacity: 0.8 });
      const midX = (from.x + to.x) / 2 + gsap.utils.random(-20, 20);
      const midY = Math.min(from.y, to.y) - gsap.utils.random(20, 50);
      gsap
        .timeline({ delay: i * 0.05, onComplete: () => release(el) })
        .to(el, {
          motionPath: { path: [{ x: midX - s / 2, y: midY - s / 2 }, { x: to.x - s / 2 + gsap.utils.random(-12, 12), y: to.y - s / 2 + gsap.utils.random(-10, 10) }], curviness: 1.4 },
          scale: 2.2,
          duration: 0.45,
          ease: 'power2.inOut',
        })
        .to(el, { opacity: 0, scale: 3, duration: 0.25 }, '-=0.1');
    }
  }, []);

  // ---------- slots: José se traslada entre zonas reservadas ----------
  const reposition = useCallback((instant = false) => {
    const holder = holderRef.current;
    const slot = slots.current[slots.current.length - 1];
    if (!holder || !slot) return;
    const r = slot.getBoundingClientRect();
    const key = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    if (key === lastRect.current && !instant) return;
    const first = lastRect.current === '';
    lastRect.current = key;
    const scale = Math.min(r.width / BASE_W, r.height / BASE_H);
    scaleRef.current = scale;
    const x = r.left + (r.width - BASE_W * scale) / 2;
    const y = r.top + r.height - BASE_H * scale;
    if (first || instant || motion.reduced) gsap.set(holder, { x, y, scale });
    else gsap.to(holder, { x, y, scale, duration: 0.75, ease: 'back.inOut(1.3)', overwrite: 'auto' });
  }, []);

  const registerSlot = useCallback(
    (el: HTMLElement) => {
      slots.current.push(el);
      requestAnimationFrame(() => reposition());
      return () => {
        slots.current = slots.current.filter((s) => s !== el);
        requestAnimationFrame(() => reposition());
      };
    },
    [reposition],
  );

  // ---------- controlador ----------
  useLayoutEffect(() => {
    const c = new JoseController(svgRef.current!);
    ctrlRef.current = c;
    if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __jose: JoseController }).__jose = c;
    gsap.set(holderRef.current, { transformOrigin: '0 0' });
    return () => c.destroy();
  }, []);

  useEffect(() => {
    // humo constante según el estado de ánimo
    let call: gsap.core.Tween;
    let zCount = 0;
    const loop = () => {
      const c = ctrlRef.current;
      if (c && !document.hidden) {
        const e = c.emberScreen();
        if (c.mood === 'sleeping') {
          if (zCount++ % 3 === 0) emitZ(e.x, e.y);
        } else puff(e.x + gsap.utils.random(-6, 6), e.y);
      }
      const rate = c ? SMOKE_RATE[c.mood] : 1;
      call = gsap.delayedCall(gsap.utils.random(0.6, 1.1) / rate, loop);
    };
    const emitZ = (x: number, y: number) => {
      if (motion.reduced || !smokeRef.current) return;
      const z = document.createElement('div');
      z.className = 'zzz';
      z.textContent = 'z';
      smokeRef.current.appendChild(z);
      gsap.set(z, { x, y: y - 10, scale: 0.4, opacity: 0 });
      gsap
        .timeline({ onComplete: () => z.remove() })
        .to(z, { opacity: 0.9, scale: 1 * scaleRef.current + 0.3, duration: 0.5 })
        .to(z, { y: `-=${70 * scaleRef.current}`, x: `+=${30 * scaleRef.current}`, rotation: 20, duration: 2.4, ease: 'sine.out' }, 0)
        .to(z, { opacity: 0, duration: 0.8 }, 1.6);
    };
    loop();

    const look = gsap.delayedCall(2.5, function tick() {
      ctrlRef.current?.idleLook();
      look.restart(true);
    });

    const iv = window.setInterval(() => reposition(), 350);
    const onResize = () => reposition(true);
    window.addEventListener('resize', onResize);

    // mirada y modo dormido
    let idleTimer = 0;
    const SLEEP_MS = 45000;
    const armSleep = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        const c = ctrlRef.current;
        if (!c || typing.current) return armSleep();
        sleeping.current = true;
        c.setMood('sleeping');
        setMsg({ id: ++idCounter.current, text: 'Zzz… me quedé pegado. Toca la pantalla cuando quieras seguir.', keepMood: true });
      }, SLEEP_MS);
    };
    const onActivity = (e: Event) => {
      if (e instanceof PointerEvent) ctrlRef.current?.lookAt(e.clientX, e.clientY);
      if (sleeping.current) {
        sleeping.current = false;
        const prev = msgRef.current;
        ctrlRef.current?.setMood(baseMood.current === 'pointing' ? 'idle' : baseMood.current);
        if (prev) setMsg({ ...prev, id: ++idCounter.current });
      }
      armSleep();
    };
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    armSleep();
    return () => {
      call?.kill();
      look.kill();
      window.clearInterval(iv);
      window.clearTimeout(idleTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [puff, reposition]);

  const say = useCallback((s: Say | string) => {
    const m: Say = typeof s === 'string' ? { text: s } : s;
    quipping.current?.kill();
    quipping.current = null;
    sleeping.current = false;
    const full: Msg = { ...m, id: ++idCounter.current };
    msgRef.current = full;
    if (!m.keepMood) baseMood.current = m.mood ?? (m.point ? 'pointing' : 'idle');
    setMsg(full);
  }, []);

  const onTap = () => {
    const c = ctrlRef.current;
    if (!c) return;
    c.react('tickle');
    c.react('flare');
    const e = c.emberScreen();
    for (let i = 0; i < 4; i++) puff(e.x, e.y, { size: 18, rise: 60, life: 1.6 });
    const prev = msgRef.current;
    if (!prev || prev.keepMood || quipping.current) return;
    setMsg({ id: ++idCounter.current, text: QUIPS[Math.floor(Math.random() * QUIPS.length)], keepMood: true });
    quipping.current = gsap.delayedCall(3.2, () => {
      quipping.current = null;
      if (msgRef.current === prev) setMsg({ ...prev, id: ++idCounter.current });
    });
  };

  const api = useMemo<JoseApi>(
    () => ({
      say,
      setMood: (m, target) => ctrlRef.current?.setMood(m, { target }),
      react: (r) => ctrlRef.current?.react(r),
      ctrl: () => ctrlRef.current,
      msg,
      smokeBurst,
      puff,
      registerSlot,
      holderEl: () => holderRef.current,
      reposition,
      setTyping: (b) => {
        typing.current = b;
        ctrlRef.current?.talk(b);
      },
    }),
    [say, msg, smokeBurst, puff, registerSlot, reposition],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="smoke-layer" ref={smokeRef} aria-hidden="true" />
      <div className="jm-layer" aria-hidden="true">
        <div className="jm-holder" ref={holderRef} onPointerDown={onTap} style={{ width: BASE_W, height: BASE_H }}>
          <Rig ref={svgRef} uid="jm" />
        </div>
      </div>
    </Ctx.Provider>
  );
}

/** Zona reservada donde José se para (nunca encima del contenido). */
export function JoseSlot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { registerSlot } = useJose();
  useLayoutEffect(() => registerSlot(ref.current!), [registerSlot]);
  return <div ref={ref} className={`jm-slot ${className ?? ''}`} aria-hidden="true" />;
}

/** Atajo: José dice algo al montar la pantalla. */
export function useSay(s: Say | string | null, deps: unknown[] = []) {
  const { say } = useJose();
  useEffect(() => {
    if (s) say(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
