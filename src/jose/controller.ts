import { gsap, motion } from '../lib/gsap';
import { MOUTH, POSES, type MouthName, type PoseName } from './shapes';

export type Mood = 'idle' | 'talking' | 'pointing' | 'thinking' | 'celebrating' | 'worried' | 'sleeping' | 'covering' | 'peeking';
export type Reaction = 'tickle' | 'startle' | 'peek' | 'flare' | 'nod';

const LIDS: Record<Mood, number> = {
  idle: 0.36,
  talking: 0.22,
  pointing: 0.2,
  thinking: 0.3,
  celebrating: 0,
  worried: 0.04,
  sleeping: 1,
  covering: 0.4,
  peeking: 0.05,
};
const MOUTHS: Record<Mood, MouthName> = {
  idle: 'smirk',
  talking: 'smile',
  pointing: 'smile',
  thinking: 'oh',
  celebrating: 'grin',
  worried: 'frown',
  sleeping: 'sleep',
  covering: 'grin',
  peeking: 'oh',
};
const POSE_FOR: Record<Mood, PoseName> = {
  idle: 'rest',
  talking: 'rest',
  pointing: 'point',
  thinking: 'think',
  celebrating: 'wave',
  worried: 'shrug',
  sleeping: 'rest',
  covering: 'cover',
  peeking: 'peek',
};
export const SMOKE_RATE: Record<Mood, number> = {
  idle: 1,
  talking: 0.8,
  pointing: 0.8,
  thinking: 2.2,
  celebrating: 3,
  worried: 0.4,
  sleeping: 0.5,
  covering: 1.4,
  peeking: 1.2,
};

