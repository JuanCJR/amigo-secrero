import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { gsap, prefersReduced } from '../anim/gsap';
import { vibrate } from '../anim/fx';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown'> {
  variant?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  pulse?: boolean;
  children: ReactNode;
}

/** Botón con squash & stretch al presionar y onda de brasa. */
export function Button({ variant = 'primary', busy, pulse, children, className = '', disabled, ...rest }: Props) {
  const btn = useRef<HTMLButtonElement>(null);

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    vibrate(8);
    const el = btn.current!;
    if (prefersReduced()) return;
    gsap.to(el, { scaleX: 1.035, scaleY: 0.9, y: 3, duration: 0.12, ease: 'power2.out', overwrite: true });
    const r = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.left = `${e.clientX - r.left}px`;
    ripple.style.top = `${e.clientY - r.top}px`;
    el.appendChild(ripple);
    gsap.fromTo(ripple, { scale: 0, opacity: 0.55 }, {
      scale: 1, opacity: 0, duration: 0.65, ease: 'power2.out', onComplete: () => ripple.remove(),
    });
  };
  const up = () => {
    if (prefersReduced()) return;
    gsap.to(btn.current, { scaleX: 1, scaleY: 1, y: 0, duration: 0.7, ease: 'elastic.out(1.3,.35)', overwrite: true });
  };

  return (
    <span className={`btn-wrap ${pulse && !disabled && !busy ? 'btn-wrap--pulse' : ''}`}>
      <button
        ref={btn}
        className={`btn btn--${variant} ${className}`}
        disabled={disabled}
        aria-busy={busy || undefined}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        {...rest}
      >
        {busy ? <span className="dots" aria-label="Cargando"><i /><i /><i /></span> : children}
      </button>
    </span>
  );
}
