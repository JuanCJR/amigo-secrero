import { memo } from 'react';

const INK = '#3B2417';
const PAPER = '#FBEBC8';

/** Cada parte articulada está dibujada en coordenadas absolutas del viewBox;
 *  el controlador les fija el pivote con svgOrigin. */
function Limb({ d, w = 8 }: { d: string; w?: number }) {
  return (
    <>
      <path d={d} stroke={INK} strokeWidth={w + 7} strokeLinecap="round" fill="none" />
      <path d={d} stroke={PAPER} strokeWidth={w} strokeLinecap="round" fill="none" />
    </>
  );
}

export const Rig = memo(function Rig() {
  return (
    <svg
      className="jm-svg"
      viewBox="45 0 210 440"
      overflow="visible"
      role="img"
      aria-label="José Miguel, el porro navideño que te guía"
      focusable="false"
    >
      <defs>
        <linearGradient id="jmPaper" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFF9EA" />
          <stop offset=".55" stopColor="#FBEBC8" />
          <stop offset="1" stopColor="#E9D1A0" />
        </linearGradient>
        <radialGradient id="jmGlow">
          <stop offset="0" stopColor="#FFC15E" stopOpacity=".95" />
          <stop offset=".4" stopColor="#FF6B2C" stopOpacity=".5" />
          <stop offset="1" stopColor="#FF6B2C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="jmEmber">
          <stop offset="0" stopColor="#FFE9A0" />
          <stop offset=".5" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#D8431B" />
        </radialGradient>
        <radialGradient id="jmSmoke">
          <stop offset="0" stopColor="#F2F6F2" stopOpacity=".8" />
          <stop offset=".6" stopColor="#D5DDD7" stopOpacity=".35" />
          <stop offset="1" stopColor="#CFD8D2" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="jm-shadow" cx="150" cy="414" rx="62" ry="9" fill="#000" opacity=".32" />

      <g className="jm-look">
        <g className="jm-root">
          {/* piernas */}
          <g className="jm-legL">
            <Limb d="M133 346 L128 396" w={9} />
            <ellipse cx="121" cy="404" rx="19" ry="9" fill="#6B3A22" stroke={INK} strokeWidth="3.5" />
          </g>
          <g className="jm-legR">
            <Limb d="M167 346 L172 396" w={9} />
            <ellipse cx="179" cy="404" rx="19" ry="9" fill="#6B3A22" stroke={INK} strokeWidth="3.5" />
          </g>

          {/* cuerpo */}
          <g className="jm-body">
            <path
              d="M98 136 C98 124 110 118 150 118 C190 118 202 124 202 136 L189 334 C188 348 174 354 150 354 C126 354 112 348 111 334 Z"
              fill="url(#jmPaper)" stroke={INK} strokeWidth="4" strokeLinejoin="round"
            />
            <path d="M108 152 C140 178 150 244 187 340" stroke="#B98F5A" strokeOpacity=".4" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx="150" cy="122" rx="51" ry="11" fill="#E8D0A0" stroke={INK} strokeWidth="4" />

            <circle className="jm-glow" cx="176" cy="114" r="54" fill="url(#jmGlow)" />
            <g className="jm-ember">
              <ellipse cx="176" cy="120" rx="26" ry="7.5" fill="#5E4A3E" stroke={INK} strokeWidth="3" />
              <ellipse cx="176" cy="119" rx="19" ry="5" fill="url(#jmEmber)" />
            </g>

            {/* cara */}
            <g className="jm-face">
              <ellipse cx="108" cy="228" rx="11" ry="7" fill="#FF8F7E" opacity=".55" />
              <ellipse cx="192" cy="228" rx="11" ry="7" fill="#FF8F7E" opacity=".55" />

              <g className="jm-eyeL">
                <ellipse cx="127" cy="203" rx="15" ry="19" fill="#fff" stroke={INK} strokeWidth="3.5" />
                <g className="jm-pupilL">
                  <circle cx="127" cy="205" r="8.5" fill={INK} />
                  <circle cx="130" cy="201" r="2.8" fill="#fff" />
                </g>
                <ellipse className="jm-lidL" cx="127" cy="203" rx="15.5" ry="19.5" fill="#F7E6C0" stroke={INK} strokeWidth="3.5" />
                <path className="jm-arc" d="M113 207 Q127 221 141 207" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0" />
              </g>
              <g className="jm-eyeR">
                <ellipse cx="173" cy="203" rx="15" ry="19" fill="#fff" stroke={INK} strokeWidth="3.5" />
                <g className="jm-pupilR">
                  <circle cx="173" cy="205" r="8.5" fill={INK} />
                  <circle cx="176" cy="201" r="2.8" fill="#fff" />
                </g>
                <ellipse className="jm-lidR" cx="173" cy="203" rx="15.5" ry="19.5" fill="#F7E6C0" stroke={INK} strokeWidth="3.5" />
                <path className="jm-arc" d="M159 207 Q173 221 187 207" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0" />
              </g>

              <path className="jm-browL" d="M111 176 Q127 167 143 176" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
              <path className="jm-browR" d="M157 176 Q173 167 189 176" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />

              <path
                className="jm-mouth"
                d="M128 238 C140 247 160 247 172 238 C160 253 140 253 128 238 Z"
                fill="#6B1F1A" stroke={INK} strokeWidth="3.5" strokeLinejoin="round"
              />
              <path className="jm-sweat" d="M212 172 C205 184 205 193 212 195 C219 193 219 184 212 172 Z" fill="#9FD8FF" stroke={INK} strokeWidth="2.5" opacity="0" />
            </g>

            {/* bufanda */}
            <g className="jm-scarf">
              <path d="M99 270 C130 287 170 287 201 270 L202 297 C170 315 130 315 98 297 Z" fill="#D62839" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <path d="M121 281 L119 304 M144 287 L143 311 M168 287 L169 311 M190 280 L192 303" stroke="#FFF1D6" strokeWidth="5" strokeLinecap="round" opacity=".92" />
            </g>
            <g className="jm-tail">
              <path d="M176 298 L206 296 L213 350 L184 355 Z" fill="#D62839" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <path d="M180 318 L209 316 M182 334 L211 332" stroke="#FFF1D6" strokeWidth="5" strokeLinecap="round" opacity=".92" />
              <path d="M188 355 L187 365 M196 354 L196 364 M204 353 L205 362" stroke="#D62839" strokeWidth="4" strokeLinecap="round" />
            </g>
          </g>

          {/* brazos */}
          <g className="jm-armL">
            <Limb d="M104 262 L88 296" w={8} />
            <g className="jm-foreL">
              <Limb d="M88 296 L86 328" w={8} />
              <circle cx="86" cy="335" r="11" fill={PAPER} stroke={INK} strokeWidth="3.5" />
            </g>
          </g>
          <g className="jm-armR">
            <Limb d="M196 262 L212 296" w={8} />
            <g className="jm-foreR">
              <Limb d="M212 296 L214 328" w={8} />
              <circle cx="214" cy="335" r="11" fill={PAPER} stroke={INK} strokeWidth="3.5" />
            </g>
          </g>

          {/* gorro de viejito pascuero (ladeado, lejos de la brasa) */}
          <g className="jm-hat">
            <path d="M80 124 C80 86 94 56 120 36 C142 54 152 92 148 124 Z" fill="#D62839" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <g className="jm-pom">
              <circle cx="120" cy="31" r="13" fill="#FFFDF5" stroke={INK} strokeWidth="4" />
            </g>
            <rect x="72" y="120" width="80" height="22" rx="11" fill="#FFFDF5" stroke={INK} strokeWidth="4" />
          </g>

          {/* humo */}
          <g className="jm-smoke">
            {Array.from({ length: 7 }, (_, i) => (
              <circle key={i} className="jm-puff" cx="176" cy="108" r="17" fill="url(#jmSmoke)" opacity="0" />
            ))}
          </g>
          <g className="jm-zzz" opacity="0">
            <text className="jm-z1" x="206" y="126" fontSize="30" fontWeight="800" fill="#DDE6E0" fontFamily="Baloo 2, sans-serif">Z</text>
            <text className="jm-z2" x="222" y="98" fontSize="24" fontWeight="800" fill="#DDE6E0" fontFamily="Baloo 2, sans-serif">z</text>
            <text className="jm-z3" x="234" y="76" fontSize="18" fontWeight="800" fill="#DDE6E0" fontFamily="Baloo 2, sans-serif">z</text>
          </g>
        </g>
      </g>
    </svg>
  );
});
