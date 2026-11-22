import { useEffect, useRef } from 'react';
import { gsap, prefersReduced } from '../anim/gsap';
import { Rig } from './Rig';
import { jm } from './controller';
import { getSlot, onSlot } from './slots';

const BASE_W = 240;
const BASE_H = (BASE_W * 440) / 210;

/** Capa fija: un solo José Miguel que viaja entre pantallas (solo transform). */
export function MascotLayer() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = layer.current!;
    const svg = el.querySelector('svg') as SVGSVGElement;
    jm.attach(svg);
    gsap.set(el, { transformOrigin: '0 0', opacity: 0, x: 0, y: 0 });
    let placed = false;
    let ro: ResizeObserver | null = null;
    let watched: HTMLElement | null = null;

    const place = (animate: boolean) => {
      const slot = getSlot();
      if (!slot) return;
      const r = slot.getBoundingClientRect();
      if (!r.width) return;
      const s = r.width / BASE_W;
      const vars = { x: r.left, y: r.top, scale: s };
      if (!placed) {
        placed = true;
        gsap.set(el, { ...vars, opacity: 1 });
        if (!prefersReduced()) {
          gsap.from(el, { y: r.top + 140, scale: s * 0.7, duration: 0.9, ease: 'back.out(1.6)' });
          jm.hop(1);
        }
      } else if (animate && !prefersReduced()) {
        jm.hop(0.8);
        gsap.to(el, { ...vars, duration: 0.8, ease: 'back.out(1.25)', overwrite: true });
      } else {
        gsap.killTweensOf(el, 'x,y,scale');
        gsap.set(el, vars);
      }
      if (watched !== slot) {
        ro?.disconnect();
        watched = slot;
        ro = new ResizeObserver(() => place(false));
        ro.observe(slot);
      }
    };

    const off = onSlot(() => {
      // esperar al layout de la pantalla nueva
      requestAnimationFrame(() => place(true));
      setTimeout(() => place(false), 450);
    });
    const onResize = () => place(false);
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(() => place(false));
    return () => { off(); window.removeEventListener('resize', onResize); ro?.disconnect(); jm.detach(); };
  }, []);

  return (
    <div
      ref={layer}
      className="jm-layer"
      style={{ width: BASE_W, height: BASE_H }}
      onPointerDown={() => { jm.poke(); window.dispatchEvent(new CustomEvent('jm:poke')); }}
    >
      <Rig />
    </div>
  );
}
