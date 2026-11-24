import { useRef } from 'react';
import { gsap, useGSAP, motion } from '../lib/gsap';

/** Estado vacío: caja abierta que respira, tapa flotando y trazos que se dibujan. */
export function EmptyGift({ label }: { label?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      gsap.from(q('.draw'), { drawSVG: '0%', duration: 1.2, stagger: 0.15, ease: 'power2.inOut' });
      if (motion.reduced) return;
      gsap.to(q('.lid'), { y: -10, rotation: -8, svgOrigin: '100 70', duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(q('.box'), { scaleY: 0.97, scaleX: 1.02, svgOrigin: '100 160', duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(q('.dash'), { drawSVG: '100% 100%', duration: 1.6, repeat: -1, ease: 'power1.inOut', stagger: 0.3 });
      gsap.to(q('.twinkle'), { scale: 0.3, opacity: 0.3, transformOrigin: '50% 50%', duration: 0.8, yoyo: true, repeat: -1, stagger: 0.25, ease: 'sine.inOut' });
    },
    { scope: ref },
  );
  return (
    <svg ref={ref} viewBox="0 0 200 170" className="illus" role="img" aria-label={label || 'Caja vacía'}>
      <g className="box">
        <path d="M50,92 L150,92 L142,160 L58,160 Z" fill="#FF5B3A" stroke="#111111" strokeWidth="3" strokeLinejoin="round" />
        <path d="M94,92 L106,92 L104,160 L96,160 Z" fill="#FFD447" />
        <path className="draw" d="M62,110 L138,110" stroke="#FF8C80" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="lid">
        <rect x="42" y="62" width="116" height="22" rx="5" fill="#FF6E4F" stroke="#111111" strokeWidth="3" />
        <rect x="93" y="62" width="14" height="22" fill="#FFD447" />
        <path className="draw" d="M100,62 C84,40 66,50 82,60 M100,62 C116,40 134,50 118,60" stroke="#FFD447" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      <path className="dash" d="M70,88 C60,60 40,50 30,30" stroke="#F5EFE2" strokeWidth="2.5" strokeDasharray="4 6" fill="none" />
      <path className="dash" d="M130,88 C140,60 160,50 172,28" stroke="#F5EFE2" strokeWidth="2.5" strokeDasharray="4 6" fill="none" />
      <circle className="twinkle" cx="30" cy="28" r="4" fill="#F5EFE2" />
      <circle className="twinkle" cx="172" cy="26" r="4" fill="#F5EFE2" />
      <circle className="twinkle" cx="100" cy="20" r="3" fill="#F5EFE2" />
    </svg>
  );
}

/** Mini tutorial animado: cómo copiar un link desde la app de una tienda. */
export function CopyLinkTutorial() {
  const ref = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      gsap.set(q('.sheet'), { y: 120 });
      gsap.set(q('.toast'), { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(q('.finger'), { x: 60, y: 60 });
      if (motion.reduced) {
        gsap.set(q('.sheet'), { y: 0 });
        return;
      }
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
      tl.to(q('.finger'), { x: 0, y: 0, duration: 0.8, ease: 'power2.inOut' })
        .to(q('.finger'), { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1, transformOrigin: '50% 50%' })
        .to(q('.share'), { scale: 1.3, duration: 0.15, yoyo: true, repeat: 1, transformOrigin: '50% 50%' }, '<')
        .to(q('.sheet'), { y: 0, duration: 0.5, ease: 'back.out(1.6)' })
        .to(q('.finger'), { x: -38, y: 64, duration: 0.6, ease: 'power2.inOut' })
        .to(q('.finger'), { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 })
        .to(q('.copy-row'), { fill: '#FFE3B0', duration: 0.1 }, '<')
        .to(q('.sheet'), { y: 120, duration: 0.4, ease: 'back.in(1.4)' }, '+=0.15')
        .to(q('.copy-row'), { fill: '#FFFFFF', duration: 0.1 })
        .to(q('.toast'), { scale: 1, duration: 0.45, ease: 'back.out(3)' })
        .to(q('.finger'), { x: 60, y: 60, duration: 0.6, ease: 'power2.in' }, '<')
        .to(q('.toast'), { scale: 0, duration: 0.3, ease: 'back.in(2)' }, '+=1');
    },
    { scope: ref },
  );
  return (
    <svg ref={ref} viewBox="0 0 160 200" className="tutorial" role="img" aria-label="Animación: en la tienda tocas Compartir y luego Copiar link">
      <rect x="20" y="6" width="120" height="188" rx="18" fill="#22294A" stroke="#C9C2DC" strokeWidth="3" />
      <clipPath id="tut-clip">
        <rect x="26" y="14" width="108" height="172" rx="12" />
      </clipPath>
      <g clipPath="url(#tut-clip)">
        <rect x="26" y="14" width="108" height="172" fill="#F5EFE2" />
        <rect x="36" y="26" width="88" height="70" rx="8" fill="#FFD5C2" />
        <path d="M60,80 L72,58 L84,72 L92,62 L106,80 Z" fill="#FF5B3A" opacity="0.7" />
        <rect x="36" y="104" width="70" height="8" rx="4" fill="#111111" opacity="0.7" />
        <rect x="36" y="118" width="44" height="8" rx="4" fill="#FFD447" />
        <g className="share">
          <circle cx="114" cy="122" r="11" fill="#FF5B3A" />
          <path d="M114,128 L114,116 M109,120 L114,115 L119,120" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="sheet">
          <rect x="26" y="130" width="108" height="60" rx="12" fill="#ECE6F6" />
          <rect className="copy-row" x="34" y="140" width="92" height="20" rx="6" fill="#FFFFFF" />
          <text x="44" y="154" fontSize="10" fontWeight="700" fill="#111111" fontFamily="Figtree Variable, sans-serif">Copiar link</text>
          <rect x="34" y="164" width="92" height="16" rx="6" fill="#FFFFFF" opacity="0.6" />
        </g>
        <g className="toast">
          <rect x="44" y="40" width="72" height="22" rx="11" fill="#FFD447" />
          <text x="80" y="55" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Figtree Variable, sans-serif">¡Copiado!</text>
        </g>
      </g>
      <g className="finger">
        <circle cx="114" cy="124" r="10" fill="#F4C49A" stroke="#111111" strokeWidth="2" opacity="0.95" />
      </g>
    </svg>
  );
}
