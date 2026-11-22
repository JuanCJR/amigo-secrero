import { gsap, prefersReduced, rand, clamp } from '../anim/gsap';
import { pointer, onPointer, onActivity } from '../anim/pointer';
import { fx } from '../anim/fx';

export type JMState =
  | 'idle' | 'talk' | 'point' | 'think' | 'celebrate' | 'worried'
  | 'sleep' | 'cover' | 'peek' | 'crank' | 'deliver';

// Todas las bocas comparten estructura → se interpolan con GSAP (attr d) sin plugin.
const MOUTH = {
  smile: 'M128 238 C140 247 160 247 172 238 C160 253 140 253 128 238 Z',
  closed: 'M130 241 C140 244 160 244 170 241 C160 245 140 245 130 241 Z',
  talkS: 'M131 238 C140 241 160 241 169 238 C163 253 137 253 131 238 Z',
  talkL: 'M129 236 C140 239 160 239 171 236 C168 262 132 262 129 236 Z',
  big: 'M123 233 C140 245 160 245 177 233 C173 264 127 264 123 233 Z',
  worried: 'M131 249 C140 237 160 237 169 249 C161 244 139 244 131 249 Z',
  o: 'M139 238 C144 235 156 235 161 238 C163 254 137 254 139 238 Z',
} as const;
export type MouthKey = keyof typeof MOUTH;

interface Pose {
  body: { x: number; y: number; rotation: number };
  root?: { x?: number; rotation?: number };
  armL: [number, number];
  armR: [number, number];
  legL: number; legR: number;
  hat: number; pom: number; tail: number;
  browL: [number, number]; browR: [number, number];
  mouth: MouthKey; lid: number;
  ember: number; glow: number; smoke: number;
  gaze?: [number, number];
  sweat?: boolean;
}

const REST: Pose = {
  body: { x: 0, y: 0, rotation: 0 },
  armL: [0, 0], armR: [0, 0], legL: 0, legR: 0,
  hat: -20, pom: 0, tail: 0,
  browL: [0, 0], browR: [0, 0],
  mouth: 'smile', lid: 0, ember: 1, glow: 0.75, smoke: 1,
};
const P = (o: Partial<Pose>): Pose => ({ ...REST, ...o });

export const POSES: Record<JMState, Pose> = {
  idle: REST,
  talk: P({ browL: [0, -3], browR: [0, -3] }),
  point: P({ armR: [-38, -6], body: { x: 0, y: 0, rotation: 3 }, browL: [0, -3], browR: [0, -3], hat: -17 }),
  think: P({
    armR: [-82, -98], body: { x: 0, y: 0, rotation: -3 }, browL: [-6, -2], browR: [-4, -6],
    mouth: 'closed', lid: 0.2, ember: 0.85, gaze: [-0.8, -0.9], hat: -26,
  }),
  celebrate: P({
    armL: [162, -14], armR: [-162, 14], legL: 9, legR: -9, hat: -10, pom: 10, tail: -6,
    browL: [0, -7], browR: [0, -7], mouth: 'big', ember: 1.5, glow: 1, smoke: 2.4,
  }),
  worried: P({
    armL: [30, -78], armR: [-30, 78], body: { x: 0, y: 0, rotation: -2 },
    browL: [-15, -4], browR: [15, -4], mouth: 'worried', ember: 0.5, glow: 0.35, smoke: 0.7, sweat: true,
    hat: -28, tail: 4,
  }),
  sleep: P({
    body: { x: 0, y: 12, rotation: 7 }, armL: [4, 4], armR: [-4, -4], lid: 1, mouth: 'closed',
    browL: [0, 3], browR: [0, 3], ember: 0.4, glow: 0.22, smoke: 0.45, hat: -36, pom: 18, gaze: [0, 0.4],
  }),
  cover: P({
    armL: [136, 100], armR: [-136, -100], browL: [0, -5], browR: [0, -5], mouth: 'closed', ember: 1.1, hat: -17,
  }),
  peek: P({
    body: { x: 0, y: 0, rotation: 9 }, root: { x: 16 }, armR: [-22, -18], browL: [0, -8], browR: [0, -8],
    mouth: 'talkS', ember: 1.2, gaze: [0.9, 0.6], hat: -15,
  }),
  crank: P({
    armR: [-60, -60], body: { x: 0, y: 0, rotation: -4 }, legL: 6, legR: -6, mouth: 'smile', ember: 1.3, glow: 0.95,
    smoke: 1.8, gaze: [0.5, 0.3],
  }),
  deliver: P({
    armL: [-30, -42], armR: [30, 42], body: { x: 0, y: 0, rotation: 2 }, browL: [0, -4], browR: [0, -4],
    mouth: 'big', ember: 1.25, hat: -18,
  }),
};

