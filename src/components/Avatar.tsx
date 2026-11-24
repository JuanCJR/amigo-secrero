import { memo, useRef } from 'react';
import { gsap, useGSAP, motion } from '../lib/gsap';

function hash(s: string) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const BG = ['#FFD5C2', '#C7E8D5', '#FFE7A8', '#D7D2FF', '#FFC9DE', '#BDE3F2', '#F6D1A8', '#D9EEB8'];
const SKIN = ['#FDDCC4', '#F4C49A', '#E0A577', '#C68459', '#9C6440', '#6E4528'];
const HAIR = ['#2B1D16', '#5A3721', '#8C5A2B', '#D9A24E', '#B23A2A', '#1F1F2E', '#9A9A9A', '#F2D27A'];
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

/** Avatar aleatorio a partir de una semilla (pelo, piel, accesorio navideño). */
export const Avatar = memo(function Avatar({ seed, size = 64, alive = true, className }: { seed: string; size?: number; alive?: boolean; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const r = hash(seed);
  const bg = pick(r, BG);
  const skin = pick(r, SKIN);
  const hairC = pick(r, HAIR);
  const hair = Math.floor(r() * 6);
  const acc = Math.floor(r() * 6);
  const mouth = Math.floor(r() * 3);
  const eyes = Math.floor(r() * 3);

  useGSAP(
    () => {
      if (!alive || motion.reduced) return;
      const lids = ref.current!.querySelectorAll('.av-eye');
      const blink = (): void => {
        gsap
          .timeline({ delay: gsap.utils.random(1.5, 6), onComplete: blink })
          .to(lids, { scaleY: 0.1, duration: 0.06, transformOrigin: '50% 50%' })
          .to(lids, { scaleY: 1, duration: 0.12 });
      };
      blink();
      gsap.to(ref.current!.querySelector('.av-head'), {
        y: -1.5,
        rotation: () => gsap.utils.random(-4, 4),
        duration: gsap.utils.random(1.4, 2.2),
        yoyo: true,
        repeat: -1,
        repeatRefresh: true,
        ease: 'sine.inOut',
        svgOrigin: '50 90',
      });
    },
    { scope: ref, dependencies: [seed, alive] },
  );

  return (
    <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} className={`avatar ${className ?? ''}`} aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill={bg} />
      <g className="av-head">
        <path d="M30,100 C30,80 70,80 70,100 Z" fill={pick(r, ['#E8443A', '#2E9E6E', '#3A5BD9', '#F2A93B'])} />
        <rect x="44" y="74" width="12" height="10" fill={skin} />
        {hair === 1 && <path d="M22,58 C18,30 36,22 50,22 C66,22 82,30 78,60 L80,82 C72,72 74,52 70,44 C60,40 40,40 30,44 C26,52 28,72 20,82 Z" fill={hairC} />}
        <circle cx="50" cy="56" r="26" fill={skin} />
        <circle cx="24.5" cy="58" r="4.5" fill={skin} />
        <circle cx="75.5" cy="58" r="4.5" fill={skin} />
        {hair === 0 && <path d="M24,54 C22,30 40,24 52,26 C66,26 80,34 76,54 C72,42 60,38 50,40 C40,40 28,44 24,54 Z" fill={hairC} />}
        {hair === 1 && <path d="M24,52 C26,32 40,28 50,28 C62,28 76,34 76,52 C68,42 58,40 50,40 C40,40 30,44 24,52 Z" fill={hairC} />}
        {hair === 2 && (
          <g fill={hairC}>
            {[
              [29, 44],
              [36, 35],
              [46, 30],
              [56, 30],
              [65, 35],
              [72, 44],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="9" />
            ))}
          </g>
        )}
        {hair === 3 && <path d="M24,52 L27,32 L36,40 L41,24 L50,37 L58,23 L63,38 L73,30 L76,52 C66,42 34,42 24,52 Z" fill={hairC} />}
        {hair === 4 && (
          <g fill={hairC}>
            <path d="M24,54 C22,30 40,24 52,26 C66,26 80,34 76,54 C72,42 60,38 50,40 C40,40 28,44 24,54 Z" />
            <circle cx="50" cy="22" r="10" />
          </g>
        )}
        {/* ojos */}
        {eyes === 2 ? (
          <g stroke="#2A1E1E" strokeWidth="3" strokeLinecap="round" fill="none">
            <path className="av-eye" d="M36,57 Q41,52 46,57" />
            <path className="av-eye" d="M54,57 Q59,52 64,57" />
          </g>
        ) : (
          <g fill="#2A1E1E">
            <ellipse className="av-eye" cx="41" cy="56" rx={eyes ? 3.2 : 3.8} ry={eyes ? 4.4 : 3.8} />
            <ellipse className="av-eye" cx="59" cy="56" rx={eyes ? 3.2 : 3.8} ry={eyes ? 4.4 : 3.8} />
          </g>
        )}
        <ellipse cx="35" cy="65" rx="4.5" ry="2.8" fill="#FF8C8C" opacity="0.5" />
        <ellipse cx="65" cy="65" rx="4.5" ry="2.8" fill="#FF8C8C" opacity="0.5" />
        {mouth === 0 && <path d="M42,66 Q50,74 58,66" stroke="#2A1E1E" strokeWidth="3" fill="none" strokeLinecap="round" />}
        {mouth === 1 && <path d="M41,65 Q50,78 59,65 Z" fill="#7A2626" />}
        {mouth === 2 && <ellipse cx="50" cy="68" rx="4" ry="4.5" fill="#7A2626" />}
        {/* accesorios navideños */}
        {acc === 0 && (
          <g>
            <path d="M26,40 C30,16 58,8 74,20 C80,26 84,30 84,36 L72,36 C68,30 62,30 74,40 Z" fill="#E8443A" />
            <rect x="22" y="34" width="56" height="10" rx="5" fill="#FFF8EE" />
            <circle cx="82" cy="38" r="6" fill="#FFF8EE" />
          </g>
        )}
        {acc === 1 && (
          <g stroke="#8C5A2B" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M34,34 L28,14 M30,22 L20,18 M29,18 L34,10" />
            <path d="M66,34 L72,14 M70,22 L80,18 M71,18 L66,10" />
          </g>
        )}
        {acc === 2 && (
          <g>
            <path d="M24,40 C30,30 70,30 76,40 L60,4 Z" fill="#2E9E6E" />
            <rect x="22" y="36" width="56" height="8" rx="4" fill="#E8443A" />
            <circle cx="60" cy="5" r="4" fill="#FFC15E" />
          </g>
        )}
        {acc === 3 && (
          <g stroke="#2A1E1E" strokeWidth="2.5" fill="rgba(255,255,255,0.25)">
            <circle cx="41" cy="56" r="8" />
            <circle cx="59" cy="56" r="8" />
            <path d="M49,56 L51,56" />
          </g>
        )}
        {acc === 4 && (
          <g>
            <path d="M24,44 C24,22 76,22 76,44 Z" fill={pick(r, ['#3A5BD9', '#E8443A', '#2E9E6E'])} />
            <rect x="22" y="40" width="56" height="8" rx="4" fill="#FFF8EE" />
            <circle cx="50" cy="22" r="5" fill="#FFF8EE" />
          </g>
        )}
      </g>
    </svg>
  );
});
