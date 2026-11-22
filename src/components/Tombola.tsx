import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Matter from 'matter-js';
import { gsap, prefersReduced, rand } from '../anim/gsap';
import { fx, vibrate } from '../anim/fx';
import { jm } from '../mascot/controller';
import { Avatar } from './Avatar';

const W = 320, H = 360, CX = 150, CY = 150, R = 130, BR = 21;
const { Engine, Bodies, Body, Composite } = Matter;

export interface BallPerson { id: number; name: string; color: number; lit?: boolean }
export interface PlayOpts {
  chips: Map<number, HTMLElement> | null;
  speed?: number;
  onLand?: (id: number) => void;
  onPhase?: (p: 'spin' | 'hush' | 'pop' | 'land') => void;
}
export interface TombolaHandle {
  play(o: PlayOpts): Promise<'done' | 'skipped'>;
  skip(): void;
  isPlaying(): boolean;
}
interface Pos { x: number; y: number; rot: number; s: number; o: number; phys: boolean }

/** Tómbola navideña: física real con gravedad giratoria + coreografía GSAP. */
export const Tombola = forwardRef<TombolaHandle, { people: BallPerson[]; idle?: boolean }>(function Tombola({ people, idle = true }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const shake = useRef<HTMLDivElement>(null);
  const lid = useRef<SVGGElement>(null);
  const crank = useRef<SVGGElement>(null);
  const spin = useRef<SVGGElement>(null);
  const heat = useRef<SVGCircleElement>(null);
  const balls = useRef(new Map<number, HTMLElement>());
  const sim = useRef({
    engine: null as Matter.Engine | null,
    bodies: new Map<number, Matter.Body>(),
    pos: new Map<number, Pos>(),
    phi: 0, omega: { v: 0 }, drum: 0, k: 1, playing: false, tl: null as gsap.core.Timeline | null,
    finish: null as null | (() => void), resolve: null as null | ((v: 'done' | 'skipped') => void),
  });
  const peopleKey = people.map((p) => `${p.id}:${p.lit ?? 1}`).join(',');

  useEffect(() => {
    const s = sim.current;
    const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0016 } });
    s.engine = engine;
    s.bodies.clear(); s.pos.clear();
    // paredes: anillo de segmentos
    const segs = 40, T = 50;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const len = ((2 * Math.PI * (R + T / 2)) / segs) * 1.2;
      const b = Bodies.rectangle(CX + Math.cos(a) * (R + T / 2), CY + Math.sin(a) * (R + T / 2), len, T, { isStatic: true, angle: a + Math.PI / 2, friction: 0.05, restitution: 0.4 });
      Composite.add(engine.world, b);
    }
    const addBody = (id: number, x: number, y: number, vx = 0, vy = 0) => {
      const b = Bodies.circle(x, y, BR, { restitution: 0.62, friction: 0.02, frictionAir: 0.006, density: 0.0012 });
      Body.setVelocity(b, { x: vx, y: vy });
      Composite.add(engine.world, b);
      s.bodies.set(id, b);
      const p = s.pos.get(id)!;
      p.phys = true;
    };
    (s as any).addBody = addBody;
    people.forEach((p) => s.pos.set(p.id, { x: CX, y: CY + 60, rot: 0, s: 1, o: idle ? 1 : 0, phys: false }));
    if (idle) {
      const placed: { x: number; y: number }[] = [];
      people.forEach((p) => {
        for (let t = 0; t < 40; t++) {
          const x = CX + rand(-80, 80), y = CY + rand(10, 95);
          if (Math.hypot(x - CX, y - CY) < R - BR - 4 && placed.every((q) => Math.hypot(q.x - x, q.y - y) > BR * 2.1)) { placed.push({ x, y }); addBody(p.id, x, y); return; }
        }
        addBody(p.id, CX + rand(-40, 40), CY + 40);
      });
      for (let i = 0; i < 160; i++) Engine.update(engine, 16.6);
    }

    const measure = () => { s.k = box.current!.clientWidth / W; gsap.set(inner.current, { scale: s.k, transformOrigin: '0 0' }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box.current!);

    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs, 16.6);
      if (s.bodies.size) {
        s.phi += (s.omega.v * dt) / 1000;
        engine.gravity.x = Math.sin(s.phi);
        engine.gravity.y = Math.cos(s.phi);
        Engine.update(engine, dt);
        s.bodies.forEach((b, id) => {
          const p = s.pos.get(id)!;
          if (p.phys) { p.x = b.position.x; p.y = b.position.y; p.rot = (b.angle * 180) / Math.PI; }
        });
      }
      s.drum += (s.omega.v * dt * 57.3) / 1000;
      spin.current?.setAttribute('transform', `rotate(${s.drum} ${CX} ${CY})`);
      crank.current && crank.current.setAttribute('transform', `rotate(${s.drum * 1.6} 28 300)`);
      s.pos.forEach((p, id) => {
        const el = balls.current.get(id);
        if (el) {
          el.style.transform = `translate3d(${p.x - BR}px,${p.y - BR}px,0) rotate(${p.rot}deg) scale(${p.s})`;
          el.style.opacity = String(p.o);
        }
      });
    };
    gsap.ticker.add(tick);

    // pequeños empujones para que el idle "respire"
    const kick = gsap.delayedCall(2.4, function loop() {
      if (!s.playing && !prefersReduced() && s.engine) {
        const arr = Array.from(s.bodies.values());
        if (arr.length) Body.setVelocity(arr[(Math.random() * arr.length) | 0], { x: rand(-5, 5), y: -rand(4, 8) });
      }
      gsap.delayedCall(rand(1.8, 3.2), loop);
    });
    return () => { gsap.ticker.remove(tick); ro.disconnect(); kick.kill(); gsap.killTweensOf(s.omega); s.tl?.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleKey]);

  const toLogical = (el: Element) => {
    const s = sim.current;
    const r = el.getBoundingClientRect(), ir = inner.current!.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - ir.left) / s.k, y: (r.top + r.height / 2 - ir.top) / s.k, w: r.width / s.k };
  };
  const screenPos = () => {
    const r = inner.current!.getBoundingClientRect();
    return { x: r.left + (CX * sim.current.k), y: r.top + (CY * sim.current.k) };
  };

  useImperativeHandle(ref, () => ({
    isPlaying: () => sim.current.playing,
    skip() { sim.current.tl?.kill(); sim.current.finish?.(); },
    play(o) {
      const s = sim.current;
      const engine = s.engine!;
      return new Promise((resolve) => {
        s.playing = true;
        s.resolve = resolve;
        const speed = o.speed ?? 1;
        const reduced = prefersReduced();
        const ids = people.map((p) => p.id);
        const chipOf = (id: number) => (o.chips?.get(id) ? toLogical(o.chips.get(id)!) : { x: CX, y: H + 30, w: 36 });
        const addBody = (s as any).addBody as (id: number, x: number, y: number, vx?: number, vy?: number) => void;

        // estado inicial: sin cuerpos, bolitas "en su casillero"
        s.bodies.forEach((b) => Composite.remove(engine.world, b));
        s.bodies.clear();
        s.omega.v = 0; s.phi = 0; s.drum = 0;
        ids.forEach((id) => {
          const c = chipOf(id), p = s.pos.get(id)!;
          Object.assign(p, { x: c.x, y: c.y, rot: 0, s: Math.max(0.3, c.w / (BR * 2)), o: 0, phys: false });
        });
        gsap.set(lid.current, { y: 0, rotation: 0, opacity: 1 });
        gsap.set(heat.current, { opacity: 0, scale: 0.6 });

        const finish = () => {
          gsap.killTweensOf(s.omega);
          s.bodies.forEach((b) => Composite.remove(engine.world, b));
          s.bodies.clear();
          ids.forEach((id) => {
            const c = chipOf(id), p = s.pos.get(id)!;
            gsap.killTweensOf(p);
            Object.assign(p, { x: c.x, y: c.y, s: Math.max(0.3, c.w / (BR * 2)), o: 0, phys: false });
            o.onLand?.(id);
          });
          s.omega.v = 0;
          gsap.set(lid.current, { y: 0, rotation: 0 });
          gsap.set(heat.current, { opacity: 0 });
          gsap.set(shake.current, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
          jm.noSleep = false;
          s.playing = false;
          s.finish = null;
          jm.set('celebrate');
          const r = s.resolve; s.resolve = null; r?.('done');
        };
        s.finish = finish;
        jm.noSleep = true;

        const tl = gsap.timeline({ onComplete: finish, defaults: { ease: 'power2.out' } });
        s.tl = tl;

        if (reduced) {
          // versión sobria: las bolitas aparecen en la tómbola y pasan a la lista
          ids.forEach((id, i) => {
            const p = s.pos.get(id)!, c = chipOf(id);
            tl.set(p, { x: CX + rand(-60, 60), y: CY + rand(0, 70), s: 1, o: 1 }, 0);
            tl.to(p, { x: c.x, y: c.y, s: Math.max(0.3, c.w / (BR * 2)), duration: 0.5, ease: 'power2.inOut' }, 0.9 + i * 0.04);
            tl.call(() => o.onLand?.(id), undefined, 1.4 + i * 0.04);
          });
          tl.to({}, { duration: 0.2 });
          return;
        }

        /* ── 1) ENTRADA: las bolitas saltan desde su casillero a la tómbola (stagger) ── */
        tl.addLabel('enter', 0);
        ids.forEach((id, i) => {
          const p = s.pos.get(id)!;
          const sx = CX + rand(-48, 48), sy = CY - R + 52;
          const t0 = i * 0.11;
          tl.set(p, { o: 1 }, t0);
          tl.to(p, { x: sx, duration: 0.8, ease: 'power1.out' }, t0);
          tl.to(p, { y: sy, duration: 0.8, ease: 'back.in(0.8)' }, t0);
          tl.to(p, { s: 1, rot: rand(-200, 200), duration: 0.8, ease: 'back.out(2)' }, t0);
          tl.call(() => { addBody(id, sx, sy, rand(-2, 2), 2); vibrate(4); }, undefined, t0 + 0.8);
        });
        const enterEnd = ids.length * 0.11 + 0.8;

        /* ── 2) ANTICIPACIÓN: José Miguel agarra la manivela ── */
        tl.addLabel('wind', enterEnd + 0.2);
        tl.call(() => jm.set('crank'), undefined, 'wind');
        tl.to(shake.current, { y: 5, scaleY: 0.985, duration: 0.25, ease: 'power2.in' }, 'wind')
          .to(shake.current, { y: 0, scaleY: 1, duration: 0.6, ease: 'elastic.out(1,.4)' }, '>');

        /* ── 3) GIRO con inercia: acelera, se sostiene y frena ── */
        tl.addLabel('spin', 'wind+=0.5');
        tl.call(() => o.onPhase?.('spin'), undefined, 'spin+=0.3');
        tl.to(s.omega, { v: 11, duration: 1.7, ease: 'power2.in' }, 'spin');
        tl.to(shake.current, { x: 4, duration: 2.4, ease: 'jmShake' }, 'spin+=0.8');
        tl.call(() => fx.embers(screenPos().x, screenPos().y - 90, 10), undefined, 'spin+=1.5');
        tl.to(s.omega, { v: 11.5, duration: 1.5, ease: 'sine.inOut' }, 'spin+=1.7');
        tl.addLabel('brake', 'spin+=3.2');
        tl.to(s.omega, { v: 0, duration: 1.5, ease: 'power3.out' }, 'brake');   // inercia
        tl.call(() => jm.set('cover'), undefined, 'brake+=0.9');

        /* ── 4) PAUSA de anticipación ── */
        tl.addLabel('hush', 'brake+=1.5');
        tl.call(() => o.onPhase?.('hush'), undefined, 'brake+=0.5');
        tl.to(heat.current, { opacity: 1, scale: 1.08, duration: 0.85, ease: 'power2.in' }, 'hush');
        tl.to(shake.current, { x: 2, duration: 0.85, ease: 'jmShake' }, 'hush');
        tl.to(crank.current, { opacity: 0.9, duration: 0.1 }, 'hush');

        /* ── 5) CLÍMAX: pop, bolitas disparadas, confeti ── */
        tl.addLabel('pop', 'hush+=0.9');
        tl.call(() => o.onPhase?.('pop'), undefined, 'pop+=0.1');
        tl.call(() => {
          jm.set('celebrate');
          const c = screenPos();
          fx.confetti(c.x, c.y - 60, { count: 120, power: 900, spread: Math.PI * 1.1 });
          fx.embers(c.x, c.y - 40, 26);
          vibrate([30, 40, 60]);
          s.bodies.forEach((b) => Composite.remove(engine.world, b));
          s.bodies.clear();
          ids.forEach((id) => { s.pos.get(id)!.phys = false; });
        }, undefined, 'pop');
        tl.to(lid.current, { y: -190, rotation: 38, duration: 0.8, ease: 'power3.out' }, 'pop');
        tl.to(lid.current, { y: 260, rotation: 170, opacity: 0, duration: 0.9, ease: 'power2.in' }, 'pop+=0.8');
        tl.to(shake.current, { scaleY: 0.92, scaleX: 1.06, duration: 0.09, ease: 'power2.in' }, 'pop')
          .to(shake.current, { scaleY: 1.0, scaleX: 1, duration: 0.8, ease: 'elastic.out(1.3,.3)' }, '>');
        tl.to(heat.current, { scale: 2.6, opacity: 0, duration: 0.7, ease: 'power2.out' }, 'pop');
        ids.forEach((id, i) => {
          const p = s.pos.get(id)!;
          tl.to(p, { physics2D: { velocity: rand(520, 860), angle: rand(-128, -52), gravity: 1500 }, rot: `+=${rand(-300, 300)}`, duration: 1.15, ease: 'none' }, 'pop+=' + (i * 0.012));
        });

        /* ── 6) CIERRE: las bolitas aterrizan en la lista (con rebote) ── */
        tl.addLabel('land', 'pop+=1.15');
        ids.forEach((id, i) => {
          const p = s.pos.get(id)!;
          tl.call(() => {
            const c = chipOf(id);
            gsap.killTweensOf(p);
            gsap.to(p, { x: c.x, duration: 0.65, ease: 'power2.out' });
            gsap.to(p, { y: c.y, duration: 0.65, ease: 'back.in(1.1)' });
            gsap.to(p, { s: Math.max(0.3, c.w / (BR * 2)), rot: 0, duration: 0.65, ease: 'power2.out',
              onComplete: () => { p.o = 0; o.onLand?.(id); fx.sparkle(chipScreen(id).x, chipScreen(id).y, 5, 30); vibrate(6); } });
          }, undefined, `land+=${i * 0.07}`);
        });
        const chipScreen = (id: number) => { const el = o.chips?.get(id); if (!el) return { x: 0, y: 0 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
        tl.to({}, { duration: 1.2 }, 'land');
        tl.timeScale(speed);
      });
    },
  }));

  return (
    <div className="tombola" ref={box}>
      <div className="tomb-inner" ref={inner}>
       <div className="tomb-fx" ref={shake}>
        <svg className="tomb-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <radialGradient id="tbGlass" cx=".5" cy=".42" r=".6">
              <stop offset="0" stopColor="#24493F" /><stop offset=".75" stopColor="#14302A" /><stop offset="1" stopColor="#0C1D19" />
            </radialGradient>
            <radialGradient id="tbHeat">
              <stop offset="0" stopColor="#FFC15E" stopOpacity=".95" /><stop offset=".5" stopColor="#FF6B2C" stopOpacity=".45" /><stop offset="1" stopColor="#FF6B2C" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tbWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B5483A" /><stop offset="1" stopColor="#7E2A22" /></linearGradient>
          </defs>
          {/* cabinete */}
          <path d="M60 282 L250 282 L240 352 L70 352 Z" fill="url(#tbWood)" stroke="#3B2417" strokeWidth="4" strokeLinejoin="round" />
          <path d="M80 300 L230 300 M82 322 L228 322" stroke="#F6C453" strokeWidth="3" strokeLinecap="round" opacity=".7" />
          <rect x="58" y="274" width="194" height="14" rx="7" fill="#F6C453" stroke="#3B2417" strokeWidth="4" />
          {/* esfera (fondo) */}
          <circle cx={CX} cy={CY} r={R} fill="url(#tbGlass)" />
          <g ref={spin} opacity=".22">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d={`M${CX} ${CY} L${CX + Math.cos((i / 12) * 6.283) * R} ${CY + Math.sin((i / 12) * 6.283) * R}`} stroke="#FFF1D6" strokeWidth="2" strokeDasharray="2 14" strokeLinecap="round" />
            ))}
            <circle cx={CX} cy={CY} r={R * 0.62} fill="none" stroke="#FFF1D6" strokeWidth="2" strokeDasharray="3 16" strokeLinecap="round" />
          </g>
          <circle ref={heat} cx={CX} cy={CY} r={R} fill="url(#tbHeat)" opacity="0" style={{ transformOrigin: `${CX}px ${CY}px` }} />
          {/* manivela (a la izquierda, donde está José Miguel) */}
          <path d="M28 300 L62 300" stroke="#3B2417" strokeWidth="14" strokeLinecap="round" />
          <path d="M28 300 L62 300" stroke="#F6C453" strokeWidth="7" strokeLinecap="round" />
          <g ref={crank}>
            <path d="M28 300 L28 268" stroke="#3B2417" strokeWidth="12" strokeLinecap="round" />
            <path d="M28 300 L28 268" stroke="#D62839" strokeWidth="6" strokeLinecap="round" />
            <circle cx="28" cy="264" r="11" fill="#F6C453" stroke="#3B2417" strokeWidth="4" />
          </g>
          <circle cx="28" cy="300" r="9" fill="#F6C453" stroke="#3B2417" strokeWidth="4" />
        </svg>

        <div className="tomb-balls">
          {people.map((p) => (
            <div key={p.id} className="ball" ref={(el) => { if (el) balls.current.set(p.id, el); else balls.current.delete(p.id); }}>
              <Avatar p={p} size={BR * 2} lit={p.lit !== false} />
            </div>
          ))}
        </div>

        <svg className="tomb-svg tomb-front" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#CFE9E0" strokeOpacity=".5" strokeWidth="5" />
          <circle cx={CX} cy={CY} r={R + 4} fill="none" stroke="#3B2417" strokeWidth="4" strokeOpacity=".8" />
          <path d={`M${CX - 90} ${CY - 70} A 105 105 0 0 1 ${CX - 20} ${CY - 108}`} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="9" strokeLinecap="round" />
          <circle cx={CX - 98} cy={CY - 46} r="5" fill="#fff" fillOpacity=".6" />
          <g ref={lid} style={{ transformOrigin: `${CX}px 24px` }}>
            <ellipse cx={CX} cy="26" rx="34" ry="12" fill="#F6C453" stroke="#3B2417" strokeWidth="4" />
            <circle cx={CX} cy="12" r="9" fill="#D62839" stroke="#3B2417" strokeWidth="4" />
          </g>
        </svg>
       </div>
      </div>
    </div>
  );
});
