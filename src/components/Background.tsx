import { useEffect, useRef } from 'react';
import { gsap, motion } from '../lib/gsap';

/** Fondo vivo: nieve + brasas en canvas, cerros y pinos con parallax según puntero/inclinación. */
export function Background() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const far = useRef<HTMLDivElement>(null);
  const near = useRef<HTMLDivElement>(null);
  const stars = useRef<SVGGElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const N = motion.reduced ? 18 : Math.min((navigator.hardwareConcurrency || 8) <= 4 ? 35 : 60, Math.round((w * h) / 9000));
    const flakes = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.2 + 0.6,
      s: Math.random() * 0.5 + 0.25,
      p: Math.random() * Math.PI * 2,
      ember: Math.random() < 0.14,
    }));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX / w - 0.5;
      pointer.ty = e.clientY / h - 0.5;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      pointer.tx = gsap.utils.clamp(-0.5, 0.5, e.gamma / 60);
      pointer.ty = gsap.utils.clamp(-0.5, 0.5, (e.beta - 45) / 80);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    const setFarX = gsap.quickSetter(far.current, 'x', 'px');
    const setNearX = gsap.quickSetter(near.current, 'x', 'px');
    const setFarY = gsap.quickSetter(far.current, 'y', 'px');
    const setNearY = gsap.quickSetter(near.current, 'y', 'px');

    const tick = (_t: number, dt: number) => {
      const k = Math.min(dt, 50) / 16.67;
      pointer.x += (pointer.tx - pointer.x) * 0.05 * k;
      pointer.y += (pointer.ty - pointer.y) * 0.05 * k;
      if (!motion.reduced) {
        setFarX(pointer.x * -10);
        setNearX(pointer.x * -26);
        setFarY(pointer.y * -4);
        setNearY(pointer.y * -8);
      }
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        if (!motion.reduced) {
          f.p += 0.015 * k;
          if (f.ember) {
            f.y -= f.s * 0.8 * k;
            f.x += Math.sin(f.p * 1.6) * 0.4 * k - pointer.x * 0.4;
          } else {
            f.y += f.s * k;
            f.x += Math.sin(f.p) * 0.35 * k - pointer.x * 0.8 * f.r * 0.3;
          }
          if (f.y > h + 6) (f.y = -6), (f.x = Math.random() * w);
          if (f.y < -6) (f.y = h + 6), (f.x = Math.random() * w);
          if (f.x > w + 6) f.x = -6;
          if (f.x < -6) f.x = w + 6;
        }
        ctx.beginPath();
        if (f.ember) {
          ctx.fillStyle = `rgba(255,${140 + Math.round(Math.sin(f.p * 3) * 40)},60,${0.55 + Math.sin(f.p * 2) * 0.3})`;
          ctx.arc(f.x, f.y, f.r * 0.8, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = `rgba(255,255,255,${0.35 + f.r * 0.15})`;
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    };
    gsap.ticker.add(tick);
    const tw =
      !motion.reduced && stars.current
        ? gsap.to(stars.current.children, {
            opacity: () => gsap.utils.random(0.2, 1),
            scale: () => gsap.utils.random(0.6, 1.3),
            transformOrigin: '50% 50%',
            duration: () => gsap.utils.random(0.8, 2),
            repeat: -1,
            repeatRefresh: true,
            stagger: { each: 0.15, from: 'random' },
            ease: 'sine.inOut',
          })
        : null;
    return () => {
      gsap.ticker.remove(tick);
      tw?.kill();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      <svg className="bg-stars" viewBox="0 0 400 300" preserveAspectRatio="xMidYMin slice">
        <g ref={stars} fill="#FFF3DD">
          {[
            [30, 40], [80, 90], [140, 30], [200, 70], [260, 25], [330, 60], [370, 110], [110, 150], [300, 140], [50, 190], [230, 170], [180, 120],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} />
          ))}
        </g>
        <circle cx="330" cy="50" r="18" fill="#FFF3DD" opacity="0.9" />
        <circle cx="338" cy="44" r="16" fill="#151A2E" />
      </svg>
      <div className="bg-layer bg-far" ref={far}>
        <svg viewBox="0 0 400 120" preserveAspectRatio="none">
          <path d="M0,70 C60,40 110,60 170,45 C230,30 300,65 400,40 L400,120 L0,120 Z" fill="#1E2747" />
        </svg>
      </div>
      <canvas ref={canvas} className="bg-canvas" />
      <div className="bg-layer bg-near" ref={near}>
        <svg viewBox="0 0 400 90" preserveAspectRatio="none">
          <path d="M-20,60 C60,30 140,70 220,50 C300,30 360,55 420,45 L420,90 L-20,90 Z" fill="#26305A" />
          {[30, 70, 330, 370].map((x, i) => (
            <path key={i} d={`M${x},${48 - (i % 2) * 6} l-12,24 h7 l-9,16 h28 l-9,-16 h7 z`} fill="#1B5C47" />
          ))}
        </svg>
      </div>
    </div>
  );
}
