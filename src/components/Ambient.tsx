import { useEffect, useRef } from 'react';
import { gsap, prefersReduced, rand, useGSAP } from '../anim/gsap';
import { pointer } from '../anim/pointer';

const BOKEH = ['#FF6B2C', '#F6C453', '#D62839', '#7CC6A4', '#FFB347'];

/** Movimiento ambiental permanente: nieve con parallax + luces que respiran. */
export function Ambient() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const bok = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = cvs.current!;
    const ctx = c.getContext('2d')!;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    const flakes = Array.from({ length: 46 }, () => {
      const depth = rand(0.25, 1);
      return { x: rand(0, 1), y: rand(0, 1), r: 1 + depth * 2.6, v: 10 + depth * 38, ph: rand(0, 6.28), depth };
    });
    let ox = 0;
    const draw = (time: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.05);
      const reduced = prefersReduced();
      ox += ((reduced ? 0 : pointer.nx * 22) - ox) * Math.min(1, dt * 3);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        if (!reduced) {
          f.y += (f.v * dt) / h;
          if (f.y > 1.02) { f.y = -0.02; f.x = rand(0, 1); }
        }
        const x = f.x * w + Math.sin(time * 0.6 + f.ph) * 14 * f.depth + ox * f.depth;
        ctx.globalAlpha = 0.25 + f.depth * 0.55;
        ctx.fillStyle = '#FFF8EA';
        ctx.beginPath(); ctx.arc(x, f.y * h, f.r, 0, 6.283); ctx.fill();
      }
    };
    gsap.ticker.add(draw);
    return () => { gsap.ticker.remove(draw); window.removeEventListener('resize', resize); };
  }, []);

  useGSAP(() => {
    const items = gsap.utils.toArray<HTMLElement>('.bokeh');
    if (prefersReduced()) return;
    items.forEach((b, i) => {
      gsap.to(b, { y: `+=${rand(-50, 50)}`, x: `+=${rand(-30, 30)}`, duration: rand(7, 13), yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(b, { scale: rand(1.08, 1.3), opacity: `+=${rand(-0.05, 0.08)}`, duration: rand(3, 6), yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.3 });
    });
    const qx = gsap.quickTo(bok.current, 'x', { duration: 1.2, ease: 'power3.out' });
    const qy = gsap.quickTo(bok.current, 'y', { duration: 1.2, ease: 'power3.out' });
    const move = () => { qx(-pointer.nx * 26); qy(-pointer.ny * 18); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, { scope: bok });

  return (
    <div className="ambient" aria-hidden="true">
      <div className="bokeh-layer" ref={bok}>
        {Array.from({ length: 9 }, (_, i) => {
          const s = 90 + ((i * 53) % 150);
          return (
            <span
              key={i}
              className="bokeh"
              style={{
                width: s, height: s, left: `${(i * 37 + 8) % 100}%`, top: `${(i * 23 + 6) % 96}%`,
                background: `radial-gradient(circle, ${BOKEH[i % BOKEH.length]}55 0%, ${BOKEH[i % BOKEH.length]}00 68%)`,
                opacity: 0.55,
              }}
            />
          );
        })}
      </div>
      <canvas ref={cvs} className="snow" />
    </div>
  );
}
