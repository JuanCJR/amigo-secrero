import { createContext, useContext, useRef, type ReactNode } from 'react';
import { gsap, prefersReduced, rand, useGSAP } from '../anim/gsap';
import { Guide, type Msg } from '../mascot/Guide';
import type { JMState } from '../mascot/controller';
import { Stepper } from './Stepper';

export const RightCtx = createContext<ReactNode>(null);

/** Pantalla tipo asistente: guirnalda de pasos, José Miguel, una sola acción principal. */
export function Screen({ step, total, label, onBack, msg, base, bubbleOnly, children, footer, right, className = '', onTyped }: {
  step: number; total: number; label: string; onBack?: () => void; msg: Msg; base?: JMState; bubbleOnly?: boolean;
  children?: ReactNode; footer?: ReactNode; right?: ReactNode; className?: string; onTyped?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ctxRight = useContext(RightCtx);

  useGSAP(() => {
    if (prefersReduced()) return;
    const els = gsap.utils.toArray<HTMLElement>('[data-pop]', root.current!);
    if (els.length) gsap.from(els, {
      scale: 0.82, y: 46, rotation: () => rand(-3.5, 3.5), opacity: 0, duration: 0.85, stagger: 0.07,
      ease: 'back.out(1.8)', delay: 0.12, clearProps: 'transform,opacity',
    });
    if (root.current!.querySelector('.screen-foot > *')) gsap.from('.screen-foot > *', { y: 90, scale: 0.9, duration: 0.9, ease: 'back.out(1.6)', delay: 0.35, clearProps: 'transform' });
  }, { scope: root });

  return (
    <div className={`screen ${className}`} ref={root}>
      <Stepper step={step} total={total} label={label} onBack={onBack} right={right ?? ctxRight} />
      <Guide msg={msg} base={base} bubbleOnly={bubbleOnly} onTyped={onTyped} />
      <main className="screen-main">{children}</main>
      {footer && <footer className="screen-foot">{footer}</footer>}
    </div>
  );
}
