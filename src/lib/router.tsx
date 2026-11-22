import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, Flip, motion } from './gsap';

interface RouterApi {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}
const Ctx = createContext<RouterApi>({ path: '/', navigate: () => {} });
export const useRouter = () => useContext(Ctx);

export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** Anima la entrada de los elementos [data-anim] que aún no han entrado. */
export function enterIn(root: Element | null, skip: Set<string> = new Set(), delay = 0) {
  if (!root) return;
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-anim]:not([data-entered])')).filter(
    (el) => !skip.has(el.dataset.flipId || '__'),
  );
  els.forEach((el) => (el.dataset.entered = '1'));
  root.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => (el.dataset.entered = '1'));
  if (!els.length) return;
  if (motion.reduced) {
    gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out', stagger: 0.03, delay });
    return;
  }
  const pops = els.filter((e) => (e.dataset.anim || 'pop') === 'pop');
  const drops = els.filter((e) => e.dataset.anim === 'drop');
  const rises = els.filter((e) => e.dataset.anim === 'rise');
  if (pops.length)
    gsap.fromTo(
      pops,
      { opacity: 0, y: 36, scale: 0.72, rotation: () => gsap.utils.random(-7, 7) },
      { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.1)', stagger: 0.06, delay, clearProps: 'transform' },
    );
  if (drops.length)
    gsap.fromTo(
      drops,
      { opacity: 0, y: -70, scaleY: 1.2, scaleX: 0.9 },
      { opacity: 1, y: 0, scaleY: 1, scaleX: 1, duration: 0.9, ease: 'landing', stagger: 0.08, delay, clearProps: 'transform' },
    );
  if (rises.length)
    gsap.fromTo(
      rises,
      { opacity: 0, y: 80, scaleY: 0.6, scaleX: 1.15, transformOrigin: '50% 100%' },
      { opacity: 1, y: 0, scaleY: 1, scaleX: 1, duration: 0.8, ease: 'elastic.out(1,0.55)', stagger: 0.07, delay: delay + 0.15, clearProps: 'transform' },
    );
}

export function Router({ children }: { children: (path: string) => ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);
  const pending = useRef<{ state: Flip.FlipState; ids: Set<string> } | null>(null);
  const busy = useRef(false);

  const go = useCallback(async (to: string, push: boolean | 'replace') => {
    if (busy.current) return;
    busy.current = true;
    const scope = document.querySelector('.screen');
    const shared = scope ? Array.from(scope.querySelectorAll<HTMLElement>('[data-flip-id]')) : [];
    const ids = new Set(shared.map((e) => e.dataset.flipId!));
    const state = Flip.getState(shared, { props: 'borderRadius' });
    if (scope) {
      const exits = Array.from(scope.querySelectorAll<HTMLElement>('[data-anim]')).filter((e) => !e.dataset.flipId);
      // los elementos que se van son "absorbidos" hacia el humo de José
      const holder = document.querySelector('.jm-holder')?.getBoundingClientRect();
      const hx = holder ? holder.left + holder.width / 2 : 0;
      const hy = holder ? holder.top : 0;
      await new Promise<void>((resolve) => {
        if (!exits.length) return resolve();
        if (motion.reduced) {
          gsap.to(exits, { opacity: 0, duration: 0.12, onComplete: resolve });
          return;
        }
        gsap.to(exits, {
          x: (_i, el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            return (hx - (r.left + r.width / 2)) * 0.35;
          },
          y: (_i, el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            return (hy - (r.top + r.height / 2)) * 0.35;
          },
          scale: 0.4,
          rotation: () => gsap.utils.random(-25, 25),
          opacity: 0,
          duration: 0.3,
          ease: 'suck',
          stagger: { each: 0.025, from: 'end' },
          onComplete: resolve,
        });
        // seguridad: nunca bloquear
        window.setTimeout(resolve, 600);
      });
    }
    pending.current = { state, ids };
    if (push === 'replace') history.replaceState(null, '', to);
    else if (push) history.pushState(null, '', to);
    window.scrollTo(0, 0);
    setPath(to);
    busy.current = false;
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (to === window.location.pathname) return;
    go(to, opts?.replace ? 'replace' : true);
  }, [go]);

  useEffect(() => {
    const onPop = () => go(window.location.pathname, false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [go]);

  useLayoutEffect(() => {
    const scope = document.querySelector('.screen');
    const p = pending.current;
    pending.current = null;
    const matched = new Set<string>();
    if (scope && p) {
      const targets = Array.from(scope.querySelectorAll<HTMLElement>('[data-flip-id]')).filter((e) => p.ids.has(e.dataset.flipId!));
      targets.forEach((t) => matched.add(t.dataset.flipId!));
      if (targets.length)
        Flip.from(p.state, {
          targets,
          duration: motion.reduced ? 0.01 : 0.75,
          ease: 'back.out(1.25)',
          absolute: true,
          zIndex: 30,
          scale: true,
          props: 'borderRadius',
          onComplete: () => targets.forEach((t) => gsap.set(t, { clearProps: 'zIndex' })),
        });
    }
    enterIn(scope, matched, p ? 0.05 : 0.2);
  }, [path]);

  return <Ctx.Provider value={{ path, navigate }}>{children(path)}</Ctx.Provider>;
}
