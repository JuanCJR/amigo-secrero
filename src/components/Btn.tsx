import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { gsap, motion } from '../lib/gsap';
import { sparkle } from './confetti';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  /** se ve deshabilitado pero al tocarlo tiembla y José explica por qué */
  blocked?: boolean;
  onBlocked?: () => void;
  busy?: boolean;
  icon?: ReactNode;
  flipId?: string;
  anim?: string | false;
};

/** Botón con squash & stretch al presionar y rebote elástico al soltar. */
export const Btn = forwardRef<HTMLButtonElement, Props>(function Btn(
  { variant = 'primary', blocked, onBlocked, busy, icon, children, className, onClick, flipId, anim = 'rise', ...rest },
  fref,
) {
  const local = useRef<HTMLButtonElement | null>(null);
  const setRef = (el: HTMLButtonElement | null) => {
    local.current = el;
    if (typeof fref === 'function') fref(el);
    else if (fref) fref.current = el;
  };
  const down = () => {
    if (motion.reduced || !local.current) return;
    gsap.to(local.current, { scaleX: 1.05, scaleY: 0.9, duration: 0.1, ease: 'power2.out', overwrite: 'auto' });
  };
  const up = () => {
    if (motion.reduced || !local.current) return;
    gsap.to(local.current, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1.3,0.35)', overwrite: 'auto' });
  };
  return (
    <button
      ref={setRef}
      type="button"
      className={`btn btn-${variant} ${blocked ? 'is-blocked' : ''} ${busy ? 'is-busy' : ''} ${className ?? ''}`}
      aria-disabled={blocked || busy || undefined}
      data-flip-id={flipId}
      data-anim={anim || undefined}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onClick={(e) => {
        if (busy) return;
        if (blocked) {
          if (!motion.reduced) gsap.fromTo(local.current, { x: 0 }, { x: 10, duration: 0.5, ease: 'shake', clearProps: 'x' });
          onBlocked?.();
          return;
        }
        const r = local.current!.getBoundingClientRect();
        sparkle(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2, 7, variant === 'primary' ? '#FFC15E' : '#FFF3DD');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      <span className="btn-label">{children}</span>
      {busy && (
        <span className="btn-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  );
});
