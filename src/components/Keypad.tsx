import { useRef } from 'react';
import { gsap, prefersReduced, useGSAP } from '../anim/gsap';
import { vibrate } from '../anim/fx';

/** Teclado numérico grande para la clave. */
export function Keypad({ value, length, onChange, shake, ok }: {
  value: string; length: number; onChange: (v: string) => void; shake: number; ok?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useGSAP(() => {
    if (first.current) { first.current = false; return; }
    if (!shake || prefersReduced()) return;
    gsap.fromTo('.pin-dots', { x: 0 }, { x: 16, duration: 0.7, ease: 'jmShake' });
    gsap.fromTo('.pin-dot', { backgroundColor: '#D62839' }, { backgroundColor: 'rgba(255,241,214,.14)', duration: 0.9 });
  }, { dependencies: [shake], scope: root });

  useGSAP(() => {
    if (!ok || prefersReduced()) return;
    gsap.to('.pin-dot', { scale: 1.5, duration: 0.35, stagger: 0.07, yoyo: true, repeat: 1, ease: 'back.out(3)', backgroundColor: '#F6C453' });
  }, { dependencies: [ok], scope: root });

  const press = (k: string, el: HTMLElement) => {
    vibrate(6);
    if (!prefersReduced()) {
      gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.55, ease: 'elastic.out(1.4,.35)', overwrite: true });
    }
    if (k === 'del') {
      onChange(value.slice(0, -1));
    } else if (value.length < length) {
      const next = value + k;
      onChange(next);
      if (!prefersReduced()) {
        const dot = root.current!.querySelectorAll('.pin-dot')[value.length];
        gsap.fromTo(dot, { scale: 0.2 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1.6,.4)' });
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div ref={root} className="keypad-wrap" data-pop>
      <div className="pin-dots" role="img" aria-label={`${value.length} de ${length} números escritos`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`pin-dot ${i < value.length ? 'pin-dot--on' : ''}`} />
        ))}
      </div>
      <div className="keypad">
        {keys.map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              className={`key ${k === 'del' ? 'key--del' : ''}`}
              aria-label={k === 'del' ? 'Borrar el último número' : k}
              onClick={(e) => press(k, e.currentTarget)}
            >
              {k === 'del' ? (
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" /><path d="M16 9l-5 6M11 9l5 6" /></svg>
              ) : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
