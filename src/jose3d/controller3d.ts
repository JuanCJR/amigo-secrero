// Controlador de José 3D con la misma interfaz que tenía el rig SVG:
// ánimos, reacciones, poses manuales, gorro, mirada y conversión de coordenadas.
// Las pantallas (sorteo, revelación) lo usan sin saber que es 3D.
import * as THREE from 'three';
import { gsap, motion } from '../lib/gsap';
import { JoseStage, SVG_K, type Rig, type StageOptions } from './stage';
import type { MouthShape } from './model';

export type Mood = 'idle' | 'talking' | 'pointing' | 'thinking' | 'celebrating' | 'worried' | 'sleeping' | 'covering' | 'peeking';
export type Reaction = 'tickle' | 'startle' | 'peek' | 'flare' | 'nod';
export type PoseName = 'rest' | 'wave' | 'hold' | 'raise' | 'overhead' | 'cover' | 'peek' | 'think' | 'shrug' | 'point';
export type MouthName = MouthShape;

/** Cuánto humo suelta según el ánimo (lo usa JoseProvider). */
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

// brazos: z abre hacia el lado (L negativo, R positivo); x negativo lleva el brazo hacia adelante
type ArmPose = { Lz: number; Lx: number; Rz: number; Rx: number };
const POSES: Record<PoseName, ArmPose> = {
  rest: { Lz: -0.12, Lx: 0, Rz: 0.12, Rx: 0 },
  wave: { Lz: -2.05, Lx: 0, Rz: 2.05, Rx: 0 },
  hold: { Lz: 0.35, Lx: -1.25, Rz: -0.35, Rx: -1.25 },
  raise: { Lz: -2.3, Lx: -0.4, Rz: 2.3, Rx: -0.4 },
  overhead: { Lz: -2.85, Lx: 0, Rz: 2.85, Rx: 0 },
  cover: { Lz: 0.55, Lx: -2.6, Rz: -0.55, Rx: -2.6 },
  peek: { Lz: 0.3, Lx: -2.35, Rz: -0.3, Rx: -2.35 },
  think: { Lz: 0.5, Lx: -0.9, Rz: -0.35, Rx: -2.2 },
  shrug: { Lz: -0.95, Lx: -0.5, Rz: 0.95, Rx: -0.5 },
  point: { Lz: -0.12, Lx: 0, Rz: 1.4, Rx: 0 },
};

