import type { ReactNode } from 'react';

export function Screen({ children, cta, className }: { children: ReactNode; cta?: ReactNode; className?: string }) {
  return (
    <>
      <div className={`screen-scroll ${className ?? ''}`}>{children}</div>
      {cta && <footer className="screen-cta">{cta}</footer>}
    </>
  );
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'gold' | 'green' }) {
  return (
    <span className={`chip chip-${tone}`} data-anim="pop">
      {children}
    </span>
  );
}
