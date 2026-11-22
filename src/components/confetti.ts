import { gsap, motion } from '../lib/gsap';

const COLORS = ['#E8443A', '#2E9E6E', '#FFC15E', '#FF8A3D', '#FFF3DD', '#7FB8FF', '#FF7FB0'];

/** Confeti con física (Physics2D): solo transform y opacity. */
export function confetti(x: number, y: number, opts: { count?: number; spread?: number; power?: number; angle?: number } = {}) {
  if (motion.reduced) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);
  const n = opts.count ?? 70;
  const spread = opts.spread ?? 70;
  const base = opts.angle ?? -90;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    const w = gsap.utils.random(6, 12);
    const round = Math.random() < 0.3;
    el.style.cssText = `width:${w}px;height:${round ? w : w * 0.45}px;background:${COLORS[i % COLORS.length]};border-radius:${round ? '50%' : '2px'}`;
    layer.appendChild(el);
    const life = gsap.utils.random(1.6, 2.6);
    gsap.set(el, { x, y, rotation: gsap.utils.random(0, 360) });
    gsap.to(el, {
      physics2D: {
        velocity: gsap.utils.random(320, 720) * (opts.power ?? 1),
        angle: base + gsap.utils.random(-spread, spread),
        gravity: 900,
        friction: 0.02,
      },
      rotation: `+=${gsap.utils.random(-720, 720)}`,
      rotationX: `+=${gsap.utils.random(360, 1080)}`,
      duration: life,
      ease: 'none',
    });
    gsap.to(el, { opacity: 0, duration: 0.5, delay: life - 0.5 });
  }
  gsap.delayedCall(2.8, () => layer.remove());
}

export function sparkle(x: number, y: number, n = 6, color = '#FFC15E') {
  if (motion.reduced) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'spark';
    el.style.background = color;
    layer.appendChild(el);
    const a = (i / n) * Math.PI * 2 + gsap.utils.random(-0.3, 0.3);
    const d = gsap.utils.random(22, 40);
    gsap.set(el, { x, y, scale: 1 });
    gsap.to(el, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0, duration: 0.55, ease: 'power3.out' });
  }
  gsap.delayedCall(0.7, () => layer.remove());
}