const LIDS: Record<Mood, number> = {
  idle: 0.12,
  talking: 0.05,
  pointing: 0.05,
  thinking: 0.2,
  celebrating: 0,
  worried: 0,
  sleeping: 1,
  covering: 0.3,
  peeking: 0,
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

/** Margen del lienzo alrededor de la caja 200×250 del viewBox, para brazos arriba y gorro. */
export const CANVAS_MARGIN = { left: 90, right: 90, top: 120, bottom: 20 };

export class JoseController {
  readonly stage: JoseStage;
  mood: Mood = 'idle';
  /** Estado de pose animable directamente con GSAP (escenas hero). */
  readonly rig: Rig;
  private moodTl?: gsap.core.Timeline;
  private loops: gsap.core.Animation[] = [];
  private talkCall?: gsap.core.Tween;
  private talking = false;
  private holdLook = false;
  private lastPointer = 0;
  private poseName: PoseName = 'rest';
  private pointAngle = 0;
  private dead = false;

  constructor(host: HTMLElement, opts: StageOptions = {}) {
    this.stage = new JoseStage(host, {
      transparent: true,
      framing: 'app',
      margin: CANVAS_MARGIN,
      smoke: false,
      reducedMotion: motion.reduced,
      ...opts,
    });
    this.rig = this.stage.rig;
    this.stage.start();
    this.setMood('idle');
  }

  // ---------- coordenadas ----------
  /** Punto del viewBox SVG 200×250 (pies en y=244) → pantalla, siguiendo el cuerpo. */
  svgToScreen(x: number, y: number) {
    const v = new THREE.Vector3((x - 100) / SVG_K, (244 - y) / SVG_K, 0);
    this.stage.jose.root.updateWorldMatrix(true, false);
    return this.stage.worldToScreen(this.stage.jose.root.localToWorld(v));
  }
  emberScreen() {
    const e = this.stage.jose.ember;
    e.updateWorldMatrix(true, false);
    return this.stage.worldToScreen(e.getWorldPosition(new THREE.Vector3()));
  }
  hatScreenRect() {
    const box = new THREE.Box3().setFromObject(this.stage.jose.hat);
    const a = this.stage.worldToScreen(new THREE.Vector3(box.min.x, box.max.y, box.max.z));
    const b = this.stage.worldToScreen(new THREE.Vector3(box.max.x, box.min.y, box.max.z));
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  }
  setResolutionScale(s: number) {
    this.stage.setResolutionScale(s);
  }

  // ---------- poses ----------
  pose(name: PoseName, duration = 0.45, ease = 'back.out(1.6)') {
    this.poseName = name;
    const p = POSES[name];
    const d = motion.reduced ? Math.min(duration, 0.2) : duration;
    gsap.to(this.rig, { armLz: p.Lz, armLx: p.Lx, armRz: p.Rz, armRx: p.Rx, duration: d, ease, overwrite: 'auto' });
  }

  /** Pose manual (escenas hero): corta el ánimo actual. */
  holdPose(name: PoseName, duration = 0.45) {
    this.moodTl?.kill();
    this.killLoops();
    this.pose(name, duration);
  }

  private mouthTo(m: MouthName) {
    this.rig.mouth = m;
  }

  face(mouth: MouthName, lids?: number) {
    this.mouthTo(mouth);
    if (lids !== undefined) gsap.to(this.rig, { lid: lids, duration: 0.2, overwrite: 'auto' });
  }

  setHat(visible: boolean) {
    if (visible) gsap.fromTo(this.rig, { hat: 0.3 }, { hat: 1, duration: 0.6, ease: 'back.out(2.2)' });
    else {
      gsap.killTweensOf(this.rig, 'hat');
      this.rig.hat = 0;
    }
  }

  private killLoops() {
    this.loops.forEach((l) => l.kill());
    this.loops = [];
  }

  setMood(mood: Mood, opts: { target?: { x: number; y: number } } = {}) {
    if (this.dead) return;
    const prev = this.mood;
    this.mood = mood;
    this.moodTl?.kill();
    this.killLoops();
    const r = this.rig;
    const R = motion.reduced;
    const tl = (this.moodTl = gsap.timeline());
    this.holdLook = false;

    tl.to(r, { hop: 0, stretch: 1, lean: 0, turn: 0, jitter: 0, sway: 1, browLift: 0, browTilt: 0, lid: LIDS[mood], duration: 0.35, ease: 'power2.out', overwrite: 'auto' }, 0);
    if (!this.talking) this.mouthTo(MOUTHS[mood]);

    if (mood === 'pointing' && opts.target) {
      // brazo del lado del objetivo, apuntando en el plano de la pantalla
      const sR = this.svgToScreen(140, 150);
      const sL = this.svgToScreen(60, 150);
      const right = opts.target.x >= (sR.x + sL.x) / 2 - 10;
      const s = right ? sR : sL;
      const dx = opts.target.x - s.x;
      const dyUp = -(opts.target.y - s.y);
      // rotar (0,-1) por a da (sin a, -cos a) → a = atan2(dx, -dyUp)
      let a = Math.atan2(dx, -dyUp);
      a = right ? gsap.utils.clamp(0.4, 2.6, a) : gsap.utils.clamp(-2.6, -0.4, a);
      this.pointAngle = a;
      this.poseName = 'point';
      const d = R ? 0.2 : 0.5;
      if (right) tl.to(r, { armRz: a, armRx: -0.25, armLz: -0.12, armLx: 0, duration: d, ease: 'back.out(2)' }, 0);
      else tl.to(r, { armLz: a, armLx: -0.25, armRz: 0.12, armRx: 0, duration: d, ease: 'back.out(2)' }, 0);
      tl.to(r, { browLift: 0.015, duration: 0.3 }, 0);
      this.lookAt(opts.target.x, opts.target.y, true);
      this.holdLook = true;
      if (!R) {
        const k = right ? 1 : -1;
        this.loops.push(gsap.to(r, { [right ? 'armRz' : 'armLz']: `+=${0.08 * k}`, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.6 }));
      }
    } else {
      this.pose(POSE_FOR[mood]);
    }

    switch (mood) {
      case 'thinking':
        this.holdLook = true;
        r.lookX = 0.5;
        r.lookY = -0.7;
        tl.to(r, { browTilt: -0.15, browLift: 0.01, duration: 0.3 }, 0);
        if (!R) this.loops.push(gsap.to(r, { lean: -0.05, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.2 }));
        break;
      case 'celebrating': {
        tl.to(r, { browLift: 0.03, flare: 0.6, duration: 0.25 }, 0);
        if (R) break;
        const hop = gsap
          .timeline({ repeat: -1, repeatDelay: 0.08, delay: 0.15 })
          .to(r, { stretch: 0.85, duration: 0.12, ease: 'power2.in' })
          .to(r, { stretch: 1.1, hop: 0.3, duration: 0.26, ease: 'power2.out' })
          .to(r, { stretch: 1, hop: 0, duration: 0.22, ease: 'power2.in' })
          .to(r, { stretch: 0.88, duration: 0.07 })
          .to(r, { stretch: 1, duration: 0.3, ease: 'elastic.out(1.2,0.4)' });
        this.loops.push(
          hop,
          gsap.to(r, { armLz: '-=0.25', duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.3 }),
          gsap.to(r, { armRz: '+=0.25', duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.42 }),
        );
        break;
      }
      case 'worried':
        tl.to(r, { browTilt: -0.35, browLift: 0.012, flare: -0.2, duration: 0.3 }, 0);
        if (!R) this.loops.push(gsap.to(r, { jitter: 0.012, duration: 0.6, yoyo: true, repeat: -1, repeatDelay: 1.4, delay: 0.3 }));
        break;
      case 'sleeping':
        this.holdLook = true;
        r.lookX = 0;
        r.lookY = 0.5;
        tl.to(r, { browLift: -0.01, sway: 0.3, flare: -0.4, duration: 0.6 }, 0);
        if (!R) this.loops.push(gsap.to(r, { lean: 0.07, stretch: 0.97, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
        break;
      case 'covering':
        this.holdLook = true;
        tl.to(r, { flare: 0.4, duration: 0.6 }, 0);
        if (!R) this.loops.push(gsap.to(r, { jitter: 0.008, duration: 0.5, repeat: -1, delay: 0.4 }));
        break;
      case 'peeking':
        this.holdLook = true;
        r.lookX = 0;
        r.lookY = 0.3;
        if (!R) this.loops.push(gsap.to(r, { lean: -0.04, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.2 }));
        break;
      default:
        tl.to(r, { flare: 0, duration: 0.4 }, 0);
    }
    if (prev === 'sleeping' && mood !== 'sleeping') this.react('startle');
  }

  /** Boca moviéndose mientras el texto aparece. */
  talk(on: boolean) {
    this.talking = on;
    this.talkCall?.kill();
    if (!on) {
      this.mouthTo(MOUTHS[this.mood]);
      return;
    }
    const shapes: MouthName[] = ['open', 'oh', 'smile', 'open', 'grin', 'open', 'smirk'];
    const step = () => {
      if (!this.talking || this.dead) return;
      this.mouthTo(shapes[Math.floor(Math.random() * shapes.length)]);
      this.talkCall = gsap.delayedCall(motion.reduced ? 0.2 : gsap.utils.random(0.08, 0.15), step);
    };
    step();
    if (!motion.reduced)
      gsap.fromTo(this.rig, { lean: -0.03 }, { lean: 0.03, duration: 0.4, ease: 'sine.inOut', yoyo: true, repeat: 3, onComplete: () => void gsap.to(this.rig, { lean: 0, duration: 0.3 }) });
  }

  lookAt(x: number, y: number, force = false) {
    if (this.dead || (this.holdLook && !force)) return;
    if (!force) this.lastPointer = performance.now();
    const c = this.svgToScreen(100, 96);
    const dx = x - c.x;
    const dy = y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    this.rig.lookX = (dx / d) * k;
    this.rig.lookY = (dy / d) * k;
  }

  /** Mirar alrededor cuando nadie mueve el puntero. */
  idleLook() {
    if (this.holdLook || this.dead || motion.reduced) return;
    if (performance.now() - this.lastPointer < 3000) return;
    if (this.mood !== 'idle' && this.mood !== 'talking') return;
    this.rig.lookX = gsap.utils.random(-1, 1);
    this.rig.lookY = gsap.utils.random(-0.7, 0.7);
  }

  blink() {
    this.stage.blink();
  }

  react(rx: Reaction) {
    if (this.dead) return;
    const r = this.rig;
    const R = motion.reduced;
    switch (rx) {
      case 'tickle':
        gsap
          .timeline()
          .to(r, { stretch: 0.85, duration: 0.1, ease: 'power2.in' })
          .to(r, { stretch: 1, duration: 0.6, ease: 'elastic.out(1.3,0.3)' });
        if (!R) gsap.fromTo(r, { lean: 0 }, { lean: 0.14, duration: 0.6, ease: 'shake' });
        this.mouthTo('grin');
        gsap.delayedCall(0.8, () => !this.talking && this.mouthTo(MOUTHS[this.mood]));
        break;
      case 'startle':
        gsap
          .timeline()
          .to(r, { hop: R ? 0 : 0.18, stretch: 1.1, duration: 0.15, ease: 'power2.out' })
          .to(r, { hop: 0, stretch: 1, duration: 0.5, ease: 'bounce.out' });
        gsap.fromTo(r, { lid: 0 }, { lid: LIDS[this.mood], duration: 0.8, delay: 0.3 });
        break;
      case 'peek':
        gsap
          .timeline()
          .to(r, { lean: R ? 0 : 0.2, turn: R ? 0 : 0.3, duration: 0.25, ease: 'power2.out' })
          .to(r, { lean: 0, turn: 0, duration: 0.8, ease: 'elastic.out(1,0.4)' }, '+=0.35');
        this.mouthTo('oh');
        gsap.delayedCall(0.9, () => !this.talking && this.mouthTo(MOUTHS[this.mood]));
        break;
      case 'flare':
        gsap.timeline().to(r, { flare: 1.2, duration: 0.25, ease: 'back.out(3)' }).to(r, { flare: 0, duration: 1.2, ease: 'power2.out' });
        break;
      case 'nod':
        gsap.timeline().to(r, { lean: -0.1, duration: 0.15 }).to(r, { lean: 0, duration: 0.6, ease: 'elastic.out(1,0.35)' });
        break;
    }
  }

  destroy() {
    this.dead = true;
    this.moodTl?.kill();
    this.talkCall?.kill();
    this.killLoops();
    gsap.killTweensOf(this.rig);
    this.stage.dispose();
  }

  get currentPose() {
    return this.poseName;
  }
  get angle() {
    return this.pointAngle;
  }
}