const pick = <T,>(a: readonly T[]) => a[(Math.random() * a.length) | 0];

export class Mascot {
  svg: SVGSVGElement | null = null;
  base: JMState = 'idle';
  cur: JMState = 'idle';
  talking = false;
  noSleep = false;
  private loops: gsap.core.Animation[] = [];
  private smokeTls: gsap.core.Timeline[] = [];
  private mouthCall: gsap.core.Tween | null = null;
  private blinkCall: gsap.core.Tween | null = null;
  private lookCall: gsap.core.Tween | null = null;
  private lastActivity = Date.now();
  private override: [number, number] | null = null;
  private qPupX?: (v: number) => void; private qPupY?: (v: number) => void;
  private qFaceX?: (v: number) => void; private qLookR?: (v: number) => void;
  private offs: Array<() => void> = [];
  private sleepTimer = 0;

  private q = (s: string) => this.svg!.querySelector(s) as SVGElement;
  private qa = (s: string) => Array.from(this.svg!.querySelectorAll(s)) as SVGElement[];

  attach(svg: SVGSVGElement) {
    if (this.svg === svg) return;
    this.detach();
    this.svg = svg;
    const set = (s: string, origin: string, extra: gsap.TweenVars = {}) =>
      gsap.set(this.q(s), { svgOrigin: origin, ...extra });
    set('.jm-root', '150 410'); set('.jm-look', '150 410'); set('.jm-body', '150 350'); set('.jm-shadow', '150 414');
    set('.jm-armL', '104 262'); set('.jm-foreL', '88 296'); set('.jm-armR', '196 262'); set('.jm-foreR', '212 296');
    set('.jm-legL', '132 346'); set('.jm-legR', '168 346');
    set('.jm-hat', '112 131', { rotation: -20, x: 14, y: 3 }); set('.jm-pom', '120 44');
    set('.jm-tail', '186 296');
    set('.jm-browL', '127 176'); set('.jm-browR', '173 176');
    set('.jm-lidL', '127 183.5', { scaleY: 0 }); set('.jm-lidR', '173 183.5', { scaleY: 0 });
    set('.jm-ember', '176 120'); set('.jm-glow', '176 114');
    set('.jm-sweat', '212 172');

    const pupils = [this.q('.jm-pupilL'), this.q('.jm-pupilR')];
    this.qPupX = gsap.quickTo(pupils, 'x', { duration: 0.28, ease: 'power3.out' }) as (v: number) => void;
    this.qPupY = gsap.quickTo(pupils, 'y', { duration: 0.28, ease: 'power3.out' }) as (v: number) => void;
    this.qFaceX = gsap.quickTo(this.q('.jm-face'), 'x', { duration: 0.5, ease: 'power3.out' }) as (v: number) => void;
    this.qLookR = gsap.quickTo(this.q('.jm-look'), 'rotation', { duration: 0.7, ease: 'power2.out' }) as (v: number) => void;

    this.buildSmoke();
    this.scheduleBlink();
    this.scheduleLook();
    this.offs.push(onPointer(() => this.followPointer()));
    this.offs.push(onActivity(() => {
      this.lastActivity = Date.now();
      if (this.cur === 'sleep') this.wake();
    }));
    this.sleepTimer = window.setInterval(() => {
      if (this.noSleep || this.talking) return;
      if (Date.now() - this.lastActivity > 32000 && (this.base === 'idle' || this.base === 'think') && this.cur !== 'sleep') {
        this.show('sleep');
      }
    }, 2000);
    this.apply('idle', 0.01);
  }

