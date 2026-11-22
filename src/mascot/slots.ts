/** Cada pantalla declara dónde "vive" José Miguel (su slot). La capa global lo mueve ahí. */
let current: HTMLElement | null = null;
const subs = new Set<() => void>();
export const setSlot = (el: HTMLElement | null) => {
  if (el === null && current === null) return;
  current = el;
  if (el) subs.forEach((f) => f());
};
export const clearSlot = (el: HTMLElement) => { if (current === el) current = null; };
export const getSlot = () => current;
export const onSlot = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
