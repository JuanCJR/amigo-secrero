// Formas para MorphSVG (boca, brazos) y poses del rig de José Miguel.
export const MOUTH = {
  smile: 'M86,121 C92,129 108,129 114,121 C108,125 92,125 86,121 Z',
  open: 'M88,118 C90,136 110,136 112,118 C106,121 94,121 88,118 Z',
  oh: 'M94,123 C94,115 106,115 106,123 C106,131 94,131 94,123 Z',
  grin: 'M82,116 C86,142 114,142 118,116 C106,121 94,121 82,116 Z',
  frown: 'M88,129 C92,120 108,120 112,129 C106,125 94,125 88,129 Z',
  sleep: 'M95,124 C97,127 103,127 105,124 C103,125.5 97,125.5 95,124 Z',
  smirk: 'M88,123 C96,127 108,126 114,118 C108,123 96,124 88,123 Z',
};
export type MouthName = keyof typeof MOUTH;

type Arm = { path: string; hx: number; hy: number; rot?: number };
export interface Pose {
  L: Arm;
  R: Arm;
}
// mano en reposo: L (48,184) R (152,184) → hx/hy son desplazamientos desde ahí
export const POSES: Record<string, Pose> = {
  rest: {
    L: { path: 'M71,160 C62,166 52,172 48,182', hx: 0, hy: 0 },
    R: { path: 'M129,160 C138,166 148,172 152,182', hx: 0, hy: 0 },
  },
  wave: {
    L: { path: 'M71,160 C58,152 48,140 44,128', hx: -4, hy: -58 },
    R: { path: 'M129,160 C142,152 152,140 156,128', hx: 4, hy: -58 },
  },
  hold: {
    L: { path: 'M71,160 C68,170 72,180 82,186', hx: 34, hy: 2 },
    R: { path: 'M129,160 C132,170 128,180 118,186', hx: -34, hy: 2 },
  },
  raise: {
    L: { path: 'M71,160 C60,140 66,100 76,80', hx: 28, hy: -104 },
    R: { path: 'M129,160 C140,140 134,100 124,80', hx: -28, hy: -104 },
  },
  overhead: {
    L: { path: 'M71,160 C54,120 58,60 72,24', hx: 24, hy: -162 },
    R: { path: 'M129,160 C146,120 142,60 128,24', hx: -24, hy: -162 },
  },
  cover: {
    L: { path: 'M71,160 C56,132 70,104 86,98', hx: 38, hy: -86 },
    R: { path: 'M129,160 C144,132 130,104 114,98', hx: -38, hy: -86 },
  },
  peek: {
    L: { path: 'M71,160 C54,136 62,110 76,104', hx: 28, hy: -80 },
    R: { path: 'M129,160 C146,136 138,110 124,104', hx: -28, hy: -80 },
  },
  think: {
    L: { path: 'M71,160 C62,166 52,172 48,182', hx: 0, hy: 0 },
    R: { path: 'M129,160 C142,150 128,138 112,136', hx: -40, hy: -48 },
  },
  shrug: {
    L: { path: 'M71,160 C60,158 52,150 48,140', hx: 0, hy: -44 },
    R: { path: 'M129,160 C140,158 148,150 152,140', hx: 0, hy: -44 },
  },
  point: {
    L: { path: 'M71,160 C62,166 52,172 48,182', hx: 0, hy: 0 },
    R: { path: 'M129,160 C140,160 152,160 163,160', hx: 15, hy: -24 },
  },
};
export type PoseName = keyof typeof POSES;
