import { useRef, useState } from 'react';
import { gsap, prefersReduced, useGSAP } from '../anim/gsap';
import type { Wish } from '../api';

export function GiftThumb() {
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
      <rect x="8" y="20" width="32" height="22" rx="4" fill="#D62839" stroke="#3B2417" strokeWidth="2.5" />
      <rect x="21" y="20" width="6" height="22" fill="#F6C453" />
      <rect x="6" y="14" width="36" height="9" rx="3" fill="#E23548" stroke="#3B2417" strokeWidth="2.5" />
      <path d="M24 14c-6-10-14-6-10-2s10 2 10 2zM24 14c6-10 14-6 10-2s-10 2-10 2z" fill="#F6C453" stroke="#3B2417" strokeWidth="2" />
    </svg>
  );
}

export function WishCard({ w, onRemove, flipId, className = '' }: { w: Wish; onRemove?: () => void; flipId?: string; className?: string }) {
  const [imgOk, setImgOk] = useState(true);
  let host = '';
  try { host = new URL(w.url).hostname.replace(/^www\./, ''); } catch { /* noop */ }
  return (
    <article className={`wish-card ${className}`} data-flip-id={flipId ?? `wish-${w.id}`} data-wish={w.id}>
      <div className="wish-thumb">
        {w.image && imgOk ? <img src={w.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} /> : <GiftThumb />}
      </div>
      <div className="wish-body">
        <h3 className="wish-title">{w.title || w.site || host}</h3>
        <span className="wish-site">{w.site || host}</span>
        {w.note && <p className="wish-note">“{w.note}”</p>}
      </div>
      <div className="wish-actions">
        <a className="mini-btn" href={w.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir el link de ${w.title || host}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
        </a>
        {onRemove && (
          <button className="mini-btn mini-btn--danger" onClick={onRemove} aria-label={`Quitar ${w.title || host} de mi lista`}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>
          </button>
        )}
      </div>
    </article>
  );
}

/** Estado vacío con ilustración en movimiento. */
export function EmptyBox({ title, hint }: { title: string; hint?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.eb-draw', { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, stagger: 0.12, ease: 'power2.inOut' });
    gsap.to('.eb-lid', { y: -9, rotation: -7, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '30% 100%' });
    gsap.to('.eb-q', { y: -26, opacity: 0, scale: 1.3, duration: 2.4, stagger: 0.8, repeat: -1, ease: 'sine.out', transformOrigin: '50% 50%' });
    gsap.to('.eb-star', { scale: 1.4, opacity: 0.4, duration: 0.9, stagger: 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' });
    gsap.to('.eb-box', { y: 3, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }, { scope: root });
  return (
    <div className="empty" ref={root} data-pop>
      <svg viewBox="0 0 200 150" width="200" height="150" aria-hidden="true" overflow="visible">
        <g className="eb-box">
          <path className="eb-draw" d="M46 70 L46 128 Q46 134 52 134 L148 134 Q154 134 154 128 L154 70" fill="none" stroke="#FFF1D6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path className="eb-draw" d="M100 70 L100 134" fill="none" stroke="#F6C453" strokeWidth="5" strokeLinecap="round" />
          <g className="eb-lid">
            <path className="eb-draw" d="M38 58 L162 58 L162 74 L38 74 Z" fill="none" stroke="#FF6B2C" strokeWidth="5" strokeLinejoin="round" />
          </g>
        </g>
        {[[84, 40], [116, 34], [100, 22]].map(([x, y], i) => (
          <text key={i} className="eb-q" x={x} y={y} fontSize="26" fontWeight="800" fill="#F6C453" fontFamily="Baloo 2, sans-serif" textAnchor="middle">?</text>
        ))}
        {[[24, 40], [176, 52], [168, 14]].map(([x, y], i) => (
          <path key={i} className="eb-star" d={`M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z`} fill="#FFF1D6" />
        ))}
      </svg>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}

/** Cómo copiar un link desde una tienda (animado en bucle). */
export function HowTo() {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    gsap.set('.ht-token', { opacity: 0 });
    if (prefersReduced()) { gsap.set('.ht-token', { opacity: 1, x: 120 }); return; }
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
    tl.fromTo('.ht-draw', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, stagger: 0.08, ease: 'power2.inOut' })
      .fromTo('.ht-url', { fill: '#2A3F38' }, { fill: '#FFB347', duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '+=0.1')
      .fromTo('.ht-arrow', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, ease: 'power2.out' })
      .fromTo('.ht-token', { opacity: 0, x: 0, scale: 0.4 }, { opacity: 1, scale: 1, x: 118, duration: 0.9, ease: 'back.out(1.4)' }, '<0.1')
      .fromTo('.ht-input', { scaleX: 1 }, { scaleX: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%' })
      .fromTo('.ht-check', { drawSVG: '0%', opacity: 1 }, { drawSVG: '100%', duration: 0.4, ease: 'power2.out' })
      .to('.ht-token, .ht-check', { opacity: 0, duration: 0.3 }, '+=1.2');
  }, { scope: root });
  return (
    <svg ref={root} className="howto-svg" viewBox="0 0 330 150" role="img" aria-label="Dibujo: copias el link en la tienda y lo pegas aquí">
      <g fill="none" stroke="#FFF1D6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <rect className="ht-draw" x="14" y="8" width="96" height="134" rx="14" />
        <rect className="ht-draw" x="220" y="8" width="96" height="134" rx="14" />
        <path className="ht-draw" d="M36 64 H88 M36 78 H74 M36 92 H82" />
        <rect className="ht-draw" x="30" y="34" width="64" height="20" rx="6" stroke="#6FA8DC" />
      </g>
      <rect className="ht-url" x="36" y="40" width="40" height="8" rx="4" fill="#2A3F38" />
      <rect className="ht-input" x="234" y="52" width="68" height="26" rx="8" fill="none" stroke="#FFB347" strokeWidth="3.5" />
      <rect x="236" y="108" width="64" height="22" rx="8" fill="#FF6B2C" />
      <path className="ht-arrow" d="M118 66 Q165 30 212 66" fill="none" stroke="#F6C453" strokeWidth="4" strokeLinecap="round" strokeDasharray="1" />
      <g className="ht-token">
        <rect x="118" y="52" width="46" height="18" rx="9" fill="#FFB347" />
        <text x="141" y="65" fontSize="11" fontWeight="800" textAnchor="middle" fill="#1A0E08" fontFamily="Nunito, sans-serif">https://</text>
      </g>
      <path className="ht-check" d="M244 66 l8 8 l14 -16" fill="none" stroke="#7CC6A4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
    </svg>
  );
}
