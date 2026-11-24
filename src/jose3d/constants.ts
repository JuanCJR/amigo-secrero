// Tipos y constantes de José que no dependen de three.js (se cargan con la app;
// el modelo 3D llega después con import()).
import type { MouthShape } from './model';

export type Mood = 'idle' | 'talking' | 'pointing' | 'thinking' | 'celebrating' | 'worried' | 'sleeping' | 'covering' | 'peeking';
export type Reaction = 'tickle' | 'startle' | 'peek' | 'flare' | 'nod';
export type PoseName = 'rest' | 'wave' | 'hold' | 'raise' | 'overhead' | 'cover' | 'peek' | 'think' | 'shrug' | 'point';
export type MouthName = MouthShape;

/** Cuánto humo suelta según el ánimo (lo usa JoseProvider). */
export const SMOKE_RATE: Record<Mood, number> = {
  idle: 1,
  talking: 0.8,
  pointing: 0.8,
  thinking: 2.2,
  celebrating: 3,
  worried: 0.4,
  sleeping: 0.5,
  covering: 1.4,
  peeking: 1.2,
};

/** Margen del lienzo alrededor de la caja 200×250 del viewBox, para brazos arriba y gorro. */
export const CANVAS_MARGIN = { left: 90, right: 90, top: 120, bottom: 20 };

