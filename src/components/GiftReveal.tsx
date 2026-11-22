import { forwardRef, useImperativeHandle, useRef } from 'react';
import { gsap, SplitText, prefersReduced, useGSAP } from '../anim/gsap';
import { fx, vibrate } from '../anim/fx';
import { jm } from '../mascot/controller';
import { Avatar } from './Avatar';
import type { Person } from '../api';

export type GiftPhase = 'idle' | 'charging' | 'opening' | 'opened';
export interface GiftHandle {
  startHold(): void;
  release(): void;
  openNow(): void;     // modo sobrio / teclado: abre sin mantener
  skip(): void;
  phase(): GiftPhase;
}

const INK = '#3B2417';
const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

export const GiftReveal = forwardRef<GiftHandle, {
  person: Person; short: boolean; onPhase: (p: GiftPhase) => void;
}>(function GiftReveal({ person, short, onPhase }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const st = useRef({
    phase: 'idle' as GiftPhase, charge: { p: 0 }, hold: null as gsap.core.Tween | null,
    open: null as gsap.core.Timeline | null, t: 0, shakeFn: null as null | ((t: number) => void),
  });
  const set = (p: GiftPhase) => { st.current.phase = p; onPhase(p); };
  const $ = (sel: string) => root.current!.querySelector(sel) as HTMLElement & SVGElement;

  // Entrada: el regalo cae con rebote y squash; José Miguel lo entrega
  useGSAP(() => {
    const s = st.current;
    const gift = $('.g-shake'), ring = $('.g-ring');
    gsap.set($('.reveal-card'), { xPercent: -50, y: 150, scale: 0.4, opacity: 0 });
    gsap.set(ring, { drawSVG: '0% 0%' });
    jm.noSleep = true;
    jm.set('deliver');
    if (!prefersReduced()) {
      gsap.from(gift, { y: -340, duration: 1.15, ease: 'jmDrop', delay: 0.2 });
      gsap.from(gift, { scaleX: 1.25, scaleY: 0.72, ease: 'jmDropSquash', duration: 1.15, delay: 0.2, transformOrigin: '50% 100%' });
      gsap.from('.g-spark', { scale: 0, rotation: -90, duration: 0.8, stagger: 0.12, ease: 'back.out(3)', delay: 1 });
      gsap.to('.g-spark', { scale: 1.25, opacity: 0.55, duration: 1.1, yoyo: true, repeat: -1, stagger: 0.25, ease: 'sine.inOut', delay: 2 });
      // flotación suave en reposo
      gsap.to('.g-float', { y: -7, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.4 });
    }

    // temblor proporcional a la carga (solo transform)
    const tick = (time: number) => {
      const p = s.charge.p;
      if (p <= 0.001) return;
      const amp = p * p * 9;
      gsap.set(gift, {
        x: Math.sin(time * 85) * amp, y: Math.cos(time * 71) * amp * 0.5,
        rotation: Math.sin(time * 63) * amp * 0.55,
        scaleX: 1 + p * 0.05, scaleY: 1 - p * 0.07, transformOrigin: '50% 100%',
      });
      gsap.set('.g-glow', { opacity: p * 0.95, scale: 0.7 + p * 0.9 });
      gsap.set(ring, { drawSVG: `0% ${Math.round(p * 100)}%` });
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); s.hold?.kill(); s.open?.kill(); jm.noSleep = false; };
  }, { scope: root });

  const settle = (fast = false) => {
    const s = st.current;
    gsap.to(s.charge, { p: 0, duration: fast ? 0.2 : 0.55, ease: 'power3.out' });
    gsap.to('.g-shake', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.9, ease: 'elastic.out(1.2,.3)', overwrite: true });
    gsap.to('.g-glow', { opacity: 0, scale: 0.7, duration: 0.5 });
    gsap.to('.g-ring', { drawSVG: '0% 0%', duration: 0.4, ease: 'power2.out' });
  };

  const open = () => {
    const s = st.current;
    if (s.phase === 'opening' || s.phase === 'opened') return;
    set('opening');
    s.hold?.kill();
    const reduced = prefersReduced();
    const card = $('.reveal-card'), nameEl = $('.reveal-name'), av = $('.reveal-card .avatar');
    const center = () => { const r = $('.g-shake').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.3 }; };
    gsap.set(s.charge, { p: 0 });

    if (reduced) {
      // versión sobria: se abre con un solo gesto suave, sin temblor ni confeti
      gsap.set(['.g-lid', '.g-bow', '.g-band'], { opacity: 0 });
      gsap.set('.g-ring', { drawSVG: '0% 0%' });
      nameEl.textContent = person.name;
      gsap.set(card, { y: 0, scale: 1, opacity: 1 });
      jm.set('celebrate');
      set('opened');
      return;
    }

    const tl = gsap.timeline({ onComplete: () => { set('opened'); jm.noSleep = false; } });
    s.open = tl;
    gsap.set('.g-shake', { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    gsap.set('.g-ring', { drawSVG: '0% 100%' });

    /* untie: la cinta se desata */
    tl.addLabel('untie', 0);
    tl.to('.g-bow', { rotation: 14, duration: 0.4, ease: 'jmWobble', transformOrigin: '50% 50%' }, 'untie')
      .to('.g-knot', { scale: 1.5, duration: 0.2, ease: 'power2.out', transformOrigin: '50% 50%' }, 'untie')
      .to('.g-loop-l', { scale: 0, rotation: -140, x: -46, duration: 0.45, ease: 'back.in(2)', transformOrigin: '100% 50%' }, 'untie+=0.3')
      .to('.g-loop-r', { scale: 0, rotation: 140, x: 46, duration: 0.45, ease: 'back.in(2)', transformOrigin: '0% 50%' }, 'untie+=0.3')
      .to('.g-knot', { scale: 0, duration: 0.25, ease: 'back.in(3)' }, 'untie+=0.5')
      .to('.g-tail', { y: 90, rotation: (i) => (i ? 50 : -50), opacity: 0, duration: 0.7, ease: 'power2.in', stagger: 0.05 }, 'untie+=0.4')
      .to('.g-band', { drawSVG: '50% 50%', duration: 0.5, ease: 'power3.inOut' }, 'untie+=0.55')
      .to('.g-ring', { drawSVG: '100% 100%', duration: 0.4, ease: 'power2.in' }, 'untie+=0.4');

    /* pop: sale volando la tapa */
    tl.addLabel('pop', 'untie+=1.05');
    tl.call(() => {
      jm.set('celebrate');
      const c = center();
      fx.confetti(c.x, c.y, { count: 110, power: 880, spread: Math.PI * 1.0 });
      fx.embers(c.x, c.y + 20, 22);
      vibrate([25, 30, 70]);
    }, undefined, 'pop');
    tl.to('.g-lid', { y: -250, x: -60, rotation: -42, duration: 0.8, ease: 'power3.out' }, 'pop')
      .to('.g-lid', { y: 340, x: -150, rotation: -200, opacity: 0, duration: 0.9, ease: 'power2.in' }, 'pop+=0.8')
      .to('.g-shake', { scaleY: 0.84, scaleX: 1.1, duration: 0.1, ease: 'power2.in', transformOrigin: '50% 100%' }, 'pop')
      .to('.g-shake', { scaleY: 1, scaleX: 1, duration: 0.9, ease: 'elastic.out(1.4,.28)' }, 'pop+=0.1')
      .fromTo('.g-glow', { opacity: 1, scale: 0.8 }, { opacity: 0, scale: 3.2, duration: 0.9, ease: 'power2.out' }, 'pop')
      .to('.g-ring', { opacity: 0, duration: 0.3 }, 'pop');

    /* card: la carta sube desde adentro */
    tl.addLabel('card', 'pop+=0.2');
    tl.fromTo(card, { y: 150, scale: 0.4, rotation: -14, opacity: 1 }, { y: 0, scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(1.9)' }, 'card');
    tl.fromTo(av, { scale: 0 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1.2,.35)' }, 'card+=0.55');

    /* name: letras que se mezclan y se asientan, con rebote final */
    tl.addLabel('name', 'card+=0.7');
    tl.to(nameEl, { duration: 1.3, ease: 'none', scrambleText: { text: person.name, chars: LETTERS, speed: 0.55, revealDelay: 0.3, tweenLength: false } }, 'name');
    tl.call(() => {
      const split = SplitText.create(nameEl, { type: 'chars', aria: 'none' }) as unknown as { chars: Element[]; revert: () => void };
      gsap.fromTo(split.chars, { y: 0, scale: 1 }, {
        keyframes: [{ y: -16, scale: 1.35, duration: 0.14 }, { y: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1.4,.3)' }],
        stagger: 0.05, onComplete: () => split.revert(),
      });
      const c = center();
      fx.rain(60);
      fx.sparkle(c.x, c.y - 90, 16, 120);
      jm.hop(1.3);
      vibrate(40);
    }, undefined, 'name+=1.35');
    tl.to({}, { duration: 0.9 });
    if (short) tl.timeScale(1.6);
  };

  useImperativeHandle(ref, () => ({
    phase: () => st.current.phase,
    startHold() {
      const s = st.current;
      if (s.phase !== 'idle' && s.phase !== 'charging') return;
      if (prefersReduced()) return;
      set('charging');
      jm.set('cover');
      vibrate(10);
      s.hold?.kill();
      gsap.killTweensOf(s.charge);
      gsap.killTweensOf('.g-shake');
      s.hold = gsap.to(s.charge, { p: 1, duration: short ? 0.75 : 1.9, ease: 'power1.in', onComplete: open });
    },
    release() {
      const s = st.current;
      if (s.phase !== 'charging') return;
      s.hold?.kill();
      set('idle');
      jm.set('deliver');
      settle();
    },
    openNow() { open(); },
    skip() { const s = st.current; if (s.phase === 'opening' && s.open) s.open.progress(1, false); },
  }));

  return (
    <div className="gift-stage" ref={root}>
      <div className="g-float">
        <svg className="gift-svg" viewBox="0 0 240 260" aria-hidden="true" overflow="visible">
          <circle className="g-ring" cx="120" cy="150" r="112" fill="none" stroke="#FFB347" strokeWidth="6" strokeLinecap="round" opacity=".9" />
          <circle className="g-glow" cx="120" cy="140" r="100" fill="url(#gGlow)" opacity="0" />
          <defs>
            <radialGradient id="gGlow"><stop offset="0" stopColor="#FFE9A0" stopOpacity=".95" /><stop offset=".5" stopColor="#FF8A3D" stopOpacity=".5" /><stop offset="1" stopColor="#FF6B2C" stopOpacity="0" /></radialGradient>
            <linearGradient id="gRed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E23548" /><stop offset="1" stopColor="#B91F30" /></linearGradient>
          </defs>
          <g className="g-spark" style={{ transformOrigin: '30px 60px' }}><path d="M30 44 L34 56 L46 60 L34 64 L30 76 L26 64 L14 60 L26 56 Z" fill="#F6C453" /></g>
          <g className="g-spark" style={{ transformOrigin: '212px 90px' }}><path d="M212 74 L215 85 L226 90 L215 95 L212 106 L209 95 L198 90 L209 85 Z" fill="#FFF1D6" /></g>
          <g className="g-spark" style={{ transformOrigin: '206px 30px' }}><path d="M206 20 L208 28 L216 30 L208 32 L206 40 L204 32 L196 30 L204 28 Z" fill="#F6C453" /></g>

          <g className="g-shake">
            {/* caja */}
            <rect x="40" y="112" width="160" height="124" rx="10" fill="url(#gRed)" stroke={INK} strokeWidth="5" />
            <rect x="106" y="112" width="28" height="124" fill="#F6C453" stroke={INK} strokeWidth="4" />
            <path d="M52 130 L52 224" stroke="#fff" strokeOpacity=".22" strokeWidth="6" strokeLinecap="round" />
            {/* cinta horizontal (se des-dibuja al abrir) */}
            <path className="g-band" d="M40 178 H200" stroke={INK} strokeWidth="24" strokeLinecap="butt" fill="none" />
            <path className="g-band" d="M40 178 H200" stroke="#F6C453" strokeWidth="15" strokeLinecap="butt" fill="none" />
            {/* tapa */}
            <g className="g-lid" style={{ transformOrigin: '120px 100px' }}>
              <rect x="30" y="82" width="180" height="38" rx="9" fill="#C42336" stroke={INK} strokeWidth="5" />
              <rect x="104" y="82" width="32" height="38" fill="#F6C453" stroke={INK} strokeWidth="4" />
            </g>
            {/* moño */}
            <g className="g-bow" transform="translate(0 0)">
              <g className="g-tail" style={{ transformOrigin: '110px 184px' }}><path d="M112 184 L96 226 L108 222 L116 232 L124 190 Z" fill="#F6C453" stroke={INK} strokeWidth="4" strokeLinejoin="round" /></g>
              <g className="g-tail" style={{ transformOrigin: '130px 184px' }}><path d="M128 184 L144 226 L132 222 L124 232 L116 190 Z" fill="#E8B23A" stroke={INK} strokeWidth="4" strokeLinejoin="round" /></g>
              <path className="g-loop-l" d="M118 178 C96 150 62 160 76 184 C86 196 108 188 118 178 Z" fill="#F6C453" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
              <path className="g-loop-r" d="M122 178 C144 150 178 160 164 184 C154 196 132 188 122 178 Z" fill="#F6C453" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
              <circle className="g-knot" cx="120" cy="180" r="11" fill="#E8B23A" stroke={INK} strokeWidth="4.5" />
            </g>
          </g>
        </svg>
      </div>

      <div className="reveal-card" aria-live="off">
        <span className="reveal-kicker">Tu amigo secreto es</span>
        <Avatar p={person} size={74} flipId="receiver" />
        <span className="reveal-name">{' '}</span>
      </div>
    </div>
  );
});
