import { useRef } from 'react';
import { gsap, prefersReduced, useGSAP } from '../anim/gsap';

const BULB = ['#FF6B2C', '#F6C453', '#D62839', '#7CC6A4', '#6FA8DC', '#B58BE0'];

/** Indicador de paso en forma de guirnalda: cada paso cumplido enciende una luz. */
export function Stepper({ step, total, label, onBack, right }: {
  step: number; total: number; label: string; onBack?: () => void; right?: React.ReactNode;
}) {
  const root = useRef<SVGSVGElement>(null);
  const prev = useRef(0);

  useGSAP(() => {
    const bulbs = gsap.utils.toArray<SVGGElement>('.bulb', root.current!);
    const glows = gsap.utils.toArray<SVGElement>('.bulb-glow', root.current!);
    bulbs.forEach((b, i) => {
      const lit = i < step;
      const wasLit = i < prev.current;
      gsap.set(b.querySelector('.bulb-on'), { opacity: lit ? 1 : 0 });
      if (lit && !wasLit && !prefersReduced()) {
        gsap.fromTo(b, { scale: 0.4, svgOrigin: undefined, transformOrigin: '50% 0%' },
          { scale: 1, duration: 1.1, ease: 'elastic.out(1.4,.3)', delay: 0.35 + i * 0.05 });
        gsap.fromTo(glows[i], { scale: 0.2, opacity: 1 }, { scale: 2.4, opacity: 0, duration: 0.9, ease: 'power2.out', delay: 0.35 });
      }
    });
    if (!prefersReduced()) {
      glows.forEach((g, i) => {
        if (i < step) gsap.to(g, { opacity: 0.55, scale: 1.25, duration: 0.9 + (i % 3) * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 1.4 + i * 0.2, transformOrigin: '50% 50%' });
        else gsap.set(g, { opacity: 0 });
      });
    } else {
      glows.forEach((g, i) => gsap.set(g, { opacity: i < step ? 0.5 : 0 }));
    }
    prev.current = step;
  }, { dependencies: [step, total], scope: root });

  const xs = Array.from({ length: total }, (_, i) => (total === 1 ? 150 : 22 + (i * 256) / (total - 1)));
  const yAt = (x: number) => { const t = x / 300; return 6 + 50 * t * (1 - t); };

  return (
    <header className="stepper">
      <div className="stepper-side">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Volver al paso anterior">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
      </div>
      <div className="stepper-mid">
        <svg ref={root} viewBox="0 0 300 52" className="garland" role="img" aria-label={step > 0 ? `Paso ${step} de ${total}: ${label}` : label}>
          <path d="M0 6 Q150 56 300 6" fill="none" stroke="#3E5A4F" strokeWidth="2.5" />
          {xs.map((x, i) => {
            const y = yAt(x) + 2;
            const c = BULB[i % BULB.length];
            return (
              <g key={i} className="bulb" transform={`translate(${x} ${y})`}>
                <circle className="bulb-glow" r="13" cy="10" fill={c} opacity="0" />
                <rect x="-3.5" y="0" width="7" height="6" rx="2" fill="#4b5f57" />
                <ellipse cx="0" cy="11" rx="6.5" ry="8.5" fill="#26403a" stroke="#3E5A4F" strokeWidth="1.5" />
                <ellipse className="bulb-on" cx="0" cy="11" rx="6.5" ry="8.5" fill={c} opacity="0" />
              </g>
            );
          })}
        </svg>
        <div className="step-label" aria-hidden="true">{step > 0 ? `Paso ${step} de ${total} · ${label}` : label}</div>
      </div>
      <div className="stepper-side stepper-side--right">{right}</div>
    </header>
  );
}