export class JoseController {
  svg: SVGSVGElement;
  p: Record<string, SVGGraphicsElement> = {};
  mood: Mood = 'idle';
  private moodTl?: gsap.core.Timeline;
  private loops: gsap.core.Animation[] = [];
  private blinkCall?: gsap.core.Tween;
  private talkCall?: gsap.core.Tween;
  private lookIdle?: gsap.core.Tween;
  private talking = false;
  private lookX: (v: number) => void;
  private lookY: (v: number) => void;
  private lastPointer = 0;
  private holdLook = false;
  private poseName: PoseName = 'rest';
  private pointAngle = 0;
  private dead = false;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    svg.querySelectorAll<SVGGraphicsElement>('[data-p]').forEach((el) => (this.p[el.dataset.p!] = el));
    const { p } = this;
    gsap.set(p.root, { svgOrigin: '100 244' });
    gsap.set(p.body, { svgOrigin: '100 215' });
    gsap.set(p.hat, { svgOrigin: '118 42' });
    gsap.set(p.pompom, { svgOrigin: '152 34' });
    gsap.set(p.scarfTail, { svgOrigin: '124 152' });
    gsap.set(p.armL, { svgOrigin: '71 160' });
    gsap.set(p.armR, { svgOrigin: '129 160' });
    gsap.set(p.glow, { svgOrigin: '88 40' });
    gsap.set(p.ember, { svgOrigin: '100 42' });
    gsap.set([p.lidL, p.lidR], { transformOrigin: '50% 0%', scaleY: LIDS.idle });
    gsap.set(p.browL, { svgOrigin: '95 75' });
    gsap.set(p.browR, { svgOrigin: '105 75' });
    gsap.set(p.legL, { svgOrigin: '88 212' });
    gsap.set(p.legR, { svgOrigin: '112 212' });
    this.lookX = gsap.quickTo(p.pupils, 'x', { duration: 0.35, ease: 'power3.out' });
    this.lookY = gsap.quickTo(p.pupils, 'y', { duration: 0.35, ease: 'power3.out' });
    this.startLoops();
    this.setMood('idle');
  }

  /** Bucles ambientales que nunca se detienen. */
  private startLoops() {
    const { p } = this;
    if (!motion.reduced) {
      this.loops.push(
        gsap.to(p.body, { scaleY: 1.025, scaleX: 0.985, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        gsap.to(p.pompom, { rotation: 14, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        gsap.to(p.scarfTail, { rotation: -7, duration: 1.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        gsap.to(p.ember, {
          scaleX: () => gsap.utils.random(0.92, 1.06),
          opacity: () => gsap.utils.random(0.82, 1),
          duration: 0.18,
          ease: 'none',
          repeat: -1,
          repeatRefresh: true,
        }),
        gsap.to(p.glow, { scale: 1.12, opacity: 0.8, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        gsap.to([p.spark1, p.spark2], {
          y: -10,
          opacity: 0,
          duration: 0.9,
          stagger: 0.45,
          repeat: -1,
          ease: 'power1.out',
        }),
      );
    }
    this.scheduleBlink();
  }

  private scheduleBlink() {
    this.blinkCall = gsap.delayedCall(gsap.utils.random(2.2, 5), () => {
      if (this.dead) return;
      if (this.mood !== 'sleeping' && this.mood !== 'covering') this.blink();
      this.scheduleBlink();
    });
  }

  blink() {
    const { p } = this;
    const open = LIDS[this.mood];
    gsap
      .timeline()
      .to([p.lidL, p.lidR], { scaleY: 1, duration: 0.07, ease: 'power2.in', overwrite: 'auto' })
      .to([p.lidL, p.lidR], { scaleY: open, duration: 0.16, ease: 'power2.out' });
  }

  private mouthTo(name: MouthName, duration = 0.18) {
    gsap.to(this.p.mouth, { morphSVG: MOUTH[name], duration, ease: 'power2.out', overwrite: 'auto' });
  }

  pose(name: PoseName, duration = 0.45, ease = 'back.out(1.8)') {
    const { p } = this;
    const pose = POSES[name];
    this.poseName = name;
    const d = motion.reduced ? Math.min(duration, 0.2) : duration;
    gsap.to(p.armLpath, { morphSVG: pose.L.path, duration: d, ease, overwrite: 'auto' });
    gsap.to(p.armRpath, { morphSVG: pose.R.path, duration: d, ease, overwrite: 'auto' });
    gsap.to(p.handL, { x: pose.L.hx, y: pose.L.hy, duration: d, ease, overwrite: 'auto' });
    gsap.to(p.handR, { x: pose.R.hx, y: pose.R.hy, duration: d, ease, overwrite: 'auto' });
    if (name !== 'point') gsap.to([p.armL, p.armR], { rotation: 0, duration: d, ease, overwrite: 'auto' });
  }

  svgToScreen(x: number, y: number) {
    const m = this.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }
  emberScreen() {
    return this.svgToScreen(96, 38);
  }
  hatScreenRect() {
    return this.p.hat.getBoundingClientRect();
  }

  setMood(mood: Mood, opts: { target?: { x: number; y: number } } = {}) {
    if (this.dead) return;
    const { p } = this;
    const prev = this.mood;
    this.mood = mood;
    this.moodTl?.kill();
    const tl = (this.moodTl = gsap.timeline());
    const R = motion.reduced;

    // volver a neutro con continuidad
    tl.to(p.root, { y: 0, x: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' }, 0);
    tl.to([p.lidL, p.lidR], { scaleY: LIDS[mood], duration: 0.25, overwrite: 'auto' }, 0);
    tl.to([p.browL, p.browR], { y: 0, rotation: 0, duration: 0.3, overwrite: 'auto' }, 0);
    tl.to(p.shadow, { scale: 1, opacity: 0.28, duration: 0.3, svgOrigin: '100 244', overwrite: 'auto' }, 0);
    tl.to(p.glow, { opacity: mood === 'sleeping' ? 0.25 : 0.7, duration: 0.6 }, 0);
    if (!this.talking) this.mouthTo(MOUTHS[mood]);

    if (mood === 'pointing' && opts.target) {
      const sR = this.svgToScreen(129, 160);
      const sL = this.svgToScreen(71, 160);
      const right = opts.target.x >= (sR.x + sL.x) / 2 - 10;
      const s = right ? sR : sL;
      let ang = (Math.atan2(opts.target.y - s.y, opts.target.x - s.x) * 180) / Math.PI;
      if (!right) ang = ang - 180;
      if (ang > 180) ang -= 360;
      if (ang < -180) ang += 360;
      ang = gsap.utils.clamp(-75, 52, ang);
      this.pointAngle = ang;
      gsap.to(right ? [p.fingerR, p.fingerR2] : [p.fingerL, p.fingerL2], { opacity: 1, duration: 0.15, delay: 0.2 });
      if (right) {
        this.pose('point');
        tl.to(p.armR, { rotation: ang, duration: 0.5, ease: 'back.out(2)', overwrite: 'auto' }, 0);
        tl.to(p.armL, { rotation: 0, duration: 0.3, overwrite: 'auto' }, 0);
      } else {
        // apuntar con la izquierda
        gsap.to(p.armLpath, { morphSVG: 'M71,160 C60,160 48,160 37,160', duration: 0.45, ease: 'back.out(1.8)', overwrite: 'auto' });
        gsap.to(p.handL, { x: -15, y: -24, duration: 0.45, ease: 'back.out(1.8)', overwrite: 'auto' });
        gsap.to(p.armRpath, { morphSVG: POSES.rest.R.path, duration: 0.45, overwrite: 'auto' });
        gsap.to(p.handR, { x: 0, y: 0, duration: 0.45, overwrite: 'auto' });
        this.poseName = 'point';
        tl.to(p.armL, { rotation: ang, duration: 0.5, ease: 'back.out(2)', overwrite: 'auto' }, 0);
        tl.to(p.armR, { rotation: 0, duration: 0.3, overwrite: 'auto' }, 0);
      }
      this.lookAt(opts.target.x, opts.target.y, true);
      if (!R) {
        const arm = right ? p.armR : p.armL;
        tl.to(arm, { rotation: `+=${right ? 9 : -9}`, duration: 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.55);
        tl.to(p.root, { rotation: right ? 3 : -3, duration: 0.6, ease: 'sine.inOut' }, 0);
      }
      return;
    }

    gsap.to([p.fingerR, p.fingerR2, p.fingerL, p.fingerL2], { opacity: 0, duration: 0.1 });
    if (mood !== 'pointing') this.pose(POSE_FOR[mood]);
    this.holdLook = false;

    switch (mood) {
      case 'idle':
        if (!R) tl.to(p.root, { rotation: 2.2, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.4);
        break;
      case 'thinking':
        this.holdLook = true;
        this.lookX(-3);
        this.lookY(-4);
        tl.to(p.browR, { y: -5, rotation: -10, duration: 0.3 }, 0);
        if (!R) tl.to(p.handR, { y: '-=3', duration: 0.28, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.5);
        if (!R) tl.to(p.root, { rotation: -4, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.2);
        break;
      case 'celebrating': {
        tl.to(p.glow, { scale: 1.7, duration: 0.3, ease: 'back.out(3)' }, 0);
        tl.to([p.browL, p.browR], { y: -5, duration: 0.25 }, 0);
        if (R) break;
        const hop = gsap
          .timeline({ repeat: -1, repeatDelay: 0.08 })
          .to(p.root, { scaleY: 0.82, scaleX: 1.14, y: 0, duration: 0.12, ease: 'power2.in' })
          .to(p.root, { scaleY: 1.12, scaleX: 0.9, y: -26, duration: 0.26, ease: 'power2.out' })
          .to(p.shadow, { scale: 0.6, opacity: 0.15, duration: 0.26, ease: 'power2.out' }, '<')
          .to(p.root, { scaleY: 1, scaleX: 1, y: 0, duration: 0.22, ease: 'power2.in' })
          .to(p.shadow, { scale: 1, opacity: 0.28, duration: 0.22, ease: 'power2.in' }, '<')
          .to(p.root, { scaleY: 0.86, scaleX: 1.1, duration: 0.07 })
          .to(p.root, { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'elastic.out(1.2,0.4)' });
        tl.add(hop, 0.15);
        tl.to(p.armL, { rotation: -16, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.3);
        tl.to(p.armR, { rotation: 16, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.42);
        break;
      }
      case 'worried':
        tl.to(p.browL, { rotation: 14, y: -3, duration: 0.3 }, 0);
        tl.to(p.browR, { rotation: -14, y: -3, duration: 0.3 }, 0);
        tl.to(p.glow, { scale: 0.7, duration: 0.4 }, 0);
        if (!R)
          tl.to(p.root, { x: 1.6, duration: 0.6, ease: 'jitter', repeat: -1, repeatDelay: 1.4 }, 0.3);
        break;
      case 'sleeping':
        this.holdLook = true;
        this.lookX(0);
        this.lookY(2);
        tl.to([p.browL, p.browR], { y: 3, duration: 0.6 }, 0);
        if (!R) tl.to(p.root, { rotation: 7, scaleY: 0.97, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0);
        break;
      case 'covering':
        this.holdLook = true;
        if (!R) tl.to(p.root, { x: 1.2, duration: 0.5, ease: 'jitter', repeat: -1 }, 0.4);
        tl.to(p.glow, { scale: 1.4, duration: 0.6 }, 0);
        break;
      case 'peeking':
        this.holdLook = true;
        this.lookX(0);
        this.lookY(1);
        if (!R) tl.to(p.root, { rotation: -3, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.2);
        break;
    }
    if (prev === 'sleeping' && mood !== 'sleeping') this.react('startle');
  }

  /** Boca moviéndose mientras el texto aparece. */
  talk(on: boolean) {
    this.talking = on;
    this.talkCall?.kill();
    if (!on) {
      this.mouthTo(MOUTHS[this.mood], 0.15);
      return;
    }
    const shapes: MouthName[] = ['open', 'oh', 'smile', 'open', 'grin', 'open', 'smirk'];
    const step = () => {
      if (!this.talking || this.dead) return;
      this.mouthTo(shapes[Math.floor(Math.random() * shapes.length)], 0.08);
      this.talkCall = gsap.delayedCall(motion.reduced ? 0.2 : gsap.utils.random(0.08, 0.15), step);
    };
    step();
    if (!motion.reduced) gsap.fromTo(this.p.body, { rotation: -2 }, { rotation: 2, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: 3, onComplete: () => { gsap.to(this.p.body, { rotation: 0, duration: 0.3 }); } });
  }

  lookAt(x: number, y: number, force = false) {
    if (this.dead || (this.holdLook && !force)) return;
    if (!force) this.lastPointer = performance.now();
    const c = this.svgToScreen(100, 96);
    const dx = x - c.x;
    const dy = y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    this.lookX((dx / d) * 4.5 * k);
    this.lookY((dy / d) * 4.2 * k);
  }

  /** Mirar alrededor cuando nadie mueve el puntero. */
  idleLook() {
    if (this.holdLook || this.dead || motion.reduced) return;
    if (performance.now() - this.lastPointer < 3000) return;
    if (this.mood !== 'idle' && this.mood !== 'talking') return;
    this.lookX(gsap.utils.random(-4.5, 4.5));
    this.lookY(gsap.utils.random(-3, 3));
  }

  react(r: Reaction) {
    if (this.dead) return;
    const { p } = this;
    const R = motion.reduced;
    switch (r) {
      case 'tickle':
        gsap
          .timeline()
          .to(p.root, { scaleY: 0.85, scaleX: 1.12, duration: 0.1, ease: 'power2.in', overwrite: 'auto' })
          .to(p.root, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1.3,0.3)' })
          .to(p.root, { rotation: R ? 0 : 8, duration: 0.6, ease: 'shake' }, 0.05);
        this.mouthTo('grin', 0.1);
        gsap.to([p.lidL, p.lidR], { scaleY: 0.6, duration: 0.1, yoyo: true, repeat: 1 });
        gsap.to(p.glow, { scale: 1.6, duration: 0.2, yoyo: true, repeat: 1 });
        gsap.delayedCall(0.8, () => !this.talking && this.mouthTo(MOUTHS[this.mood]));
        break;
      case 'startle':
        gsap
          .timeline()
          .to(p.root, { y: R ? 0 : -16, scaleY: 1.1, scaleX: 0.92, duration: 0.15, ease: 'power2.out' })
          .to(p.root, { y: 0, scaleY: 1, scaleX: 1, duration: 0.5, ease: 'bounce.out' });
        gsap.fromTo([p.lidL, p.lidR], { scaleY: 0 }, { scaleY: LIDS[this.mood], duration: 0.8, delay: 0.3 });
        break;
      case 'peek':
        gsap
          .timeline()
          .to(p.root, { rotation: R ? 0 : -12, x: R ? 0 : 6, duration: 0.25, ease: 'power2.out' })
          .to(p.root, { rotation: 0, x: 0, duration: 0.8, ease: 'elastic.out(1,0.4)' }, '+=0.35');
        this.mouthTo('oh', 0.1);
        gsap.to([p.lidL, p.lidR], { scaleY: 0, duration: 0.15, yoyo: true, repeat: 1, repeatDelay: 0.4 });
        gsap.delayedCall(0.9, () => !this.talking && this.mouthTo(MOUTHS[this.mood]));
        break;
      case 'flare':
        gsap.timeline().to(p.glow, { scale: 2.1, opacity: 1, duration: 0.25, ease: 'back.out(3)' }).to(p.glow, { scale: 1, opacity: 0.7, duration: 1.2, ease: 'power2.out' });
        gsap.fromTo(p.ember, { scaleY: 1.6 }, { scaleY: 1, duration: 0.8, ease: 'elastic.out(1,0.3)' });
        break;
      case 'nod':
        gsap.timeline().to(p.body, { rotation: 6, duration: 0.15 }).to(p.body, { rotation: 0, duration: 0.6, ease: 'elastic.out(1,0.35)' });
        break;
    }
  }

  /** Expresión manual (escenas hero). */
  face(mouth: MouthName, lids?: number) {
    this.mouthTo(mouth, 0.15);
    if (lids !== undefined) gsap.to([this.p.lidL, this.p.lidR], { scaleY: lids, duration: 0.2, overwrite: 'auto' });
  }

  setHat(visible: boolean) {
    const { hat } = this.p;
    if (visible) gsap.fromTo(hat, { scale: 0.3, opacity: 1, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.2)' });
    else gsap.set(hat, { opacity: 0 });
  }

  /** Pose manual (para escenas hero). */
  holdPose(name: PoseName, duration = 0.45) {
    this.moodTl?.kill();
    this.pose(name, duration);
  }

  destroy() {
    this.dead = true;
    this.moodTl?.kill();
    this.blinkCall?.kill();
    this.talkCall?.kill();
    this.lookIdle?.kill();
    this.loops.forEach((l) => l.kill());
    gsap.killTweensOf(Object.values(this.p));
  }

  get currentPose() {
    return this.poseName;
  }
  get angle() {
    return this.pointAngle;
  }
}
