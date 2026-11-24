import { forwardRef } from 'react';
import { MOUTH, POSES } from './shapes';

/** José Miguel: personaje articulado en SVG. Cada parte se anima por separado. */
export const Rig = forwardRef<SVGSVGElement, { uid: string }>(function Rig({ uid }, ref) {
  const id = (s: string) => `${uid}-${s}`;
  return (
    <svg ref={ref} viewBox="0 0 200 250" className="jm-svg" aria-hidden="true" overflow="visible">
      <defs>
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor="#FFB347" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#FF7A2F" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FF7A2F" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('ember')} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#FFF2B0" />
          <stop offset="0.35" stopColor="#FFB547" />
          <stop offset="0.75" stopColor="#FF5A1F" />
          <stop offset="1" stopColor="#B8321A" />
        </radialGradient>
        <linearGradient id={id('paper')} x1="0" x2="1">
          <stop offset="0" stopColor="#F3E6CC" />
          <stop offset="0.35" stopColor="#FFF8EA" />
          <stop offset="1" stopColor="#E9D9BA" />
        </linearGradient>
        <pattern id={id('cork')} width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="9" height="9" fill="#E7B46A" />
          <circle cx="2.5" cy="2.5" r="1.2" fill="#C98E3F" />
          <circle cx="7" cy="6.5" r="1" fill="#D49A4C" />
        </pattern>
        <clipPath id={id('eyeL')}>
          <ellipse cx="86" cy="96" rx="11" ry="13" />
        </clipPath>
        <clipPath id={id('eyeR')}>
          <ellipse cx="114" cy="96" rx="11" ry="13" />
        </clipPath>
        <clipPath id={id('bodyclip')}>
          <path d="M65,48 Q65,40 73,40 L127,40 Q135,40 135,48 L127,205 Q127,215 117,215 L83,215 Q73,215 73,205 Z" />
        </clipPath>
      </defs>

      <ellipse data-p="shadow" cx="100" cy="244" rx="44" ry="6" fill="#000" opacity="0.28" />

      <g data-p="root">
      {/* piernas */}
      <g data-p="legL">
        <path d="M88,212 L84,236" stroke="#3B2A2A" strokeWidth="7" strokeLinecap="round" fill="none" />
        <ellipse cx="80" cy="240" rx="12" ry="6.5" fill="#B5302A" stroke="#3B2A2A" strokeWidth="2.5" />
      </g>
      <g data-p="legR">
        <path d="M112,212 L116,236" stroke="#3B2A2A" strokeWidth="7" strokeLinecap="round" fill="none" />
        <ellipse cx="120" cy="240" rx="12" ry="6.5" fill="#B5302A" stroke="#3B2A2A" strokeWidth="2.5" />
      </g>

      <g data-p="body">
        {/* brillo de la brasa detrás */}
        <circle data-p="glow" cx="88" cy="40" r="46" fill={`url(#${id('glow')})`} />

        {/* cuerpo de papel */}
        <path
          d="M65,48 Q65,40 73,40 L127,40 Q135,40 135,48 L127,205 Q127,215 117,215 L83,215 Q73,215 73,205 Z"
          fill={`url(#${id('paper')})`}
          stroke="#3B2A2A"
          strokeWidth="3"
        />
        <g clipPath={`url(#${id('bodyclip')})`}>
          <path d="M60,70 C90,62 110,80 140,72" stroke="#D9C6A2" strokeWidth="1.6" fill="none" />
          <path d="M60,168 C90,160 112,176 140,166" stroke="#D9C6A2" strokeWidth="1.6" fill="none" />
          <path d="M120,44 L112,210" stroke="#E8D7B6" strokeWidth="2" fill="none" />
          {/* filtro = "shorts" */}
          <rect x="60" y="182" width="80" height="40" fill={`url(#${id('cork')})`} />
          <path d="M60,182 L140,182" stroke="#3B2A2A" strokeWidth="2.5" />
        </g>
        <path
          d="M65,48 Q65,40 73,40 L127,40 Q135,40 135,48 L127,205 Q127,215 117,215 L83,215 Q73,215 73,205 Z"
          fill="none"
          stroke="#3B2A2A"
          strokeWidth="3"
        />

        {/* punta encendida */}
        <g data-p="tip">
          <ellipse cx="100" cy="43" rx="35" ry="8.5" fill="#6B5A57" stroke="#3B2A2A" strokeWidth="2.5" />
          <ellipse data-p="ember" cx="100" cy="42.5" rx="27" ry="5.6" fill={`url(#${id('ember')})`} />
          <circle data-p="spark1" cx="86" cy="41" r="1.6" fill="#FFF2B0" />
          <circle data-p="spark2" cx="108" cy="43" r="1.3" fill="#FFF2B0" />
        </g>

        {/* cara */}
        <g data-p="face">
          <ellipse cx="74" cy="112" rx="7" ry="4.5" fill="#FF8C8C" opacity="0.45" />
          <ellipse cx="126" cy="112" rx="7" ry="4.5" fill="#FF8C8C" opacity="0.45" />
          <g data-p="eyes">
            <ellipse cx="86" cy="96" rx="11" ry="13" fill="#fff" />
            <ellipse cx="114" cy="96" rx="11" ry="13" fill="#fff" />
            <g data-p="pupils">
              <circle cx="87" cy="98" r="5.6" fill="#2A1E1E" />
              <circle cx="115" cy="98" r="5.6" fill="#2A1E1E" />
              <circle cx="89" cy="95.5" r="1.8" fill="#fff" />
              <circle cx="117" cy="95.5" r="1.8" fill="#fff" />
            </g>
            <g clipPath={`url(#${id('eyeL')})`}>
              <g data-p="lidL">
                <ellipse cx="86" cy="96" rx="12.5" ry="14.5" fill="#F5E8CF" stroke="#3B2A2A" strokeWidth="2.5" />
              </g>
            </g>
            <g clipPath={`url(#${id('eyeR')})`}>
              <g data-p="lidR">
                <ellipse cx="114" cy="96" rx="12.5" ry="14.5" fill="#F5E8CF" stroke="#3B2A2A" strokeWidth="2.5" />
              </g>
            </g>
            <ellipse cx="86" cy="96" rx="11" ry="13" fill="none" stroke="#3B2A2A" strokeWidth="2.5" />
            <ellipse cx="114" cy="96" rx="11" ry="13" fill="none" stroke="#3B2A2A" strokeWidth="2.5" />
          </g>
          <path data-p="browL" d="M76,76 Q85,71 95,75" stroke="#3B2A2A" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path data-p="browR" d="M105,75 Q115,71 124,76" stroke="#3B2A2A" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path data-p="mouth" d={MOUTH.smile} fill="#7A2626" stroke="#3B2A2A" strokeWidth="2.2" strokeLinejoin="round" />
        </g>

        {/* bufanda */}
        <g data-p="scarf">
          <path d="M67,142 C88,150 112,150 133,142 L132,156 C112,164 88,164 68,156 Z" fill="#2E9E6E" stroke="#3B2A2A" strokeWidth="2.5" />
          <path d="M80,147 L78,159 M96,149 L95,162 M112,149 L113,161" stroke="#E8443A" strokeWidth="4" />
          <g data-p="scarfTail">
            <path d="M118,152 C124,166 126,180 122,192 L134,190 C138,176 134,162 128,150 Z" fill="#2E9E6E" stroke="#3B2A2A" strokeWidth="2.5" />
            <path d="M122,186 L135,184" stroke="#E8443A" strokeWidth="4" />
          </g>
        </g>

        {/* gorro */}
        <g data-p="hat">
          <path d="M92,42 C96,12 132,0 160,16 C168,22 170,30 168,34 L150,36 C146,28 138,26 132,30 C130,34 134,40 140,44 Z" fill="#E8443A" stroke="#3B2A2A" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M104,26 C116,14 136,12 150,18" stroke="#FF7A6E" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
          <rect x="88" y="36" width="58" height="13" rx="6.5" fill="#FFF8EE" stroke="#3B2A2A" strokeWidth="2.5" transform="rotate(10 117 42)" />
          <g data-p="pompom">
            <circle cx="166" cy="38" r="9" fill="#FFF8EE" stroke="#3B2A2A" strokeWidth="2.5" />
          </g>
        </g>
      </g>

      {/* brazos (delante del cuerpo) */}
      <g data-p="armL">
        <path data-p="armLpath" d={POSES.rest.L.path} stroke="#3B2A2A" strokeWidth="6.5" strokeLinecap="round" fill="none" />
        <g data-p="handL">
          <path data-p="fingerL" d="M46,183 L35,181" stroke="#3B2A2A" strokeWidth="8" strokeLinecap="round" opacity="0" />
          <path data-p="fingerL2" d="M46,183 L35,181" stroke="#FFF8EE" strokeWidth="3.5" strokeLinecap="round" opacity="0" />
          <circle cx="48" cy="184" r="8.5" fill="#FFF8EE" stroke="#3B2A2A" strokeWidth="2.5" />
        </g>
      </g>
      <g data-p="armR">
        <path data-p="armRpath" d={POSES.rest.R.path} stroke="#3B2A2A" strokeWidth="6.5" strokeLinecap="round" fill="none" />
        <g data-p="handR">
          <path data-p="fingerR" d="M154,183 L165,181" stroke="#3B2A2A" strokeWidth="8" strokeLinecap="round" opacity="0" />
          <path data-p="fingerR2" d="M154,183 L165,181" stroke="#FFF8EE" strokeWidth="3.5" strokeLinecap="round" opacity="0" />
          <circle cx="152" cy="184" r="8.5" fill="#FFF8EE" stroke="#3B2A2A" strokeWidth="2.5" />
        </g>
      </g>
      </g>
    </svg>
  );
});
