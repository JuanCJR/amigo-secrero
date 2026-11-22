/** Puntero/toque global (para parallax y para que José Miguel mire al usuario). */
type Cb = () => void;
export const pointer = {
  x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
  y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  nx: 0,
  ny: 0,
  last: 0, // ms de la última interacción real
};
const subs = new Set<Cb>();
const activity = new Set<Cb>();
export const onPointer = (cb: Cb) => { subs.add(cb); return () => subs.delete(cb); };
export const onActivity = (cb: Cb) => { activity.add(cb); return () => activity.delete(cb); };

if (typeof window !== 'undefined') {
  let raf = 0;
  const move = (e: PointerEvent | TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : (e as PointerEvent);
    if (!p) return;
    pointer.x = p.clientX;
    pointer.y = p.clientY;
    pointer.nx = (p.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = (p.clientY / window.innerHeight) * 2 - 1;
    pointer.last = Date.now();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; subs.forEach((f) => f()); });
  };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', move, { passive: true });
  window.addEventListener('touchmove', move, { passive: true });
  const act = () => { pointer.last = Date.now(); activity.forEach((f) => f()); };
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => window.addEventListener(ev, act, { passive: true }));
}
