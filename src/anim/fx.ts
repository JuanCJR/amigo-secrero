import { gsap, prefersReduced, rand } from './gsap';

/** Partículas de celebración en un solo canvas (confeti, brasas, destellos). */
type Kind = 0 | 1 | 2; // 0 confeti, 1 brasa, 2 destello
interface P {
  x: number; y: number; vx: number; vy: number;
  r: number; vr: number; w: number; h: number;
  c: string; life: number; max: number; kind: Kind;
  phase: number; g: number; drag: number;
}
const COLORS = ['#FFB347', '#FF6B2C', '#D62839', '#F6C453', '#FFF1D6', '#7CC6A4', '#6FA8DC'];

class FX {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  ps: P[] = [];
  running = false;
  dpr = 1;
  w = 0;
  h = 0;

  mount() {
    if (this.canvas) return;
    const c = document.createElement('canvas');
    c.className = 'fx-canvas';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }
  private start() {
    if (this.running) return;
    this.running = true;
    gsap.ticker.add(this.tick);
  }
  private tick = (_t: number, dtMs: number) => {
    const dt = Math.min(dtMs / 1000, 0.05);
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const keep: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k; p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.phase += dt * 9;
      if (p.y > this.h + 40) continue;
      const left = p.max - p.life;
      ctx.globalAlpha = left < 0.5 ? left / 0.5 : 1;
      ctx.fillStyle = p.c;
      const cos = Math.cos(p.r) * dpr, sin = Math.sin(p.r) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
      if (p.kind === 0) {
        ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.phase), p.w, p.h * Math.cos(p.phase));
      } else if (p.kind === 1) {
        const s = 1 - p.life / p.max;
        ctx.beginPath(); ctx.arc(0, 0, p.w * (0.4 + s), 0, 6.283); ctx.fill();
      } else {
        const s = p.w * (0.6 + 0.4 * Math.sin(p.phase));
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.28, -s * 0.28); ctx.lineTo(s, 0); ctx.lineTo(s * 0.28, s * 0.28);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.28, s * 0.28); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.28, -s * 0.28);
        ctx.closePath(); ctx.fill();
      }
      keep.push(p);
    }
    this.ps = keep;
    ctx.globalAlpha = 1;
    if (!keep.length) {
      gsap.ticker.remove(this.tick);
      this.running = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  private push(p: Partial<P>) {
    if (this.ps.length > 420) return;
    this.ps.push({
      x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, w: 8, h: 12, c: '#fff', life: 0, max: 2.5,
      kind: 0, phase: rand(0, 6), g: 900, drag: 0.985, ...p,
    });
  }

  confetti(x: number, y: number, o: { count?: number; angle?: number; spread?: number; power?: number } = {}) {
    this.mount();
    const reduced = prefersReduced();
    const count = Math.round((o.count ?? 80) * (reduced ? 0.15 : 1));
    const angle = o.angle ?? -Math.PI / 2;
    const spread = o.spread ?? Math.PI * 0.9;
    const power = o.power ?? 720;
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const v = rand(power * 0.35, power);
      this.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(0, 6), vr: reduced ? 0 : rand(-9, 9),
        w: rand(6, 11), h: rand(8, 15), c: COLORS[(Math.random() * COLORS.length) | 0],
        max: rand(2.2, 3.6), g: 820, drag: 0.982,
      });
    }
    this.start();
  }
  embers(x: number, y: number, count = 18) {
    this.mount();
    if (prefersReduced()) count = Math.round(count * 0.2);
    for (let i = 0; i < count; i++) {
      this.push({
        kind: 1, x: x + rand(-14, 14), y, vx: rand(-60, 60), vy: rand(-260, -90),
        w: rand(2.4, 5), c: Math.random() < 0.5 ? '#FFB347' : '#FF6B2C', max: rand(0.9, 1.8), g: -40, drag: 0.99,
      });
    }
    this.start();
  }
  sparkle(x: number, y: number, count = 10, spread = 60) {
    this.mount();
    if (prefersReduced()) count = Math.min(count, 4);
    for (let i = 0; i < count; i++) {
      const a = rand(0, 6.283), v = rand(30, 160);
      this.push({
        kind: 2, x: x + rand(-spread, spread) * 0.3, y: y + rand(-spread, spread) * 0.3,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, w: rand(5, 11), c: Math.random() < 0.6 ? '#F6C453' : '#FFF1D6',
        max: rand(0.7, 1.4), g: 120, drag: 0.96, vr: rand(-3, 3),
      });
    }
    this.start();
  }
  /** Lluvia de confeti desde arriba (cierres grandes). */
  rain(count = 70) {
    this.mount();
    const reduced = prefersReduced();
    for (let i = 0; i < (reduced ? 6 : count); i++) {
      this.push({
        x: rand(0, this.w), y: rand(-80, -10), vx: rand(-60, 60), vy: rand(60, 240), r: rand(0, 6),
        vr: reduced ? 0 : rand(-6, 6), w: rand(6, 10), h: rand(8, 14), c: COLORS[(Math.random() * COLORS.length) | 0],
        max: rand(3, 4.5), g: 120, drag: 0.992,
      });
    }
    this.start();
  }
}

export const fx = new FX();
export const centerOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
};
export const vibrate = (ms: number | number[]) => {
  try { if (!prefersReduced()) navigator.vibrate?.(ms); } catch { /* noop */ }
};
