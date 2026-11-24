import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { CustomEase } from 'gsap/CustomEase';
import { CustomWiggle } from 'gsap/CustomWiggle';
import { CustomBounce } from 'gsap/CustomBounce';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(
  useGSAP,
  Flip,
  CustomEase,
  CustomWiggle,
  CustomBounce,
  MorphSVGPlugin,
  DrawSVGPlugin,
  MotionPathPlugin,
  Physics2DPlugin,
  SplitText,
  ScrambleTextPlugin,
);

// Easings con carácter
CustomEase.create('pop', 'M0,0 C0.12,0.6 0.24,1.28 0.44,1.18 0.6,1.1 0.72,0.97 1,1');
CustomEase.create('anticipate', 'M0,0 C0.2,-0.18 0.38,-0.14 0.5,0.2 0.62,0.62 0.8,1.04 1,1');
CustomEase.create('suck', 'M0,0 C0.3,0 0.5,0.1 0.7,0.4 0.85,0.7 0.95,1 1,1');
CustomWiggle.create('shake', { wiggles: 6, type: 'easeOut' });
CustomWiggle.create('jitter', { wiggles: 12, type: 'uniform' });
CustomWiggle.create('shakeUp', { wiggles: 16, type: 'easeInOut' });
CustomBounce.create('landing', { strength: 0.55, squash: 2, squashID: 'landing-squash' });

gsap.defaults({ ease: 'back.out(1.6)', duration: 0.5 });

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export const motion = { reduced: !!mq?.matches };
mq?.addEventListener('change', (e) => (motion.reduced = e.matches));

export { gsap, useGSAP, Flip, SplitText, MorphSVGPlugin, DrawSVGPlugin, MotionPathPlugin };
