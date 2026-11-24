import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap, motion } from '../lib/gsap';

/** Confirmación: la tarjeta cae con rebote; José (arriba) explica. */
export function Dialog({ open, children, onClose }: { open: boolean; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const card = ref.current.querySelector('.dialog-card');
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    if (!motion.reduced)
      gsap.fromTo(card, { y: -260, rotation: -6, scaleY: 1.15 }, { y: 0, rotation: 0, scaleY: 1, duration: 1, ease: 'landing' });
    (ref.current.querySelector('button') as HTMLButtonElement | null)?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog" ref={ref} role="dialog" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="dialog-scrim" onClick={onClose} />
      <div className="dialog-card">{children}</div>
    </div>
  );
}