  detach() {
    this.offs.forEach((f) => f()); this.offs = [];
    clearInterval(this.sleepTimer);
    this.killLoops();
    this.smokeTls.forEach((t) => t.kill()); this.smokeTls = [];
    this.mouthCall?.kill(); this.blinkCall?.kill(); this.lookCall?.kill();
    this.svg = null;
  }

  /* ───────── estados ───────── */
  /** Cambia el estado "de reposo" de la pantalla. */
  set(state: JMState) {
    this.base = state;
    this.apply(state);
  }
  /** Muestra un estado sin cambiar el de reposo. */
  show(state: JMState) { this.apply(state); }
  /** Estado temporal que luego vuelve al de reposo. */
  flash(state: JMState, ms = 1800) {
    this.apply(state);
    gsap.delayedCall(ms / 1000, () => { if (this.cur === state) this.apply(this.base); });
  }
  wake() {
    this.lastActivity = Date.now();
    this.apply(this.base === 'sleep' ? 'idle' : this.base);
    this.hop(0.6);
  }

  private apply(state: JMState, forceDur?: number) {
    if (!this.svg) return;
    this.cur = state;
    this.killLoops();
    const reduced = prefersReduced();
    const pose = POSES[state];
    const dur = forceDur ?? (reduced ? 0.01 : 0.65);
    const ease = reduced ? 'none' : 'back.out(1.5)';
    const o = { duration: dur, ease, overwrite: 'auto' as const };
    const q = this.q;

    gsap.to(q('.jm-body'), { x: pose.body.x, y: pose.body.y, rotation: pose.body.rotation, scaleX: 1, scaleY: 1, ...o });
    gsap.to(q('.jm-root'), { x: pose.root?.x ?? 0, y: 0, rotation: pose.root?.rotation ?? 0, scaleX: 1, scaleY: 1, ...o });
    gsap.to(q('.jm-armL'), { rotation: pose.armL[0], ...o });
    gsap.to(q('.jm-foreL'), { rotation: pose.armL[1], ...o });
    gsap.to(q('.jm-armR'), { rotation: pose.armR[0], ...o });
    gsap.to(q('.jm-foreR'), { rotation: pose.armR[1], ...o });
    gsap.to(q('.jm-legL'), { rotation: pose.legL, ...o });
    gsap.to(q('.jm-legR'), { rotation: pose.legR, ...o });
    gsap.to(q('.jm-hat'), { rotation: pose.hat, x: 14, y: 3, ...o });
    gsap.to(q('.jm-pom'), { rotation: pose.pom, ...o });
    gsap.to(q('.jm-tail'), { rotation: pose.tail, ...o });
    gsap.to(q('.jm-browL'), { rotation: pose.browL[0], y: pose.browL[1], ...o });
    gsap.to(q('.jm-browR'), { rotation: pose.browR[0], y: pose.browR[1], ...o });
    gsap.to(this.qa('.jm-lidL, .jm-lidR'), { scaleY: pose.lid, duration: dur * 0.6, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(this.qa('.jm-arc'), { opacity: pose.lid > 0.8 ? 1 : 0, duration: 0.2, overwrite: 'auto' });
    gsap.to(q('.jm-ember'), { scale: 0.85 + pose.ember * 0.2, ...o });
    gsap.to(q('.jm-glow'), { scale: 0.7 + pose.glow * 0.5, opacity: pose.glow, ...o });
    gsap.to(q('.jm-sweat'), { opacity: pose.sweat ? 1 : 0, duration: 0.3, overwrite: 'auto' });
    gsap.to(q('.jm-zzz'), { opacity: state === 'sleep' ? 1 : 0, duration: 0.4, overwrite: 'auto' });
    if (!this.talking) this.morph(pose.mouth, dur * 0.5);

    this.override = pose.gaze ?? null;
    if (this.override) this.look(this.override[0], this.override[1]);
    this.setSmoke(reduced ? 0.25 : pose.smoke);

    if (!reduced) this.startLoops(state, pose, dur);
  }

  /* ───────── bucles por estado ───────── */
  private killLoops() {
    this.loops.forEach((l) => l.kill());
    this.loops = [];
  }
  private add<T extends gsap.core.Animation>(a: T) { this.loops.push(a); return a; }

  private startLoops(state: JMState, pose: Pose, d: number) {
    const q = this.q;
    const delay = d * 0.9;
    // respiración + follow-through del gorro y la bufanda (siempre, salvo en saltos)
    const breathe = (amt: number, t: number) => {
      this.add(gsap.to(q('.jm-body'), { scaleY: 1 + amt, scaleX: 1 - amt * 0.55, duration: t, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
      this.add(gsap.to(q('.jm-hat'), { y: 3 - amt * 140, duration: t, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 0.18 }));
      this.add(gsap.to(q('.jm-tail'), { rotation: pose.tail + 3.5, duration: t * 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
      this.add(gsap.to(q('.jm-glow'), { opacity: pose.glow * 0.7, duration: rand(0.6, 1.0), yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
    };
    switch (state) {
      case 'idle': case 'talk': case 'point': case 'think': case 'peek': case 'deliver': case 'cover': {
        breathe(0.02, 2.3);
        if (state === 'talk') {
          this.add(gsap.to(q('.jm-root'), { rotation: 1.6, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
          this.add(gsap.to(q('.jm-foreR'), { rotation: -14, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
          this.add(gsap.to(q('.jm-armR'), { rotation: -24, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        }
        if (state === 'point') {
          this.add(gsap.to(q('.jm-foreR'), { rotation: 10, duration: 0.38, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
          this.add(gsap.to(q('.jm-armR'), { rotation: -48, duration: 0.38, yoyo: true, repeat: -1, ease: 'power1.inOut', delay }));
        }
        if (state === 'think') {
          this.add(gsap.to(q('.jm-foreR'), { rotation: -88, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        }
        if (state === 'peek') {
          this.add(gsap.to(q('.jm-root'), { rotation: 3, x: 20, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        }
        if (state === 'deliver') {
          this.add(gsap.to(q('.jm-root'), { rotation: 3, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        }
        if (state === 'cover') {
          this.add(gsap.to(q('.jm-root'), { x: 1.2, duration: 0.07, yoyo: true, repeat: -1, ease: 'none', delay }));
        }
        break;
      }
      case 'celebrate': {
        const root = q('.jm-root'), shadow = q('.jm-shadow');
        const jump = gsap.timeline({ repeat: -1, delay: delay * 0.5 });
        jump
          .to(root, { scaleY: 0.84, scaleX: 1.12, duration: 0.16, ease: 'power2.in' })           // anticipación
          .to(root, { y: -40, scaleY: 1.14, scaleX: 0.92, duration: 0.28, ease: 'power2.out' })   // estiramiento
          .to(shadow, { scaleX: 0.72, opacity: 0.18, duration: 0.28, ease: 'power2.out' }, '<')
          .to(root, { y: 0, scaleY: 1, scaleX: 1, duration: 0.26, ease: 'power2.in' })            // caída
          .to(shadow, { scaleX: 1, opacity: 0.32, duration: 0.26, ease: 'power2.in' }, '<')
          .to(root, { scaleY: 0.86, scaleX: 1.1, duration: 0.09, ease: 'power2.out' })            // aplastón
          .to(root, { scaleY: 1, scaleX: 1, duration: 0.55, ease: 'elastic.out(1.2,.35)' })       // overshoot
          .to(q('.jm-hat'), { rotation: -3, duration: 0.3, ease: 'power2.out' }, 0.18)              // follow-through
          .to(q('.jm-hat'), { rotation: -11, duration: 0.7, ease: 'elastic.out(1,.3)' }, 0.55)
          .to(q('.jm-pom'), { rotation: -25, duration: 0.3, ease: 'power2.out' }, 0.2)
          .to(q('.jm-pom'), { rotation: 12, duration: 0.8, ease: 'elastic.out(1,.25)' }, 0.5);
        this.add(jump);
        this.add(gsap.to(q('.jm-foreL'), { rotation: 18, duration: 0.2, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        this.add(gsap.to(q('.jm-foreR'), { rotation: -18, duration: 0.2, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        this.add(gsap.to(q('.jm-tail'), { rotation: 10, duration: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        break;
      }
      case 'worried': {
        this.add(gsap.to(q('.jm-root'), { x: 1.6, duration: 0.06, yoyo: true, repeat: -1, ease: 'none', delay }));
        this.add(gsap.fromTo(q('.jm-sweat'), { y: -4 }, { y: 26, duration: 1.1, repeat: -1, ease: 'power1.in', delay }));
        this.add(gsap.to(q('.jm-foreL'), { rotation: -92, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        this.add(gsap.to(q('.jm-foreR'), { rotation: 92, duration: 0.18, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        break;
      }
      case 'sleep': {
        breathe(0.035, 3.4);
        const z = [q('.jm-z1'), q('.jm-z2'), q('.jm-z3')];
        this.add(gsap.fromTo(z, { y: 12, opacity: 0, scale: 0.6 }, {
          y: -20, opacity: 1, scale: 1.1, duration: 2.2, stagger: 0.7, repeat: -1, ease: 'sine.out', repeatDelay: 0.3,
        }));
        break;
      }
      case 'crank': {
        breathe(0.015, 1.6);
        this.add(gsap.to(q('.jm-armR'), { rotation: -118, duration: 0.42, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        this.add(gsap.to(q('.jm-foreR'), { rotation: -20, duration: 0.42, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: delay + 0.21 }));
        this.add(gsap.to(q('.jm-root'), { rotation: 2.5, duration: 0.21, yoyo: true, repeat: -1, ease: 'sine.inOut', delay }));
        break;
      }
    }
  }

  /* ───────── cara ───────── */
  morph(key: MouthKey, dur = 0.12) {
    if (!this.svg) return;
    gsap.to(this.q('.jm-mouth'), { attr: { d: MOUTH[key] }, duration: dur, ease: 'power2.out', overwrite: true });
  }
  talkStart() {
    if (!this.svg) return;
    this.talking = true;
    if (this.cur === 'idle' && this.base === 'idle') this.apply('talk');
    const loop = () => {
      if (!this.talking) return;
      this.morph(pick(['talkS', 'talkL', 'talkS', 'smile', 'talkS', 'o'] as MouthKey[]), 0.08);
      this.mouthCall = gsap.delayedCall(rand(0.08, 0.17), loop);
    };
    loop();
  }
  talkEnd() {
    this.talking = false;
    this.mouthCall?.kill();
    if (!this.svg) return;
    if (this.cur === 'talk' && this.base === 'idle') this.apply('idle');
    else this.morph(POSES[this.cur].mouth, 0.2);
  }

  private scheduleBlink() {
    this.blinkCall = gsap.delayedCall(rand(2, 5), () => {
      if (!this.svg) return;
      const lids = this.qa('.jm-lidL, .jm-lidR');
      if (this.cur !== 'sleep' && this.cur !== 'cover') {
        const tl = gsap.timeline();
        const arcs = this.qa('.jm-arc');
        const rest = POSES[this.cur].lid;
        const blink = () => {
          tl.to(lids, { scaleY: 1, duration: 0.07, ease: 'power2.in' }).set(arcs, { opacity: 1 })
            .to(lids, { scaleY: rest, duration: 0.16, ease: 'power2.out' }, '+=0.03').set(arcs, { opacity: rest > 0.8 ? 1 : 0 }, '<');
        };
        blink();
        if (Math.random() < 0.2) blink();
      }
      this.scheduleBlink();
    });
  }
  private scheduleLook() {
    this.lookCall = gsap.delayedCall(rand(3, 6), () => {
      if (!this.svg) return;
      if (!prefersReduced() && !this.override && this.cur !== 'sleep' && Date.now() - pointer.last > 5000) {
        this.look(rand(-1, 1), rand(-0.5, 0.7));
        gsap.delayedCall(rand(0.9, 1.6), () => { if (!this.override && Date.now() - pointer.last > 5000) this.look(0, 0); });
      }
      this.scheduleLook();
    });
  }
  look(nx: number, ny: number) {
    if (!this.svg) return;
    nx = clamp(-1, 1, nx); ny = clamp(-1, 1, ny);
    this.qPupX?.(nx * 5.5);
    this.qPupY?.(ny * 4.5);
    this.qFaceX?.(nx * 3);
    this.qLookR?.(prefersReduced() ? 0 : nx * 1.8);
  }
  private followPointer() {
    if (!this.svg || this.override || this.cur === 'sleep' || prefersReduced()) return;
    const r = this.svg.getBoundingClientRect();
    const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.46;
    const span = Math.max(r.width, 160) * 1.5;
    this.look((pointer.x - cx) / span, (pointer.y - cy) / span);
  }

  /* ───────── humo ───────── */
  private buildSmoke() {
    this.smokeTls = this.qa('.jm-puff').map((p, i) => {
      const tl = gsap.timeline({ repeat: -1, repeatRefresh: true, delay: i * 0.5 });
      tl.fromTo(p, { x: 0, y: 0, scale: 0.3, rotation: 0 }, {
        x: () => rand(-26, 26), y: () => rand(-125, -90), scale: () => rand(1.5, 2.2), rotation: () => rand(-40, 40),
        duration: 3.6, ease: 'sine.out',
      }, 0).fromTo(p, { opacity: 0 }, { keyframes: { opacity: [0, 0.8, 0.45, 0], easeEach: 'none' }, duration: 3.6 }, 0);
      return tl;
    });
  }
  setSmoke(rate: number) {
    this.smokeTls.forEach((t) => gsap.to(t, { timeScale: Math.max(rate, 0.05), duration: 0.8, overwrite: true }));
  }
  /** Una bocanada de humo (para formar el globo de diálogo). */
  puff() {
    if (!this.svg || prefersReduced()) return;
    this.smokeTls.forEach((t, i) => gsap.to(t, { timeScale: 3.2, duration: 0.2, delay: i * 0.02, overwrite: true }));
    gsap.delayedCall(0.8, () => this.setSmoke(POSES[this.cur].smoke));
  }

  /* ───────── reacciones ───────── */
  hop(strength = 1) {
    if (!this.svg || prefersReduced()) return;
    const root = this.q('.jm-root');
    gsap.timeline()
      .to(root, { scaleY: 0.88, scaleX: 1.08, duration: 0.1, ease: 'power2.in' })
      .to(root, { y: -22 * strength, scaleY: 1.1, scaleX: 0.94, duration: 0.2, ease: 'power2.out' })
      .to(root, { y: 0, scaleY: 0.9, scaleX: 1.08, duration: 0.18, ease: 'power2.in' })
      .to(root, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1.2,.35)' });
  }
  poke() {
    this.lastActivity = Date.now();
    if (this.cur === 'sleep') { this.wake(); return; }
    this.hop(1.2);
    this.morph('big', 0.1);
    const p = this.emberPos();
    fx.embers(p.x, p.y, 10);
    gsap.fromTo(this.q('.jm-ember'), { scale: 1.5 }, { scale: 0.85 + POSES[this.cur].ember * 0.2, duration: 0.8, ease: 'elastic.out(1,.3)' });
    gsap.delayedCall(0.7, () => { if (!this.talking) this.morph(POSES[this.cur].mouth, 0.2); });
  }
  emberPos() {
    const r = this.svg!.getBoundingClientRect();
    return { x: r.left + r.width * ((176 - 45) / 210), y: r.top + r.height * (112 / 440) };
  }
  centerPos() {
    const r = this.svg!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.4, r };
  }
}

export const jm = new Mascot();
